-- Add feeding device status columns to sensor_devices table
-- Run this migration to support real-time monitoring of feeding devices

ALTER TABLE sensor_devices 
ADD COLUMN IF NOT EXISTS hopper_level DOUBLE DEFAULT 0,
ADD COLUMN IF NOT EXISTS hopper_capacity DOUBLE DEFAULT 20000,
ADD COLUMN IF NOT EXISTS hopper_percentage DOUBLE DEFAULT 0,
ADD COLUMN IF NOT EXISTS plate_speed DOUBLE DEFAULT 0,
ADD COLUMN IF NOT EXISTS motor_status VARCHAR(50) DEFAULT 'STOPPED',
ADD COLUMN IF NOT EXISTS feeding_active BOOLEAN DEFAULT FALSE;

-- Update existing feed_device_001 if it exists
UPDATE sensor_devices 
SET hopper_capacity = 20000,
    hopper_level = 0,
    hopper_percentage = 0,
    plate_speed = 0,
    motor_status = 'STOPPED',
    feeding_active = FALSE
WHERE device_id = 'feed_device_001';
