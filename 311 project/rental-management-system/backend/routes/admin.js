const express = require('express');
const router = express.Router();
const {
    getDashboard, getUsers, updateUser, deleteUser,
    getAllProperties, getAllPayments, getReports,
    exportUsersCsv, exportPaymentsCsv,
    getDisputes, resolveDispute, createDispute
} = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');


router.use(authenticate, authorize('admin'));

router.get('/dashboard', getDashboard);
router.get('/users', getUsers);
router.get('/users/export.csv', exportUsersCsv);
router.patch('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.get('/properties', getAllProperties);
router.get('/payments', getAllPayments);
router.get('/payments/export.csv', exportPaymentsCsv);
router.get('/reports', getReports);
router.get('/disputes', getDisputes);
router.post('/disputes', createDispute);
router.patch('/disputes/:id', resolveDispute);

module.exports = router;
