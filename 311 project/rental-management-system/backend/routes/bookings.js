const express = require('express');
const router = express.Router();
const {
    createBooking, getMyBookings, getLandlordBookings,
    updateBookingStatus, cancelBooking, getBooking
} = require('../controllers/bookingController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/', authenticate, authorize('tenant'), createBooking);
router.get('/my', authenticate, authorize('tenant'), getMyBookings);
router.get('/landlord', authenticate, authorize('landlord', 'admin'), getLandlordBookings);
router.get('/:id', authenticate, getBooking);
router.patch('/:id/status', authenticate, authorize('landlord', 'admin'), updateBookingStatus);
router.patch('/:id/cancel', authenticate, authorize('tenant'), cancelBooking);

module.exports = router;
