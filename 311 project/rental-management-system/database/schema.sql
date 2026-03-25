-- ============================================================
-- RENTAL MANAGEMENT SYSTEM - DATABASE SCHEMA
-- ============================================================
-- ERD OVERVIEW:
-- Users (1) ----< Properties (1) ----< Bookings (1) ----< Payments
-- Users (1) ----< Bookings (many as tenant)
-- Properties (1) ----< Reviews (many)
-- Users (1) ----< Messages (many as sender/receiver)
-- ============================================================

CREATE DATABASE IF NOT EXISTS rental_management;
USE rental_management;

-- ============================================================
-- TABLE: users
-- Stores all user accounts (admin, landlord, tenant)
-- ============================================================
CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(180) NOT NULL UNIQUE,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin','landlord','tenant') NOT NULL DEFAULT 'tenant',
    profile_picture VARCHAR(255) DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    email_verified TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLE: properties
-- Stores rental property listings created by landlords
-- ============================================================
CREATE TABLE properties (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    landlord_id INT UNSIGNED NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    property_type ENUM('apartment','house','studio','office','land','other') NOT NULL DEFAULT 'apartment',
    address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    county VARCHAR(100),
    monthly_rent DECIMAL(12,2) NOT NULL,
    bedrooms TINYINT UNSIGNED DEFAULT 1,
    bathrooms TINYINT UNSIGNED DEFAULT 1,
    size_sqft DECIMAL(10,2) DEFAULT NULL,
    is_available TINYINT(1) NOT NULL DEFAULT 1,
    amenities TEXT COMMENT 'JSON encoded list of amenities',
    cover_image VARCHAR(255) DEFAULT NULL,
    images TEXT COMMENT 'JSON encoded array of image paths',
    views INT UNSIGNED DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_property_landlord FOREIGN KEY (landlord_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLE: bookings
-- Tracks tenant booking requests for properties
-- ============================================================
CREATE TABLE bookings (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    property_id INT UNSIGNED NOT NULL,
    tenant_id INT UNSIGNED NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    monthly_rent DECIMAL(12,2) NOT NULL,
    status ENUM('pending','approved','rejected','cancelled','completed') NOT NULL DEFAULT 'pending',
    message TEXT COMMENT 'Optional message from tenant when booking',
    rejection_reason VARCHAR(255) DEFAULT NULL,
    is_paid TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_booking_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    CONSTRAINT fk_booking_tenant FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLE: payments
-- Records all payment transactions linked to bookings
-- ============================================================
CREATE TABLE payments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    booking_id INT UNSIGNED NOT NULL,
    tenant_id INT UNSIGNED NOT NULL,
    landlord_id INT UNSIGNED NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    payment_method ENUM('send_money','till_number','paybill','cash','other') NOT NULL,
    transaction_reference VARCHAR(100) NOT NULL UNIQUE,
    phone_used VARCHAR(20),
    paybill_number VARCHAR(30) DEFAULT NULL,
    till_number VARCHAR(30) DEFAULT NULL,
    account_number VARCHAR(60) DEFAULT NULL,
    status ENUM('pending','verified','failed') NOT NULL DEFAULT 'pending',
    verified_by INT UNSIGNED DEFAULT NULL COMMENT 'Admin user id who verified',
    verified_at TIMESTAMP NULL DEFAULT NULL,
    payment_period_start DATE NOT NULL COMMENT 'Month this payment covers (start)',
    payment_period_end DATE NOT NULL COMMENT 'Month this payment covers (end)',
    notes TEXT,
    receipt_number VARCHAR(80) GENERATED ALWAYS AS (CONCAT('RCP-', LPAD(id, 6, '0'))) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT fk_payment_tenant FOREIGN KEY (tenant_id) REFERENCES users(id),
    CONSTRAINT fk_payment_landlord FOREIGN KEY (landlord_id) REFERENCES users(id),
    CONSTRAINT fk_payment_verified_by FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLE: messages
-- Stores messages between tenants and landlords
-- ============================================================
CREATE TABLE messages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sender_id INT UNSIGNED NOT NULL,
    receiver_id INT UNSIGNED NOT NULL,
    property_id INT UNSIGNED DEFAULT NULL COMMENT 'Context property for the conversation',
    subject VARCHAR(200),
    body TEXT NOT NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    parent_id INT UNSIGNED DEFAULT NULL COMMENT 'For threading replies',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_msg_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_msg_receiver FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_msg_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
    CONSTRAINT fk_msg_parent FOREIGN KEY (parent_id) REFERENCES messages(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLE: reviews
-- Tenant reviews and ratings for properties
-- ============================================================
CREATE TABLE reviews (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    property_id INT UNSIGNED NOT NULL,
    tenant_id INT UNSIGNED NOT NULL,
    booking_id INT UNSIGNED NOT NULL,
    rating TINYINT UNSIGNED NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title VARCHAR(150),
    body TEXT,
    is_approved TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_review_booking (booking_id),
    CONSTRAINT fk_review_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    CONSTRAINT fk_review_tenant FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_review_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLE: notifications
-- System notifications for users
-- ============================================================
CREATE TABLE notifications (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    type VARCHAR(50) NOT NULL COMMENT 'booking_request, payment_received, message, etc.',
    title VARCHAR(200) NOT NULL,
    body TEXT,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    reference_id INT UNSIGNED DEFAULT NULL COMMENT 'ID of the related record',
    reference_type VARCHAR(50) DEFAULT NULL COMMENT 'booking, payment, message, etc.',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLE: disputes
-- Admin dispute management
-- ============================================================
CREATE TABLE disputes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    raised_by INT UNSIGNED NOT NULL,
    against_user INT UNSIGNED NOT NULL,
    booking_id INT UNSIGNED DEFAULT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    status ENUM('open','investigating','resolved','dismissed') NOT NULL DEFAULT 'open',
    resolved_by INT UNSIGNED DEFAULT NULL,
    resolution_notes TEXT,
    resolved_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_dispute_raised_by FOREIGN KEY (raised_by) REFERENCES users(id),
    CONSTRAINT fk_dispute_against FOREIGN KEY (against_user) REFERENCES users(id),
    CONSTRAINT fk_dispute_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
    CONSTRAINT fk_dispute_resolved_by FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX idx_properties_city ON properties(city);
CREATE INDEX idx_properties_available ON properties(is_available);
CREATE INDEX idx_properties_rent ON properties(monthly_rent);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_tenant ON bookings(tenant_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_messages_receiver ON messages(receiver_id, is_read);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
