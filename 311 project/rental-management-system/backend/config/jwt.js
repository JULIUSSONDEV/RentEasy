const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'change_me_in_production_at_least_32_chars';
const EXPIRES = process.env.JWT_EXPIRES_IN || '7d';


function generateToken(payload) {
    return jwt.sign(payload, SECRET, { expiresIn: EXPIRES });
}


function verifyToken(token) {
    return jwt.verify(token, SECRET);
}

module.exports = { generateToken, verifyToken };
