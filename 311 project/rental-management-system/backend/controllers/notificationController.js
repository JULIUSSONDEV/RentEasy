const db = require('../config/database');


async function getNotifications(req, res) {
    try {
        const { page = 1, limit = 20 } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;

        const [[{ total }]] = await db.execute(
            'SELECT COUNT(*) AS total FROM notifications WHERE user_id = ?', [req.user.id]
        );
        const [rows] = await db.execute(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
            [req.user.id, limitNum, offset]
        );
        const [[{ unread }]] = await db.execute(
            'SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]
        );
        res.json({ notifications: rows, total, unread, page: pageNum, pages: Math.ceil(total / limitNum) });
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch notifications.' });
    }
}


async function markAllRead(req, res) {
    try {
        await db.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
        res.json({ message: 'All notifications marked as read.' });
    } catch (err) {
        res.status(500).json({ error: 'Could not update notifications.' });
    }
}


async function markRead(req, res) {
    try {
        await db.execute(
            'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        res.json({ message: 'Notification marked as read.' });
    } catch (err) {
        res.status(500).json({ error: 'Could not update notification.' });
    }
}

async function deleteNotification(req, res) {
    try {
        const [result] = await db.execute(
            'DELETE FROM notifications WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        if (!result.changes) return res.status(404).json({ error: 'Notification not found.' });
        res.json({ message: 'Notification deleted.' });
    } catch (err) {
        res.status(500).json({ error: 'Could not delete notification.' });
    }
}

module.exports = { getNotifications, markAllRead, markRead, deleteNotification };
