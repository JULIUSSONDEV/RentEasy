const db = require('../config/database');


async function notify(userId, type, title, body, refId = null, refType = null) {
    try {
        await db.execute(
            'INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type) VALUES (?,?,?,?,?,?)',
            [userId, type, title, body, refId, refType]
        );
    } catch (e) { }
}


async function createBooking(req, res) {
    try {
        const { property_id, start_date, message } = req.body;
        if (!property_id || !start_date) {
            return res.status(400).json({ error: 'property_id and start_date are required.' });
        }

        const [props] = await db.execute(
            'SELECT id, landlord_id, monthly_rent, is_available, title FROM properties WHERE id = ?',
            [property_id]
        );
        if (!props.length) return res.status(404).json({ error: 'Property not found.' });
        const property = props[0];
        if (!property.is_available) return res.status(400).json({ error: 'Property is not available for booking.' });


        const [dup] = await db.execute(
            `SELECT id FROM bookings WHERE property_id = ? AND tenant_id = ?
             AND status IN ('pending','approved')`,
            [property_id, req.user.id]
        );
        if (dup.length) return res.status(409).json({ error: 'You already have an active booking for this property.' });

        const [result] = await db.execute(
            `INSERT INTO bookings (property_id, tenant_id, start_date, monthly_rent, message, status)
             VALUES (?, ?, ?, ?, ?, 'pending')`,
            [property_id, req.user.id, start_date, property.monthly_rent, message || null]
        );

        await notify(property.landlord_id, 'booking_request',
            'New Booking Request',
            `${req.user.full_name} has requested to book "${property.title}".`,
            result.insertId, 'booking'
        );
        res.status(201).json({ message: 'Booking request submitted successfully.', booking_id: result.insertId });
    } catch (err) {
        console.error('[Booking] Create error:', err.message);
        res.status(500).json({ error: 'Could not create booking.' });
    }
}


async function getMyBookings(req, res) {
    try {
        const [rows] = await db.execute(
            `SELECT b.*, p.title AS property_title, p.address, p.city, p.cover_image, p.landlord_id,
             u.full_name AS landlord_name, u.phone AS landlord_phone
             FROM bookings b
             JOIN properties p ON p.id = b.property_id
             JOIN users u ON u.id = p.landlord_id
             WHERE b.tenant_id = ? ORDER BY b.created_at DESC`,
            [req.user.id]
        );
        res.json({ bookings: rows });
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch bookings.' });
    }
}


async function getLandlordBookings(req, res) {
    try {
        const { status } = req.query;
        let sql = `SELECT b.*, p.title AS property_title, p.address, p.city, p.cover_image,
                   t.full_name AS tenant_name, t.email AS tenant_email, t.phone AS tenant_phone
                   FROM bookings b
                   JOIN properties p ON p.id = b.property_id AND p.landlord_id = ?
                   JOIN users t ON t.id = b.tenant_id
                   WHERE 1=1`;
        const params = [req.user.id];
        if (status) { sql += ' AND b.status = ?'; params.push(status); }
        sql += ' ORDER BY b.created_at DESC';
        const [rows] = await db.execute(sql, params);
        res.json({ bookings: rows });
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch bookings.' });
    }
}


async function updateBookingStatus(req, res) {
    try {
        const { id } = req.params;
        const { status, rejection_reason } = req.body;
        const validStatuses = ['approved', 'rejected', 'completed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}.` });
        }


        let sql = 'SELECT b.*, p.landlord_id, p.title, p.id AS pid, p.total_rooms FROM bookings b JOIN properties p ON p.id = b.property_id WHERE b.id = ?';
        const [rows] = await db.execute(sql, [id]);
        if (!rows.length) return res.status(404).json({ error: 'Booking not found.' });
        const booking = rows[0];

        if (req.user.role === 'landlord' && booking.landlord_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        await db.execute(
            'UPDATE bookings SET status = ?, rejection_reason = ? WHERE id = ?',
            [status, rejection_reason || null, id]
        );


        const totalRooms = booking.total_rooms || 1;

        if (status === 'approved') {
            const [occupiedRows] = await db.execute(
                `SELECT COUNT(*) AS occupied FROM bookings WHERE property_id = ? AND status = 'approved'`,
                [booking.pid]
            );
            const occupied = occupiedRows[0].occupied;
            if (occupied >= totalRooms) {
                await db.execute('UPDATE properties SET is_available = 0 WHERE id = ?', [booking.pid]);
            }
        }

        if (status === 'rejected' || status === 'completed') {
            const [occupiedRows] = await db.execute(
                `SELECT COUNT(*) AS occupied FROM bookings WHERE property_id = ? AND status = 'approved' AND id != ?`,
                [booking.pid, id]
            );
            const occupied = occupiedRows[0].occupied;
            if (occupied < totalRooms) {
                await db.execute('UPDATE properties SET is_available = 1 WHERE id = ?', [booking.pid]);
            }
        }


        const notifTitle = status === 'approved' ? 'Booking Approved' :
            status === 'rejected' ? 'Booking Rejected' : 'Booking Completed';
        const notifBody = status === 'approved'
            ? `Your booking for "${booking.title}" has been approved!`
            : status === 'rejected'
                ? `Your booking for "${booking.title}" was rejected. Reason: ${rejection_reason || 'Not specified.'}`
                : `Your booking for "${booking.title}" is now marked as completed.`;
        await notify(booking.tenant_id, `booking_${status}`, notifTitle, notifBody, id, 'booking');

        res.json({ message: `Booking ${status} successfully.` });
    } catch (err) {
        console.error('[Booking] Status error:', err.message);
        res.status(500).json({ error: 'Could not update booking status.' });
    }
}


async function cancelBooking(req, res) {
    try {
        const { id } = req.params;
        const [rows] = await db.execute(
            'SELECT * FROM bookings WHERE id = ? AND tenant_id = ?', [id, req.user.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Booking not found.' });
        if (rows[0].status !== 'pending') {
            return res.status(400).json({ error: 'Only pending bookings can be cancelled.' });
        }
        await db.execute("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [id]);
        res.json({ message: 'Booking cancelled successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Could not cancel booking.' });
    }
}


async function getBooking(req, res) {
    try {
        const { id } = req.params;
        const [rows] = await db.execute(
            `SELECT b.*, p.title AS property_title, p.address, p.city, p.cover_image, p.landlord_id,
             t.full_name AS tenant_name, t.email AS tenant_email, t.phone AS tenant_phone,
             l.full_name AS landlord_name, l.email AS landlord_email, l.phone AS landlord_phone
             FROM bookings b
             JOIN properties p ON p.id = b.property_id
             JOIN users t ON t.id = b.tenant_id
             JOIN users l ON l.id = p.landlord_id
             WHERE b.id = ?`,
            [id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Booking not found.' });
        const booking = rows[0];


        if (req.user.role === 'tenant' && booking.tenant_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied.' });
        }
        if (req.user.role === 'landlord' && booking.landlord_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied.' });
        }
        res.json({ booking });
    } catch (err) {
        res.status(500).json({ error: 'Could not retrieve booking.' });
    }
}

module.exports = { createBooking, getMyBookings, getLandlordBookings, updateBookingStatus, cancelBooking, getBooking };
