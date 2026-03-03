import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Self-hosted Supabase instance
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'http://superbase.koifishfriend.online';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzIxODYyMzcsImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6ImFub24iLCJpc3MiOiJzdXBhYmFzZSJ9.EfWDPx24M0OjJa5QjzEX4SbMwM_gG_71fhGLkYrBprY';

// Safe initialisation — never crash the app if Supabase is unavailable
let _client: SupabaseClient | null = null;
try {
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: { params: { eventsPerSecond: 2 } },
  });
} catch (err) {
  console.warn('[Supabase] Failed to initialise client:', err);
}

export const supabase: SupabaseClient | null = _client;

// ─── Types ───

export interface FeedingHistoryRow {
  id: number;
  device_id: string;
  recorded_at: string;
  status: string;
  feeding_active: boolean;
  hopper_level: number;
  hopper_capacity: number;
  hopper_percentage: number;
  current_weight: number;
  target_weight: number;
  feed_count: number;
  total_grams_fed: number;
  motor_status: string;
  plate_speed: number;
  esc_percent: number;
  rssi: number | null;
  ip_address: string | null;
  uptime_ms: number;
}

// ─── Query helpers ───

/**
 * Fetch feeding history for a device within a time range.
 * Returns [] if Supabase is unavailable or the table doesn't exist yet.
 */
export async function fetchFeedingHistory(
  deviceId: string,
  hoursBack: number = 24,
  limit: number = 2000,
): Promise<FeedingHistoryRow[]> {
  if (!supabase) return [];
  try {
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('feeding_history')
      .select('*')
      .eq('device_id', deviceId)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[Supabase] Error fetching feeding history:', error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.error('[Supabase] fetchFeedingHistory exception:', err);
    return [];
  }
}

/**
 * Fetch only feeding events (start/stop) for a device.
 * Returns [] if Supabase is unavailable or the table doesn't exist yet.
 */
export async function fetchFeedingEvents(
  deviceId: string,
  hoursBack: number = 72,
  limit: number = 100,
): Promise<FeedingHistoryRow[]> {
  if (!supabase) return [];
  try {
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('feeding_history')
      .select('*')
      .eq('device_id', deviceId)
      .in('status', ['feeding_started', 'feeding_stopped'])
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[Supabase] Error fetching feeding events:', error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.error('[Supabase] fetchFeedingEvents exception:', err);
    return [];
  }
}
