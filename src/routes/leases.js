const express = require('express');
const db = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/leases - landlord sees all theirs; tenant sees their own
router.get('/', authenticate, (req, res) => {
  let rows;
  if (req.user.role === 'landlord') {
    rows = db.prepare(`
      SELECT l.*, p.name AS property_name, p.address AS property_address,
             u.name AS tenant_name, u.email AS tenant_email, u.phone AS tenant_phone
      FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN users u ON l.tenant_id = u.id
      WHERE l.landlord_id = ?
      ORDER BY l.created_at DESC
    `).all(req.user.id);
  } else {
    rows = db.prepare(`
      SELECT l.*, p.name AS property_name, p.address AS property_address,
             u.name AS landlord_name, u.email AS landlord_email, u.phone AS landlord_phone
      FROM leases l
      JOIN properties p ON l.property_id = p.id
      JOIN users u ON l.landlord_id = u.id
      WHERE l.tenant_id = ?
      ORDER BY l.created_at DESC
    `).all(req.user.id);
  }
  res.json(rows);
});

// GET /api/leases/:id
router.get('/:id', authenticate, (req, res) => {
  const lease = db.prepare(`
    SELECT l.*, p.name AS property_name, p.address AS property_address,
           t.name AS tenant_name, t.email AS tenant_email,
           ld.name AS landlord_name, ld.email AS landlord_email
    FROM leases l
    JOIN properties p ON l.property_id = p.id
    JOIN users t ON l.tenant_id = t.id
    JOIN users ld ON l.landlord_id = ld.id
    WHERE l.id = ?
  `).get(req.params.id);

  if (!lease) return res.status(404).json({ error: 'Lease not found' });

  if (req.user.role === 'landlord' && lease.landlord_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (req.user.role === 'tenant' && lease.tenant_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.json(lease);
});

// POST /api/leases - landlord only
router.post('/', authenticate, requireRole('landlord'), (req, res) => {
  const { property_id, tenant_id, start_date, end_date, monthly_rent, deposit, notes } = req.body;
  if (!property_id || !tenant_id || !start_date || !end_date || !monthly_rent) {
    return res.status(400).json({ error: 'property_id, tenant_id, start_date, end_date and monthly_rent are required' });
  }

  const property = db.prepare('SELECT * FROM properties WHERE id = ? AND landlord_id = ?').get(property_id, req.user.id);
  if (!property) return res.status(404).json({ error: 'Property not found or not owned by you' });

  const tenant = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'tenant'").get(tenant_id);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const existingActive = db.prepare(
    "SELECT id FROM leases WHERE property_id = ? AND status = 'active'"
  ).get(property_id);
  if (existingActive) {
    return res.status(409).json({ error: 'Property already has an active lease' });
  }

  const result = db.prepare(`
    INSERT INTO leases (property_id, tenant_id, landlord_id, start_date, end_date, monthly_rent, deposit, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(property_id, tenant_id, req.user.id, start_date, end_date, monthly_rent, deposit || 0, notes || null);

  db.prepare("UPDATE properties SET status = 'occupied' WHERE id = ?").run(property_id);

  const lease = db.prepare('SELECT * FROM leases WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(lease);
});

// PUT /api/leases/:id - landlord only
router.put('/:id', authenticate, requireRole('landlord'), (req, res) => {
  const lease = db.prepare('SELECT * FROM leases WHERE id = ? AND landlord_id = ?').get(req.params.id, req.user.id);
  if (!lease) return res.status(404).json({ error: 'Lease not found' });

  const { end_date, status, notes } = req.body;

  db.prepare(`
    UPDATE leases SET
      end_date = COALESCE(?, end_date),
      status = COALESCE(?, status),
      notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(end_date, status, notes, req.params.id);

  if (status && status !== 'active') {
    db.prepare("UPDATE properties SET status = 'available' WHERE id = ?").run(lease.property_id);
  }

  const updated = db.prepare('SELECT * FROM leases WHERE id = ?').get(req.params.id);
  res.json(updated);
});

module.exports = router;
