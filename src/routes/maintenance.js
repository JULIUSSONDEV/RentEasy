const express = require('express');
const db = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/maintenance - landlord sees all theirs; tenant sees their own
router.get('/', authenticate, (req, res) => {
  let rows;
  if (req.user.role === 'landlord') {
    rows = db.prepare(`
      SELECT m.*, p.name AS property_name, p.address AS property_address,
             u.name AS tenant_name, u.email AS tenant_email
      FROM maintenance_requests m
      JOIN properties p ON m.property_id = p.id
      JOIN users u ON m.tenant_id = u.id
      WHERE m.landlord_id = ?
      ORDER BY m.created_at DESC
    `).all(req.user.id);
  } else {
    rows = db.prepare(`
      SELECT m.*, p.name AS property_name, p.address AS property_address
      FROM maintenance_requests m
      JOIN properties p ON m.property_id = p.id
      WHERE m.tenant_id = ?
      ORDER BY m.created_at DESC
    `).all(req.user.id);
  }
  res.json(rows);
});

// GET /api/maintenance/:id
router.get('/:id', authenticate, (req, res) => {
  const request = db.prepare('SELECT * FROM maintenance_requests WHERE id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Maintenance request not found' });

  if (req.user.role === 'landlord' && request.landlord_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (req.user.role === 'tenant' && request.tenant_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.json(request);
});

// POST /api/maintenance - tenant submits a maintenance request
router.post('/', authenticate, requireRole('tenant'), (req, res) => {
  const { property_id, title, description, priority } = req.body;
  if (!property_id || !title || !description) {
    return res.status(400).json({ error: 'property_id, title and description are required' });
  }

  const lease = db.prepare(
    "SELECT * FROM leases WHERE property_id = ? AND tenant_id = ? AND status = 'active'"
  ).get(property_id, req.user.id);
  if (!lease) {
    return res.status(403).json({ error: 'You do not have an active lease for this property' });
  }

  const result = db.prepare(`
    INSERT INTO maintenance_requests (property_id, tenant_id, landlord_id, title, description, priority)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(property_id, req.user.id, lease.landlord_id, title, description, priority || 'medium');

  const maint = db.prepare('SELECT * FROM maintenance_requests WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(maint);
});

// PUT /api/maintenance/:id - landlord updates status/resolution
router.put('/:id', authenticate, (req, res) => {
  const request = db.prepare('SELECT * FROM maintenance_requests WHERE id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Maintenance request not found' });

  if (req.user.role === 'landlord' && request.landlord_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (req.user.role === 'tenant' && request.tenant_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { status, priority, resolution_notes } = req.body;
  const now = new Date().toISOString().replace('T', ' ').split('.')[0];

  db.prepare(`
    UPDATE maintenance_requests SET
      status = COALESCE(?, status),
      priority = COALESCE(?, priority),
      resolution_notes = COALESCE(?, resolution_notes),
      updated_at = ?
    WHERE id = ?
  `).run(status, priority, resolution_notes, now, req.params.id);

  const updated = db.prepare('SELECT * FROM maintenance_requests WHERE id = ?').get(req.params.id);
  res.json(updated);
});

module.exports = router;
