-- ============================================================
-- Supabase: feeding_history table for real-time historical data
-- Run this in your Supabase SQL Editor at:
--   http://superbase.koifishfriend.online/project/default
-- ============================================================

-- 1. Create the feeding_history table
CREATE TABLE IF NOT EXISTS feeding_history (
  id            BIGSERIAL PRIMARY KEY,
  device_id     TEXT NOT NULL DEFAULT 'feed_device_001',
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Device status
  status        TEXT DEFAULT 'online',
  feeding_active BOOLEAN DEFAULT FALSE,

  -- Hopper data
  hopper_level      DOUBLE PRECISION DEFAULT 0,
  hopper_capacity   DOUBLE PRECISION DEFAULT 20000,
  hopper_percentage DOUBLE PRECISION DEFAULT 0,

  -- Weight / feeding data
  current_weight    DOUBLE PRECISION DEFAULT 0,
  target_weight     DOUBLE PRECISION DEFAULT 0,
  feed_count        INTEGER DEFAULT 0,
  total_grams_fed   DOUBLE PRECISION DEFAULT 0,

  -- Motor
  motor_status  TEXT DEFAULT 'STOPPED',
  plate_speed   DOUBLE PRECISION DEFAULT 0,
  esc_percent   DOUBLE PRECISION DEFAULT 0,

  -- Connectivity
  rssi          INTEGER,
  ip_address    TEXT,
  uptime_ms     BIGINT DEFAULT 0
);

-- 2. Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_feeding_history_device_time
  ON feeding_history (device_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_feeding_history_recorded_at
  ON feeding_history (recorded_at DESC);

-- 3. Disable Row Level Security (self-hosted, backend writes with anon key)
ALTER TABLE feeding_history DISABLE ROW LEVEL SECURITY;

-- 4. Enable Realtime for this table so frontend can subscribe
ALTER PUBLICATION supabase_realtime ADD TABLE feeding_history;

-- 5. (Optional) Create a function to auto-delete old data (keep 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_feeding_history()
RETURNS void AS $$
BEGIN
  DELETE FROM feeding_history
  WHERE recorded_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 6. (Optional) Schedule cleanup with pg_cron if available
-- SELECT cron.schedule('cleanup-feeding-history', '0 3 * * *', 'SELECT cleanup_old_feeding_history()');
