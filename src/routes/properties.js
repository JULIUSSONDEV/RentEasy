const express = require('express');
const db = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/properties - list properties
// Landlord sees their own; tenant sees available + their leased ones
router.get('/', authenticate, (req, res) => {
  let rows;
  if (req.user.role === 'landlord') {
    rows = db.prepare('SELECT * FROM properties WHERE landlord_id = ? ORDER BY created_at DESC').all(req.user.id);
  } else {
    rows = db.prepare(`
      SELECT p.* FROM properties p
      WHERE p.status = 'available'
      OR p.id IN (
        SELECT property_id FROM leases
        WHERE tenant_id = ? AND status = 'active'
      )
      ORDER BY p.created_at DESC
    `).all(req.user.id);
  }
  res.json(rows);
});

// GET /api/properties/:id
router.get('/:id', authenticate, (req, res) => {
  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });

  if (req.user.role === 'landlord' && property.landlord_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(property);
});

// POST /api/properties - landlord only
router.post('/', authenticate, requireRole('landlord'), (req, res) => {
  const { name, address, type, bedrooms, bathrooms, rent_amount, description } = req.body;
  if (!name || !address || !type || !rent_amount) {
    return res.status(400).json({ error: 'name, address, type and rent_amount are required' });
  }

  const result = db.prepare(`
    INSERT INTO properties (landlord_id, name, address, type, bedrooms, bathrooms, rent_amount, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, name, address, type, bedrooms || 1, bathrooms || 1, rent_amount, description || null);

  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(property);
});

// PUT /api/properties/:id - landlord only
router.put('/:id', authenticate, requireRole('landlord'), (req, res) => {
  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  if (property.landlord_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const { name, address, type, bedrooms, bathrooms, rent_amount, status, description } = req.body;

  db.prepare(`
    UPDATE properties SET
      name = COALESCE(?, name),
      address = COALESCE(?, address),
      type = COALESCE(?, type),
      bedrooms = COALESCE(?, bedrooms),
      bathrooms = COALESCE(?, bathrooms),
      rent_amount = COALESCE(?, rent_amount),
      status = COALESCE(?, status),
      description = COALESCE(?, description)
    WHERE id = ?
  `).run(name, address, type, bedrooms, bathrooms, rent_amount, status, description, req.params.id);

  const updated = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/properties/:id - landlord only
router.delete('/:id', authenticate, requireRole('landlord'), (req, res) => {
  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  if (property.landlord_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  db.prepare('DELETE FROM properties WHERE id = ?').run(req.params.id);
  res.json({ message: 'Property deleted' });
});

module.exports = router;
