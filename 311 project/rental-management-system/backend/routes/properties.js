const express = require('express');
const router = express.Router();
const {
    listProperties, getProperty, getMyProperties,
    createProperty, updateProperty, deleteProperty
} = require('../controllers/propertyController');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadProperty } = require('../middleware/upload');

const propertyUpload = uploadProperty.fields([
    { name: 'cover_image', maxCount: 1 },
    { name: 'images', maxCount: 8 }
]);


router.get('/', listProperties);
router.get('/mine', authenticate, authorize('landlord', 'admin'), getMyProperties);
router.get('/:id', getProperty);


router.post('/', authenticate, authorize('landlord', 'admin'), propertyUpload, createProperty);
router.put('/:id', authenticate, authorize('landlord', 'admin'), propertyUpload, updateProperty);
router.delete('/:id', authenticate, authorize('landlord', 'admin'), deleteProperty);

module.exports = router;
