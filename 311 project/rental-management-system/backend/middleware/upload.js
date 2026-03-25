const multer = require('multer');
const path = require('path');
const fs = require('fs');

const MAX_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '5');
const ALLOWED_TYPES = /jpeg|jpg|png|webp/;

function makeStorage(subFolder) {
    return multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = path.join(__dirname, '..', 'uploads', subFolder);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, `${subFolder}-${unique}${ext}`);
        }
    });
}

function fileFilter(req, file, cb) {
    const extOk = ALLOWED_TYPES.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = ALLOWED_TYPES.test(file.mimetype);
    if (extOk && mimeOk) return cb(null, true);
    cb(new Error('Only JPEG, JPG, PNG, and WEBP images are allowed.'));
}

const uploadProperty = multer({
    storage: makeStorage('properties'),
    limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
    fileFilter
});

const uploadProfile = multer({
    storage: makeStorage('profiles'),
    limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
    fileFilter
});

module.exports = { uploadProperty, uploadProfile };
