const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { register, login, getProfile, updateProfile, changePassword, deleteOwnAccount, registerRules, loginRules } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { uploadProfile } = require('../middleware/upload');
const validate = require('../middleware/validate');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 15,
    message: { error: 'Too many authentication attempts. Try again later.' }
});

router.post('/register', authLimiter, registerRules, validate, register);
router.post('/login', authLimiter, loginRules, validate, login);
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, uploadProfile.single('profile_picture'), updateProfile);
router.put('/change-password', authenticate, changePassword);
router.delete('/account', authenticate, deleteOwnAccount);

module.exports = router;
