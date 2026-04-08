const express = require('express');
const db = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/payments
router.get('/', authenticate, (req, res) => {
  let rows;
  if (req.user.role === 'landlord') {
    rows = db.prepare(`
      SELECT p.*, l.monthly_rent,
             prop.name AS property_name, prop.address AS property_address,
             u.name AS tenant_name, u.email AS tenant_email
      FROM payments p
      JOIN leases l ON p.lease_id = l.id
      JOIN properties prop ON l.property_id = prop.id
      JOIN users u ON p.tenant_id = u.id
      WHERE p.landlord_id = ?
      ORDER BY p.due_date DESC
    `).all(req.user.id);
  } else {
    rows = db.prepare(`
      SELECT p.*, l.monthly_rent,
             prop.name AS property_name, prop.address AS property_address
      FROM payments p
      JOIN leases l ON p.lease_id = l.id
      JOIN properties prop ON l.property_id = prop.id
      WHERE p.tenant_id = ?
      ORDER BY p.due_date DESC
    `).all(req.user.id);
  }
  res.json(rows);
});

// GET /api/payments/:id
router.get('/:id', authenticate, (req, res) => {
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  if (req.user.role === 'landlord' && payment.landlord_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (req.user.role === 'tenant' && payment.tenant_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.json(payment);
});

// POST /api/payments - landlord creates payment records
router.post('/', authenticate, requireRole('landlord'), (req, res) => {
  const { lease_id, amount, due_date, notes } = req.body;
  if (!lease_id || !amount || !due_date) {
    return res.status(400).json({ error: 'lease_id, amount and due_date are required' });
  }

  const lease = db.prepare('SELECT * FROM leases WHERE id = ? AND landlord_id = ?').get(lease_id, req.user.id);
  if (!lease) return res.status(404).json({ error: 'Lease not found' });

  const result = db.prepare(`
    INSERT INTO payments (lease_id, tenant_id, landlord_id, amount, due_date, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(lease_id, lease.tenant_id, req.user.id, amount, due_date, notes || null);

  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(payment);
});

// PUT /api/payments/:id - mark as paid (landlord) or update status
router.put('/:id', authenticate, requireRole('landlord'), (req, res) => {
  const payment = db.prepare('SELECT * FROM payments WHERE id = ? AND landlord_id = ?').get(req.params.id, req.user.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  const { status, paid_date, payment_method, notes } = req.body;
  const resolvedPaidDate = status === 'paid' ? (paid_date || new Date().toISOString().split('T')[0]) : paid_date;

  db.prepare(`
    UPDATE payments SET
      status = COALESCE(?, status),
      paid_date = COALESCE(?, paid_date),
      payment_method = COALESCE(?, payment_method),
      notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(status, resolvedPaidDate, payment_method, notes, req.params.id);

  const updated = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/payments/:id - landlord only
router.delete('/:id', authenticate, requireRole('landlord'), (req, res) => {
  const payment = db.prepare('SELECT * FROM payments WHERE id = ? AND landlord_id = ?').get(req.params.id, req.user.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  db.prepare('DELETE FROM payments WHERE id = ?').run(req.params.id);
  res.json({ message: 'Payment deleted' });
});

module.exports = router;
