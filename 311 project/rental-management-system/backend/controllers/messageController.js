const db = require('../config/database');


async function notify(userId, type, title, body, refId = null, refType = null) {
    try {
        await db.execute(
            'INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type) VALUES (?,?,?,?,?,?)',
            [userId, type, title, body, refId, refType]
        );
    } catch (e) { }
}


async function sendMessage(req, res) {
    try {
        const { receiver_id, receiver_phone, property_id, subject, body, parent_id } = req.body;
        if (!receiver_id && !receiver_phone) {
            return res.status(400).json({ error: 'Recipient phone number is required.' });
        }
        if (!body) {
            return res.status(400).json({ error: 'Message body is required.' });
        }

        let recipientId = receiver_id ? parseInt(receiver_id) : null;

        if (receiver_phone && !receiver_id) {
            const [phoneRows] = await db.execute('SELECT id FROM users WHERE phone = ? AND is_active = 1', [receiver_phone]);
            if (!phoneRows.length) return res.status(404).json({ error: 'No user found with that phone number.' });
            recipientId = phoneRows[0].id;
        }

        if (recipientId === req.user.id) {
            return res.status(400).json({ error: 'You cannot message yourself.' });
        }

        const [recv] = await db.execute('SELECT id, full_name FROM users WHERE id = ? AND is_active = 1', [recipientId]);
        if (!recv.length) return res.status(404).json({ error: 'Recipient not found.' });

        const [result] = await db.execute(
            'INSERT INTO messages (sender_id, receiver_id, property_id, subject, body, parent_id) VALUES (?,?,?,?,?,?)',
            [req.user.id, recipientId, property_id || null, subject || null, body, parent_id || null]
        );

        await notify(recipientId, 'new_message',
            `New Message from ${req.user.full_name}`,
            subject ? `Subject: ${subject}` : body.substring(0, 100),
            result.insertId, 'message'
        );
        res.status(201).json({ message: 'Message sent successfully.', message_id: result.insertId });
    } catch (err) {
        console.error('[Message] Send error:', err.message);
        res.status(500).json({ error: 'Could not send message.' });
    }
}


async function getInbox(req, res) {
    try {
        const [rows] = await db.execute(
            `SELECT m.*, u.full_name AS sender_name, u.profile_picture AS sender_avatar,
             r.full_name AS receiver_name, r.profile_picture AS receiver_avatar,
             p.title AS property_title
             FROM messages m
             JOIN users u ON u.id = m.sender_id
             JOIN users r ON r.id = m.receiver_id
             LEFT JOIN properties p ON p.id = m.property_id
             WHERE (m.receiver_id = ? OR m.sender_id = ?) AND m.parent_id IS NULL
             ORDER BY m.created_at DESC`,
            [req.user.id, req.user.id]
        );

        const [unread] = await db.execute(
            'SELECT COUNT(*) AS count FROM messages WHERE receiver_id = ? AND is_read = 0',
            [req.user.id]
        );
        res.json({ messages: rows, unread_count: unread[0].count });
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch inbox.' });
    }
}


async function getSent(req, res) {
    try {
        const [rows] = await db.execute(
            `SELECT m.*, u.full_name AS receiver_name, u.profile_picture AS receiver_avatar,
             p.title AS property_title
             FROM messages m
             JOIN users u ON u.id = m.receiver_id
             LEFT JOIN properties p ON p.id = m.property_id
             WHERE m.sender_id = ? ORDER BY m.created_at DESC`,
            [req.user.id]
        );
        res.json({ messages: rows });
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch sent messages.' });
    }
}


async function getMessage(req, res) {
    try {
        const { id } = req.params;
        const [rows] = await db.execute(
            `SELECT m.*, s.full_name AS sender_name, s.profile_picture AS sender_avatar,
             r.full_name AS receiver_name, p.title AS property_title
             FROM messages m
             JOIN users s ON s.id = m.sender_id
             JOIN users r ON r.id = m.receiver_id
             LEFT JOIN properties p ON p.id = m.property_id
             WHERE m.id = ?`,
            [id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Message not found.' });
        const msg = rows[0];


        if (msg.sender_id !== req.user.id && msg.receiver_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied.' });
        }

        if (msg.receiver_id === req.user.id && !msg.is_read) {
            await db.execute('UPDATE messages SET is_read = 1 WHERE id = ?', [id]);
        }

        const [replies] = await db.execute(
            `SELECT m2.*, u.full_name AS sender_name, u.profile_picture AS sender_avatar
             FROM messages m2 JOIN users u ON u.id = m2.sender_id
             WHERE m2.parent_id = ? ORDER BY m2.created_at ASC`,
            [id]
        );
        res.json({ message: msg, replies });
    } catch (err) {
        res.status(500).json({ error: 'Could not retrieve message.' });
    }
}


async function getUnreadCount(req, res) {
    try {
        const [rows] = await db.execute(
            'SELECT COUNT(*) AS count FROM messages WHERE receiver_id = ? AND is_read = 0',
            [req.user.id]
        );
        res.json({ unread_count: rows[0].count });
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch count.' });
    }
}

async function deleteMessage(req, res) {
    try {
        const { id } = req.params;
        const [rows] = await db.execute('SELECT id, sender_id, receiver_id FROM messages WHERE id = ?', [id]);
        if (!rows.length) return res.status(404).json({ error: 'Message not found.' });
        const msg = rows[0];
        if (msg.sender_id !== req.user.id && msg.receiver_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied.' });
        }
        await db.execute('DELETE FROM messages WHERE parent_id = ?', [id]);
        await db.execute('DELETE FROM messages WHERE id = ?', [id]);
        res.json({ message: 'Message deleted.' });
    } catch (err) {
        res.status(500).json({ error: 'Could not delete message.' });
    }
}

module.exports = { sendMessage, getInbox, getSent, getMessage, getUnreadCount, deleteMessage };
