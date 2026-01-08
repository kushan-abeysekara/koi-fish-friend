-- Add power management columns to sensor_devices table
-- These columns store the current state of BUDGET_MANAGEMENT devices

ALTER TABLE sensor_devices ADD COLUMN IF NOT EXISTS relay_state VARCHAR(10);
ALTER TABLE sensor_devices ADD COLUMN IF NOT EXISTS control_mode VARCHAR(20);
ALTER TABLE sensor_devices ADD COLUMN IF NOT EXISTS schedule_count INTEGER DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN sensor_devices.relay_state IS 'Current relay state: ON or OFF';
COMMENT ON COLUMN sensor_devices.control_mode IS 'Power control mode: manual, auto, or schedule';
COMMENT ON COLUMN sensor_devices.schedule_count IS 'Number of schedules synced to device';

-- Update existing BUDGET_MANAGEMENT devices with default values
UPDATE sensor_devices 
SET 
    relay_state = 'OFF',
    control_mode = 'auto',
    schedule_count = 0
WHERE device_type = 'BUDGET_MANAGEMENT' 
  AND relay_state IS NULL;

SELECT 'Power management columns added successfully!' AS status;
