import React, { useEffect, useState, useCallback } from 'react';
import {
  LiveKitRoom,
  VideoTrack,
  useTracks,
  useConnectionState,
} from '@livekit/components-react';
import { Track, ConnectionState } from 'livekit-client';
import '@livekit/components-styles';
import { Video, VideoOff, RefreshCw, Wifi, WifiOff } from 'lucide-react';

// ─── Configuration ───
const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL ||
  'wss://livekit.koifish-livekit-9ae13d-187-77-189-5.traefik.me';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8081';

// ─── Inner: Video renderer (must be inside LiveKitRoom) ───
function CameraVideoView() {
  const tracks = useTracks([Track.Source.Camera]);
  const connectionState = useConnectionState();

  // Connecting state
  if (connectionState === ConnectionState.Connecting) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px] bg-gray-900 text-gray-400">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500 mb-3"></div>
          <p className="text-sm font-medium">Connecting to LiveKit...</p>
          <p className="text-xs text-gray-600 mt-1">{LIVEKIT_URL}</p>
        </div>
      </div>
    );
  }

  // Reconnecting state
  if (connectionState === ConnectionState.Reconnecting) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px] bg-gray-900 text-orange-400">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 mx-auto mb-3 animate-spin" />
          <p className="text-sm font-semibold">Reconnecting...</p>
          <p className="text-xs text-gray-500 mt-1">Connection interrupted, retrying</p>
        </div>
      </div>
    );
  }

  // Disconnected state
  if (connectionState === ConnectionState.Disconnected) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px] bg-gray-900 text-red-400">
        <div className="text-center">
          <WifiOff className="w-10 h-10 mx-auto mb-3" />
          <p className="text-sm font-semibold">Disconnected</p>
          <p className="text-xs text-gray-500 mt-1">Will auto-reconnect...</p>
        </div>
      </div>
    );
  }

  // Connected but no camera tracks (Pi not publishing yet)
  if (tracks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px] bg-gray-900 text-gray-400">
        <div className="text-center">
          <div className="animate-pulse text-5xl mb-3">📡</div>
          <p className="text-sm font-semibold text-cyan-400">Connected to LiveKit ✅</p>
          <p className="text-xs text-gray-500 mt-2">
            Waiting for Raspberry Pi camera feed...
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Make sure <code className="bg-gray-800 px-1 py-0.5 rounded text-cyan-300">camera_publisher.py</code> is running on the Pi
          </p>
        </div>
      </div>
    );
  }

  // Live video feed
  return (
    <div className="relative w-full h-full bg-black" style={{ minHeight: '300px' }}>
      {tracks.map((trackRef) => (
        <VideoTrack
          key={trackRef.participant.identity}
          trackRef={trackRef}
          className="w-full h-full object-contain"
        />
      ))}

      {/* LIVE badge */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600/90 px-3 py-1 rounded-full shadow-lg">
        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        <span className="text-white text-xs font-bold tracking-wide">LIVE</span>
      </div>

      {/* Source label */}
      <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg text-white text-xs flex items-center gap-2">
        <Video className="w-3.5 h-3.5" />
        <span>{tracks[0]?.participant.name || 'Boat Camera'}</span>
      </div>

      {/* WebRTC badge */}
      <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-lg text-xs text-cyan-300 flex items-center gap-1.5">
        <Wifi className="w-3 h-3" />
        <span>WebRTC via LiveKit</span>
      </div>
    </div>
  );
}

// ─── Inner: Connection status bar ───
function ConnectionStatusBar() {
  const connectionState = useConnectionState();

  const statusMap: Record<string, { icon: React.ReactNode; text: string; color: string }> = {
    [ConnectionState.Connected]: {
      icon: <Wifi className="w-3 h-3 text-green-500" />,
      text: 'LiveKit Connected',
      color: 'text-green-500',
    },
    [ConnectionState.Connecting]: {
      icon: <RefreshCw className="w-3 h-3 text-yellow-500 animate-spin" />,
      text: 'Connecting...',
      color: 'text-yellow-500',
    },
    [ConnectionState.Disconnected]: {
      icon: <WifiOff className="w-3 h-3 text-red-500" />,
      text: 'Disconnected',
      color: 'text-red-500',
    },
    [ConnectionState.Reconnecting]: {
      icon: <RefreshCw className="w-3 h-3 text-orange-500 animate-spin" />,
      text: 'Reconnecting...',
      color: 'text-orange-500',
    },
  };

  const status = statusMap[connectionState] || statusMap[ConnectionState.Disconnected];

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {status.icon}
      <span className={`font-medium ${status.color}`}>{status.text}</span>
    </div>
  );
}

// ─── Main exported component ───
interface LiveKitCameraFeedProps {
  room?: string;
  className?: string;
  showStatus?: boolean;
  showHeader?: boolean;
}

const LiveKitCameraFeed: React.FC<LiveKitCameraFeedProps> = ({
  room = 'boat-navigation',
  className = '',
  showStatus = true,
  showHeader = false,
}) => {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchToken = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const viewerId = `viewer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const res = await fetch(`${API_BASE}/api/livekit/token?identity=${viewerId}&room=${room}`);

      if (!res.ok) {
        throw new Error(
          res.status === 404
            ? 'LiveKit token endpoint not found. Deploy LiveKitController to your backend.'
            : `Backend returned ${res.status}: ${res.statusText}`
        );
      }

      const data = await res.json();
      if (data.token) {
        setToken(data.token);
      } else {
        throw new Error('No token in response');
      }
    } catch (err: any) {
      console.error('Failed to fetch LiveKit token:', err);
      setError(err.message || 'Failed to get camera token');
    } finally {
      setLoading(false);
    }
  }, [room]);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  // Loading state
  if (loading) {
    return (
      <div className={`bg-gray-900 rounded-lg overflow-hidden ${className}`}>
        {showHeader && (
          <div className="bg-gray-700 px-4 py-3">
            <h2 className="text-white font-semibold">Live Camera Feed</h2>
            <p className="text-gray-400 text-sm">Boat POV Camera</p>
          </div>
        )}
        <div className="flex items-center justify-center h-64 text-gray-400">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mb-2"></div>
            <p className="text-sm">Initializing LiveKit camera...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`bg-gray-900 rounded-lg overflow-hidden ${className}`}>
        {showHeader && (
          <div className="bg-gray-700 px-4 py-3">
            <h2 className="text-white font-semibold">Live Camera Feed</h2>
            <p className="text-gray-400 text-sm">Boat POV Camera</p>
          </div>
        )}
        <div className="flex items-center justify-center h-64 text-red-400">
          <div className="text-center p-6">
            <VideoOff className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-semibold mb-1">Camera Feed Error</p>
            <p className="text-xs text-gray-400 mb-4 max-w-sm">{error}</p>
            <button
              onClick={fetchToken}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs rounded-lg transition flex items-center gap-2 mx-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!token) return null;

  return (
    <div className={`bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      <LiveKitRoom
        serverUrl={LIVEKIT_URL}
        token={token}
        connect={true}
        audio={false}
        video={false}
        options={{
          adaptiveStream: true,
          dynacast: true,
        }}
        onDisconnected={() => {
          console.log('🔌 LiveKit disconnected, will auto-reconnect');
        }}
        onError={(err) => {
          console.error('❌ LiveKit room error:', err);
        }}
      >
        <div className="relative">
          <CameraVideoView />
          {showStatus && (
            <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-full">
              <ConnectionStatusBar />
            </div>
          )}
        </div>
      </LiveKitRoom>
    </div>
  );
};

export default LiveKitCameraFeed;
