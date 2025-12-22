import React, { useState, useEffect } from 'react';
import { cameraApi, type CameraPond } from '../services/api';

interface CameraStatusBadgeProps {
  status: 'online' | 'offline';
}

const CameraStatusBadge: React.FC<CameraStatusBadgeProps> = ({ status }) => {
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
      status === 'online' 
        ? 'bg-green-100 text-green-700' 
        : 'bg-gray-100 text-gray-600'
    }`}>
      <span className={`w-2 h-2 rounded-full ${
        status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
      }`}></span>
      {status === 'online' ? 'Camera Online' : 'Camera Offline'}
    </div>
  );
};

interface PondStatusBadgeProps {
  status: 'normal' | 'warning' | 'critical';
}

const PondStatusBadge: React.FC<PondStatusBadgeProps> = ({ status }) => {
  const styles = {
    normal: 'bg-green-100 text-green-700 border-green-200',
    warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    critical: 'bg-red-100 text-red-700 border-red-200'
  };

  const icons = {
    normal: 'fa-check-circle',
    warning: 'fa-exclamation-triangle',
    critical: 'fa-exclamation-circle'
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${styles[status]}`}>
      <i className={`fas ${icons[status]}`}></i>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </div>
  );
};

const PondCamera: React.FC = () => {
  const [ponds, setPonds] = useState<CameraPond[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPond, setSelectedPond] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [streamError, setStreamError] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetchPonds();
  }, []);

  const fetchPonds = async () => {
    try {
      setLoading(true);
      // Try to fetch from API first
      try {
        const response = await cameraApi.getAllPonds();
        if (response.success && response.data) {
          setPonds(response.data);
          if (response.data.length > 0) {
            setSelectedPond(response.data[0].id);
          }
          return;
        }
      } catch {
        console.log('API not available, using mock data');
      }
      
      // Fallback to mock data if API fails
      const mockPonds: CameraPond[] = [
        {
          id: 1,
          name: 'Pond A - Main',
          status: 'normal',
          lastDetectionTime: new Date(Date.now() - 3600000).toISOString(),
          lastAlertSummary: null,
          cameraStatus: 'online',
          streamUrl: cameraApi.getStreamUrl(1)
        },
        {
          id: 2,
          name: 'Pond B - Secondary',
          status: 'warning',
          lastDetectionTime: new Date(Date.now() - 1800000).toISOString(),
          lastAlertSummary: 'Abnormal behavior detected during high humidity',
          cameraStatus: 'online',
          streamUrl: cameraApi.getStreamUrl(2)
        },
        {
          id: 3,
          name: 'Pond C - Nursery',
          status: 'critical',
          lastDetectionTime: new Date(Date.now() - 600000).toISOString(),
          lastAlertSummary: 'Possible mortality detected during rainfall',
          cameraStatus: 'online',
          streamUrl: cameraApi.getStreamUrl(3)
        },
        {
          id: 4,
          name: 'Pond D - Quarantine',
          status: 'normal',
          lastDetectionTime: null,
          lastAlertSummary: null,
          cameraStatus: 'offline'
        }
      ];
      
      setPonds(mockPonds);
      if (mockPonds.length > 0) {
        setSelectedPond(mockPonds[0].id);
      }
    } catch (error) {
      console.error('Error fetching ponds:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCaptureSnapshot = async (pondId: number) => {
    try {
      setIsCapturing(true);
      const response = await cameraApi.captureSnapshot(pondId);
      
      if (response.success) {
        alert('Snapshot captured successfully!');
      } else {
        alert('Failed to capture snapshot: ' + response.message);
      }
    } catch (error) {
      console.error('Error capturing snapshot:', error);
      alert('Failed to capture snapshot - camera service may be unavailable');
    } finally {
      setIsCapturing(false);
    }
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-cyan-500 mb-4"></i>
          <p className="text-gray-600">Loading pond cameras...</p>
        </div>
      </div>
    );
  }

  const selectedPondData = ponds.find(p => p.id === selectedPond);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <i className="fas fa-video text-cyan-500"></i>
            Pond Camera Monitoring
          </h2>
          <p className="text-gray-600 mt-1">Live camera feeds and pond surveillance</p>
        </div>
        <button
          onClick={fetchPonds}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <i className="fas fa-sync-alt"></i>
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Ponds</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{ponds.length}</p>
            </div>
            <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-water text-cyan-600 text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Cameras Online</p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {ponds.filter(p => p.cameraStatus === 'online').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-video text-green-600 text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Warnings</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">
                {ponds.filter(p => p.status === 'warning').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-exclamation-triangle text-yellow-600 text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Critical Alerts</p>
              <p className="text-3xl font-bold text-red-600 mt-2">
                {ponds.filter(p => p.status === 'critical').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-exclamation-circle text-red-600 text-xl"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pond List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Pond Overview</h3>
            <div className="space-y-3">
              {ponds.map(pond => (
                <button
                  key={pond.id}
                  onClick={() => setSelectedPond(pond.id)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    selectedPond === pond.id
                      ? 'border-cyan-500 bg-cyan-50'
                      : 'border-gray-200 bg-white hover:border-cyan-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-gray-800">{pond.name}</h4>
                    <PondStatusBadge status={pond.status} />
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Camera:</span>
                      <CameraStatusBadge status={pond.cameraStatus} />
                    </div>
                    
                    <div className="flex items-center gap-2 text-gray-600">
                      <i className="fas fa-clock text-xs"></i>
                      <span className="text-xs">Last detection: {formatTimestamp(pond.lastDetectionTime)}</span>
                    </div>
                    
                    {pond.lastAlertSummary && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                        <i className="fas fa-info-circle mr-1"></i>
                        {pond.lastAlertSummary}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Camera Feed */}
        <div className="lg:col-span-2">
          {selectedPondData ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Camera Header */}
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">{selectedPondData.name}</h3>
                    <p className="text-sm text-gray-300 mt-1">Live Camera Feed</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <CameraStatusBadge status={selectedPondData.cameraStatus} />
                    <PondStatusBadge status={selectedPondData.status} />
                  </div>
                </div>
              </div>

              {/* Video Stream */}
              <div className="relative bg-gray-900 aspect-video flex items-center justify-center">
                {selectedPondData.cameraStatus === 'online' ? (
                  <>
                    {!streamError[selectedPondData.id] ? (
                      <>
                        {/* Live MJPEG Stream */}
                        <div className="relative w-full h-full">
                          <img
                            src={`http://localhost:5000/api/camera/stream/${selectedPondData.id}`}
                            alt={`${selectedPondData.name} live feed`}
                            className="w-full h-full object-contain"
                            onError={() => {
                              console.error('Stream connection failed for pond', selectedPondData.id);
                              setStreamError(prev => ({ ...prev, [selectedPondData.id]: true }));
                            }}
                          />
                        </div>

                        {/* Stream Overlay Info */}
                        <div className="absolute top-4 left-4 bg-black bg-opacity-60 text-white px-3 py-2 rounded-lg text-sm">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                            <span>LIVE</span>
                          </div>
                        </div>

                        {/* Timestamp */}
                        <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 text-white px-3 py-2 rounded-lg text-xs">
                          {new Date().toLocaleString()}
                        </div>
                      </>
                    ) : (
                      <div className="text-center text-gray-400">
                        <i className="fas fa-video-slash text-6xl mb-4"></i>
                        <p className="text-xl font-semibold">Stream Not Available</p>
                        <p className="text-sm mt-2">Camera server is not running on port 5000</p>
                        <button
                          onClick={() => setStreamError(prev => ({ ...prev, [selectedPondData.id]: false }))}
                          className="mt-4 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
                        >
                          <i className="fas fa-sync-alt mr-2"></i>
                          Retry Connection
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center text-gray-400">
                    <i className="fas fa-video-slash text-6xl mb-4"></i>
                    <p className="text-xl font-semibold">Camera Offline</p>
                    <p className="text-sm mt-2">Unable to connect to camera feed</p>
                  </div>
                )}
              </div>

              {/* Camera Controls */}
              <div className="p-4 bg-gray-50 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleCaptureSnapshot(selectedPondData.id)}
                      disabled={selectedPondData.cameraStatus === 'offline' || isCapturing}
                      className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <i className={`fas ${isCapturing ? 'fa-spinner fa-spin' : 'fa-camera'}`}></i>
                      {isCapturing ? 'Capturing...' : 'Capture Snapshot'}
                    </button>
                    
                    <button
                      disabled={selectedPondData.cameraStatus === 'offline'}
                      className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <i className="fas fa-expand"></i>
                      Fullscreen
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <i className="fas fa-signal"></i>
                    <span>Quality: HD</span>
                  </div>
                </div>

                {/* Last Detection Info */}
                {selectedPondData.lastDetectionTime && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <i className="fas fa-info-circle text-blue-500 mt-0.5"></i>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900">Last Detection Activity</p>
                        <p className="text-xs text-blue-700 mt-1">
                          {formatTimestamp(selectedPondData.lastDetectionTime)}
                        </p>
                        {selectedPondData.lastAlertSummary && (
                          <p className="text-sm text-blue-800 mt-2">
                            {selectedPondData.lastAlertSummary}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <i className="fas fa-water text-6xl text-gray-300 mb-4"></i>
              <p className="text-gray-600">Select a pond to view camera feed</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold mb-2">Camera System Status</h3>
            <p className="text-cyan-100">
              {ponds.filter(p => p.cameraStatus === 'online').length} of {ponds.length} cameras operational
            </p>
          </div>
          <div className="flex gap-3">
            <button className="px-5 py-2 bg-white text-cyan-600 rounded-lg hover:bg-cyan-50 transition-colors font-medium">
              View All Events
            </button>
            <button className="px-5 py-2 bg-cyan-600 text-white border-2 border-white rounded-lg hover:bg-cyan-700 transition-colors font-medium">
              System Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PondCamera;
