const { verifyToken } = require('../config/jwt');
const db = require('../config/database');


async function authenticate(req, res, next) {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    const token = header.split(' ')[1];
    try {
        const decoded = verifyToken(token);
        
        const [rows] = await db.execute(
            'SELECT id, full_name, email, role, is_active, profile_picture FROM users WHERE id = ?',
            [decoded.id]
        );
        if (!rows.length) return res.status(401).json({ error: 'User no longer exists.' });
        if (!rows[0].is_active) return res.status(403).json({ error: 'Account is deactivated. Contact admin.' });
        req.user = rows[0];
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
}


function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Not authenticated.' });
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'You do not have permission to perform this action.' });
        }
        next();
    };
}

module.exports = { authenticate, authorize };
