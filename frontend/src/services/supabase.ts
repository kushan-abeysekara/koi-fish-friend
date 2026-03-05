import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';

// Self-hosted Supabase instance (kept for optional real-time subscriptions)
// MUST be http:// (not https://) — self-hosted instance has no TLS.
// This makes the Supabase JS client use ws:// instead of wss:// for Realtime.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'http://superbase.koifishfriend.online';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzIxODYyMzcsImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6ImFub24iLCJpc3MiOiJzdXBhYmFzZSJ9.EfWDPx24M0OjJa5QjzEX4SbMwM_gG_71fhGLkYrBprY';

// Backend REST API base URL (reads from Supabase via pg/query)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';

// ─── Supabase pg/query — direct SQL access (same endpoint ESP32 uses to write) ───
// This is the most reliable path: ESP32 → pg/query (write) → pg/query (read) → Frontend
const SUPABASE_PG_URL = SUPABASE_URL + '/pg/query';
const SUPABASE_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';

/**
 * Execute a raw SQL query against Supabase pg/query endpoint.
 * Returns the result rows as a typed array.
 */
export async function supabasePgQuery<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const res = await axios.post(SUPABASE_PG_URL, { query: sql }, {
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    timeout: 5000,
  });
  return Array.isArray(res.data) ? res.data : [];
}

/**
 * Fetch device status DIRECTLY from Supabase feeddb table (bypasses backend).
 * The ESP32 UPSERTs this table every 2 seconds — this is the freshest data source.
 * Calculates online/offline based on how stale `updated_at` is.
 */
export async function fetchDeviceStatusDirect(
  deviceId: string = 'feed_device_001',
): Promise<FeeddbRow | null> {
  try {
    const rows = await supabasePgQuery<FeeddbRow & { age_seconds: number }>(
      `SELECT *, EXTRACT(EPOCH FROM (now() - updated_at))::float AS age_seconds FROM feeddb WHERE device_id = '${deviceId}' LIMIT 1`,
    );
    if (rows.length > 0) {
      const row = rows[0];
      // Device is online if data is less than 15 seconds old
      const age = row.age_seconds ?? 999;
      row.status = age < 15 ? 'online' : 'offline';
      return row;
    }
    return null;
  } catch (err) {
    console.error('[Supabase Direct] fetchDeviceStatusDirect error:', err);
    return null;
  }
}

/** Last feeding event from feeding_history table (ESP32 logs start/stop events directly) */
export interface LastFeedingEvent {
  id: number;
  event_type: string;
  recorded_at: string;
  tank_before: number;
  tank_after: number;
  total_feed: number;
  duration_ms: number;
  target_weight: number;
  feed_count: number;
  total_grams_fed: number;
  motor_max_speed: number;
  weight: number;
}

/**
 * Fetch the most recent completed feeding event from Supabase feeding_history.
 * The ESP32 logs 'feeding_started' and 'feeding_stopped' events directly.
 */
export async function fetchLastFeedingEvent(
  deviceId: string = 'feed_device_001',
): Promise<LastFeedingEvent | null> {
  try {
    const rows = await supabasePgQuery<LastFeedingEvent>(
      `SELECT * FROM feeding_history WHERE device_id = '${deviceId}' AND event_type = 'feeding_stopped' ORDER BY recorded_at DESC LIMIT 1`,
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (err) {
    console.error('[Supabase Direct] fetchLastFeedingEvent error:', err);
    return null;
  }
}

/**
 * Fetch recent feeding events from Supabase feeding_history directly.
 */
export async function fetchFeedingEventsDirect(
  deviceId: string = 'feed_device_001',
  limit: number = 20,
): Promise<LastFeedingEvent[]> {
  try {
    return await supabasePgQuery<LastFeedingEvent>(
      `SELECT * FROM feeding_history WHERE device_id = '${deviceId}' ORDER BY recorded_at DESC LIMIT ${limit}`,
    );
  } catch (err) {
    console.error('[Supabase Direct] fetchFeedingEventsDirect error:', err);
    return [];
  }
}

/**
 * Fetch weight history directly from Supabase weight_history table.
 * ESP32 inserts every 10 seconds.
 */
export async function fetchWeightHistoryDirect(
  deviceId: string = 'feed_device_001',
  hoursBack: number = 24,
  limit: number = 2000,
): Promise<WeightHistoryRow[]> {
  try {
    return await supabasePgQuery<WeightHistoryRow>(
      `SELECT * FROM weight_history WHERE device_id = '${deviceId}' AND recorded_at > now() - interval '${hoursBack} hours' ORDER BY recorded_at ASC LIMIT ${limit}`,
    );
  } catch (err) {
    console.error('[Supabase Direct] fetchWeightHistoryDirect error:', err);
    return [];
  }
}

// Safe initialisation — never crash the app if Supabase is unavailable
let _client: SupabaseClient | null = null;
try {
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: { params: { eventsPerSecond: 10 } },
  });
} catch (err) {
  console.warn('[Supabase] Failed to initialise client:', err);
}

export const supabase: SupabaseClient | null = _client;

// ─── Types (matches Supabase table schemas) ───

/** feeddb table — ESP32 writes every 2 seconds (UPSERT per device) */
export interface FeeddbRow {
  device_id: string;
  status?: string;           // 'online' | 'offline' — set by backend based on last_seen staleness
  weight: number;
  tank_level: number;
  tank_capacity: number;
  tank_percentage: number;
  motor_status: string;
  motor_rpm: number;
  esc_percent: number;
  feeding_active: boolean;
  feed_count: number;
  total_grams_fed: number;
  target_weight: number;
  device_time: string;
  uptime_ms: number;
  rssi: number;
  ip_address: string;
  updated_at: string;
}

/** weight_history table — continuous readings every 10 seconds */
export interface WeightHistoryRow {
  id: number;
  device_id: string;
  recorded_at: string;
  weight: number;
  tank_level: number;
  tank_percentage: number;
  motor_rpm: number;
  esc_percent: number;
  motor_status: string;
  feeding_active: boolean;
  rssi: number;
}

/** feeding_history table — start/stop events with tank diff */
export interface FeedingEventRow {
  id: number;
  device_id: string;
  recorded_at: string;
  event_type: string;
  weight: number;
  tank_level: number;
  tank_capacity: number;
  tank_percentage: number;
  tank_before: number | null;
  tank_after: number | null;
  total_feed: number | null;
  motor_max_speed: number | null;
  duration_ms: number | null;
  motor_status: string;
  motor_rpm: number;
  esc_percent: number;
  feeding_active: boolean;
  feed_count: number;
  total_grams_fed: number;
  target_weight: number;
  rssi: number;
  ip_address: string;
}

/** energydb table — backend UPSERTS on every MQTT message (~3s). One row per device. */
export interface EnergyDbRow {
  device_id: string;
  voltage:   number;
  current:   number;
  power:     number;
  energy_wh: number;
  status:    string;
  rssi:      number;
  ip_address: string;
  updated_at: string;
}

/** energy_history table — one INSERT per minute per device. */
export interface EnergyHistoryRow {
  id:          number;
  device_id:   string;
  voltage:     number;
  current:     number;
  power:       number;
  energy_wh:   number;
  status:      string;
  recorded_at: string;
}

/**
 * Legacy FeedingHistoryRow type — used by existing components.
 * Mapped from either WeightHistoryRow or FeedingEventRow for backward compat.
 */
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

/**
 * Normalise a row from backend (Supabase snake_case or Spring Boot camelCase).
 * Maps weight_history/feeding_history columns → FeedingHistoryRow for components.
 */
function normaliseRow(row: Record<string, unknown>): FeedingHistoryRow {
  return {
    id: (row.id as number) ?? 0,
    device_id: (row.device_id ?? row.deviceId ?? '') as string,
    recorded_at: (row.recorded_at ?? row.recordedAt ?? '') as string,
    status: (row.status ?? row.event_type ?? row.motor_status ?? '') as string,
    feeding_active: (row.feeding_active ?? row.feedingActive ?? false) as boolean,
    hopper_level: (row.hopper_level ?? row.hopperLevel ?? row.tank_level ?? 0) as number,
    hopper_capacity: (row.hopper_capacity ?? row.hopperCapacity ?? row.tank_capacity ?? 20000) as number,
    hopper_percentage: (row.hopper_percentage ?? row.hopperPercentage ?? row.tank_percentage ?? 0) as number,
    current_weight: (row.current_weight ?? row.currentWeight ?? row.weight ?? 0) as number,
    target_weight: (row.target_weight ?? row.targetWeight ?? 0) as number,
    feed_count: (row.feed_count ?? row.feedCount ?? 0) as number,
    total_grams_fed: (row.total_grams_fed ?? row.totalGramsFed ?? 0) as number,
    motor_status: (row.motor_status ?? row.motorStatus ?? '') as string,
    plate_speed: (row.plate_speed ?? row.plateSpeed ?? row.motor_rpm ?? 0) as number,
    esc_percent: (row.esc_percent ?? row.escPercent ?? 0) as number,
    rssi: (row.rssi ?? null) as number | null,
    ip_address: (row.ip_address ?? row.ipAddress ?? null) as string | null,
    uptime_ms: (row.uptime_ms ?? row.uptimeMs ?? 0) as number,
  };
}

// ─── Query helpers (backed by Backend REST API → Supabase pg/query) ───

/**
 * Fetch weight history (continuous readings) from Supabase via backend.
 * Used for Live Weight Monitor and Hopper Level Trend charts.
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
 * Fetch feeding events (start/stop) from Supabase via backend.
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

/**
 * Fetch real-time device status from Supabase feeddb via backend.
 */
export async function fetchDeviceStatus(
  deviceId: string = 'feed_device_001',
): Promise<FeeddbRow | null> {
  try {
    const res = await axios.get(`${API_URL}/api/feeding/device-status`, {
      params: { deviceId },
      timeout: 3000,
    });
    return res.data as FeeddbRow;
  } catch (err) {
    console.error('[DeviceStatus] Error fetching from backend:', err);
    return null;
  }
}

/**
 * Fetch weight history specifically for charts.
 */
export async function fetchWeightHistory(
  deviceId: string,
  hoursBack: number = 24,
  limit: number = 5000,
): Promise<WeightHistoryRow[]> {
  try {
    const res = await axios.get(`${API_URL}/api/feeding/weight-history`, {
      params: { deviceId, hours: hoursBack, limit },
      timeout: 10000,
    });
    return Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    console.error('[WeightHistory] Error fetching from backend:', err);
    return [];
  }
}

// ─── Manual Feeding types & API calls ───

export interface ManualFeedingRow {
  id: number;
  device_id: string;
  requested_amount: number;
  requested_unit: string;
  tank_before: number;
  tank_after: number | null;
  actual_dispensed: number | null;
  status: string;           // 'feeding' | 'completed' | 'cancelled'
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  created_at: string;
}

/**
 * Start a manual feeding — creates Supabase record and sends MQTT start.
 */
export async function startManualFeeding(
  deviceId: string,
  amount: number,
  unit: string,
  tankBefore: number,
): Promise<{ id?: number; started_at?: string; error?: string }> {
  try {
    const res = await axios.post(`${API_URL}/api/feeding/manual-feeding/start`, {
      deviceId,
      amount,
      unit,
      tankBefore,
    }, { timeout: 8000 });
    return res.data;
  } catch (err) {
    console.error('[ManualFeed] Error starting:', err);
    return { error: String(err) };
  }
}

/**
 * Complete a manual feeding.
 */
export async function completeManualFeeding(
  feedingId: number,
  tankAfter: number,
  actualDispensed: number,
  durationMs: number,
): Promise<{ status?: string; error?: string }> {
  try {
    const res = await axios.post(`${API_URL}/api/feeding/manual-feeding/complete`, {
      feedingId,
      tankAfter,
      actualDispensed,
      durationMs,
    }, { timeout: 8000 });
    return res.data;
  } catch (err) {
    console.error('[ManualFeed] Error completing:', err);
    return { error: String(err) };
  }
}

/**
 * Cancel a manual feeding.
 */
export async function cancelManualFeeding(
  feedingId: number,
  tankAfter: number,
): Promise<{ status?: string; error?: string }> {
  try {
    const res = await axios.post(`${API_URL}/api/feeding/manual-feeding/cancel`, {
      feedingId,
      tankAfter,
    }, { timeout: 8000 });
    return res.data;
  } catch (err) {
    console.error('[ManualFeed] Error cancelling:', err);
    return { error: String(err) };
  }
}

/**
 * Fetch manual feeding history from Supabase.
 */
export async function fetchManualFeedingHistory(
  deviceId: string = 'feed_device_001',
  limit: number = 20,
): Promise<ManualFeedingRow[]> {
  try {
    const res = await axios.get(`${API_URL}/api/feeding/manual-feeding/history`, {
      params: { deviceId, limit },
      timeout: 8000,
    });
    return Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    console.error('[ManualFeed] Error fetching history:', err);
    return [];
  }
}

// ─── Energy Monitor — Supabase direct queries ────────────────────────────────

/**
 * Fetch energy_history rows for the given time range directly from Supabase.
 * Returns rows newest-first. Falls back to empty array on error.
 */
export async function fetchEnergyHistory(
  hoursBack: number = 24,
  limit: number = 1500,
): Promise<EnergyHistoryRow[]> {
  if (!supabase) return [];
  try {
    const since = new Date(Date.now() - hoursBack * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from('energy_history')
      .select('*')
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as EnergyHistoryRow[];
  } catch (err) {
    console.warn('[Supabase] fetchEnergyHistory failed:', err);
    return [];
  }
}

/**
 * Fetch the latest live status row from energydb for a given device.
 */
export async function fetchEnergyLive(deviceId: string): Promise<EnergyDbRow | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('energydb')
      .select('*')
      .eq('device_id', deviceId)
      .single();

    if (error) throw error;
    return (data ?? null) as EnergyDbRow | null;
  } catch (err) {
    console.warn('[Supabase] fetchEnergyLive failed:', err);
    return null;
  }
}
