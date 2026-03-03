import { useState, useEffect, useCallback, useRef } from 'react';
import { powerScheduleApi, sensorDeviceApi } from '../services/api';
import type { PowerSchedule, SensorDevice } from '../services/api';
import {
  Edit2, Trash2, Plus, Calendar, Clock, Power, RefreshCw, Check, X,
  Zap, Wifi, WifiOff, Activity, AlertTriangle, ChevronRight
} from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning';
interface Toast { id: number; type: ToastType; message: string }
interface ConfirmDialog { message: string; onConfirm: () => void }

interface DeviceState extends SensorDevice {
  relayState?: 'ON' | 'OFF';
  controlMode?: 'manual' | 'schedule' | 'auto';
  scheduleCount?: number;
}

export default function PowerManagement() {
  const [activeTab, setActiveTab] = useState<'control' | 'schedules'>('control');
  const [device, setDevice] = useState<DeviceState | null>(null);
  const [schedules, setSchedules] = useState<PowerSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<PowerSchedule | null>(null);
  const [commandInProgress, setCommandInProgress] = useState(false);
  const commandSentAt = useRef<number>(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<ConfirmDialog | null>(null);

  // Check device online status from MQTT device status (published every 5s by ESP32)
  // NOT from sensor data - device status is more reliable for control interface
  const isOnline = device !== null && 
    device.status === 'online' &&
    device.lastSeen !== null &&
    (Date.now() - new Date(device.lastSeen).getTime()) < 20000; // 20s grace period

  const [formData, setFormData] = useState({
    name: '',
    startTime: '',
    endTime: '',
    daysOfWeek: [false, false, false, false, false, false, false],
    enabled: true,
    autoMode: false,
  });

  // ── Toast helpers ────────────────────────────────────────────
  const showToast = (type: ToastType, message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const askConfirm = (message: string, onConfirm: () => void) => {
    setConfirm({ message, onConfirm });
  };

  // ── Data fetching ────────────────────────────────────────────
  useEffect(() => {
    const fetchDevice = async () => {
      setLoading(true);
      setError(null);
      try {
        const deviceRes = await sensorDeviceApi.getAll();
        if (deviceRes.success && deviceRes.data) {
          const bm = deviceRes.data.find(d => d.deviceType === 'BUDGET_MANAGEMENT');
          setDevice(prev => {
            if (!bm) return null;
            const updated = bm as DeviceState;
            // Hold optimistic state for 10s after a command — gives ESP32 time to
            // respond via MQTT and the backend to persist the confirmed state.
            const holdOptimistic = Date.now() - commandSentAt.current < 10000;
            return {
              ...updated,
              relayState: holdOptimistic
                ? (prev?.relayState ?? updated.relayState as DeviceState['relayState'])
                : (updated.relayState as DeviceState['relayState'] ?? prev?.relayState),
              controlMode: holdOptimistic
                ? (prev?.controlMode ?? updated.controlMode as DeviceState['controlMode'])
                : (updated.controlMode as DeviceState['controlMode'] ?? prev?.controlMode),
            };
          });
        }
      } catch {
        setError('Failed to fetch device');
      } finally {
        setLoading(false);
      }
    };
    fetchDevice();
    const iv = setInterval(fetchDevice, 5000);
    return () => clearInterval(iv);
  }, []);

  const fetchSchedules = useCallback(async () => {
    if (!device) return;
    try {
      const res = await powerScheduleApi.getByDevice(device.deviceId);
      if (res.success && res.data) setSchedules(res.data);
    } catch {
      setError('Failed to fetch schedules');
    }
  }, [device]);

  useEffect(() => {
    if (device && activeTab === 'schedules') fetchSchedules();
  }, [device, activeTab, fetchSchedules]);

  // ── Power commands ───────────────────────────────────────────
  const sendCommand = async (
    action: () => Promise<{ success: boolean; message?: string }>,
    optimistic: Partial<DeviceState>,
    successMsg: string,
    failMsg: string,
  ) => {
    if (!device || commandInProgress) return;
    commandSentAt.current = Date.now();
    setCommandInProgress(true);
    setLoading(true);
    setError(null);
    try {
      const res = await action();
      if (res.success) {
        setDevice(prev => prev ? { ...prev, ...optimistic } : null);
        showToast('success', successMsg);
      } else {
        throw new Error(res.message || failMsg);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : failMsg;
      setError(msg);
      showToast('error', msg);
    } finally {
      setLoading(false);
      setCommandInProgress(false);
    }
  };

  const handlePowerOn = () =>
    sendCommand(
      () => sensorDeviceApi.powerOn(device!.deviceId),
      { relayState: 'ON', controlMode: 'manual' },
      'Relay turned ON',
      'Failed to turn power on',
    );

  const handlePowerOff = () =>
    askConfirm('Cut power to all connected equipment?', () =>
      sendCommand(
        () => sensorDeviceApi.powerOff(device!.deviceId),
        { relayState: 'OFF', controlMode: 'manual' },
        'Relay turned OFF',
        'Failed to turn power off',
      ),
    );

  const handleAutoMode = () =>
    askConfirm('Switch to voltage-based AUTO mode (210–250 V)?', () =>
      sendCommand(
        () => sensorDeviceApi.setAutoMode(device!.deviceId),
        { controlMode: 'auto' },
        'Switched to AUTO mode',
        'Failed to set auto mode',
      ),
    );

  const handleScheduleMode = () =>
    askConfirm('Switch to time-based SCHEDULE mode?', () =>
      sendCommand(
        () => sensorDeviceApi.setScheduleMode(device!.deviceId),
        { controlMode: 'schedule' },
        'Switched to SCHEDULE mode',
        'Failed to set schedule mode',
      ),
    );

  // ── Schedule CRUD ────────────────────────────────────────────
  const handleCreateSchedule = async () => {
    if (!device) return;
    if (!formData.name.trim() || !formData.startTime || !formData.endTime) {
      showToast('warning', 'Fill in name, start time and end time');
      return;
    }
    if (!formData.daysOfWeek.some(d => d)) {
      showToast('warning', 'Select at least one day');
      return;
    }
    try {
      setLoading(true);
      await powerScheduleApi.create({
        deviceId: device.deviceId,
        name: formData.name,
        startTime: formData.startTime,
        endTime: formData.endTime,
        daysOfWeek: formData.daysOfWeek,
        enabled: formData.enabled,
      });
      showToast('success', 'Schedule created');
      setShowForm(false);
      resetForm();
      fetchSchedules();
    } catch {
      showToast('error', 'Failed to create schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSchedule = async () => {
    if (!editingSchedule?.id) return;
    try {
      setLoading(true);
      await powerScheduleApi.update(editingSchedule.id, {
        name: formData.name,
        startTime: formData.startTime,
        endTime: formData.endTime,
        daysOfWeek: formData.daysOfWeek,
        enabled: formData.enabled,
      });
      showToast('success', 'Schedule updated');
      setShowForm(false);
      setEditingSchedule(null);
      resetForm();
      fetchSchedules();
    } catch {
      showToast('error', 'Failed to update schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSchedule = async (id: number) => {
    try {
      await powerScheduleApi.toggle(id);
      fetchSchedules();
    } catch {
      showToast('error', 'Failed to toggle schedule');
    }
  };

  const handleDeleteSchedule = (id: number) =>
    askConfirm('Delete this schedule permanently?', async () => {
      try {
        await powerScheduleApi.delete(id);
        fetchSchedules();
        showToast('success', 'Schedule deleted');
      } catch {
        showToast('error', 'Failed to delete schedule');
      }
    });

  const handleSyncSchedules = async () => {
    if (!device) return;
    try {
      setLoading(true);
      await powerScheduleApi.syncToDevice(device.deviceId);
      showToast('success', 'Schedules synced to ESP32');
    } catch {
      showToast('error', 'Failed to sync schedules');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (schedule: PowerSchedule) => {
    setEditingSchedule(schedule);
    setFormData({
      name: schedule.name,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      daysOfWeek: schedule.daysOfWeek,
      enabled: schedule.enabled,
      autoMode: (schedule as PowerSchedule & { autoMode?: boolean }).autoMode || false,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({ name: '', startTime: '', endTime: '', daysOfWeek: Array(7).fill(false), enabled: true, autoMode: false });
    setEditingSchedule(null);
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // ── Mode config ──────────────────────────────────────────────
  const modes = [
    {
      key: 'power_on' as const,
      label: 'Power ON',
      sub: 'Force relay closed',
      icon: <Zap className="w-6 h-6" />,
      active: device?.controlMode === 'manual' && device?.relayState === 'ON',
      color: 'emerald',
      onClick: handlePowerOn,
    },
    {
      key: 'power_off' as const,
      label: 'Power OFF',
      sub: 'Force relay open',
      icon: <Power className="w-6 h-6" />,
      active: device?.controlMode === 'manual' && device?.relayState === 'OFF',
      color: 'rose',
      onClick: handlePowerOff,
    },
    {
      key: 'auto' as const,
      label: 'Auto',
      sub: 'Voltage-based (210–250 V)',
      icon: <Activity className="w-6 h-6" />,
      active: device?.controlMode === 'auto',
      color: 'sky',
      onClick: handleAutoMode,
    },
    {
      key: 'schedule' as const,
      label: 'Schedule',
      sub: 'Time-based rules',
      icon: <Calendar className="w-6 h-6" />,
      active: device?.controlMode === 'schedule',
      color: 'violet',
      onClick: handleScheduleMode,
    },
  ] as const;

  const colorMap: Record<string, { ring: string; bg: string; badge: string }> = {
    emerald: { ring: 'ring-emerald-400', bg: 'bg-emerald-500 hover:bg-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
    rose:    { ring: 'ring-rose-400',    bg: 'bg-rose-500 hover:bg-rose-600',       badge: 'bg-rose-100 text-rose-700'    },
    sky:     { ring: 'ring-sky-400',     bg: 'bg-sky-500 hover:bg-sky-600',         badge: 'bg-sky-100 text-sky-700'      },
    violet:  { ring: 'ring-violet-400',  bg: 'bg-violet-500 hover:bg-violet-600',   badge: 'bg-violet-100 text-violet-700' },
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Hero Header ─────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-gray-900 text-white px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-yellow-400/20 rounded-xl">
                  <Zap className="w-6 h-6 text-yellow-400" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Power Management</h1>
              </div>
              <p className="text-slate-400 text-sm ml-14">ESP32 relay control &amp; scheduling</p>
            </div>

            {/* Live device pill */}
            {device && (
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur rounded-2xl px-5 py-3 border border-white/10">
                <div className="flex items-center gap-2">
                  {isOnline
                    ? <><span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span></span><span className="text-emerald-400 text-sm font-semibold">Online</span></>
                    : <><WifiOff className="w-4 h-4 text-red-400" /><span className="text-red-400 text-sm font-semibold">Offline</span></>
                  }
                </div>
                <div className="w-px h-5 bg-white/20"></div>
                <span className="font-mono text-sm text-slate-200">{device.deviceId}</span>
                {device.ipAddress && (
                  <>
                    <div className="w-px h-5 bg-white/20"></div>
                    <div className="flex items-center gap-1.5">
                      <Wifi className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono text-xs text-slate-300">{device.ipAddress}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Live KPI strip */}
          {device && (
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Relay',     value: device.relayState ?? '—',   accent: device.relayState === 'ON' ? 'text-emerald-400' : 'text-red-400' },
                { label: 'Mode',      value: device.controlMode ? device.controlMode.charAt(0).toUpperCase() + device.controlMode.slice(1) : '—', accent: 'text-sky-300' },
                { label: 'Schedules', value: device.scheduleCount != null ? String(device.scheduleCount) : '—', accent: 'text-violet-300' },
                { label: 'Signal',    value: device.rssi ? `${device.rssi} dBm` : '—', accent: 'text-slate-300' },
              ].map(k => (
                <div key={k.label} className="bg-white/[0.08] rounded-xl px-4 py-3 border border-white/10">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{k.label}</p>
                  <p className={`text-lg font-bold ${k.accent}`}>{k.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── Error banner ──────────────────────────────────── */}
        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto hover:text-red-900"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* ── No device ─────────────────────────────────────── */}
        {!loading && !device && (
          <div className="bg-white rounded-2xl border border-amber-200 p-10 text-center shadow-sm">
            <WifiOff className="w-12 h-12 mx-auto text-amber-400 mb-3" />
            <h3 className="text-lg font-semibold text-gray-700 mb-1">No device found</h3>
            <p className="text-sm text-gray-500">Power on the BUDGET_MANAGEMENT ESP32 and ensure it connects to MQTT.</p>
          </div>
        )}

        {/* ── Tabs ──────────────────────────────────────────── */}
        {device && (
          <>
            <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1 shadow-sm w-fit">
              {[
                { key: 'control' as const,   label: 'Manual Control', icon: <Zap className="w-4 h-4" /> },
                { key: 'schedules' as const, label: 'Schedules',      icon: <Calendar className="w-4 h-4" /> },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === tab.key
                      ? 'bg-slate-800 text-white shadow'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {tab.icon}{tab.label}
                </button>
              ))}
            </div>

            {/* ─── Control Tab ──────────────────────────────── */}
            {activeTab === 'control' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {modes.map(mode => {
                    const c = colorMap[mode.color];
                    return (
                      <button
                        key={mode.key}
                        onClick={mode.onClick}
                        disabled={loading || commandInProgress || !isOnline}
                        className={`relative group bg-white rounded-2xl border-2 p-5 text-left shadow-sm transition-all duration-200
                          hover:shadow-md hover:-translate-y-0.5 active:scale-95
                          disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm
                          ${mode.active ? `border-transparent ring-2 ${c.ring} ring-offset-2` : 'border-gray-100 hover:border-gray-200'}
                        `}
                      >
                        {mode.active && (
                          <span className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full ${c.badge} uppercase tracking-wide`}>
                            Active
                          </span>
                        )}
                        <div className={`inline-flex p-2.5 rounded-xl mb-4 ${c.bg} text-white`}>
                          {mode.icon}
                        </div>
                        <p className="font-bold text-gray-800 text-base leading-tight">{mode.label}</p>
                        <p className="text-xs text-gray-400 mt-1 leading-snug">{mode.sub}</p>
                        {!isOnline && (
                          <p className="text-xs text-red-400 mt-2 font-medium">Device offline</p>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Info strip */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                  {[
                    { icon: <Zap className="w-4 h-4 text-emerald-500" />, title: 'Manual ON / OFF', desc: 'Directly opens or closes the relay. State is saved to ESP32 flash and persists across reboots.' },
                    { icon: <Activity className="w-4 h-4 text-sky-500" />, title: 'Auto Mode', desc: 'ESP32 monitors the mains voltage. Relay stays ON while 210 V ≤ V ≤ 250 V; cuts power if voltage drifts outside the safe range.' },
                    { icon: <Calendar className="w-4 h-4 text-violet-500" />, title: 'Schedule Mode', desc: 'Relay follows time-based rules configured in the Schedules tab. Requires at least one enabled schedule.' },
                  ].map(row => (
                    <div key={row.title} className="flex items-start gap-4 px-5 py-4">
                      <div className="mt-0.5 shrink-0">{row.icon}</div>
                      <div>
                        <p className="text-sm font-semibold text-gray-700">{row.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{row.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Schedules Tab ────────────────────────────── */}
            {activeTab === 'schedules' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-base font-bold text-gray-800">Time Schedules</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Define when the relay should be ON or OFF</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSyncSchedules}
                      disabled={loading}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:border-slate-400 text-gray-700 hover:text-slate-800 rounded-xl text-sm font-semibold shadow-sm transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                      Sync to ESP32
                    </button>
                    <button
                      onClick={() => { resetForm(); setShowForm(true); }}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      New Schedule
                    </button>
                  </div>
                </div>

                {/* Inline form */}
                {showForm && (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                    <h3 className="font-bold text-gray-800 mb-5 text-base">
                      {editingSchedule ? 'Edit Schedule' : 'New Schedule'}
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Name</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={e => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                          placeholder="e.g. Morning Power"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {(['startTime', 'endTime'] as const).map(field => (
                          <div key={field}>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                              {field === 'startTime' ? 'Start' : 'End'}
                            </label>
                            <input
                              type="time"
                              value={formData[field]}
                              onChange={e => setFormData({ ...formData, [field]: e.target.value })}
                              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                            />
                          </div>
                        ))}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Days</label>
                        <div className="flex gap-2">
                          {dayNames.map((day, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                const d = [...formData.daysOfWeek]; d[i] = !d[i];
                                setFormData({ ...formData, daysOfWeek: d });
                              }}
                              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                                formData.daysOfWeek[i]
                                  ? 'bg-slate-800 text-white'
                                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                              }`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-700">Enabled</p>
                          <p className="text-xs text-gray-400">Schedule will run when device is in Schedule mode</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, enabled: !formData.enabled })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${formData.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={editingSchedule ? handleUpdateSchedule : handleCreateSchedule}
                          disabled={loading}
                          className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                          {editingSchedule ? 'Update' : 'Create'}
                        </button>
                        <button
                          onClick={() => { setShowForm(false); resetForm(); }}
                          className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Schedule list */}
                {schedules.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-14 text-center">
                    <Calendar className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                    <p className="text-sm font-semibold text-gray-400">No schedules yet</p>
                    <p className="text-xs text-gray-300 mt-1">Click "New Schedule" to add one</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {schedules.map(schedule => (
                      <div
                        key={schedule.id}
                        className={`bg-white rounded-2xl border shadow-sm transition-all ${
                          schedule.enabled ? 'border-emerald-100' : 'border-gray-100 opacity-70'
                        }`}
                      >
                        <div className="flex items-start gap-4 p-5">
                          <button
                            onClick={() => schedule.id && handleToggleSchedule(schedule.id)}
                            className={`mt-0.5 relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${schedule.enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${schedule.enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <span className="font-semibold text-gray-800 text-sm">{schedule.name}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                                schedule.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {schedule.enabled ? 'Enabled' : 'Disabled'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-3">
                              <Clock className="w-3.5 h-3.5" />
                              <span className="font-mono font-semibold">{schedule.startTime}</span>
                              <ChevronRight className="w-3 h-3 text-gray-300" />
                              <span className="font-mono font-semibold">{schedule.endTime}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {schedule.daysOfWeek.map((on, i) => (
                                <span
                                  key={i}
                                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                                    on ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-300'
                                  }`}
                                >
                                  {dayNames[i]}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => startEdit(schedule)}
                              className="p-2 rounded-xl bg-gray-50 hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => schedule.id && handleDeleteSchedule(schedule.id)}
                              className="p-2 rounded-xl bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Toast stack ──────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white transition-all
              ${t.type === 'success' ? 'bg-emerald-600' : t.type === 'error' ? 'bg-red-600' : 'bg-amber-500'}
            `}
          >
            {t.type === 'success' ? <Check className="w-4 h-4" /> : t.type === 'error' ? <X className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {t.message}
          </div>
        ))}
      </div>

      {/* ── Confirm Dialog ───────────────────────────────────── */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-5">
              <div className="p-2 bg-amber-100 rounded-xl shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-bold text-gray-800 text-sm">Confirm action</p>
                <p className="text-gray-500 text-sm mt-1">{confirm.message}</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirm(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => { confirm.onConfirm(); setConfirm(null); }}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
