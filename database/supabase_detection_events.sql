-- Detection Events Table for Koi Fish Friend
-- Stores all AI detection events (health issues, fish detection, etc.)
-- with status tracking for acknowledgment and false alarm marking

CREATE TABLE IF NOT EXISTS detection_events (
    id BIGSERIAL PRIMARY KEY,
    fish_id INTEGER,
    health_status TEXT NOT NULL DEFAULT 'unknown',
    confidence FLOAT DEFAULT 0,
    is_critical BOOLEAN DEFAULT FALSE,
    needs_attention BOOLEAN DEFAULT FALSE,
    
    -- Bounding box coordinates
    x1 FLOAT DEFAULT 0,
    y1 FLOAT DEFAULT 0,
    x2 FLOAT DEFAULT 0,
    y2 FLOAT DEFAULT 0,
    
    -- Status tracking
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'false_alarm')),
    notes TEXT,
    
    -- Image/screenshot storage
    image_url TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_detection_events_created_at 
    ON detection_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_detection_events_fish_id 
    ON detection_events(fish_id);

CREATE INDEX IF NOT EXISTS idx_detection_events_health_status 
    ON detection_events(health_status);

CREATE INDEX IF NOT EXISTS idx_detection_events_is_critical 
    ON detection_events(is_critical);

CREATE INDEX IF NOT EXISTS idx_detection_events_status 
    ON detection_events(status);

-- Enable realtime for frontend subscriptions
ALTER TABLE detection_events REPLICA IDENTITY FULL;

-- Realtime publication (if not already created)
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime_detection_events CASCADE;
  CREATE PUBLICATION supabase_realtime_detection_events FOR TABLE detection_events;
COMMIT;

-- Set retention policy: Keep only last 90 days
ALTER TABLE detection_events SET (fillfactor = 70);

-- You can add this trigger if you want to auto-delete old records
-- CREATE OR REPLACE FUNCTION delete_old_detection_events()
-- RETURNS void AS $$
-- BEGIN
--   DELETE FROM detection_events WHERE created_at < NOW() - INTERVAL '90 days';
-- END;
-- $$ LANGUAGE plpgsql;

-- Optional: Grant permissions if using role-based access
-- GRANT SELECT, INSERT, UPDATE ON detection_events TO postgres;
-- GRANT USAGE ON SEQUENCE detection_events_id_seq TO postgres;
