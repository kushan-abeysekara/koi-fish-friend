-- Complete setup script for feeding device
-- This ensures the table exists with all required columns and creates the device

-- Connect to database
-- mysql -h 82.197.82.97 -u root -pChuki000 koifish < setup_feed_device.sql

USE koifish;

-- Create sensor_devices table if it doesn't exist
CREATE TABLE IF NOT EXISTS sensor_devices (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(255) UNIQUE NOT NULL,
    device_type VARCHAR(50),
    pond_id BIGINT,
    status VARCHAR(50),
    ip_address VARCHAR(50),
    rssi INT,
    energy_wh DOUBLE,
    last_seen DATETIME,
    created_at DATETIME,
    -- Feeding device specific columns
    hopper_level DOUBLE DEFAULT 0,
    hopper_capacity DOUBLE DEFAULT 20000,
    hopper_percentage DOUBLE DEFAULT 0,
    plate_speed DOUBLE DEFAULT 0,
    motor_status VARCHAR(50) DEFAULT 'STOPPED',
    feeding_active BOOLEAN DEFAULT FALSE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- If table already exists, add missing columns (safe to run multiple times)
ALTER TABLE sensor_devices 
ADD COLUMN IF NOT EXISTS hopper_level DOUBLE DEFAULT 0;

ALTER TABLE sensor_devices 
ADD COLUMN IF NOT EXISTS hopper_capacity DOUBLE DEFAULT 20000;

ALTER TABLE sensor_devices 
ADD COLUMN IF NOT EXISTS hopper_percentage DOUBLE DEFAULT 0;

ALTER TABLE sensor_devices 
ADD COLUMN IF NOT EXISTS plate_speed DOUBLE DEFAULT 0;

ALTER TABLE sensor_devices 
ADD COLUMN IF NOT EXISTS motor_status VARCHAR(50) DEFAULT 'STOPPED';

ALTER TABLE sensor_devices 
ADD COLUMN IF NOT EXISTS feeding_active BOOLEAN DEFAULT FALSE;

-- Insert or update the feeding device
INSERT INTO sensor_devices 
(device_id, device_type, status, hopper_capacity, hopper_level, hopper_percentage, 
 plate_speed, motor_status, feeding_active, created_at, last_seen)
VALUES 
('feed_device_001', 'FEEDING_MANAGEMENT', 'offline', 20000, 0, 0, 
 0, 'STOPPED', FALSE, NOW(), NOW())
ON DUPLICATE KEY UPDATE 
    device_type = 'FEEDING_MANAGEMENT',
    hopper_capacity = 20000,
    last_seen = NOW();

-- Verify the device was created
SELECT device_id, device_type, status, hopper_level, hopper_capacity, last_seen 
FROM sensor_devices 
WHERE device_id='feed_device_001';

-- Show all devices
SELECT device_id, device_type, status, last_seen 
FROM sensor_devices;
