import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Video, RefreshCw, WifiOff, Wifi, Maximize2, Minimize2 } from 'lucide-react';

// ─── Configuration ───
const MEDIAMTX_HLS_URL = import.meta.env.VITE_MEDIAMTX_HLS_URL ||
  'https://mediamtx.koifishfriend.online/live/camera/index.m3u8';

interface MediaMTXCameraFeedProps {
  streamPath?: string;   // e.g. "live/camera"
  className?: string;
  showStatus?: boolean;
}

type StreamStatus = 'connecting' | 'live' | 'waiting' | 'error' | 'unsupported';

const MediaMTXCameraFeed: React.FC<MediaMTXCameraFeedProps> = ({
  streamPath,
  className = '',
  showStatus = true,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<StreamStatus>('connecting');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build HLS URL
  const hlsUrl = streamPath
    ? `${MEDIAMTX_HLS_URL.replace(/\/live\/camera\/index\.m3u8$/, '')}/${streamPath}/index.m3u8`
    : MEDIAMTX_HLS_URL;

  const cleanup = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  const connectHls = useCallback(() => {
    cleanup();

    if (!videoRef.current) return;

    // Check HLS support
    if (!Hls.isSupported() && !videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      setStatus('unsupported');
      return;
    }

    setStatus('connecting');

    // Safari has native HLS support
    if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = hlsUrl;
      videoRef.current.addEventListener('loadedmetadata', () => {
        setStatus('live');
        setRetryCount(0);
        videoRef.current?.play().catch(() => {});
      });
      videoRef.current.addEventListener('error', () => {
        setStatus('waiting');
        retryTimerRef.current = setTimeout(() => {
          setRetryCount(c => c + 1);
          connectHls();
        }, 3000);
      });
      return;
    }

    // All other browsers: use hls.js
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 5,
      maxBufferLength: 10,
      maxMaxBufferLength: 15,
      liveSyncDurationCount: 2,
      liveMaxLatencyDurationCount: 5,
      manifestLoadingTimeOut: 8000,
      manifestLoadingMaxRetry: 3,
      levelLoadingTimeOut: 8000,
      fragLoadingTimeOut: 8000,
    });

    hlsRef.current = hls;
    hls.loadSource(hlsUrl);
    hls.attachMedia(videoRef.current);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setStatus('live');
      setRetryCount(0);
      videoRef.current?.play().catch(() => {});
    });

    hls.on(Hls.Events.ERROR, (_event: typeof Hls.Events.ERROR, data: { fatal: boolean; type: string }) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            // Stream not available yet — Pi not streaming or MediaMTX restarting
            setStatus('waiting');
            hls.destroy();
            hlsRef.current = null;
            retryTimerRef.current = setTimeout(() => {
              setRetryCount(c => c + 1);
              connectHls();
            }, 3000);
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            setStatus('error');
            hls.destroy();
            hlsRef.current = null;
            retryTimerRef.current = setTimeout(() => {
              setRetryCount(c => c + 1);
              connectHls();
            }, 5000);
            break;
        }
      }
    });
  }, [hlsUrl, cleanup]);

  useEffect(() => {
    connectHls();
    return cleanup;
  }, [connectHls, cleanup]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  return (
    <div ref={containerRef} className={`relative bg-gray-900 ${className}`} style={{ minHeight: '300px' }}>
      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        muted
        autoPlay
        playsInline
        style={{ display: status === 'live' ? 'block' : 'none' }}
      />

      {/* Status overlays */}
      {status === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500 mb-3"></div>
            <p className="text-sm font-medium">Connecting to camera stream...</p>
            <p className="text-xs text-gray-600 mt-1">MediaMTX HLS</p>
          </div>
        </div>
      )}

      {status === 'waiting' && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <div className="animate-pulse text-5xl mb-3">📡</div>
            <p className="text-sm font-semibold text-yellow-400">Waiting for camera stream...</p>
            <p className="text-xs text-gray-500 mt-2">
              Pi camera stream not detected. Make sure the streamer is running.
            </p>
            {retryCount > 0 && (
              <p className="text-xs text-gray-600 mt-1">
                Retry #{retryCount} — checking every 3s
              </p>
            )}
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center text-red-400">
          <div className="text-center">
            <WifiOff className="w-10 h-10 mx-auto mb-3" />
            <p className="text-sm font-semibold">Stream Error</p>
            <p className="text-xs text-gray-500 mt-2">Will retry automatically...</p>
            <button
              onClick={connectHls}
              className="mt-3 px-4 py-1.5 bg-cyan-600 text-white text-xs rounded-lg hover:bg-cyan-500 transition"
            >
              <RefreshCw className="w-3 h-3 inline mr-1" /> Retry Now
            </button>
          </div>
        </div>
      )}

      {status === 'unsupported' && (
        <div className="absolute inset-0 flex items-center justify-center text-red-400">
          <div className="text-center">
            <p className="text-sm font-semibold">Browser Not Supported</p>
            <p className="text-xs text-gray-500 mt-2">
              Your browser doesn't support HLS playback. Try Chrome or Firefox.
            </p>
          </div>
        </div>
      )}

      {/* Live badge + controls overlay */}
      {status === 'live' && (
        <>
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600/90 px-3 py-1 rounded-full shadow-lg">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-white text-xs font-bold tracking-wide">LIVE</span>
          </div>

          <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg text-white text-xs flex items-center gap-2">
            <Video className="w-3.5 h-3.5" />
            <span>Boat Camera (RPi + YOLOv8)</span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm p-2 rounded-lg text-white hover:bg-black/90 transition"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </>
      )}

      {/* Status bar */}
      {showStatus && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full">
          {status === 'live' ? (
            <Wifi className="w-3.5 h-3.5 text-green-400" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-gray-500" />
          )}
          <span className={`text-xs font-medium ${status === 'live' ? 'text-green-400' : 'text-gray-500'}`}>
            {status === 'live' ? 'HLS Connected' : status === 'connecting' ? 'Connecting...' : 'Offline'}
          </span>
        </div>
      )}
    </div>
  );
};

export default MediaMTXCameraFeed;
