-- Fix for "Blocked" Status Issue
-- This script ensures the feeding device exists and is set to online status

-- First, check if the device exists
SELECT device_id, status, device_type, last_seen, hopper_level, hopper_capacity
FROM sensor_devices 
WHERE device_id = 'feed_device_001';

-- If device doesn't exist, create it
INSERT INTO sensor_devices 
(device_id, device_type, status, hopper_capacity, hopper_level, hopper_percentage, 
 plate_speed, motor_status, feeding_active, created_at, last_seen)
VALUES 
('feed_device_001', 'FEEDING_MANAGEMENT', 'online', 20000, 0, 0, 
 0, 'STOPPED', FALSE, NOW(), NOW())
ON DUPLICATE KEY UPDATE
    status = 'online',
    last_seen = NOW(),
    device_type = 'FEEDING_MANAGEMENT';

-- Verify the fix
SELECT device_id, status, device_type, last_seen, hopper_level, hopper_capacity
FROM sensor_devices 
WHERE device_id = 'feed_device_001';

-- Expected result: device_id='feed_device_001', status='online'
