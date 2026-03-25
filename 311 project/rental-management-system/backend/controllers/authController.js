const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const db = require('../config/database');
const { generateToken } = require('../config/jwt');


const registerRules = [
    body('full_name').trim().notEmpty().withMessage('Full name is required.')
        .isLength({ min: 2, max: 120 }).withMessage('Full name must be 2-120 characters.'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
    body('phone').optional({ checkFalsy: true }).isMobilePhone().withMessage('Invalid phone number.'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
        .matches(/[0-9]/).withMessage('Password must contain at least one number.'),
    body('role').optional().isIn(['landlord', 'tenant', 'admin']).withMessage('Role must be landlord, tenant, or admin.')
];

const loginRules = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
    body('password').notEmpty().withMessage('Password is required.')
];


async function register(req, res) {
    try {
        const { full_name, email, phone, password, role = 'tenant' } = req.body;


const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length) return res.status(409).json({ error: 'Email already registered.' });

        const password_hash = await bcrypt.hash(password, 12);
        const [result] = await db.execute(
            'INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)',
            [full_name, email, phone || null, password_hash, role]
        );

        const token = generateToken({ id: result.insertId, email, role });
        res.status(201).json({
            message: 'Registration successful.',
            token,
            user: { id: result.insertId, full_name, email, phone, role }
        });
    } catch (err) {
        console.error('[Auth] Register error:', err.message);
        res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
}


async function login(req, res) {
    try {
        const { email, password } = req.body;
        const [rows] = await db.execute(
            'SELECT id, full_name, email, phone, password_hash, role, is_active, profile_picture FROM users WHERE email = ?',
            [email]
        );
        if (!rows.length) return res.status(401).json({ error: 'Invalid email or password.' });

        const user = rows[0];
        if (!user.is_active) return res.status(403).json({ error: 'Account is deactivated. Contact admin.' });

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Invalid email or password.' });

        const token = generateToken({ id: user.id, email: user.email, role: user.role });
        const { password_hash, ...safeUser } = user;
        res.json({ message: 'Login successful.', token, user: safeUser });
    } catch (err) {
        console.error('[Auth] Login error:', err.message);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
}


async function getProfile(req, res) {
    try {
        const [rows] = await db.execute(
            'SELECT id, full_name, email, phone, role, profile_picture, is_active, created_at FROM users WHERE id = ?',
            [req.user.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'User not found.' });
        res.json({ user: rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Could not retrieve profile.' });
    }
}


async function updateProfile(req, res) {
    try {
        const { full_name, phone } = req.body;
        const profile_picture = req.file ? `/uploads/profiles/${req.file.filename}` : undefined;

        const fields = [];
        const values = [];
        if (full_name) { fields.push('full_name = ?'); values.push(full_name); }
        if (phone) { fields.push('phone = ?'); values.push(phone); }
        if (profile_picture) { fields.push('profile_picture = ?'); values.push(profile_picture); }

        if (!fields.length) return res.status(400).json({ error: 'No fields provided to update.' });
        values.push(req.user.id);

        await db.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
        res.json({ message: 'Profile updated successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Profile update failed.' });
    }
}


async function changePassword(req, res) {
    try {
        const { current_password, new_password } = req.body;
        if (!new_password || new_password.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters.' });
        }
        const [rows] = await db.execute('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
        const match = await bcrypt.compare(current_password, rows[0].password_hash);
        if (!match) return res.status(400).json({ error: 'Current password is incorrect.' });

        const hash = await bcrypt.hash(new_password, 12);
        await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
        res.json({ message: 'Password changed successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Password change failed.' });
    }
}


async function deleteOwnAccount(req, res) {
    try {
        const { password } = req.body;
        if (!password) return res.status(400).json({ error: 'Password is required to delete your account.' });

        const [rows] = await db.execute('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
        if (!rows.length) return res.status(404).json({ error: 'User not found.' });

        const match = await bcrypt.compare(password, rows[0].password_hash);
        if (!match) return res.status(400).json({ error: 'Incorrect password.' });

        await db.execute('DELETE FROM users WHERE id = ?', [req.user.id]);
        res.json({ message: 'Account deleted successfully.' });
    } catch (err) {
        console.error('[Auth] Delete account error:', err.message);
        res.status(500).json({ error: 'Could not delete account.' });
    }
}

module.exports = { register, login, getProfile, updateProfile, changePassword, deleteOwnAccount, registerRules, loginRules };
