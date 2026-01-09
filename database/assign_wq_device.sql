-- Assign Water Quality device WQ_000 to pond 3
UPDATE sensor_device 
SET pond_id = 3, status = 'online'
WHERE device_id = 'WQ_000' AND device_type = 'WATER_QUALITY';

-- Verify the update
SELECT id, device_id, device_type, pond_id, status 
FROM sensor_device 
WHERE device_id = 'WQ_000';
