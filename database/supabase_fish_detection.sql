-- Supabase: fish_detection_events table — stores every AI detection event with image
-- The frontend writes events here whether or not the user has the page open
-- (backend can also write via the same pg/query endpoint)

CREATE TABLE IF NOT EXISTS fish_detection_events (
  id            BIGSERIAL PRIMARY KEY,
  device_id     TEXT NOT NULL DEFAULT 'POND_CAM_001',
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fish_id       INTEGER,
  health_class  TEXT NOT NULL DEFAULT 'unknown',
  confidence    DOUBLE PRECISION DEFAULT 0,
  is_critical   BOOLEAN DEFAULT FALSE,
  needs_attention BOOLEAN DEFAULT FALSE,
  bbox_x1       DOUBLE PRECISION,
  bbox_y1       DOUBLE PRECISION,
  bbox_x2       DOUBLE PRECISION,
  bbox_y2       DOUBLE PRECISION,
  image_base64  TEXT,
  fish_count    INTEGER DEFAULT 0,
  fps           DOUBLE PRECISION DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_fish_detection_device_time
  ON fish_detection_events (device_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_fish_detection_health
  ON fish_detection_events (health_class);
CREATE INDEX IF NOT EXISTS idx_fish_detection_critical
  ON fish_detection_events (is_critical) WHERE is_critical = TRUE;

ALTER TABLE fish_detection_events DISABLE ROW LEVEL SECURITY;

-- Enable Realtime for live subscription
ALTER PUBLICATION supabase_realtime ADD TABLE fish_detection_events;

-- Summary view for quick counts per health class
CREATE OR REPLACE VIEW fish_detection_summary AS
SELECT
  health_class,
  COUNT(*) AS total_count,
  COUNT(*) FILTER (WHERE recorded_at > NOW() - INTERVAL '1 hour') AS last_hour,
  COUNT(*) FILTER (WHERE recorded_at > NOW() - INTERVAL '24 hours') AS last_24h,
  MAX(recorded_at) AS last_seen
FROM fish_detection_events
GROUP BY health_class;

-- Auto-cleanup: keep 30 days of data, but always keep critical events for 90 days
CREATE OR REPLACE FUNCTION cleanup_old_fish_detections()
RETURNS void AS $$
BEGIN
  DELETE FROM fish_detection_events
  WHERE recorded_at < NOW() - INTERVAL '90 days' AND is_critical = TRUE;
  DELETE FROM fish_detection_events
  WHERE recorded_at < NOW() - INTERVAL '30 days' AND is_critical = FALSE;
END;
$$ LANGUAGE plpgsql;
