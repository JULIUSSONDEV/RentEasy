require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();


app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
}));

app.use(cors({
    origin: '*',
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));


const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { error: 'Too many requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use(globalLimiter);


app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));


app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));


app.use('/api/auth', require('./routes/auth'));
app.use('/api/properties', require('./routes/properties'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));


app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
});


app.get('/api/stats', async (req, res) => {
    try {
        const db = require('./config/database');
        const [[props]] = await db.execute("SELECT COUNT(*) AS total FROM properties WHERE is_available = 1");
        const [[tenants]] = await db.execute("SELECT COUNT(*) AS total FROM users WHERE role = 'tenant'");
        const [[landlords]] = await db.execute("SELECT COUNT(*) AS total FROM users WHERE role = 'landlord'");
        const [[cities]] = await db.execute("SELECT COUNT(DISTINCT city) AS total FROM properties WHERE is_available = 1");
        res.json({
            properties: props.total,
            tenants: tenants.total,
            landlords: landlords.total,
            cities: cities.total
        });
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch stats.' });
    }
});


app.use((req, res) => {
    res.status(404).json({ error: 'Route not found.' });
});


app.use((err, req, res, next) => {
    console.error('[Error]', err.message);
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: `File too large. Max ${process.env.MAX_FILE_SIZE_MB || 5}MB allowed.` });
    }
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Internal server error.' });
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app;
