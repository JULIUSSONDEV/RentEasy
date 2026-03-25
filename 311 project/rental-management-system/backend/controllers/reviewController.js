const db = require('../config/database');


async function createReview(req, res) {
    try {
        const { booking_id, rating, title, body } = req.body;
        if (!booking_id || !rating) {
            return res.status(400).json({ error: 'booking_id and rating are required.' });
        }
        const ratingNum = parseInt(rating);
        if (ratingNum < 1 || ratingNum > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
        }
        
        const [bookings] = await db.execute(
            `SELECT b.*, p.id AS property_id FROM bookings b JOIN properties p ON p.id = b.property_id
             WHERE b.id = ? AND b.tenant_id = ? AND b.status IN ('approved','completed')`,
            [booking_id, req.user.id]
        );
        if (!bookings.length) {
            return res.status(403).json({ error: 'You can only review properties with an approved booking.' });
        }
        
        const [dup] = await db.execute('SELECT id FROM reviews WHERE booking_id = ?', [booking_id]);
        if (dup.length) return res.status(409).json({ error: 'You have already reviewed this booking.' });

        const [result] = await db.execute(
            'INSERT INTO reviews (property_id, tenant_id, booking_id, rating, title, body) VALUES (?,?,?,?,?,?)',
            [bookings[0].property_id, req.user.id, booking_id, ratingNum, title || null, body || null]
        );
        res.status(201).json({ message: 'Review submitted successfully.', review_id: result.insertId });
    } catch (err) {
        console.error('[Review] Create error:', err.message);
        res.status(500).json({ error: 'Could not submit review.' });
    }
}


async function getPropertyReviews(req, res) {
    try {
        const [rows] = await db.execute(
            `SELECT r.*, u.full_name AS tenant_name, u.profile_picture AS tenant_avatar
             FROM reviews r JOIN users u ON u.id = r.tenant_id
             WHERE r.property_id = ? AND r.is_approved = 1 ORDER BY r.created_at DESC`,
            [req.params.id]
        );
        const [stats] = await db.execute(
            'SELECT COALESCE(AVG(rating),0) AS avg_rating, COUNT(*) AS total FROM reviews WHERE property_id = ? AND is_approved = 1',
            [req.params.id]
        );
        res.json({ reviews: rows, stats: stats[0] });
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch reviews.' });
    }
}


async function deleteReview(req, res) {
    try {
        const { id } = req.params;
        let sql = 'DELETE FROM reviews WHERE id = ?';
        const params = [id];
        if (req.user.role !== 'admin') { sql += ' AND tenant_id = ?'; params.push(req.user.id); }
        const [result] = await db.execute(sql, params);
        if (!result.affectedRows) return res.status(404).json({ error: 'Review not found or access denied.' });
        res.json({ message: 'Review deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Could not delete review.' });
    }
}

module.exports = { createReview, getPropertyReviews, deleteReview };
