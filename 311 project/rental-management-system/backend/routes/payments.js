const express = require('express');
const router = express.Router();
const {
    submitPayment, payheroCallback, getPaymentStatus,
    getMyPayments, getLandlordPayments, verifyPayment, getReceipt
} = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/auth');


router.post('/payhero/callback', payheroCallback);

router.post('/', authenticate, authorize('tenant'), submitPayment);
router.get('/my', authenticate, authorize('tenant'), getMyPayments);
router.get('/landlord', authenticate, authorize('landlord', 'admin'), getLandlordPayments);
router.patch('/:id/verify', authenticate, authorize('admin'), verifyPayment);
router.get('/:id/status', authenticate, authorize('tenant'), getPaymentStatus);
router.get('/:id/receipt', authenticate, getReceipt);

module.exports = router;
