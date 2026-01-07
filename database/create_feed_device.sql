-- Manually create or update feed_device_001 in the database
-- Run this if the device doesn't automatically register

-- Insert device if it doesn't exist
INSERT IGNORE INTO sensor_devices 
(device_id, device_type, status, hopper_capacity, hopper_level, hopper_percentage, plate_speed, motor_status, feeding_active, created_at, last_seen)
VALUES 
('feed_device_001', 'FEEDING_MANAGEMENT', 'offline', 20000, 0, 0, 0, 'STOPPED', FALSE, NOW(), NOW());

-- Update device to ensure correct settings
UPDATE sensor_devices 
SET 
    device_type = 'FEEDING_MANAGEMENT',
    hopper_capacity = 20000,
    status = 'offline',
    last_seen = NOW()
WHERE device_id = 'feed_device_001';

-- Verify device exists
SELECT * FROM sensor_devices WHERE device_id = 'feed_device_001';
