import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';

// Self-hosted Supabase instance (kept for optional real-time subscriptions)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'http://superbase.koifishfriend.online';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzIxODYyMzcsImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6ImFub24iLCJpc3MiOiJzdXBhYmFzZSJ9.EfWDPx24M0OjJa5QjzEX4SbMwM_gG_71fhGLkYrBprY';

// Backend REST API base URL (primary data source — MySQL, auto-created tables)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';

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
  device_id: string;         // snake_case from Supabase
  deviceId?: string;          // camelCase from Spring Boot
  recorded_at: string;        // snake_case from Supabase
  recordedAt?: string;        // camelCase from Spring Boot
  status: string;
  feeding_active: boolean;
  feedingActive?: boolean;
  hopper_level: number;
  hopperLevel?: number;
  hopper_capacity: number;
  hopperCapacity?: number;
  hopper_percentage: number;
  hopperPercentage?: number;
  current_weight: number;
  currentWeight?: number;
  target_weight: number;
  targetWeight?: number;
  feed_count: number;
  feedCount?: number;
  total_grams_fed: number;
  totalGramsFed?: number;
  motor_status: string;
  motorStatus?: string;
  plate_speed: number;
  plateSpeed?: number;
  esc_percent: number;
  escPercent?: number;
  rssi: number | null;
  ip_address: string | null;
  ipAddress?: string | null;
  uptime_ms: number;
  uptimeMs?: number;
}

/**
 * Normalise a row from Spring Boot (camelCase) to the snake_case format
 * that the frontend components expect.
 */
function normaliseRow(row: Record<string, unknown>): FeedingHistoryRow {
  return {
    id: (row.id as number) ?? 0,
    device_id: (row.device_id ?? row.deviceId ?? '') as string,
    recorded_at: (row.recorded_at ?? row.recordedAt ?? '') as string,
    status: (row.status ?? '') as string,
    feeding_active: (row.feeding_active ?? row.feedingActive ?? false) as boolean,
    hopper_level: (row.hopper_level ?? row.hopperLevel ?? 0) as number,
    hopper_capacity: (row.hopper_capacity ?? row.hopperCapacity ?? 0) as number,
    hopper_percentage: (row.hopper_percentage ?? row.hopperPercentage ?? 0) as number,
    current_weight: (row.current_weight ?? row.currentWeight ?? 0) as number,
    target_weight: (row.target_weight ?? row.targetWeight ?? 0) as number,
    feed_count: (row.feed_count ?? row.feedCount ?? 0) as number,
    total_grams_fed: (row.total_grams_fed ?? row.totalGramsFed ?? 0) as number,
    motor_status: (row.motor_status ?? row.motorStatus ?? '') as string,
    plate_speed: (row.plate_speed ?? row.plateSpeed ?? 0) as number,
    esc_percent: (row.esc_percent ?? row.escPercent ?? 0) as number,
    rssi: (row.rssi ?? null) as number | null,
    ip_address: (row.ip_address ?? row.ipAddress ?? null) as string | null,
    uptime_ms: (row.uptime_ms ?? row.uptimeMs ?? 0) as number,
  };
}

// ─── Query helpers (now backed by Spring Boot REST API → MySQL) ───

/**
 * Fetch feeding history for a device within a time range.
 * Primary source: Backend REST API (MySQL, auto-created table).
 */
export async function fetchFeedingHistory(
  deviceId: string,
  hoursBack: number = 24,
  limit: number = 2000,
): Promise<FeedingHistoryRow[]> {
  try {
    const res = await axios.get(`${API_URL}/api/feeding/history`, {
      params: { deviceId, hours: hoursBack, limit },
      timeout: 10000,
    });
    const rows = Array.isArray(res.data) ? res.data : [];
    return rows.map((r: Record<string, unknown>) => normaliseRow(r));
  } catch (err) {
    console.error('[FeedingHistory] Error fetching from backend:', err);
    return [];
  }
}

/**
 * Fetch only feeding events (start/stop) for a device.
 * Primary source: Backend REST API (MySQL).
 */
export async function fetchFeedingEvents(
  deviceId: string,
  hoursBack: number = 72,
  limit: number = 100,
): Promise<FeedingHistoryRow[]> {
  try {
    const res = await axios.get(`${API_URL}/api/feeding/events`, {
      params: { deviceId, hours: hoursBack, limit },
      timeout: 10000,
    });
    const rows = Array.isArray(res.data) ? res.data : [];
    return rows.map((r: Record<string, unknown>) => normaliseRow(r));
  } catch (err) {
    console.error('[FeedingHistory] Error fetching events from backend:', err);
    return [];
  }
}
