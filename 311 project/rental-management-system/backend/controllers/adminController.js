const db = require('../config/database');

function csvEscape(value) {
    if (value === null || value === undefined) return '';
    const str = String(value).replace(/"/g, '""');
    return /[",\n]/.test(str) ? `"${str}"` : str;
}

function toCsv(headers, rows) {
    const lines = [headers.map(csvEscape).join(',')];
    for (const row of rows) lines.push(row.map(csvEscape).join(','));
    return lines.join('\n');
}


async function getDashboard(req, res) {
    try {
        const [[totalUsers]] = await db.execute('SELECT COUNT(*) AS c FROM users');
        const [[totalTenants]] = await db.execute("SELECT COUNT(*) AS c FROM users WHERE role = 'tenant'");
        const [[totalLandlords]] = await db.execute("SELECT COUNT(*) AS c FROM users WHERE role = 'landlord'");
        const [[totalProperties]] = await db.execute('SELECT COUNT(*) AS c FROM properties');
        const [[totalBookings]] = await db.execute('SELECT COUNT(*) AS c FROM bookings');
        const [[totalPayments]] = await db.execute("SELECT COUNT(*) AS c, COALESCE(SUM(amount),0) AS total FROM payments WHERE status='verified'");
        const [[pendingPayments]] = await db.execute("SELECT COUNT(*) AS c FROM payments WHERE status='pending'");
        const [[openDisputes]] = await db.execute("SELECT COUNT(*) AS c FROM disputes WHERE status='open'");
        const [[totalCities]] = await db.execute('SELECT COUNT(DISTINCT city) AS c FROM properties');


        const [monthlyIncome] = await db.execute(
            `SELECT strftime('%Y-%m', payment_period_start) AS month,
             COALESCE(SUM(amount),0) AS income, COUNT(*) AS payment_count
             FROM payments WHERE status='verified'
             GROUP BY month ORDER BY month DESC LIMIT 6`
        );


        const [recentBookings] = await db.execute(
            `SELECT b.id, b.status, b.created_at,
             p.title AS property_title,
             t.full_name AS tenant_name,
             l.full_name AS landlord_name
             FROM bookings b
             JOIN properties p ON p.id = b.property_id
             JOIN users t ON t.id = b.tenant_id
             JOIN users l ON l.id = p.landlord_id
             ORDER BY b.created_at DESC LIMIT 5`
        );


        const [landlords] = await db.execute(
            `SELECT u.id, u.full_name, u.email, u.created_at, COUNT(p.id) AS property_count
             FROM users u LEFT JOIN properties p ON p.landlord_id = u.id
             WHERE u.role = 'landlord'
             GROUP BY u.id ORDER BY u.full_name ASC`
        );


        const [tenants] = await db.execute(
            `SELECT id, full_name, email, created_at FROM users WHERE role = 'tenant' ORDER BY full_name ASC`
        );


        const [cities] = await db.execute(
            `SELECT city, COUNT(*) AS property_count FROM properties GROUP BY city ORDER BY property_count DESC`
        );


        const [propertiesList] = await db.execute(
            `SELECT p.id, p.title, p.city, p.property_type, p.monthly_rent, p.is_available,
             u.full_name AS landlord_name
             FROM properties p JOIN users u ON u.id = p.landlord_id
             ORDER BY p.created_at DESC`
        );

        res.json({
            stats: {
                total_users: totalUsers.c,
                total_tenants: totalTenants.c,
                total_landlords: totalLandlords.c,
                total_properties: totalProperties.c,
                total_bookings: totalBookings.c,
                total_revenue: totalPayments.total,
                total_cities: totalCities.c,
                pending_payments: pendingPayments.c,
                open_disputes: openDisputes.c
            },
            monthly_income: monthlyIncome,
            recent_bookings: recentBookings,
            landlords,
            tenants,
            cities,
            properties_list: propertiesList
        });
    } catch (err) {
        console.error('[Admin] Dashboard error:', err.message);
        res.status(500).json({ error: 'Could not fetch dashboard data.' });
    }
}


async function getUsers(req, res) {
    try {
        const { role, is_active, search, page = 1, limit = 20 } = req.query;
        let sql = 'SELECT id, full_name, email, phone, role, is_active, created_at, profile_picture FROM users WHERE 1=1';
        const params = [];
        if (role) { sql += ' AND role = ?'; params.push(role); }
        if (is_active !== undefined) { sql += ' AND is_active = ?'; params.push(parseInt(is_active)); }
        if (search) { sql += ' AND (full_name LIKE ? OR email LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, parseInt(limit));
        const offset = (pageNum - 1) * limitNum;

        const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM (${sql}) t`, params);
        const [rows] = await db.execute(sql + ' ORDER BY created_at DESC LIMIT ? OFFSET ?', [...params, limitNum, offset]);

        const [[roleSummary]] = await db.execute(
            `SELECT
                SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS admins,
                SUM(CASE WHEN role = 'landlord' THEN 1 ELSE 0 END) AS landlords,
                SUM(CASE WHEN role = 'tenant' THEN 1 ELSE 0 END) AS tenants
             FROM users`
        );
        const [[activitySummary]] = await db.execute(
            `SELECT
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active,
                SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS inactive
             FROM users`
        );

        res.json({
            users: rows,
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum),
            summary: {
                admins: roleSummary.admins || 0,
                landlords: roleSummary.landlords || 0,
                tenants: roleSummary.tenants || 0,
                active: activitySummary.active || 0,
                inactive: activitySummary.inactive || 0
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch users.' });
    }
}


async function updateUser(req, res) {
    try {
        const { id } = req.params;
        const { is_active, role } = req.body;
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ error: 'You cannot modify your own admin account this way.' });
        }
        const fields = [], values = [];
        if (is_active !== undefined) { fields.push('is_active = ?'); values.push(parseInt(is_active)); }
        if (role && ['admin', 'landlord', 'tenant'].includes(role)) { fields.push('role = ?'); values.push(role); }
        if (!fields.length) return res.status(400).json({ error: 'No valid fields provided.' });
        values.push(id);
        await db.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
        res.json({ message: 'User updated successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Could not update user.' });
    }
}


async function deleteUser(req, res) {
    try {
        const { id } = req.params;
        if (parseInt(id) === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account.' });

        // Remove records with non-cascading FK references first
        await db.execute('DELETE FROM payments WHERE tenant_id = ? OR landlord_id = ?', [id, id]);
        await db.execute('DELETE FROM disputes WHERE raised_by = ? OR against_user = ?', [id, id]);

        const [result] = await db.execute('DELETE FROM users WHERE id = ?', [id]);
        if (!result.affectedRows) return res.status(404).json({ error: 'User not found.' });
        res.json({ message: 'User deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Could not delete user.' });
    }
}


async function getAllProperties(req, res) {
    try {
        const [rows] = await db.execute(
            `SELECT p.*, u.full_name AS landlord_name, u.email AS landlord_email
             FROM properties p JOIN users u ON u.id = p.landlord_id
             ORDER BY p.created_at DESC`
        );
        rows.forEach(r => {
            r.images = r.images ? JSON.parse(r.images) : [];
            r.amenities = r.amenities ? JSON.parse(r.amenities) : [];
        });
        res.json({ properties: rows });
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch properties.' });
    }
}


async function getAllPayments(req, res) {
    try {
        const { status, from_date, to_date, page = 1, limit = 20 } = req.query;
        let sql = `SELECT pm.*,
                   'RCP-' || printf('%06d', pm.id) AS receipt_number,
                   t.full_name AS tenant_name, l.full_name AS landlord_name,
                   p.title AS property_title
                   FROM payments pm
                   JOIN users t ON t.id = pm.tenant_id
                   JOIN users l ON l.id = pm.landlord_id
                   JOIN bookings b ON b.id = pm.booking_id
                   JOIN properties p ON p.id = b.property_id
                   WHERE 1=1`;
        const params = [];
        if (status) { sql += ' AND pm.status = ?'; params.push(status); }
        if (from_date) { sql += " AND date(pm.created_at) >= date(?)"; params.push(from_date); }
        if (to_date) { sql += " AND date(pm.created_at) <= date(?)"; params.push(to_date); }

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;
        const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM (${sql}) t`, params);
        const [rows] = await db.execute(sql + ' ORDER BY pm.created_at DESC LIMIT ? OFFSET ?', [...params, limitNum, offset]);
        res.json({ payments: rows, total, page: pageNum, pages: Math.ceil(total / limitNum) });
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch payments.' });
    }
}

async function exportUsersCsv(req, res) {
    try {
        const { role, is_active, search } = req.query;
        let sql = 'SELECT id, full_name, email, phone, role, is_active, created_at FROM users WHERE 1=1';
        const params = [];
        if (role) { sql += ' AND role = ?'; params.push(role); }
        if (is_active !== undefined) { sql += ' AND is_active = ?'; params.push(parseInt(is_active)); }
        if (search) { sql += ' AND (full_name LIKE ? OR email LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
        sql += ' ORDER BY created_at DESC';

        const [rows] = await db.execute(sql, params);
        const csv = toCsv(
            ['ID', 'Name', 'Email', 'Phone', 'Role', 'Status', 'Created At'],
            rows.map(u => [
                u.id,
                u.full_name,
                u.email,
                u.phone || '',
                u.role,
                u.is_active ? 'active' : 'inactive',
                u.created_at
            ])
        );

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="users-${new Date().toISOString().slice(0, 10)}.csv"`);
        res.send(csv);
    } catch (err) {
        res.status(500).json({ error: 'Could not export users CSV.' });
    }
}

async function exportPaymentsCsv(req, res) {
    try {
        const { status, from_date, to_date } = req.query;
        let sql = `SELECT pm.*,
                   'RCP-' || printf('%06d', pm.id) AS receipt_number,
                   t.full_name AS tenant_name, l.full_name AS landlord_name,
                   p.title AS property_title
                   FROM payments pm
                   JOIN users t ON t.id = pm.tenant_id
                   JOIN users l ON l.id = pm.landlord_id
                   JOIN bookings b ON b.id = pm.booking_id
                   JOIN properties p ON p.id = b.property_id
                   WHERE 1=1`;
        const params = [];
        if (status) { sql += ' AND pm.status = ?'; params.push(status); }
        if (from_date) { sql += " AND date(pm.created_at) >= date(?)"; params.push(from_date); }
        if (to_date) { sql += " AND date(pm.created_at) <= date(?)"; params.push(to_date); }
        sql += ' ORDER BY pm.created_at DESC';

        const [rows] = await db.execute(sql, params);
        const csv = toCsv(
            ['ID', 'Receipt', 'Tenant', 'Landlord', 'Property', 'Amount', 'Method', 'Reference', 'Status', 'Created At'],
            rows.map(p => [
                p.id,
                p.receipt_number || '',
                p.tenant_name,
                p.landlord_name,
                p.property_title,
                p.amount,
                p.payment_method,
                p.transaction_reference || '',
                p.status,
                p.created_at
            ])
        );

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="payments-${new Date().toISOString().slice(0, 10)}.csv"`);
        res.send(csv);
    } catch (err) {
        res.status(500).json({ error: 'Could not export payments CSV.' });
    }
}


async function getReports(req, res) {
    try {
        const { year = new Date().getFullYear() } = req.query;
        const yearStr = String(year);

        const [monthlyIncome] = await db.execute(
            `SELECT strftime('%Y-%m', payment_period_start) AS month,
             SUM(amount) AS income, COUNT(*) AS payment_count
             FROM payments
             WHERE status='verified' AND strftime('%Y', payment_period_start) = ?
             GROUP BY month ORDER BY month ASC`,
            [yearStr]
        );

        const [bookingStats] = await db.execute(
            `SELECT status, COUNT(*) AS count FROM bookings GROUP BY status`
        );

        const [topProperties] = await db.execute(
            `SELECT p.title, p.city, u.full_name AS landlord_name,
             COUNT(DISTINCT pm.id) AS payment_count,
             COALESCE(SUM(pm.amount),0) AS total_revenue
             FROM properties p
             JOIN users u ON u.id = p.landlord_id
             LEFT JOIN bookings b ON b.property_id = p.id
             LEFT JOIN payments pm ON pm.booking_id = b.id AND pm.status='verified'
             GROUP BY p.id ORDER BY total_revenue DESC LIMIT 10`
        );

        const [userGrowth] = await db.execute(
            `SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS new_users
             FROM users
             WHERE strftime('%Y', created_at) = ?
             GROUP BY month ORDER BY month ASC`,
            [yearStr]
        );

        res.json({
            monthly_income: monthlyIncome,
            booking_stats: bookingStats,
            top_properties: topProperties,
            user_growth: userGrowth
        });
    } catch (err) {
        res.status(500).json({ error: 'Could not generate reports.' });
    }
}


async function getDisputes(req, res) {
    try {
        const [rows] = await db.execute(
            `SELECT d.*,
             u1.full_name AS complainant_name,
             u2.full_name AS respondent_name,
             u3.full_name AS resolved_by_name
             FROM disputes d
             JOIN users u1 ON u1.id = d.raised_by
             JOIN users u2 ON u2.id = d.against_user
             LEFT JOIN users u3 ON u3.id = d.resolved_by
             ORDER BY d.created_at DESC`
        );
        res.json({ disputes: rows });
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch disputes.' });
    }
}


async function resolveDispute(req, res) {
    try {
        const { id } = req.params;
        const { status, resolution_notes } = req.body;
        if (!['investigating', 'resolved', 'dismissed'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status.' });
        }

        await db.execute(
            `UPDATE disputes SET status=?, resolved_by=?, resolution_notes=?,
             resolved_at = CASE WHEN ? = 'resolved' THEN datetime('now') ELSE resolved_at END
             WHERE id=?`,
            [status, req.user.id, resolution_notes || null, status, id]
        );
        res.json({ message: 'Dispute updated successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Could not update dispute.' });
    }
}


async function createDispute(req, res) {
    try {
        const { against_user, booking_id, title, description } = req.body;
        if (!against_user || !title || !description) {
            return res.status(400).json({ error: 'against_user, title, and description are required.' });
        }
        const [result] = await db.execute(
            'INSERT INTO disputes (raised_by, against_user, booking_id, title, description) VALUES (?,?,?,?,?)',
            [req.user.id, against_user, booking_id || null, title, description]
        );
        res.status(201).json({ message: 'Dispute raised successfully.', dispute_id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: 'Could not raise dispute.' });
    }
}

module.exports = {
    getDashboard, getUsers, updateUser, deleteUser,
    getAllProperties, getAllPayments, getReports,
    exportUsersCsv, exportPaymentsCsv,
    getDisputes, resolveDispute, createDispute
};
