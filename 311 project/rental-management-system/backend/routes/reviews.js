const express = require('express');
const router = express.Router();
const { createReview, getPropertyReviews, deleteReview } = require('../controllers/reviewController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/', authenticate, authorize('tenant'), createReview);
router.get('/property/:id', getPropertyReviews);
router.delete('/:id', authenticate, deleteReview);

module.exports = router;
