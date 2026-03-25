-- ============================================================
-- RENTAL MANAGEMENT SYSTEM - SEED DATA
-- Run AFTER schema.sql
-- Passwords are bcrypt hashes of: Admin@123 / Landlord@123 / Tenant@123
-- ============================================================
USE rental_management;

-- ============================================================
-- SEED: users
-- ============================================================
INSERT INTO users (full_name, email, phone, password_hash, role, is_active, email_verified) VALUES
('System Admin',    'admin@rentals.co.ke',    '0700000001', '$2b$12$EWFH1k.8bkzGN7kz6XaQH.QX52K3N0DpJGVNFMGKzYCa3XWVT8O6y', 'admin',    1, 1),
('James Waweru',    'james@rentals.co.ke',    '0712345678', '$2b$12$EWFH1k.8bkzGN7kz6XaQH.QX52K3N0DpJGVNFMGKzYCa3XWVT8O6y', 'landlord', 1, 1),
('Grace Muthoni',   'grace@rentals.co.ke',    '0723456789', '$2b$12$EWFH1k.8bkzGN7kz6XaQH.QX52K3N0DpJGVNFMGKzYCa3XWVT8O6y', 'landlord', 1, 1),
('Kevin Odhiambo',  'kevin@rentals.co.ke',    '0734567890', '$2b$12$EWFH1k.8bkzGN7kz6XaQH.QX52K3N0DpJGVNFMGKzYCa3XWVT8O6y', 'tenant',   1, 1),
('Amina Hassan',    'amina@rentals.co.ke',    '0745678901', '$2b$12$EWFH1k.8bkzGN7kz6XaQH.QX52K3N0DpJGVNFMGKzYCa3XWVT8O6y', 'tenant',   1, 1),
('Brian Kipchoge',  'brian@rentals.co.ke',    '0756789012', '$2b$12$EWFH1k.8bkzGN7kz6XaQH.QX52K3N0DpJGVNFMGKzYCa3XWVT8O6y', 'tenant',   1, 1);

-- ============================================================
-- SEED: properties (landlord_id 2 = James, 3 = Grace)
-- ============================================================
INSERT INTO properties (landlord_id, title, description, property_type, address, city, county, monthly_rent, bedrooms, bathrooms, size_sqft, is_available, amenities, cover_image) VALUES
(2, '2 Bedroom Apartment - Westlands',
 'Modern 2-bedroom apartment in the heart of Westlands. Close to shopping malls, restaurants, and public transport. Fully fitted kitchen, spacious living room, and secured parking.',
 'apartment', 'Westlands Road, Block A, Apartment 3B', 'Nairobi', 'Nairobi County', 35000.00, 2, 1, 850.00, 1,
 '["WiFi","Parking","Security","Water 24/7","Backup Generator","Gym"]', NULL),

(2, 'Studio Apartment - Kilimani',
 'Cozy studio apartment ideal for a single professional or couple. Open plan design with modern finishes. Walking distance to Yaya Centre.',
 'studio', '14 Argwings Kodhek Rd, Kilimani', 'Nairobi', 'Nairobi County', 18000.00, 1, 1, 400.00, 1,
 '["WiFi","Water 24/7","Security","CCTV"]', NULL),

(2, '3 Bedroom House - Karen',
 'Spacious 3-bedroom house on a large compound with beautiful garden. Ideal for a family looking for a quiet environment with proximity to Karen shopping centre.',
 'house', '5 Karen Road, Karen Estate', 'Nairobi', 'Nairobi County', 75000.00, 3, 2, 2200.00, 1,
 '["Parking","Garden","Security","Water Tank","DSTV","WiFi","Backup Generator"]', NULL),

(3, '1 Bedroom Apartment - Parklands',
 'Well-maintained 1-bedroom apartment in secure compound. Fitted kitchen with cooker. Close to Aga Khan Hospital and Parklands town.',
 'apartment', 'Park Road, Block C, Flat 12', 'Nairobi', 'Nairobi County', 22000.00, 1, 1, 600.00, 1,
 '["Security","Parking","Water 24/7","Caretaker"]', NULL),

(3, 'Office Space - Upper Hill',
 'Open plan office space suitable for a team of 10-20 people. Located in Upper Hill, prime business district. Includes boardroom access.',
 'office', 'Upper Hill Road, 8th Floor, Office 802', 'Nairobi', 'Nairobi County', 120000.00, 0, 2, 1500.00, 1,
 '["Lift","Parking","Backup Generator","WiFi","Boardroom","Reception"]', NULL),

(3, '2 Bedroom Apartment - Ruaka',
 'Affordable 2-bedroom apartment in the fast-growing Ruaka town. Modern design, secure compound with perimeter wall and CCTV.',
 'apartment', 'Ruaka Town Centre, Phase 2, Flat 6', 'Kiambu', 'Kiambu County', 20000.00, 2, 1, 750.00, 0,
 '["Security","CCTV","Parking","Water Tank"]', NULL);

-- ============================================================
-- SEED: bookings
-- ============================================================
INSERT INTO bookings (property_id, tenant_id, start_date, end_date, monthly_rent, status, message, is_paid) VALUES
(1, 4, '2025-03-01', NULL,    35000.00, 'approved',  'I am a working professional looking for a quiet environment.', 1),
(2, 5, '2025-03-01', NULL,    18000.00, 'approved',  'Single person, very clean and quiet.', 1),
(3, 6, '2025-04-01', NULL,    75000.00, 'pending',   'Family of four, very interested in the property.', 0),
(4, 4, '2025-04-01', NULL,    22000.00, 'rejected',  'Looking for a 1 bedroom near Parklands.',  0),
(5, 5, '2025-05-01', NULL,   120000.00, 'pending',   'Our startup team needs office space urgently.', 0);

-- ============================================================
-- SEED: payments
-- ============================================================
INSERT INTO payments (booking_id, tenant_id, landlord_id, amount, payment_method, transaction_reference, phone_used, status, payment_period_start, payment_period_end, verified_by, verified_at) VALUES
(1, 4, 2, 35000.00, 'mpesa',      'QJZ8X2KLM9',  '0734567890', 'verified', '2025-03-01', '2025-03-31', 1, '2025-03-02 09:00:00'),
(2, 5, 3, 18000.00, 'till_number','TILL88742A',   '0745678901', 'verified', '2025-03-01', '2025-03-31', 1, '2025-03-03 10:30:00'),
(1, 4, 2, 35000.00, 'paybill',    'PBL7799XK2',  '0734567890', 'verified', '2025-04-01', '2025-04-30', 1, '2025-04-02 08:45:00'),
(2, 5, 3, 18000.00, 'send_money', 'SEND44992ZP', '0745678901', 'pending',  '2025-04-01', '2025-04-30', NULL, NULL);

-- ============================================================
-- SEED: messages
-- ============================================================
INSERT INTO messages (sender_id, receiver_id, property_id, subject, body, is_read) VALUES
(4, 2, 1, 'Question about parking',   'Hi James, is there dedicated parking for each unit?', 1),
(2, 4, 1, 'RE: Question about parking','Hi Kevin, yes each unit has one dedicated parking slot. Additional parking at KES 2,000/month.', 1),
(5, 3, 2, 'Water supply query',       'Good morning Grace, how is the water supply? Is it 24/7?', 1),
(3, 5, 2, 'RE: Water supply query',   'Hello Amina, we have both council water and a borehole. Supply is very reliable.', 0),
(6, 2, 3, 'Viewing request',          'Hello, we would like to schedule a viewing of the Karen house this weekend.', 0);

-- ============================================================
-- SEED: reviews
-- ============================================================
INSERT INTO reviews (property_id, tenant_id, booking_id, rating, title, body, is_approved) VALUES
(1, 4, 1, 5, 'Excellent apartment!', 'The apartment is in great condition. Management is very responsive and professional. Highly recommended.', 1),
(2, 5, 2, 4, 'Good value for money', 'Nice studio in a convenient location. Minor maintenance issues were fixed promptly. Would recommend.', 1);

-- ============================================================
-- SEED: notifications
-- ============================================================
INSERT INTO notifications (user_id, type, title, body, is_read, reference_id, reference_type) VALUES
(2, 'booking_request', 'New Booking Request', 'Kevin Odhiambo has requested to book your Westlands apartment.', 1, 1, 'booking'),
(3, 'booking_request', 'New Booking Request', 'Amina Hassan has requested to book your Kilimani studio.', 1, 2, 'booking'),
(2, 'booking_request', 'New Booking Request', 'Brian Kipchoge has requested to book your Karen house.', 0, 3, 'booking'),
(4, 'booking_approved', 'Booking Approved', 'Your booking for Westlands Apartment has been approved!', 1, 1, 'booking'),
(5, 'booking_approved', 'Booking Approved', 'Your booking for Kilimani Studio has been approved!', 1, 2, 'booking'),
(4, 'payment_verified', 'Payment Verified', 'Your payment of KES 35,000 for March has been verified.', 1, 1, 'payment'),
(4, 'new_message', 'New Message from James', 'James Waweru replied to your parking query.', 1, 2, 'message'),
(2, 'new_message', 'New Message from Brian', 'Brian Kipchoge sent you a viewing request.', 0, 5, 'message');
