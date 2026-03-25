const express = require('express');
const router = express.Router();
const { sendMessage, getInbox, getSent, getMessage, getUnreadCount, deleteMessage } = require('../controllers/messageController');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, sendMessage);
router.get('/inbox', authenticate, getInbox);
router.get('/sent', authenticate, getSent);
router.get('/unread-count', authenticate, getUnreadCount);
router.get('/:id', authenticate, getMessage);
router.delete('/:id', authenticate, deleteMessage);

module.exports = router;
