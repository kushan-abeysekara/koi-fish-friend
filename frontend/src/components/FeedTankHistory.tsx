import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell,
  Brush, ReferenceLine
} from 'recharts';
import {
  supabase,
  fetchFeedingHistory,
  fetchFeedingEvents,
  type FeedingHistoryRow
} from '../services/supabase';

const DEVICE_ID = 'feed_device_001';

/* ── Time-range options ── */
const RANGES = [
  { label: '1 Hour',  value: 1,   key: '1H'  },
  { label: '6 Hours', value: 6,   key: '6H'  },
  { label: '24 Hours',value: 24,  key: '24H' },
  { label: '3 Days',  value: 72,  key: '3D'  },
  { label: '7 Days',  value: 168, key: '7D'  },
  { label: '30 Days', value: 720, key: '30D' },
];

/* ── Chart colors ── */
const COLORS = {
  hopper:    '#8b5cf6',
  weight:    '#06b6d4',
  feedCount: '#f59e0b',
  total:     '#10b981',
  started:   '#22c55e',
  stopped:   '#ef4444',
};

/* ─────────────────── Component ─────────────────── */
const FeedTankHistory: React.FC = () => {
  const [historyData, setHistoryData] = useState<FeedingHistoryRow[]>([]);
  const [feedingEvents, setFeedingEvents] = useState<FeedingHistoryRow[]>([]);
  const [range, setRange] = useState(24);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'capacity' | 'feeding' | 'events'>('overview');
  const chartContainerRef = useRef<HTMLDivElement>(null);

  /* ── Load data ── */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [history, events] = await Promise.all([
        fetchFeedingHistory(DEVICE_ID, range, 5000),
        fetchFeedingEvents(DEVICE_ID, Math.max(range, 72), 500),
      ]);
      setHistoryData(history);
      setFeedingEvents(events);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Realtime subscription ── */
  useEffect(() => {
    const channel = supabase
      .channel('tank_history_rt')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'feeding_history',
        filter: `device_id=eq.${DEVICE_ID}`,
      }, (payload) => {
        const row = payload.new as FeedingHistoryRow;
        setHistoryData(prev => [...prev, row].slice(-5000));
        if (row.status === 'feeding_started' || row.status === 'feeding_stopped') {
          setFeedingEvents(prev => [...prev, row].slice(-500));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  /* ── Prepare chart data ── */
  const chartData = historyData.map(row => {
    const d = new Date(row.recorded_at);
    return {
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      fullTime: d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
      hopperPct: row.hopper_percentage,
      hopperKg: row.hopper_level / 1000,
      capacityKg: row.hopper_capacity / 1000,
      weightG: row.current_weight,
      feedCount: row.feed_count,
      totalFedKg: row.total_grams_fed / 1000,
      status: row.status,
      feeding: row.feeding_active,
    };
  });

  /* ── Daily summary for bar chart ── */
  const dailySummary = (() => {
    const days: Record<string, { date: string; totalFed: number; sessions: number; avgHopper: number; count: number }> = {};
    historyData.forEach(row => {
      const dayKey = new Date(row.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!days[dayKey]) days[dayKey] = { date: dayKey, totalFed: 0, sessions: 0, avgHopper: 0, count: 0 };
      days[dayKey].totalFed = Math.max(days[dayKey].totalFed, row.total_grams_fed / 1000);
      days[dayKey].sessions = Math.max(days[dayKey].sessions, row.feed_count);
      days[dayKey].avgHopper += row.hopper_percentage;
      days[dayKey].count++;
    });
    return Object.values(days).map(d => ({
      ...d,
      avgHopper: d.count > 0 ? Math.round(d.avgHopper / d.count) : 0,
    }));
  })();

  /* ── Stats ── */
  const stats = (() => {
    if (historyData.length === 0) return null;
    const last = historyData[historyData.length - 1];
    const first = historyData[0];
    const maxHopper = Math.max(...historyData.map(r => r.hopper_percentage));
    const minHopper = Math.min(...historyData.map(r => r.hopper_percentage));
    const avgHopper = historyData.reduce((s, r) => s + r.hopper_percentage, 0) / historyData.length;
    const totalEvents = feedingEvents.filter(e => e.status === 'feeding_stopped').length;
    const totalFed = last.total_grams_fed - first.total_grams_fed;
    return {
      currentPct: last.hopper_percentage,
      currentKg: last.hopper_level / 1000,
      capacityKg: last.hopper_capacity / 1000,
      maxHopper: maxHopper.toFixed(1),
      minHopper: minHopper.toFixed(1),
      avgHopper: avgHopper.toFixed(1),
      totalEvents,
      totalFed: (totalFed / 1000).toFixed(2),
      records: historyData.length,
    };
  })();

  /* ── Export Functions ── */
  const exportCSV = () => {
    setExporting(true);
    try {
      const headers = [
        'Timestamp', 'Hopper %', 'Hopper (kg)', 'Capacity (kg)',
        'Scale Weight (g)', 'Feed Count', 'Total Fed (kg)',
        'Motor Status', 'ESC %', 'Status'
      ];
      const rows = historyData.map(r => [
        new Date(r.recorded_at).toLocaleString(),
        r.hopper_percentage.toFixed(1),
        (r.hopper_level / 1000).toFixed(2),
        (r.hopper_capacity / 1000).toFixed(1),
        r.current_weight.toFixed(1),
        r.feed_count,
        (r.total_grams_fed / 1000).toFixed(2),
        r.motor_status,
        r.esc_percent.toFixed(0),
        r.status,
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `feed-tank-history-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const exportJSON = () => {
    setExporting(true);
    try {
      const blob = new Blob([JSON.stringify(historyData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `feed-tank-history-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const printReport = () => {
    const rangeLabel = RANGES.find(r => r.value === range)?.label || `${range}h`;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const eventsHTML = feedingEvents.slice().reverse().slice(0, 50).map(e =>
      `<tr>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;font-size:12px">${new Date(e.recorded_at).toLocaleString()}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;font-size:12px">
          <span style="color:${e.status === 'feeding_started' ? '#16a34a' : '#dc2626'};font-weight:600">
            ${e.status === 'feeding_started' ? '▶ Started' : '⬛ Stopped'}
          </span>
        </td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;font-size:12px;text-align:right">${e.current_weight.toFixed(1)}g</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;font-size:12px;text-align:right">${(e.total_grams_fed / 1000).toFixed(2)}kg</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;font-size:12px;text-align:right">${e.hopper_percentage.toFixed(1)}%</td>
      </tr>`
    ).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Feed Tank History Report</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; color: #1f2937; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #8b5cf6; padding-bottom: 20px; }
          .header h1 { color: #4c1d95; font-size: 24px; margin: 0; }
          .header p { color: #6b7280; font-size: 14px; margin-top: 5px; }
          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
          .stat-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; text-align: center; }
          .stat-value { font-size: 22px; font-weight: 700; color: #1f2937; }
          .stat-label { font-size: 11px; color: #6b7280; text-transform: uppercase; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th { background: #f3f4f6; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
          .section-title { font-size: 16px; font-weight: 700; margin-top: 30px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🐟 KoiFishFriend — Feed Tank History Report</h1>
          <p>Device: ${DEVICE_ID} &bull; Range: ${rangeLabel} &bull; Generated: ${new Date().toLocaleString()}</p>
          <p>${historyData.length} data points &bull; ${feedingEvents.filter(e => e.status === 'feeding_stopped').length} feeding sessions</p>
        </div>

        ${stats ? `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${stats.currentPct.toFixed(1)}%</div>
            <div class="stat-label">Current Hopper Level</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.currentKg.toFixed(2)} kg</div>
            <div class="stat-label">Current Feed Weight</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.totalFed} kg</div>
            <div class="stat-label">Total Feed Dispensed</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.totalEvents}</div>
            <div class="stat-label">Feeding Sessions</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.maxHopper}%</div>
            <div class="stat-label">Max Hopper Level</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.minHopper}%</div>
            <div class="stat-label">Min Hopper Level</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.avgHopper}%</div>
            <div class="stat-label">Avg Hopper Level</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.capacityKg} kg</div>
            <div class="stat-label">Tank Capacity</div>
          </div>
        </div>
        ` : ''}

        <div class="section-title">Feeding Events</div>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th style="text-align:right">Weight</th>
              <th style="text-align:right">Total Fed</th>
              <th style="text-align:right">Hopper</th>
            </tr>
          </thead>
          <tbody>${eventsHTML || '<tr><td colspan="5" style="padding:20px;text-align:center;color:#9ca3af">No feeding events in this period</td></tr>'}</tbody>
        </table>
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  /* ── Tooltip formatter ── */
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 min-w-[180px]">
        <p className="text-xs font-semibold text-gray-600 mb-2">{label}</p>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
              {p.name}
            </span>
            <span className="font-semibold text-gray-800">{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</span>
          </div>
        ))}
      </div>
    );
  };

  /* ─────────── RENDER ─────────── */
  return (
    <div className="space-y-5 max-w-7xl mx-auto" ref={chartContainerRef}>

      {/* ── HEADER ── */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 rounded-2xl p-5 sm:p-6 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <i className="fas fa-chart-area text-3xl"></i>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">Feed Tank History</h2>
              <p className="text-purple-200 text-xs sm:text-sm">
                Historical hopper capacity &amp; feeding data &bull; Stored in Supabase
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Time range buttons */}
            {RANGES.map(r => (
              <button
                key={r.key}
                onClick={() => setRange(r.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  range === r.value
                    ? 'bg-white text-purple-700 shadow-md'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                {r.key}
              </button>
            ))}
          </div>
        </div>

        {/* Export buttons row */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/20">
          <span className="text-purple-200 text-xs mr-2">
            <i className="fas fa-download mr-1"></i>Export:
          </span>
          <button
            onClick={exportCSV}
            disabled={exporting || historyData.length === 0}
            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 flex items-center gap-1.5"
          >
            <i className="fas fa-file-csv"></i> CSV
          </button>
          <button
            onClick={exportJSON}
            disabled={exporting || historyData.length === 0}
            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 flex items-center gap-1.5"
          >
            <i className="fas fa-file-code"></i> JSON
          </button>
          <button
            onClick={printReport}
            disabled={exporting || historyData.length === 0}
            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 flex items-center gap-1.5"
          >
            <i className="fas fa-print"></i> Print Report
          </button>
          <span className="ml-auto text-purple-200 text-xs">
            {historyData.length} records
          </span>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            icon="fas fa-gas-pump"
            iconBg="bg-violet-100"
            iconColor="text-violet-600"
            label="Current Level"
            value={`${stats.currentPct.toFixed(1)}%`}
            sub={`${stats.currentKg.toFixed(2)} / ${stats.capacityKg} kg`}
          />
          <StatCard
            icon="fas fa-arrow-up"
            iconBg="bg-green-100"
            iconColor="text-green-600"
            label="Max Level"
            value={`${stats.maxHopper}%`}
            sub={`Min: ${stats.minHopper}% &bull; Avg: ${stats.avgHopper}%`}
          />
          <StatCard
            icon="fas fa-weight"
            iconBg="bg-cyan-100"
            iconColor="text-cyan-600"
            label="Total Dispensed"
            value={`${stats.totalFed} kg`}
            sub={`${stats.totalEvents} feeding sessions`}
          />
          <StatCard
            icon="fas fa-database"
            iconBg="bg-amber-100"
            iconColor="text-amber-600"
            label="Data Points"
            value={stats.records.toLocaleString()}
            sub={`${RANGES.find(r => r.value === range)?.label || ''} range`}
          />
        </div>
      )}

      {/* ── TAB NAVIGATION ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {[
            { key: 'overview' as const, label: 'Overview', icon: 'fas fa-chart-pie' },
            { key: 'capacity' as const, label: 'Tank Capacity', icon: 'fas fa-gas-pump' },
            { key: 'feeding' as const, label: 'Feeding Data', icon: 'fas fa-utensils' },
            { key: 'events' as const, label: 'Event Log', icon: 'fas fa-list-alt' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'text-violet-700 border-b-2 border-violet-600 bg-violet-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <i className={tab.icon + ' text-xs'}></i>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-10 h-10 border-3 border-violet-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm text-gray-500">Loading historical data...</p>
              </div>
            </div>
          ) : historyData.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center text-gray-400">
                <i className="fas fa-database text-5xl mb-4"></i>
                <p className="text-lg font-semibold">No Data Available</p>
                <p className="text-sm mt-2">
                  The server stores feeding data automatically.<br/>
                  Data will appear once the device starts sending messages.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* ═══ OVERVIEW TAB ═══ */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Combined Hopper + Weight chart */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <i className="fas fa-chart-line text-violet-500"></i>
                      Hopper Level &amp; Scale Weight Over Time
                    </h3>
                    <ResponsiveContainer width="100%" height={320}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis yAxisId="pct" tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                        <YAxis yAxisId="weight" orientation="right" tick={{ fontSize: 10 }} unit="g" />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Line yAxisId="pct" type="monotone" dataKey="hopperPct" name="Hopper %" stroke={COLORS.hopper} strokeWidth={2} dot={false} />
                        <Line yAxisId="weight" type="monotone" dataKey="weightG" name="Scale (g)" stroke={COLORS.weight} strokeWidth={2} dot={false} />
                        {chartData.length > 80 && <Brush dataKey="time" height={25} stroke={COLORS.hopper} />}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Daily summary bar chart */}
                  {dailySummary.length > 1 && (
                    <div>
                      <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <i className="fas fa-chart-bar text-amber-500"></i>
                        Daily Feed Summary
                      </h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={dailySummary}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis yAxisId="kg" tick={{ fontSize: 10 }} unit="kg" />
                          <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                          <Bar yAxisId="kg" dataKey="totalFed" name="Total Fed (kg)" fill={COLORS.total} radius={[6, 6, 0, 0]} />
                          <Line yAxisId="pct" type="monotone" dataKey="avgHopper" name="Avg Hopper %" stroke={COLORS.hopper} strokeWidth={2} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}

              {/* ═══ TANK CAPACITY TAB ═══ */}
              {activeTab === 'capacity' && (
                <div className="space-y-6">
                  {/* Hopper % Area Chart */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <i className="fas fa-gas-pump text-violet-500"></i>
                      Tank Level Percentage Over Time
                    </h3>
                    <ResponsiveContainer width="100%" height={320}>
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="tankGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS.hopper} stopOpacity={0.35} />
                            <stop offset="95%" stopColor={COLORS.hopper} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine y={25} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Low (25%)', position: 'insideTopLeft', fill: '#ef4444', fontSize: 10 }} />
                        <ReferenceLine y={75} stroke="#22c55e" strokeDasharray="5 5" label={{ value: 'Good (75%)', position: 'insideTopLeft', fill: '#22c55e', fontSize: 10 }} />
                        <Area type="monotone" dataKey="hopperPct" name="Hopper %" stroke={COLORS.hopper} strokeWidth={2.5} fill="url(#tankGrad)" />
                        {chartData.length > 80 && <Brush dataKey="time" height={25} stroke={COLORS.hopper} />}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Hopper Kg chart */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <i className="fas fa-weight text-indigo-500"></i>
                      Tank Weight (kg) Over Time
                    </h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="tankKgGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 10 }} unit="kg" />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="hopperKg" name="Feed (kg)" stroke="#6366f1" strokeWidth={2} fill="url(#tankKgGrad)" />
                        {chartData.length > 80 && <Brush dataKey="time" height={25} stroke="#6366f1" />}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* ═══ FEEDING DATA TAB ═══ */}
              {activeTab === 'feeding' && (
                <div className="space-y-6">
                  {/* Cumulative feed chart */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <i className="fas fa-chart-line text-emerald-500"></i>
                      Cumulative Feed Dispensed &amp; Feed Sessions
                    </h3>
                    <ResponsiveContainer width="100%" height={320}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis yAxisId="kg" tick={{ fontSize: 10 }} unit="kg" />
                        <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Line yAxisId="kg" type="monotone" dataKey="totalFedKg" name="Total Fed (kg)" stroke={COLORS.total} strokeWidth={2.5} dot={false} />
                        <Line yAxisId="count" type="stepAfter" dataKey="feedCount" name="Feed Sessions" stroke={COLORS.feedCount} strokeWidth={2} dot={false} />
                        {chartData.length > 80 && <Brush dataKey="time" height={25} stroke={COLORS.total} />}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Scale weight chart */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <i className="fas fa-balance-scale text-cyan-500"></i>
                      Scale Weight (Feed Being Dispensed)
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="scaleGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS.weight} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={COLORS.weight} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 10 }} unit="g" />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="weightG" name="Scale (g)" stroke={COLORS.weight} strokeWidth={2} fill="url(#scaleGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* ═══ EVENT LOG TAB ═══ */}
              {activeTab === 'events' && (
                <div>
                  <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <i className="fas fa-list-alt text-violet-500"></i>
                    Feeding Events Log
                    <span className="ml-auto text-xs font-normal text-gray-400">
                      {feedingEvents.length} events
                    </span>
                  </h3>
                  {feedingEvents.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Date &amp; Time</th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Event</th>
                            <th className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase">Scale</th>
                            <th className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase">Total Fed</th>
                            <th className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase">Hopper</th>
                            <th className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase">Session #</th>
                          </tr>
                        </thead>
                        <tbody>
                          {feedingEvents.slice().reverse().map((evt, i) => (
                            <tr key={evt.id || i} className="border-t border-gray-100 hover:bg-violet-50/40 transition-colors">
                              <td className="py-3 px-4 text-xs text-gray-600 font-mono">
                                {new Date(evt.recorded_at).toLocaleString('en-US', {
                                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
                                })}
                              </td>
                              <td className="py-3 px-4">
                                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                                  evt.status === 'feeding_started'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                  <i className={`fas ${evt.status === 'feeding_started' ? 'fa-play' : 'fa-stop'} text-[9px]`}></i>
                                  {evt.status === 'feeding_started' ? 'Started' : 'Stopped'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right text-xs font-mono text-gray-700">{evt.current_weight.toFixed(1)} g</td>
                              <td className="py-3 px-4 text-right text-xs font-mono text-gray-700">{(evt.total_grams_fed / 1000).toFixed(2)} kg</td>
                              <td className="py-3 px-4 text-right">
                                <span className={`text-xs font-semibold ${
                                  evt.hopper_percentage > 50 ? 'text-green-600' :
                                  evt.hopper_percentage > 25 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  {evt.hopper_percentage.toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right text-xs font-mono text-gray-700">#{evt.feed_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-gray-400">
                      <i className="fas fa-list text-3xl mb-3"></i>
                      <p className="text-sm">No feeding events recorded in this period.</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Stat Card Component ── */
const StatCard: React.FC<{
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  sub: string;
}> = ({ icon, iconBg, iconColor, label, value, sub }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-center gap-3 mb-2">
      <div className={`w-9 h-9 ${iconBg} rounded-lg flex items-center justify-center`}>
        <i className={`${icon} ${iconColor} text-sm`}></i>
      </div>
      <span className="text-xs text-gray-500 font-semibold uppercase">{label}</span>
    </div>
    <p className="text-xl sm:text-2xl font-bold text-gray-800">{value}</p>
    <p className="text-xs text-gray-400 mt-1" dangerouslySetInnerHTML={{ __html: sub }} />
  </div>
);

export default FeedTankHistory;
