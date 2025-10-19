-- Koi Fish Friend Database Setup
-- This script is for reference only - JPA will create tables automatically

-- Database is already created: u626686198_fishfeed
-- Connection details:
-- Host: 82.197.82.97
-- Username: u626686198_fishfeedu
-- Password: FrevCf&1:2

-- Switch to database
USE u626686198_fishfeed;

-- Users table (auto-created by JPA)
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    CONSTRAINT uk_username UNIQUE (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert demo user (BCrypt hash for 'admin123')
-- Note: This is done automatically by DataInitializer.java
-- Including here for reference only
INSERT INTO users (username, password) VALUES 
('admin', '$2a$10$YourBCryptHashHere') 
ON DUPLICATE KEY UPDATE username=username;

-- Verify table structure
DESCRIBE users;

-- Check if demo user exists
SELECT id, username FROM users WHERE username = 'admin';

-- Sample queries for testing

-- Find user by username
SELECT * FROM users WHERE username = 'admin';

-- Count total users
SELECT COUNT(*) as total_users FROM users;

-- List all users (excluding password)
SELECT id, username FROM users;

-- Update username (example)
-- UPDATE users SET username = 'newadmin' WHERE username = 'admin';

-- Update password (example - use BCrypt hash)
-- UPDATE users SET password = '$2a$10$NewBCryptHashHere' WHERE username = 'admin';

-- Delete user (example - careful!)
-- DELETE FROM users WHERE username = 'admin';

-- Drop table (if needed for reset)
-- DROP TABLE IF EXISTS users;
