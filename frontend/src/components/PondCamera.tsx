/**
 * PondCamera.tsx
 *
 * Live fish health monitoring component for the koi pond dashboard.
 *
 * Supports two feed modes:
 *  - HLS  : Pulls a live RTSP/HLS stream from a Raspberry Pi running MediaMTX.
 *           Frames are periodically captured to an offscreen <canvas> and the
 *           pixel data is analyzed client-side to detect YOLOv8 overlay colours
 *           (bounding boxes + text labels drawn by the Pi's AI pipeline).
 *  - AI   : Connects via Socket.IO directly to the Python camera server running
 *           on the Pi, which streams JPEG frames with pre-parsed detection JSON.
 *
 * Detection events (fish health readings) are persisted to the backend database
 * and displayed in a scrollable event log. Critical detections (dead fish) also
 * trigger an audible alert and a dedicated critical-alert API call.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Video, VideoOff, AlertCircle, Download, RefreshCw } from 'lucide-react';
import io from 'socket.io-client';
import axios from 'axios';
import MediaMTXCameraFeed from './MediaMTXCameraFeed';

/**
 * A single fish detection event stored in the frontend event log.
 * Events are created from both the AI Socket.IO feed and the HLS frame analyser.
 */
interface DetectionEvent {
  id: string;            // Unique client-side ID (e.g. "db-42" or "hls-1715000000-0")
  timestamp: string;     // ISO 8601 timestamp of the detection
  fishId: number;        // Numeric fish identifier from the detection model
  healthClass: string;   // Health classification (healthy | unhealthy | dead | …)
  confidence: number;    // Model confidence [0, 1]
  isCritical: boolean;   // True when the fish is classified as dead
  needsAttention: boolean; // True when the fish needs monitoring (unhealthy/dead)
  screenshotDataUrl: string; // base64 data URL of the frame at detection time
  bbox: {
    x1: number;          // Bounding box left pixel coordinate
    y1: number;          // Bounding box top pixel coordinate
    x2: number;          // Bounding box right pixel coordinate
    y2: number;          // Bounding box bottom pixel coordinate
  };
}

/**
 * Raw detection event shape returned by the backend REST API
 * (GET /api/camera/events). Fields use snake_case to match the DB columns.
 */
interface ApiDetectionEvent {
  id: number;
  created_at: string;
  fish_id: number;
  health_status: string;
  confidence: number;
  is_critical: boolean;
  needs_attention: boolean;
  image_url: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Which live-feed source is currently active.
 *  - 'hls' : MediaMTX HLS stream (default, always available in production)
 *  - 'ai'  : Direct Socket.IO connection to the Python camera/AI server
 */
type FeedSource = 'hls' | 'ai';

const PondCamera: React.FC = () => {
  // ─── AI Camera Feed State ──────────────────────────────────────────────────
  // These states are only meaningful when feedSource === 'ai'.
  const [cameraConnected, setCameraConnected] = useState(false);   // Socket.IO connection status
  const [cameraFPS, setCameraFPS] = useState(0);                   // Frames-per-second reported by the AI server
  const [fishCount, setFishCount] = useState(0);                   // Number of fish detected in the latest frame
  const [detections, setDetections] = useState<Array<{ id: number; health?: { class?: string; confidence?: number; is_critical?: boolean; needs_attention?: boolean } }>>([]);
  const [cameraFrame, setCameraFrame] = useState<string>('');      // Latest JPEG frame as a base64 data URL

  // Persisted Socket.IO client for the AI camera server
  const cameraSocketRef = useRef<ReturnType<typeof io> | null>(null);

  // Base URL of the Python camera/AI server running on the Raspberry Pi
  const CAMERA_SERVER_URL = import.meta.env.VITE_CAMERA_SERVER_URL || 'http://192.168.8.101:5000';

  // ─── Feed Source Toggle ────────────────────────────────────────────────────
  // 'hls'  = MediaMTX live stream (default, works without the Python AI server)
  // 'ai'   = Direct Socket.IO connection to the Python camera server
  const [feedSource, setFeedSource] = useState<FeedSource>('hls');

  // ─── AI Feed Quality Mode ──────────────────────────────────────────────────
  // Controls the resolution/quality sent by the Pi camera server to the browser.
  //   quality     → 960×540, JPEG 90 (best image, higher bandwidth)
  //   balanced    → 640×360, JPEG 75 (default trade-off)
  //   performance → 480×270, JPEG 60 (lowest latency, lowest quality)
  const [cameraMode, setCameraMode] = useState<'quality' | 'balanced' | 'performance'>('balanced');

  // ─── Detection Event Log State ─────────────────────────────────────────────
  const [detectionEvents, setDetectionEvents] = useState<DetectionEvent[]>([]);  // All events (DB + live)
  const [criticalAlerts, setCriticalAlerts] = useState<number>(0);               // Running count of critical (dead fish) alerts
  const [, setTotalDetections] = useState<number>(0);                            // Running total of all detected fish across frames
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);                 // True while fetching events from the backend

  // ─── HLS Refs ──────────────────────────────────────────────────────────────
  // Forwarded ref to the <video> element rendered by MediaMTXCameraFeed.
  // Used by captureHlsFrame() to draw the current video frame onto a canvas.
  const hlsVideoRef = useRef<HTMLVideoElement>(null);

  /**
   * Deduplication ref for HLS overlay detections.
   * We only emit a new detection event when the fish count or health composition
   * changes, or when more than 10 seconds have passed since the last emission.
   * This prevents flooding the event log with identical readings every 3 s.
   */
  const hlsLastDetectionRef = useRef<{ count: number; healthLabel: string; timestamp: number }>({
    count: 0,
    healthLabel: '',
    timestamp: 0,
  });

  /**
   * Play a short beep to alert the user when a critical (dead fish) event is detected.
   * Uses an inline base64-encoded WAV so there is no external audio file dependency.
   * Errors are swallowed because autoplay is often blocked until the user interacts
   * with the page.
   */
  const playAlertSound = useCallback(() => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjGH0fPTgjMGHm7A7+OZURE');
    audio.play().catch(e => console.log('Could not play alert sound:', e));
  }, []);

  /**
   * Fetch the persisted detection events from the backend database.
   *
   * Called once on mount and again whenever the user presses the refresh button.
   * Implements an exponential-back-off retry loop (up to 5 attempts) so that a
   * brief backend restart during initial page load does not silently leave the
   * event log empty. The retry delays are: 3 s, 5 s, 8 s, 12 s, 20 s.
   *
   * @param retryCount - Internal retry counter (do not pass from call sites).
   */
  const fetchDetectionEvents = useCallback(async (retryCount = 0) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';
    const MAX_RETRIES = 5;
    const RETRY_DELAYS = [3000, 5000, 8000, 12000, 20000];
    setIsLoadingEvents(true);
    try {
      const response = await axios.get(`${API_URL}/api/camera/events`, {
        params: { hoursBack: 720, limit: 1000 },
        timeout: 10000,
      });
      if (response.data?.success && Array.isArray(response.data?.data)) {
        const fetchedEvents: DetectionEvent[] = response.data.data.map((e: ApiDetectionEvent) => ({
          id: `db-${e.id}`,
          timestamp: e.created_at || new Date().toISOString(),
          fishId: e.fish_id || 0,
          healthClass: e.health_status || 'unknown',
          confidence: Number(e.confidence || 0),
          isCritical: e.is_critical || false,
          needsAttention: e.needs_attention || false,
          screenshotDataUrl: (e.image_url || (e as { imageUrl?: string }).imageUrl || '') as string,
          bbox: {
            x1: e.x1 || 0,
            y1: e.y1 || 0,
            x2: e.x2 || 0,
            y2: e.y2 || 0
          }
        }));
        setDetectionEvents(fetchedEvents);
      }
      setIsLoadingEvents(false);
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryCount];
        console.warn(`[DetectionEvents] Fetch failed (attempt ${retryCount + 1}/${MAX_RETRIES + 1}), retrying in ${delay / 1000}s...`, error);
        setTimeout(() => fetchDetectionEvents(retryCount + 1), delay);
      } else {
        console.warn('[DetectionEvents] All fetch attempts failed. Use the refresh button to retry.', error);
        setIsLoadingEvents(false);
      }
    }
  }, []);

  /**
   * Persist a batch of detection events to the backend database.
   *
   * Events are batched per Socket.IO frame or per HLS capture interval and sent
   * in a single POST to avoid excessive API calls. Screenshots are included so
   * the event log can show a thumbnail for each detection.
   */
  const saveDetectionEvents = useCallback(async (events: DetectionEvent[]) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';
    try {
      await axios.post(`${API_URL}/api/camera/events`, {
        events: events.map(e => ({
          timestamp: e.timestamp,
          fishId: e.fishId,
          healthStatus: e.healthClass,
          confidence: e.confidence,
          isCritical: e.isCritical,
          needsAttention: e.needsAttention,
          boundingBox: e.bbox,
          screenshot: e.screenshotDataUrl || null
        }))
      });
    } catch (error) {
      console.error('Failed to save detection events:', error);
    }
  }, []);

  /**
   * Record a critical alert to the backend and play an audible beep.
   *
   * Called whenever one or more fish are classified as dead in a single frame.
   * The alert is stored separately from regular events so it can be queried
   * independently (e.g. for push notifications or dashboard counters).
   */
  const saveCriticalAlert = useCallback(async (events: DetectionEvent[]) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';
    try {
      await axios.post(`${API_URL}/api/camera/alerts/critical`, {
        timestamp: new Date().toISOString(),
        alertType: 'DEAD_FISH_DETECTED',
        severity: 'CRITICAL',
        fishCount: events.length,
        details: events.map(e => ({
          fishId: e.fishId,
          healthClass: e.healthClass,
          confidence: e.confidence
        }))
      });

      playAlertSound();
    } catch (error) {
      console.error('Failed to save critical alert:', error);
    }
  }, [playAlertSound]);

  // ─── On Mount: Load Historical Events ────────────────────────────────────
  // Populate the event log with previously saved detections so the user can
  // review recent history without waiting for new live detections.
  useEffect(() => {
    fetchDetectionEvents();
  }, [fetchDetectionEvents]);

  // ─── AI Camera Feed — Socket.IO Connection ────────────────────────────────
  // This effect manages the lifecycle of the Socket.IO connection to the Python
  // camera/AI server running on the Raspberry Pi. The connection is only opened
  // when the user explicitly switches to 'AI Detection' mode; switching back to
  // 'HLS' immediately disconnects the socket to conserve resources.
  //
  // On each 'detection_update' event the server sends:
  //   { fps, fish_count, detections[], frame (base64 JPEG), timestamp }
  // We update state, append to the event log, and persist events to the backend.
  useEffect(() => {
    // Only connect to the Pi camera server when the user explicitly selects 'AI Detection' mode
    if (feedSource !== 'ai') {
      // Ensure we clean up if switching away
      if (cameraSocketRef.current) {
        cameraSocketRef.current.disconnect();
        cameraSocketRef.current = null;
      }
      setCameraConnected(false);
      setCameraFrame('');
      return;
    }

    console.log('🎥 Connecting to AI camera server:', CAMERA_SERVER_URL);

    // Open a Socket.IO connection with automatic reconnection.
    // We prefer WebSocket transport but fall back to long-polling if the Pi's
    // nginx proxy does not support WebSocket upgrades.
    const socket = io(CAMERA_SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 5000,   // wait 5 s before the first retry
      reconnectionAttempts: 5,   // give up after 5 failed reconnections
      timeout: 8000,             // initial connection timeout
    });

    socket.on('connect', () => {
      console.log('✅ AI camera server connected');
      setCameraConnected(true);

      // Resolution/quality presets sent to the Pi camera server.
      // The server applies these before encoding each JPEG frame.
      const config = {
        quality:     { width: 960, height: 540, quality: 90 },
        balanced:    { width: 640, height: 360, quality: 75 },
        performance: { width: 480, height: 270, quality: 60 }
      };
      
      const settings = config[cameraMode];

      // Push the quality settings to the Pi camera server REST endpoint.
      // This is fire-and-forget; if it fails the server keeps its previous settings.
      fetch(`${CAMERA_SERVER_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      }).catch(err => console.warn('Could not update AI config:', err));
      
      socket.emit('start_stream');
    });

    socket.on('disconnect', () => {
      console.log('❌ AI camera server disconnected');
      setCameraConnected(false);
      setCameraFrame('');
      setFishCount(0);
      setDetections([]);
    });

    // ── 'detection_update' payload handler ──────────────────────────────────
    // The AI server emits this event for every processed camera frame.
    // Payload fields:
    //   fps         – current frames per second of the AI pipeline
    //   fish_count  – number of fish detected in this frame
    //   detections  – array of fish objects (id, health, bbox)
    //   frame       – base64-encoded JPEG of the annotated frame
    //   timestamp   – ISO 8601 string
    socket.on('detection_update', (data: { fps?: number; fish_count?: number; detections?: Array<{ id: number; health?: { class?: string; confidence?: number; is_critical?: boolean; needs_attention?: boolean }; bbox?: { x1: number; y1: number; x2: number; y2: number } }>; frame?: string; timestamp?: string }) => {
      try {
        setCameraFPS(data.fps || 0);
        setFishCount(data.fish_count || 0);
        setDetections(data.detections || []);
        setTotalDetections(prev => prev + (data.fish_count || 0));
        
        if (data.frame) {
          setCameraFrame(`data:image/jpeg;base64,${data.frame}`);
        }
        
        if (data.detections && data.detections.length > 0) {
          // Use the annotated frame (if available) as the screenshot for each event.
          // All detections in the same frame share the same screenshot.
          const aiScreenshotDataUrl = data.frame ? `data:image/jpeg;base64,${data.frame}` : '';
          const newEvents: DetectionEvent[] = data.detections.map((fish) => ({
            id: `${Date.now()}-${fish.id}`,
            timestamp: data.timestamp || new Date().toISOString(),
            fishId: fish.id,
            healthClass: fish.health?.class || 'unknown',
            confidence: fish.health?.confidence || 0,
            isCritical: fish.health?.is_critical || false,
            needsAttention: fish.health?.needs_attention || false,
            screenshotDataUrl: aiScreenshotDataUrl,
            bbox: fish.bbox || { x1: 0, y1: 0, x2: 0, y2: 0 }
          }));
          
          // Cap the in-memory event log at 500 entries to prevent unbounded memory growth
          setDetectionEvents(prev => [...newEvents, ...prev].slice(0, 500));
          
          const criticalCount = newEvents.filter(e => e.isCritical).length;
          if (criticalCount > 0) {
            setCriticalAlerts(prev => prev + criticalCount);
            saveCriticalAlert(newEvents.filter(e => e.isCritical));
          }
          
          saveDetectionEvents(newEvents);
        }
      } catch (error) {
        console.error('Error processing camera data:', error);
      }
    });

    socket.on('connect_error', (error: Error) => {
      console.warn('⚠️ AI camera connection error:', error.message);
    });

    cameraSocketRef.current = socket;

    return () => {
      console.log('🔌 Disconnecting from AI camera server');
      socket.emit('stop_stream');
      socket.disconnect();
      cameraSocketRef.current = null;
    };
  }, [CAMERA_SERVER_URL, cameraMode, feedSource, saveCriticalAlert, saveDetectionEvents]);

  // ─── HLS Frame Capture → Client-Side Overlay Detection ───
  // The Pi's YOLOv8 draws colored bounding boxes + text labels onto the HLS stream.
  // The overlay text format is: "Fish#N: <status> (<confidence>%)"
  // Bounding box colours:
  //   • Green rectangles  = healthy fish
  //   • Red rectangles    = dead/critical fish  
  //   • Orange rectangles = unhealthy / needs attention
  //
  // IMPORTANT: We must avoid counting natural green (water, plants) as "healthy" boxes.
  // We focus on high-saturation overlay colours and scan bounding-box-likely regions
  // (edges of detected rectangles, text label areas at the top of the frame).

  /**
   * Analyze canvas pixel data for YOLOv8 overlay colors.
   * Scans for bounding box rectangles and label text colours,
   * ignoring natural scene colours (pond water, plants, etc).
   * Returns detected overlay regions with health classifications.
   */
  const analyzeFrameOverlays = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // --- Strategy ---
    // YOLOv8 draws:
    //  1) A coloured bounding box (2-3px lines) around each fish
    //  2) A coloured text label above the box: "Fish#1: unhealthy (100%)"
    //  3) An info bar at the top: "FPS: X | Fish: N"
    //
    // The bounding box lines and text use pure, saturated overlay colours that
    // stand out from the natural scene. We check colour saturation and value
    // to distinguish overlays from pond water/plants.

    /**
     * Convert RGB to HSV. Returns [h: 0-360, s: 0-1, v: 0-1].
     */
    const rgbToHsv = (r: number, g: number, b: number): [number, number, number] => {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const d = max - min;
      let h = 0;
      const s = max === 0 ? 0 : d / max;
      const v = max;
      if (d !== 0) {
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        else if (max === g) h = ((b - r) / d + 2) * 60;
        else h = ((r - g) / d + 4) * 60;
      }
      return [h, s, v];
    };

    /**
     * Check if a pixel is a YOLOv8 overlay colour (high saturation, bright).
     * Returns the classification or null.
     */
    const classifyOverlayPixel = (r: number, g: number, b: number): string | null => {
      const [h, s, v] = rgbToHsv(r, g, b);

      // Overlay colours are highly saturated and bright
      // Natural greens (water/plants) have lower saturation and are darker
      if (s < 0.5 || v < 0.5) return null; // not saturated/bright enough for an overlay

      // Pure green overlay (healthy): H ≈ 90-150, very saturated
      // YOLOv8 uses (0, 255, 0) style green → H=120, S=1, V=1
      if (h >= 80 && h <= 160 && s >= 0.7 && v >= 0.7) {
        return 'healthy';
      }

      // Red overlay (dead/critical): H ≈ 0-15 or 345-360
      // YOLOv8 uses (255, 0, 0) or (0, 0, 255) style red → H=0, S=1, V=1
      if ((h <= 15 || h >= 345) && s >= 0.7 && v >= 0.6) {
        return 'dead';
      }

      // Orange overlay (unhealthy): H ≈ 15-45
      // YOLOv8 uses orange (255, 165, 0) style → H≈39, S=1, V=1
      if (h >= 10 && h <= 50 && s >= 0.6 && v >= 0.7) {
        return 'unhealthy';
      }

      // Yellow overlay (needs attention): H ≈ 45-70
      if (h >= 45 && h <= 70 && s >= 0.6 && v >= 0.7) {
        return 'unhealthy';
      }

      return null;
    };

    // --- Scan strategy: focus on areas where overlays are drawn ---
    // 1) Text label region: top 20% of the frame (where FPS bar and fish labels are)
    // 2) Frame edges: scan along edges where bounding box lines appear
    // 3) Skip the interior of the frame to avoid counting water/plants

    const overlaySignals: Record<string, { labelPixels: number; edgePixels: number }> = {
      healthy: { labelPixels: 0, edgePixels: 0 },
      dead: { labelPixels: 0, edgePixels: 0 },
      unhealthy: { labelPixels: 0, edgePixels: 0 },
    };

    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    // Helper to get pixel classification at (x, y)
    const getPixelClass = (x: number, y: number): string | null => {
      const idx = (y * width + x) * 4;
      return classifyOverlayPixel(pixels[idx], pixels[idx + 1], pixels[idx + 2]);
    };

    // Region 1: Top label area (top 25% of frame) — text labels and info bar
    const labelRegionHeight = Math.floor(height * 0.25);
    const step = 2; // sample every 2nd pixel for speed
    for (let y = 0; y < labelRegionHeight; y += step) {
      for (let x = 0; x < width; x += step) {
        const cls = getPixelClass(x, y);
        if (cls) overlaySignals[cls].labelPixels++;
      }
    }

    // Region 2: Scan horizontal bands across the frame (bounding box top/bottom edges)
    // Sample a few horizontal lines spaced across the frame
    const bandStep = Math.floor(height / 12);
    for (let band = labelRegionHeight; band < height; band += bandStep) {
      for (let dy = 0; dy < 4 && band + dy < height; dy++) {
        for (let x = 0; x < width; x += step) {
          const cls = getPixelClass(x, band + dy);
          if (cls) overlaySignals[cls].edgePixels++;
        }
      }
    }

    // Region 3: Scan vertical bands (bounding box left/right edges)
    const vBandStep = Math.floor(width / 12);
    for (let band = 0; band < width; band += vBandStep) {
      for (let dx = 0; dx < 4 && band + dx < width; dx++) {
        for (let y = labelRegionHeight; y < height; y += step) {
          const cls = getPixelClass(band + dx, y);
          if (cls) overlaySignals[cls].edgePixels++;
        }
      }
    }

    // --- Determine detections ---
    // Threshold: bounding box lines + text labels produce many saturated pixels.
    // We need at least ~20 overlay pixels from our focused scan to confirm a detection.
    const threshold = 20;
    const healthyLabelThreshold = 12;
    const healthyEdgeThreshold = 8;

    const detections: Array<{
      healthClass: string;
      confidence: number;
      isCritical: boolean;
      needsAttention: boolean;
      pixelCount: number;
    }> = [];

    // Find the dominant overlay colour — this is what the model actually says
    const sortedClasses = Object.entries(overlaySignals)
      .map(([healthClass, signal]) => ({
        healthClass,
        labelPixels: signal.labelPixels,
        edgePixels: signal.edgePixels,
        totalPixels: signal.labelPixels + signal.edgePixels,
      }))
      .filter(({ healthClass, labelPixels, edgePixels, totalPixels }) => {
        if (healthClass === 'healthy') {
          return labelPixels >= healthyLabelThreshold && edgePixels >= healthyEdgeThreshold;
        }

        return totalPixels >= threshold;
      })
      .sort((a, b) => b.totalPixels - a.totalPixels);

    if (sortedClasses.length === 0) return detections;

    // Use the dominant classification for all detected fish
    // (If there are multiple overlay colours, each one represents different fish)
    for (const { healthClass, totalPixels: pixelCount } of sortedClasses) {
      // Estimate fish count from pixel density
      const estimatedCount = Math.max(1, Math.min(5, Math.round(pixelCount / 100)));

      for (let i = 0; i < estimatedCount; i++) {
        const isCritical = healthClass === 'dead';
        const needsAttention = healthClass === 'unhealthy' || healthClass === 'dead';

        detections.push({
          healthClass,
          confidence: Math.min(0.99, 0.80 + (pixelCount / 2000)),
          isCritical,
          needsAttention,
          pixelCount,
        });
      }
    }

    return detections;
  }, []);

  /**
   * Capture the current HLS video frame, run the pixel-level overlay analyser,
   * and emit detection events if new fish health data is found.
   *
   * Called every 3 seconds by the interval registered below.
   * Bails out early if the <video> element is not ready or has no video data.
   */
  const captureHlsFrame = useCallback(() => {
    const video = hlsVideoRef.current;
    // readyState < 2 means the video has no current data yet (HAVE_CURRENT_DATA = 2)
    if (!video || video.readyState < 2 || video.videoWidth === 0) return;

    // Draw the current video frame onto an offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Analyze the frame for YOLOv8 overlay colours
    const overlayDetections = analyzeFrameOverlays(ctx, canvas.width, canvas.height);

    if (overlayDetections.length === 0) return;

    // Capture the screenshot as a base64 data URL
    const screenshotDataUrl = canvas.toDataURL('image/jpeg', 0.7);

    const now = Date.now();
    const timestamp = new Date().toISOString();
    const lastDet = hlsLastDetectionRef.current;

    // Build a summary key for deduplication (e.g. "2-healthy,1-dead")
    const summaryKey = overlayDetections
      .map((d) => d.healthClass)
      .sort()
      .join(',');

    // Deduplicate: skip if same detection count + same health composition within 10s
    if (
      lastDet.count === overlayDetections.length &&
      lastDet.healthLabel === summaryKey &&
      now - lastDet.timestamp < 10000
    ) {
      return;
    }
    hlsLastDetectionRef.current = { count: overlayDetections.length, healthLabel: summaryKey, timestamp: now };

    // Update fish count for the stats card
    setFishCount(overlayDetections.length);

    const newEvents: DetectionEvent[] = overlayDetections.map((det, idx) => ({
      id: `hls-${now}-${idx}`,
      timestamp,
      fishId: idx + 1,
      healthClass: det.healthClass,
      confidence: parseFloat(det.confidence.toFixed(2)),
      isCritical: det.isCritical,
      needsAttention: det.needsAttention,
      screenshotDataUrl,
      bbox: { x1: 0, y1: 0, x2: 0, y2: 0 },
    }));

    setDetectionEvents((prev) => [...newEvents, ...prev].slice(0, 500));
    setTotalDetections((prev) => prev + newEvents.length);

    const criticalCount = newEvents.filter((e) => e.isCritical).length;
    if (criticalCount > 0) {
      setCriticalAlerts((prev) => prev + criticalCount);
      saveCriticalAlert(newEvents.filter((e) => e.isCritical));
    }

    saveDetectionEvents(newEvents);
    console.log(
      `🐟 HLS overlay detection: ${overlayDetections.length} fish detected [${summaryKey}]`
    );
  }, [analyzeFrameOverlays, saveCriticalAlert, saveDetectionEvents]);

  // ─── HLS Frame Capture Interval ─────────────────────────────────────────
  // Fires captureHlsFrame every 3 seconds while the HLS feed is active.
  // We reset the deduplication ref on entry so the first capture after switching
  // modes always produces an event (even if the scene hasn't changed).
  useEffect(() => {
    if (feedSource !== 'hls') return;

    // Reset dedup ref when switching to HLS
    hlsLastDetectionRef.current = { count: 0, healthLabel: '', timestamp: 0 };

    const intervalId = setInterval(() => {
      captureHlsFrame();
    }, 3000);

    // Clean up the interval when the component unmounts or feed source changes
    return () => clearInterval(intervalId);
  }, [feedSource, captureHlsFrame]);

  /**
   * Change the AI camera quality mode and force-reconnect the Socket.IO client.
   * The server reads the new config on the next 'connect' event.
   */
  const handleCameraModeChange = (mode: 'quality' | 'balanced' | 'performance') => {
    setCameraMode(mode);
    // Reconnect so the 'connect' handler re-sends the new quality settings to the Pi
    if (cameraSocketRef.current) {
      cameraSocketRef.current.disconnect();
      cameraSocketRef.current.connect();
    }
  };

  /** Returns a Tailwind text-color class matching the given health classification. */
  const getHealthColor = (healthClass: string) => {
    switch (healthClass) {
      case 'healthy': return 'text-green-500';
      case 'unhealthy': return 'text-orange-500';
      case 'bacterial': return 'text-orange-500';
      case 'fungal': return 'text-purple-500';
      case 'parasitic': return 'text-blue-500';
      case 'white_tail': return 'text-yellow-500';
      case 'dead': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  /** Returns a coloured circle emoji that visually represents the health status. */
  const getHealthEmoji = (healthClass: string) => {
    switch (healthClass) {
      case 'healthy': return '🟢';
      case 'unhealthy': return '🟠';
      case 'bacterial': return '🟠';
      case 'fungal': return '🟣';
      case 'parasitic': return '🔵';
      case 'white_tail': return '🟡';
      case 'dead': return '🔴';
      default: return '⚪';
    }
  };

  /**
   * Export all detection events in the event log to a CSV file and trigger a
   * browser download. Columns: Timestamp, Fish ID, Health Status, Confidence,
   * Critical, Needs Attention.
   */
  const exportEventsToCSV = () => {
    const csv = [
      ['Timestamp', 'Fish ID', 'Health Status', 'Confidence', 'Critical', 'Needs Attention'].join(','),
      ...detectionEvents.map(e => 
        [e.timestamp, e.fishId, e.healthClass, e.confidence.toFixed(2), e.isCritical, e.needsAttention].join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fish-detection-events-${new Date().toISOString()}.csv`;
    a.click();
  };

  /**
   * Delete ALL detection events from the backend database and reset local state.
   * Shows a confirmation dialog before proceeding because this action is irreversible.
   */
  const clearEvents = async () => {
    if (confirm('Clear all detection events from database? This cannot be undone.')) {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';
        await axios.delete(`${API_URL}/api/camera/events`);
        setDetectionEvents([]);
        setCriticalAlerts(0);
        setTotalDetections(0);
        alert('All detection events have been deleted successfully.');
      } catch (error) {
        console.error('Failed to delete events:', error);
        alert('Failed to delete events. Please try again.');
      }
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // Layout (top → bottom):
  //  1. Page header + Export / Clear buttons
  //  2. Stats row  (feed status, fish count, total events, critical alerts)
  //  3. Main area  (live camera feed 2/3 width  |  event log 1/3 width)
  //     ├─ HLS feed : <MediaMTXCameraFeed> + optional feed-source toggle
  //     └─ AI feed  : Socket.IO JPEG stream + detection overlays
  //  4. Health distribution bar chart (count per health class)
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Video className="text-cyan-500" size={32} />
            Live Fish Health Monitoring
          </h2>
          <p className="text-gray-600 mt-1">Real-time AI fish detection with health analysis</p>
        </div>
        {/* Action buttons: CSV export and clear-all */}
        <div className="flex gap-2">
          <button
            onClick={exportEventsToCSV}
            disabled={detectionEvents.length === 0}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 flex items-center gap-2"
          >
            <Download size={16} />
            Export Events
          </button>
          <button
            onClick={clearEvents}
            disabled={detectionEvents.length === 0}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 flex items-center gap-2"
          >
            Clear Events
          </button>
        </div>
      </div>

      {/* ── Stats Cards ──────────────────────────────────────────────────── */}
      {/* Four metric cards: feed status, fish count, total events, critical alerts */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Live Feed</p>
              <p className="text-2xl font-bold mt-2">
                {feedSource === 'hls' ? (
                  <span className="text-green-600">HLS Stream</span>
                ) : cameraConnected ? (
                  <span className="text-green-600">AI Online</span>
                ) : (
                  <span className="text-red-600">AI Offline</span>
                )}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              feedSource === 'hls' || cameraConnected ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {feedSource === 'hls' || cameraConnected ? (
                <Video className="text-green-600" size={24} />
              ) : (
                <VideoOff className="text-red-600" size={24} />
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Fish Detected</p>
              <p className="text-3xl font-bold text-cyan-600 mt-2">{fishCount}</p>
            </div>
            <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🐟</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Events</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{detectionEvents.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📋</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Critical Alerts</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{criticalAlerts}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="text-red-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content: Camera Feed + Event Log ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Camera Feed (occupies 2 of 3 grid columns) */}
        <div className="lg:col-span-2">
          <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="bg-gray-700 px-4 py-3 flex items-center justify-between">
              <div>
                <h2 className="text-white font-semibold">Live Camera Feed</h2>
                <p className="text-gray-400 text-sm">
                  {feedSource === 'hls' ? 'Pond Camera via MediaMTX HLS' : 'AI-Powered Fish Health Detection'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Feed Source Toggle */}
                <div className="flex bg-gray-600 rounded-lg p-0.5">
                  <button
                    onClick={() => setFeedSource('hls')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                      feedSource === 'hls'
                        ? 'bg-cyan-500 text-white shadow'
                        : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    📡 HLS Live
                  </button>
                  <button
                    onClick={() => setFeedSource('ai')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                      feedSource === 'ai'
                        ? 'bg-cyan-500 text-white shadow'
                        : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    🤖 AI Detection
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-400 text-xs font-semibold">LIVE</span>
                </div>
              </div>
            </div>
            
            {/* HLS Feed (primary — always works in production) */}
            {feedSource === 'hls' && (
              <div className="aspect-video">
                <MediaMTXCameraFeed ref={hlsVideoRef} className="w-full h-full" showStatus={true} />
              </div>
            )}

            {/* AI Detection Feed (optional — requires local camera server) */}
            {feedSource === 'ai' && (
              <>
                <div className="relative aspect-video bg-gray-900 flex items-center justify-center">
              {cameraConnected && cameraFrame ? (
                <>
                  {/* Live Video Feed with Detections */}
                  <img 
                    src={cameraFrame} 
                    alt="Live Camera Feed" 
                    className="w-full h-full object-contain"
                  />
                  
                  {/* Detection Overlays */}
                  <div className="absolute top-4 right-4 space-y-2">
                    {detections.map((fish, idx) => (
                      <div 
                        key={idx} 
                        className={`px-3 py-1 rounded-lg text-sm font-semibold shadow-lg ${
                          fish.health?.is_critical 
                            ? 'bg-red-600 text-white animate-pulse' 
                            : fish.health?.needs_attention
                            ? 'bg-orange-500 text-white'
                            : 'bg-green-500 bg-opacity-80 text-white'
                        }`}
                      >
                        {getHealthEmoji(fish.health?.class || 'unknown')} Fish #{fish.id}: {fish.health?.class || 'detecting'} ({((fish.health?.confidence ?? 0) * 100).toFixed(0)}%)
                      </div>
                    ))}
                  </div>
                  
                  {/* Live Indicator & Controls */}
                  <div className="absolute top-4 left-4 space-y-2">
                    <div className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg">
                      <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                      <span>LIVE</span>
                    </div>
                    
                    {/* Performance Mode Selector */}
                    <div className="bg-black bg-opacity-70 text-white px-3 py-2 rounded-lg text-xs space-y-1">
                      <div className="text-gray-300 mb-1">Quality Mode:</div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleCameraModeChange('performance')}
                          className={`px-2 py-1 rounded ${
                            cameraMode === 'performance' 
                              ? 'bg-cyan-500 text-white' 
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          ⚡ Fast
                        </button>
                        <button
                          onClick={() => handleCameraModeChange('balanced')}
                          className={`px-2 py-1 rounded ${
                            cameraMode === 'balanced' 
                              ? 'bg-cyan-500 text-white' 
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          ⚖️ Balanced
                        </button>
                        <button
                          onClick={() => handleCameraModeChange('quality')}
                          className={`px-2 py-1 rounded ${
                            cameraMode === 'quality' 
                              ? 'bg-cyan-500 text-white' 
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          🎯 Quality
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Stats Bar */}
                  <div className="absolute bottom-4 left-4 right-4 flex gap-2">
                    <div className={`px-3 py-1 rounded text-sm flex items-center gap-2 ${
                      cameraFPS < 10 
                        ? 'bg-red-600 bg-opacity-90 text-white font-bold'
                        : cameraFPS < 15
                        ? 'bg-yellow-600 bg-opacity-90 text-white'
                        : 'bg-black bg-opacity-70 text-white'
                    }`}>
                      <Video size={16} />
                      <span>{cameraFPS.toFixed(1)} FPS</span>
                      {cameraFPS < 10 && <span>⚠️</span>}
                    </div>
                    <div className="bg-black bg-opacity-70 text-white px-3 py-1 rounded text-sm flex items-center gap-2">
                      <span>🐟 {fishCount} Fish</span>
                    </div>
                    {detections.some(d => d.health?.is_critical) && (
                      <div className="bg-red-600 text-white px-3 py-1 rounded text-sm font-bold animate-pulse">
                        ⚠️ CRITICAL ALERT
                      </div>
                    )}
                    {cameraFPS < 10 && (
                      <div className="bg-orange-600 text-white px-3 py-1 rounded text-sm">
                        💡 Try ⚡ Fast mode
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center p-6">
                  <div className="w-24 h-24 mx-auto mb-4 opacity-50">
                    {cameraConnected ? (
                      <Video className="text-cyan-500 w-full h-full" />
                    ) : (
                      <VideoOff className="text-gray-600 w-full h-full" />
                    )}
                  </div>
                  <p className="text-gray-400 text-lg mb-2">
                    {cameraConnected ? 'Waiting for camera stream...' : 'Camera Server Not Connected'}
                  </p>
                  <p className="text-gray-500 text-sm">
                    {cameraConnected 
                      ? 'Initializing fish detection models...' 
                      : `Trying to connect to ${CAMERA_SERVER_URL}`
                    }
                  </p>
                  {!cameraConnected && (
                    <div className="mt-4">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                      <p className="text-sm text-gray-500 mt-2">Reconnecting...</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="bg-gray-700 px-4 py-2 text-center text-sm">
              <div className="flex items-center justify-center gap-4 text-gray-300">
                <span className="flex items-center gap-2">
                  {cameraConnected ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span>AI Server: Connected</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <span>AI Server: Disconnected</span>
                    </>
                  )}
                </span>
                <span>|</span>
                <span>📹 AI Detection Mode — Switch to HLS for live stream</span>
              </div>
            </div>
              </>
            )}

            {/* Bottom status bar for HLS mode */}
            {feedSource === 'hls' && (
              <div className="bg-gray-700 px-4 py-2 text-center text-sm">
                <div className="flex items-center justify-center gap-4 text-gray-300">
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span>Pond Camera (RPi + MediaMTX)</span>
                  </span>
                  <span>|</span>
                  <span>📡 HLS Live Stream</span>
                  {cameraConnected && (
                    <>
                      <span>|</span>
                      <span className="text-green-400">🤖 AI Server Available</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Event Log - 1/3 width */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-4 py-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Detection Events Log</h3>
                <p className="text-sm text-cyan-100">Real-time event tracking</p>
              </div>
              <button
                onClick={() => fetchDetectionEvents(0)}
                disabled={isLoadingEvents}
                title="Refresh logs from database"
                className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 disabled:opacity-50 transition"
              >
                <RefreshCw size={16} className={isLoadingEvents ? 'animate-spin' : ''} />
              </button>
            </div>
            
            <div className="h-[600px] overflow-y-auto">
              {detectionEvents.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <AlertCircle size={48} className="mx-auto mb-3 opacity-50" />
                  <p>No detection events yet</p>
                  <p className="text-sm mt-1">Events will appear here in real-time</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {detectionEvents.map((event) => (
                    <div 
                      key={event.id} 
                      className={`p-4 hover:bg-gray-50 transition-colors ${
                        event.isCritical ? 'bg-red-50 border-l-4 border-red-500' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{getHealthEmoji(event.healthClass)}</span>
                          <div>
                            <p className="font-semibold text-gray-800">
                              Fish #{event.fishId}
                            </p>
                            <p className={`text-sm font-medium ${getHealthColor(event.healthClass)}`}>
                              {event.healthClass.toUpperCase()}
                            </p>
                          </div>
                        </div>
                        {event.isCritical && (
                          <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded">
                            CRITICAL
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>Confidence: {(event.confidence * 100).toFixed(1)}%</p>
                        <p className="text-xs text-gray-500">
                          {new Date(event.timestamp).toLocaleString()}
                        </p>
                      </div>
                      
                      {event.screenshotDataUrl && (
                        <img
                          src={event.screenshotDataUrl}
                          alt={`Detection screenshot for Fish #${event.fishId}`}
                          className="w-full rounded mt-2 border border-gray-200"
                        />
                      )}
                      
                      {event.needsAttention && !event.isCritical && (
                        <div className="mt-2 px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded">
                          ⚠️ Needs Attention
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Health Statistics */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Health Status Distribution</h3>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
          {['healthy', 'unhealthy', 'bacterial', 'fungal', 'parasitic', 'white_tail', 'dead'].map((status) => {
            const count = detectionEvents.filter(e => e.healthClass === status).length;
            const percentage = detectionEvents.length > 0 
              ? ((count / detectionEvents.length) * 100).toFixed(1) 
              : '0';
            
            return (
              <div key={status} className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-3xl mb-2">{getHealthEmoji(status)}</div>
                <p className={`font-bold text-2xl ${getHealthColor(status)}`}>{count}</p>
                <p className="text-sm text-gray-600 capitalize">{status.replace('_', ' ')}</p>
                <p className="text-xs text-gray-500 mt-1">{percentage}%</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PondCamera;
