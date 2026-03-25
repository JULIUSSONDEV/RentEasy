const express = require('express');
const db = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/tenants - landlord sees tenants with active leases for their properties
router.get('/', authenticate, requireRole('landlord'), (req, res) => {
  const rows = db.prepare(`
    SELECT DISTINCT u.id, u.name, u.email, u.phone, u.created_at,
           l.id AS lease_id, l.property_id, l.start_date, l.end_date, l.monthly_rent, l.status AS lease_status,
           p.name AS property_name, p.address AS property_address
    FROM users u
    JOIN leases l ON l.tenant_id = u.id
    JOIN properties p ON l.property_id = p.id
    WHERE l.landlord_id = ?
    ORDER BY u.name
  `).all(req.user.id);
  res.json(rows);
});

// GET /api/tenants/:id - landlord gets a specific tenant
router.get('/:id', authenticate, requireRole('landlord'), (req, res) => {
  const tenant = db.prepare(`
    SELECT u.id, u.name, u.email, u.phone, u.created_at
    FROM users u
    WHERE u.id = ? AND u.role = 'tenant'
  `).get(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const leases = db.prepare(`
    SELECT l.*, p.name AS property_name, p.address AS property_address
    FROM leases l
    JOIN properties p ON l.property_id = p.id
    WHERE l.tenant_id = ? AND l.landlord_id = ?
    ORDER BY l.created_at DESC
  `).all(req.params.id, req.user.id);

  res.json({ ...tenant, leases });
});

// GET /api/tenants/search - search tenants by email (for landlords to add to a lease)
router.get('/search/by-email', authenticate, requireRole('landlord'), (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email query param is required' });

  const tenant = db.prepare(
    "SELECT id, name, email, phone FROM users WHERE email = ? AND role = 'tenant'"
  ).get(email);
  if (!tenant) return res.status(404).json({ error: 'No tenant found with that email' });

  res.json(tenant);
});

module.exports = router;
