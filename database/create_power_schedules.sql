-- Power Schedules Table for Budget Management
-- Stores time-based power on/off schedules for devices

CREATE TABLE IF NOT EXISTS power_schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    days_of_week VARCHAR(7) NOT NULL DEFAULT '0000000',
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_device FOREIGN KEY (device_id) REFERENCES sensor_devices(device_id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_power_schedules_device ON power_schedules(device_id);
CREATE INDEX IF NOT EXISTS idx_power_schedules_enabled ON power_schedules(enabled);

-- Comments for documentation
-- days_of_week format: String of 7 characters (0 or 1)
-- Position: [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
-- Example: "1111100" = Mon-Fri (Monday to Friday)
-- Example: "1111111" = Every day
-- Example: "0000011" = Sat-Sun (Weekend only)
