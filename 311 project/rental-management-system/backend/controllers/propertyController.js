const db = require('../config/database');


function buildPropertyQuery(filters, params) {
    let sql = `SELECT p.*, u.full_name AS landlord_name, u.phone AS landlord_phone,
               COALESCE(AVG(r.rating),0) AS avg_rating, COUNT(DISTINCT r.id) AS review_count,
               (SELECT COUNT(*) FROM bookings WHERE bookings.property_id = p.id AND bookings.status = 'approved') AS occupied_rooms
               FROM properties p
               JOIN users u ON u.id = p.landlord_id
               LEFT JOIN reviews r ON r.property_id = p.id AND r.is_approved = 1
               WHERE 1=1`;

    if (filters.city) { sql += ' AND p.city LIKE ?'; params.push(`%${filters.city}%`); }
    if (filters.property_type) { sql += ' AND p.property_type = ?'; params.push(filters.property_type); }
    if (filters.min_rent) { sql += ' AND p.monthly_rent >= ?'; params.push(filters.min_rent); }
    if (filters.max_rent) { sql += ' AND p.monthly_rent <= ?'; params.push(filters.max_rent); }
    if (filters.bedrooms) { sql += ' AND p.bedrooms >= ?'; params.push(filters.bedrooms); }
    if (filters.is_available !== undefined) { sql += ' AND p.is_available = ?'; params.push(filters.is_available); }
    if (filters.search) {
        sql += ' AND (p.title LIKE ? OR p.address LIKE ? OR p.city LIKE ?)';
        const kw = `%${filters.search}%`;
        params.push(kw, kw, kw);
    }
    sql += ' GROUP BY p.id';
    return sql;
}


async function listProperties(req, res) {
    try {
        const { city, type, min_rent, max_rent, bedrooms, search, is_available, page = 1, limit = 9 } = req.query;
        const params = [];
        const filters = {
            city, property_type: type,
            min_rent: min_rent ? parseFloat(min_rent) : null,
            max_rent: max_rent ? parseFloat(max_rent) : null,
            bedrooms: bedrooms ? parseInt(bedrooms) : null,
            search,
            is_available: is_available !== undefined ? parseInt(is_available) : undefined
        };
        
        Object.keys(filters).forEach(k => (filters[k] == null || filters[k] === undefined) && delete filters[k]);

        const sql = buildPropertyQuery(filters, params) + ' ORDER BY p.created_at DESC';


const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
        const offset = (pageNum - 1) * limitNum;

        const countParams = [...params];
        const countSql = `SELECT COUNT(*) AS total FROM (${sql}) t`;

        const [[{ total }]] = await db.execute(countSql, countParams);
        const [rows] = await db.execute(sql + ' LIMIT ? OFFSET ?', [...params, limitNum, offset]);

        rows.forEach(r => {
            r.images = r.images ? JSON.parse(r.images) : [];
            r.amenities = r.amenities ? JSON.parse(r.amenities) : [];
        });

        res.json({ properties: rows, total, page: pageNum, pages: Math.ceil(total / limitNum) });
    } catch (err) {
        console.error('[Property] List error:', err.message);
        res.status(500).json({ error: 'Could not fetch properties.' });
    }
}


async function getProperty(req, res) {
    try {
        const { id } = req.params;
        const [rows] = await db.execute(
            `SELECT p.*, u.full_name AS landlord_name, u.email AS landlord_email, u.phone AS landlord_phone,
             u.profile_picture AS landlord_avatar,
             COALESCE(AVG(r.rating),0) AS avg_rating, COUNT(DISTINCT r.id) AS review_count,
             (SELECT COUNT(*) FROM bookings WHERE bookings.property_id = p.id AND bookings.status = 'approved') AS occupied_rooms
             FROM properties p
             JOIN users u ON u.id = p.landlord_id
             LEFT JOIN reviews r ON r.property_id = p.id AND r.is_approved = 1
             WHERE p.id = ?
             GROUP BY p.id`,
            [id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Property not found.' });

        const property = rows[0];
        property.images = property.images ? JSON.parse(property.images) : [];
        property.amenities = property.amenities ? JSON.parse(property.amenities) : [];


await db.execute('UPDATE properties SET views = views + 1 WHERE id = ?', [id]);


const [reviews] = await db.execute(
            `SELECT r.*, u.full_name AS tenant_name, u.profile_picture AS tenant_avatar
             FROM reviews r JOIN users u ON u.id = r.tenant_id
             WHERE r.property_id = ? AND r.is_approved = 1 ORDER BY r.created_at DESC`,
            [id]
        );

        res.json({ property, reviews });
    } catch (err) {
        console.error('[Property] Get error:', err.message);
        res.status(500).json({ error: 'Could not retrieve property.' });
    }
}


async function getMyProperties(req, res) {
    try {
        const [rows] = await db.execute(
            `SELECT p.*, COALESCE(AVG(r.rating),0) AS avg_rating, COUNT(DISTINCT r.id) AS review_count,
             (SELECT COUNT(*) FROM bookings b WHERE b.property_id = p.id AND b.status = 'pending') AS pending_bookings,
             (SELECT COUNT(*) FROM bookings WHERE bookings.property_id = p.id AND bookings.status = 'approved') AS occupied_rooms
             FROM properties p
             LEFT JOIN reviews r ON r.property_id = p.id AND r.is_approved = 1
             WHERE p.landlord_id = ?
             GROUP BY p.id ORDER BY p.created_at DESC`,
            [req.user.id]
        );
        rows.forEach(r => {
            r.images = r.images ? JSON.parse(r.images) : [];
            r.amenities = r.amenities ? JSON.parse(r.amenities) : [];
        });
        res.json({ properties: rows });
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch your properties.' });
    }
}


async function createProperty(req, res) {
    try {
        const {
            title, description, property_type, address, city, county,
            monthly_rent, bedrooms, bathrooms, size_sqft, amenities, total_rooms
        } = req.body;

        const coverImage = req.files && req.files.cover_image
            ? `/uploads/properties/${req.files.cover_image[0].filename}` : null;
        const extraImages = req.files && req.files.images
            ? req.files.images.map(f => `/uploads/properties/${f.filename}`) : [];

        const amenitiesJson = amenities ? (typeof amenities === 'string' ? amenities : JSON.stringify(amenities)) : '[]';
        const imagesJson = JSON.stringify(extraImages);

        const [result] = await db.execute(
            `INSERT INTO properties (landlord_id, title, description, property_type, address, city, county,
             monthly_rent, bedrooms, bathrooms, size_sqft, amenities, cover_image, images, total_rooms)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.user.id, title, description || null, property_type, address, city, county || null,
                parseFloat(monthly_rent), parseInt(bedrooms) || 1, parseInt(bathrooms) || 1,
                size_sqft ? parseFloat(size_sqft) : null, amenitiesJson, coverImage, imagesJson,
                total_rooms ? parseInt(total_rooms) : 1
            ]
        );
        res.status(201).json({ message: 'Property created successfully.', property_id: result.insertId });
    } catch (err) {
        console.error('[Property] Create error:', err.message);
        res.status(500).json({ error: 'Could not create property.' });
    }
}


async function updateProperty(req, res) {
    try {
        const { id } = req.params;
        const [rows] = await db.execute('SELECT * FROM properties WHERE id = ? AND landlord_id = ?', [id, req.user.id]);
        if (!rows.length) return res.status(404).json({ error: 'Property not found or access denied.' });

        const {
            title, description, property_type, address, city, county,
            monthly_rent, bedrooms, bathrooms, size_sqft, amenities, is_available, total_rooms
        } = req.body;

        const coverImage = req.files && req.files.cover_image
            ? `/uploads/properties/${req.files.cover_image[0].filename}` : rows[0].cover_image;

        let existingImages = rows[0].images ? JSON.parse(rows[0].images) : [];
        if (req.files && req.files.images) {
            const newImgs = req.files.images.map(f => `/uploads/properties/${f.filename}`);
            existingImages = [...existingImages, ...newImgs];
        }

        const amenitiesJson = amenities
            ? (typeof amenities === 'string' ? amenities : JSON.stringify(amenities))
            : rows[0].amenities;

        await db.execute(
            `UPDATE properties SET title=?, description=?, property_type=?, address=?, city=?, county=?,
             monthly_rent=?, bedrooms=?, bathrooms=?, size_sqft=?, amenities=?, cover_image=?, images=?,
             is_available=?, total_rooms=? WHERE id = ?`,
            [
                title || rows[0].title, description ?? rows[0].description,
                property_type || rows[0].property_type, address || rows[0].address,
                city || rows[0].city, county ?? rows[0].county,
                monthly_rent ? parseFloat(monthly_rent) : rows[0].monthly_rent,
                bedrooms ? parseInt(bedrooms) : rows[0].bedrooms,
                bathrooms ? parseInt(bathrooms) : rows[0].bathrooms,
                size_sqft ? parseFloat(size_sqft) : rows[0].size_sqft,
                amenitiesJson, coverImage, JSON.stringify(existingImages),
                is_available !== undefined ? parseInt(is_available) : rows[0].is_available,
                total_rooms ? parseInt(total_rooms) : (rows[0].total_rooms || 1),
                id
            ]
        );
        res.json({ message: 'Property updated successfully.' });
    } catch (err) {
        console.error('[Property] Update error:', err.message);
        res.status(500).json({ error: 'Could not update property.' });
    }
}


async function deleteProperty(req, res) {
    try {
        const { id } = req.params;
        let query = 'DELETE FROM properties WHERE id = ?';
        const params = [id];
        if (req.user.role !== 'admin') { query += ' AND landlord_id = ?'; params.push(req.user.id); }

        const [result] = await db.execute(query, params);
        if (!result.affectedRows) return res.status(404).json({ error: 'Property not found or access denied.' });
        res.json({ message: 'Property deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Could not delete property.' });
    }
}

module.exports = { listProperties, getProperty, getMyProperties, createProperty, updateProperty, deleteProperty };
