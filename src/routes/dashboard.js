const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard - summary stats for the current user
router.get('/', authenticate, (req, res) => {
  if (req.user.role === 'landlord') {
    const totalProperties = db.prepare('SELECT COUNT(*) AS count FROM properties WHERE landlord_id = ?').get(req.user.id).count;
    const occupiedProperties = db.prepare("SELECT COUNT(*) AS count FROM properties WHERE landlord_id = ? AND status = 'occupied'").get(req.user.id).count;
    const availableProperties = db.prepare("SELECT COUNT(*) AS count FROM properties WHERE landlord_id = ? AND status = 'available'").get(req.user.id).count;
    const activeLeases = db.prepare("SELECT COUNT(*) AS count FROM leases WHERE landlord_id = ? AND status = 'active'").get(req.user.id).count;
    const pendingPayments = db.prepare("SELECT COUNT(*) AS count FROM payments WHERE landlord_id = ? AND status = 'pending'").get(req.user.id).count;
    const overduePayments = db.prepare("SELECT COUNT(*) AS count FROM payments WHERE landlord_id = ? AND status = 'overdue'").get(req.user.id).count;
    const openMaintenance = db.prepare("SELECT COUNT(*) AS count FROM maintenance_requests WHERE landlord_id = ? AND status IN ('open','in_progress')").get(req.user.id).count;
    const monthlyRevenue = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE landlord_id = ? AND status = 'paid' AND strftime('%Y-%m', paid_date) = strftime('%Y-%m', 'now')").get(req.user.id).total;

    const recentPayments = db.prepare(`
      SELECT p.*, u.name AS tenant_name, prop.name AS property_name
      FROM payments p
      JOIN users u ON p.tenant_id = u.id
      JOIN leases l ON p.lease_id = l.id
      JOIN properties prop ON l.property_id = prop.id
      WHERE p.landlord_id = ?
      ORDER BY p.created_at DESC LIMIT 5
    `).all(req.user.id);

    const recentMaintenance = db.prepare(`
      SELECT m.*, u.name AS tenant_name, prop.name AS property_name
      FROM maintenance_requests m
      JOIN users u ON m.tenant_id = u.id
      JOIN properties prop ON m.property_id = prop.id
      WHERE m.landlord_id = ?
      ORDER BY m.created_at DESC LIMIT 5
    `).all(req.user.id);

    res.json({
      totalProperties,
      occupiedProperties,
      availableProperties,
      activeLeases,
      pendingPayments,
      overduePayments,
      openMaintenance,
      monthlyRevenue,
      recentPayments,
      recentMaintenance
    });
  } else {
    const activeLeases = db.prepare(`
      SELECT l.*, p.name AS property_name, p.address AS property_address, p.rent_amount
      FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.tenant_id = ? AND l.status = 'active'
    `).all(req.user.id);

    const pendingPayments = db.prepare(`
      SELECT p.*, prop.name AS property_name
      FROM payments p
      JOIN leases l ON p.lease_id = l.id
      JOIN properties prop ON l.property_id = prop.id
      WHERE p.tenant_id = ? AND p.status IN ('pending', 'overdue')
      ORDER BY p.due_date ASC
    `).all(req.user.id);

    const openMaintenance = db.prepare(`
      SELECT m.*, prop.name AS property_name
      FROM maintenance_requests m
      JOIN properties prop ON m.property_id = prop.id
      WHERE m.tenant_id = ? AND m.status IN ('open', 'in_progress')
      ORDER BY m.created_at DESC
    `).all(req.user.id);

    res.json({
      activeLeases,
      pendingPayments,
      openMaintenance
    });
  }
});

module.exports = router;
