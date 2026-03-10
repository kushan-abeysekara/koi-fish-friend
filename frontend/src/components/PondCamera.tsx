import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Video, VideoOff, AlertCircle, Download, Camera, X, Filter, Image } from 'lucide-react';
import io from 'socket.io-client';
import axios from 'axios';
import MediaMTXCameraFeed from './MediaMTXCameraFeed';
import {
  supabase,
  type FishDetectionEvent,
} from '../services/supabase';

// Feed source type
type FeedSource = 'hls' | 'ai';
type TabView = 'live' | 'history';

const HEALTH_CLASSES = ['healthy', 'bacterial', 'fungal', 'parasitic', 'white_tail', 'dead'] as const;

const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8081';

const getHealthColor = (cls: string) => {
  switch (cls) {
    case 'healthy': return 'text-green-600';
    case 'bacterial': return 'text-orange-500';
    case 'fungal': return 'text-purple-500';
    case 'parasitic': return 'text-blue-500';
    case 'white_tail': return 'text-yellow-600';
    case 'dead': return 'text-red-600';
    default: return 'text-gray-500';
  }
};

const getHealthEmoji = (cls: string) => {
  switch (cls) {
    case 'healthy': return '🟢';
    case 'bacterial': return '🟠';
    case 'fungal': return '🟣';
    case 'parasitic': return '🔵';
    case 'white_tail': return '🟡';
    case 'dead': return '🔴';
    default: return '⚪';
  }
};

const PondCamera: React.FC = () => {
  // --- Feed & UI ---
  const [feedSource, setFeedSource] = useState<FeedSource>('hls');
  const [activeTab, setActiveTab] = useState<TabView>('live');
  const [cameraConnected, setCameraConnected] = useState(false);
  const [cameraFPS, setCameraFPS] = useState(0);
  const [fishCount, setFishCount] = useState(0);
  const [cameraFrame, setCameraFrame] = useState<string>('');
  const [cameraMode, setCameraMode] = useState<'quality' | 'balanced' | 'performance'>('balanced');
  const cameraSocketRef = useRef<ReturnType<typeof io> | null>(null);
  const CAMERA_SERVER_URL = (import.meta.env.VITE_CAMERA_SERVER_URL as string) || 'http://192.168.8.101:5000';

  // --- Summary counts (from backend API) ---
  const [totalEvents, setTotalEvents] = useState(0);

  // --- Detection history (backend API → Supabase) ---
  const [historyEvents, setHistoryEvents] = useState<FishDetectionEvent[]>([]);
  const [historyFilter, setHistoryFilter] = useState<string>('');
  const [historyPage, setHistoryPage] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // --- Image modal ---
  const [imageModalEvent, setImageModalEvent] = useState<FishDetectionEvent | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [fullImage, setFullImage] = useState<string | null>(null);

  // --- Export ---
  const [exporting, setExporting] = useState(false);

  // ─── Load history from backend API ───
  const loadHistory = useCallback(async (page: number, filter: string, append = false) => {
    setHistoryLoading(true);
    try {
      const PAGE_SIZE = 20;
      const params: Record<string, string | number> = { limit: PAGE_SIZE, offset: page * PAGE_SIZE };
      if (filter) params.healthClass = filter;
      const res = await axios.get(`${API_URL}/api/fish-detection/history`, { params });
      const rows: FishDetectionEvent[] = res.data.data || [];
      if (append) {
        setHistoryEvents(prev => [...prev, ...rows]);
      } else {
        setHistoryEvents(rows);
      }
      setHasMore(rows.length === PAGE_SIZE);
      // Also load total count
      const summaryRes = await axios.get(`${API_URL}/api/fish-detection/summary`);
      const summaryData = summaryRes.data.data || [];
      const total = summaryData.reduce((s: number, r: { total_count: number }) => s + r.total_count, 0);
      setTotalEvents(total);
    } catch { /* silent */ }
    setHistoryLoading(false);
  }, []);

  // Initial load
  useEffect(() => {
    loadHistory(0, '');
  }, [loadHistory]);

  // Reload history when filter changes
  useEffect(() => {
    setHistoryPage(0);
    loadHistory(0, historyFilter);
  }, [historyFilter, loadHistory]);

  // ─── Supabase Realtime subscription for new detection events ───
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('fish-detection-live')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'fish_detection_events',
      }, (payload: { new: Record<string, unknown> }) => {
        const row = payload.new as unknown as FishDetectionEvent;
        if (row) {
          // Prepend to history (if on first page and matching filter)
          setHistoryEvents(prev => {
            if (!historyFilter || row.health_class === historyFilter) {
              return [row, ...prev].slice(0, 100);
            }
            return prev;
          });
          setTotalEvents(prev => prev + 1);
        }
      })
      .subscribe();

    return () => { supabase?.removeChannel(channel); };
  }, [historyFilter]);

  // ─── AI Camera WebSocket Connection ───
  useEffect(() => {
    const socket = io(CAMERA_SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 5000,
      reconnectionAttempts: 5,
      timeout: 8000,
    });

    socket.on('connect', () => {
      setCameraConnected(true);
      const configs = {
        quality: { width: 960, height: 540, quality: 90 },
        balanced: { width: 640, height: 360, quality: 75 },
        performance: { width: 480, height: 270, quality: 60 },
      };
      fetch(`${CAMERA_SERVER_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configs[cameraMode]),
      }).catch(() => {});
      socket.emit('start_stream');
    });

    socket.on('disconnect', () => {
      setCameraConnected(false);
      setCameraFrame('');
      setFishCount(0);
    });

    socket.on('detection_update', (data: {
      fps?: number;
      fish_count?: number;
      detections?: Array<{
        id: number;
        health?: { class?: string; confidence?: number; is_critical?: boolean; needs_attention?: boolean };
        bbox?: { x1: number; y1: number; x2: number; y2: number };
      }>;
      frame?: string;
      timestamp?: string;
    }) => {
      try {
        setCameraFPS(data.fps || 0);
        setFishCount(data.fish_count || 0);
        if (data.frame) {
          setCameraFrame(`data:image/jpeg;base64,${data.frame}`);
        }
        // Detection history is saved by the backend continuously — no frontend saving needed
      } catch (err) {
        console.error('Error processing detection:', err);
      }
    });

    socket.on('connect_error', () => {});
    cameraSocketRef.current = socket;

    return () => {
      socket.emit('stop_stream');
      socket.disconnect();
    };
  }, [cameraMode, CAMERA_SERVER_URL]);

  // ─── Image modal loader ───
  const openImageModal = async (event: FishDetectionEvent) => {
    setImageModalEvent(event);
    setFullImage(null);
    if (event.id) {
      setImageLoading(true);
      try {
        const res = await axios.get(`${API_URL}/api/fish-detection/image/${event.id}`);
        setFullImage(res.data.data || null);
      } catch { setFullImage(null); }
      setImageLoading(false);
    }
  };

  // ─── Export CSV via backend API ───
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await axios.get(`${API_URL}/api/fish-detection/export`, { params: { limit: 5000 } });
      const rows: FishDetectionEvent[] = res.data.data || [];
      const csv = [
        ['ID', 'Timestamp', 'Fish ID', 'Health Class', 'Confidence', 'Critical', 'Needs Attention', 'Fish Count', 'FPS'].join(','),
        ...rows.map(r =>
          [r.id, r.recorded_at, r.fish_id, r.health_class, r.confidence.toFixed(3), r.is_critical, r.needs_attention, r.fish_count, r.fps.toFixed(1)].join(',')
        ),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fish-detections-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { /* silent */ }
    setExporting(false);
  };

  // ─── Load more history ───
  const loadMore = () => {
    const next = historyPage + 1;
    setHistoryPage(next);
    loadHistory(next, historyFilter, true);
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-6">
      {/* ═══ Header — mobile-friendly ═══ */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Video className="text-cyan-500 flex-shrink-0" size={24} />
            Fish Health Monitoring
          </h2>
          <p className="text-gray-500 text-sm mt-0.5">Real-time AI detection &amp; history</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleExport}
            disabled={exporting || totalEvents === 0}
            className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm font-medium"
          >
            <Download size={14} />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* ═══ Tab switcher (Mobile only) ═══ */}
      <div className="flex bg-gray-100 rounded-xl p-1 sm:hidden">
        <button
          onClick={() => setActiveTab('live')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${activeTab === 'live' ? 'bg-white shadow text-cyan-600' : 'text-gray-500'}`}
        >
          📹 Live Feed
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${activeTab === 'history' ? 'bg-white shadow text-cyan-600' : 'text-gray-500'}`}
        >
          📋 History ({totalEvents})
        </button>
      </div>

      {/* ═══ Main content ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
        {/* ── Live Camera Feed ── */}
        <div className={`lg:col-span-3 ${activeTab !== 'live' ? 'hidden sm:block' : ''}`}>
          <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            {/* Feed header */}
            <div className="bg-gray-700 px-3 py-2 sm:px-4 sm:py-3 flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="text-white font-semibold text-sm sm:text-base truncate">Live Camera Feed</h3>
                <p className="text-gray-400 text-xs truncate">
                  {feedSource === 'hls' ? 'MediaMTX HLS Stream' : 'AI Detection Server'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex bg-gray-600 rounded-lg p-0.5">
                  <button
                    onClick={() => setFeedSource('hls')}
                    className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium rounded-md transition ${
                      feedSource === 'hls' ? 'bg-cyan-500 text-white shadow' : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    📡 HLS
                  </button>
                  <button
                    onClick={() => setFeedSource('ai')}
                    className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium rounded-md transition ${
                      feedSource === 'ai' ? 'bg-cyan-500 text-white shadow' : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    🤖 AI
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-400 text-[10px] sm:text-xs font-semibold">LIVE</span>
                </div>
              </div>
            </div>

            {/* HLS feed */}
            {feedSource === 'hls' && (
              <div className="aspect-video">
                <MediaMTXCameraFeed className="w-full h-full" showStatus={true} />
              </div>
            )}

            {/* AI feed */}
            {feedSource === 'ai' && (
              <div className="relative aspect-video bg-gray-900 flex items-center justify-center">
                {cameraConnected && cameraFrame ? (
                  <>
                    <img src={cameraFrame} alt="AI Detection Feed" className="w-full h-full object-contain" />
                    <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      LIVE
                    </div>
                    <div className="absolute bottom-2 left-2 right-2 flex gap-1.5 flex-wrap">
                      <span className="bg-black/70 text-white px-2 py-0.5 rounded text-xs">
                        {cameraFPS.toFixed(1)} FPS
                      </span>
                      <span className="bg-black/70 text-white px-2 py-0.5 rounded text-xs">
                        🐟 {fishCount} Fish
                      </span>
                    </div>
                    {/* Quality selector */}
                    <div className="absolute top-2 right-2 flex gap-1">
                      {(['performance', 'balanced', 'quality'] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => { setCameraMode(m); cameraSocketRef.current?.disconnect(); cameraSocketRef.current?.connect(); }}
                          className={`px-1.5 py-0.5 rounded text-[10px] ${cameraMode === m ? 'bg-cyan-500 text-white' : 'bg-black/50 text-gray-300'}`}
                        >
                          {m === 'performance' ? '⚡' : m === 'balanced' ? '⚖️' : '🎯'}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center p-6">
                    <VideoOff className="mx-auto mb-3 text-gray-600" size={40} />
                    <p className="text-gray-400 text-sm">
                      {cameraConnected ? 'Loading stream...' : 'AI Server Offline'}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      HLS feed is available — switch above
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Status bar */}
            <div className="bg-gray-700 px-3 py-1.5 text-center">
              <div className="flex items-center justify-center gap-3 text-gray-300 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${feedSource === 'hls' || cameraConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                  {feedSource === 'hls' ? 'Pond Camera (MediaMTX)' : cameraConnected ? 'AI Connected' : 'AI Offline'}
                </span>
                <span className="hidden sm:inline">|</span>
                <span className="hidden sm:inline">
                  {feedSource === 'hls' ? '📡 HLS Stream' : '🤖 AI Detection'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Detection History Panel ── */}
        <div className={`lg:col-span-2 ${activeTab !== 'history' ? 'hidden sm:block' : ''}`}>
          <div className="bg-white rounded-xl shadow-lg overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            {/* History header */}
            <div className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-3 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-semibold text-sm sm:text-base">Detection History</h3>
                <p className="text-cyan-100 text-[10px] sm:text-xs">{totalEvents} events saved in database</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Filter dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                    className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition ${
                      historyFilter ? 'bg-white text-cyan-700' : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    <Filter size={12} />
                    {historyFilter ? historyFilter.replace('_', ' ') : 'Filter'}
                  </button>
                  {showFilterDropdown && (
                    <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border z-20 w-40">
                      <button
                        onClick={() => { setHistoryFilter(''); setShowFilterDropdown(false); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${!historyFilter ? 'font-bold text-cyan-600' : 'text-gray-700'}`}
                      >
                        All Events
                      </button>
                      {HEALTH_CLASSES.map(cls => (
                        <button
                          key={cls}
                          onClick={() => { setHistoryFilter(cls); setShowFilterDropdown(false); }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${historyFilter === cls ? 'font-bold' : ''}`}
                        >
                          <span>{getHealthEmoji(cls)}</span>
                          <span className={`capitalize ${getHealthColor(cls)}`}>{cls.replace('_', ' ')}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { setHistoryPage(0); loadHistory(0, historyFilter); }}
                  className="bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded-lg text-xs"
                  title="Refresh"
                >
                  ↻
                </button>
              </div>
            </div>

            {/* Active filter badge */}
            {historyFilter && (
              <div className="px-3 py-1.5 bg-cyan-50 border-b flex items-center justify-between flex-shrink-0">
                <span className="text-xs text-cyan-700">
                  Showing: <strong className="capitalize">{historyFilter.replace('_', ' ')}</strong>
                </span>
                <button onClick={() => setHistoryFilter('')} className="text-cyan-600 hover:text-cyan-800">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Event list */}
            <div className="flex-1 overflow-y-auto">
              {historyEvents.length === 0 && !historyLoading ? (
                <div className="text-center py-12 text-gray-400">
                  <AlertCircle size={40} className="mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No detection events yet</p>
                  <p className="text-xs mt-1">Events saved automatically when AI detects fish</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {historyEvents.map((event) => (
                    <div
                      key={event.id ?? `${event.recorded_at}-${event.fish_id}`}
                      className={`px-3 py-2.5 sm:px-4 sm:py-3 hover:bg-gray-50 transition-colors ${
                        event.is_critical ? 'bg-red-50 border-l-4 border-red-500' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {/* Image thumbnail */}
                        <button
                          onClick={() => openImageModal(event)}
                          className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-gray-200 overflow-hidden relative group"
                          title="View captured image"
                        >
                          {event.image_base64 ? (
                            <img
                              src={event.image_base64.startsWith('data:') ? event.image_base64 : `data:image/jpeg;base64,${event.image_base64}`}
                              alt="Detection"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Camera size={16} className="text-gray-400" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                            <Image size={14} className="text-white opacity-0 group-hover:opacity-100 transition" />
                          </div>
                        </button>

                        {/* Event info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-sm flex-shrink-0">{getHealthEmoji(event.health_class)}</span>
                              <span className="font-semibold text-gray-800 text-sm flex-shrink-0">
                                Fish #{event.fish_id}
                              </span>
                              <span className={`text-xs font-medium capitalize truncate ${getHealthColor(event.health_class)}`}>
                                {event.health_class.replace('_', ' ')}
                              </span>
                            </div>
                            {event.is_critical && (
                              <span className="px-1.5 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded flex-shrink-0 ml-1">
                                DEAD
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span>{(event.confidence * 100).toFixed(0)}% conf</span>
                            <span>🐟 {event.fish_count}</span>
                            <span className="truncate">{new Date(event.recorded_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          {event.needs_attention && !event.is_critical && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] rounded">
                              ⚠️ Attention
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Load more */}
                  {hasMore && (
                    <div className="p-3 text-center">
                      <button
                        onClick={loadMore}
                        disabled={historyLoading}
                        className="px-4 py-2 bg-cyan-50 text-cyan-600 rounded-lg text-sm font-medium hover:bg-cyan-100 disabled:opacity-50 w-full sm:w-auto"
                      >
                        {historyLoading ? 'Loading...' : 'Load More'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {historyLoading && historyEvents.length === 0 && (
                <div className="p-8 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
                  <p className="text-gray-400 text-sm mt-2">Loading history...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Image Modal ═══ */}
      {imageModalEvent && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setImageModalEvent(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-3 sm:p-4 border-b">
              <div>
                <h3 className="font-semibold text-gray-800 text-sm sm:text-base">
                  {getHealthEmoji(imageModalEvent.health_class)} Fish #{imageModalEvent.fish_id} — <span className={`capitalize ${getHealthColor(imageModalEvent.health_class)}`}>{imageModalEvent.health_class.replace('_', ' ')}</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(imageModalEvent.recorded_at).toLocaleString()} · {(imageModalEvent.confidence * 100).toFixed(1)}% confidence
                </p>
              </div>
              <button onClick={() => setImageModalEvent(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-3 sm:p-4">
              {imageLoading ? (
                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
                </div>
              ) : fullImage ? (
                <img
                  src={fullImage.startsWith('data:') ? fullImage : `data:image/jpeg;base64,${fullImage}`}
                  alt="Detection capture"
                  className="w-full rounded-lg"
                />
              ) : (
                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <Camera size={40} className="mx-auto mb-2" />
                    <p className="text-sm">No image captured for this event</p>
                  </div>
                </div>
              )}

              {/* Event details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-gray-500">Health</p>
                  <p className={`font-bold text-sm capitalize ${getHealthColor(imageModalEvent.health_class)}`}>
                    {imageModalEvent.health_class.replace('_', ' ')}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-gray-500">Confidence</p>
                  <p className="font-bold text-sm">{(imageModalEvent.confidence * 100).toFixed(1)}%</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-gray-500">Fish Count</p>
                  <p className="font-bold text-sm">{imageModalEvent.fish_count}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-gray-500">Status</p>
                  <p className={`font-bold text-sm ${imageModalEvent.is_critical ? 'text-red-600' : imageModalEvent.needs_attention ? 'text-orange-500' : 'text-green-600'}`}>
                    {imageModalEvent.is_critical ? '🔴 Critical' : imageModalEvent.needs_attention ? '⚠️ Watch' : '✅ OK'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PondCamera;
