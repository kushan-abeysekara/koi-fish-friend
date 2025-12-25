import React, { useState, useEffect } from 'react';

const BoatNavigation: React.FC = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [streamError, setStreamError] = useState(false);
  const [lastCommand, setLastCommand] = useState<string>('');
  const [speed, setSpeed] = useState(50);

  const sendCommand = async (direction: 'forward' | 'backward' | 'left' | 'right' | 'stop') => {
    try {
      setLastCommand(direction.toUpperCase());
      
      // TODO: Replace with actual API call to boat control system
      // await fetch(`http://localhost:5000/api/boat/navigate`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ direction, speed })
      // });
      
      console.log(`Boat command: ${direction} at speed ${speed}%`);
      
      // Auto-clear command after 2 seconds
      setTimeout(() => setLastCommand(''), 2000);
    } catch (error) {
      console.error('Error sending boat command:', error);
    }
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    switch(e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        sendCommand('forward');
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        sendCommand('backward');
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        sendCommand('left');
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        sendCommand('right');
        break;
      case ' ':
        e.preventDefault();
        sendCommand('stop');
        break;
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [speed]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <i className="fas fa-ship text-cyan-500"></i>
            Boat Navigation Control
          </h2>
          <p className="text-gray-600 mt-1">Remote control with live camera feed</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg ${
            isConnected 
              ? 'bg-green-100 text-green-700' 
              : 'bg-red-100 text-red-700'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}></span>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Main Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera Feed - Left Side (2 columns on desktop) */}
        <div className="lg:col-span-2 order-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Camera Header */}
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg md:text-xl font-semibold">Live Camera Feed</h3>
                  <p className="text-xs md:text-sm text-gray-300 mt-1">Boat POV Camera</p>
                </div>
                <div className="flex items-center gap-3">
                  {lastCommand && (
                    <div className="bg-cyan-500 px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-bold animate-pulse">
                      {lastCommand}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Video Stream */}
            <div className="relative bg-gray-900 aspect-video flex items-center justify-center">
              {isConnected ? (
                <>
                  {!streamError ? (
                    <>
                      {/* Live MJPEG Stream */}
                      <div className="relative w-full h-full">
                        <img
                          src="http://localhost:5000/api/boat/stream"
                          alt="Boat camera live feed"
                          className="w-full h-full object-contain"
                          onError={() => {
                            console.error('Boat stream connection failed');
                            setStreamError(true);
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

                      {/* Speed Indicator */}
                      <div className="absolute top-4 right-4 bg-black bg-opacity-60 text-white px-3 py-2 rounded-lg text-sm">
                        <div className="flex items-center gap-2">
                          <i className="fas fa-tachometer-alt"></i>
                          <span>Speed: {speed}%</span>
                        </div>
                      </div>

                      {/* Timestamp */}
                      <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 text-white px-3 py-2 rounded-lg text-xs">
                        {new Date().toLocaleString()}
                      </div>

                      {/* Command Display */}
                      {lastCommand && (
                        <div className="absolute bottom-4 right-4 bg-cyan-500 text-white px-4 py-2 rounded-lg text-lg font-bold">
                          <i className={`fas fa-arrow-${
                            lastCommand === 'FORWARD' ? 'up' :
                            lastCommand === 'BACKWARD' ? 'down' :
                            lastCommand === 'LEFT' ? 'left' :
                            lastCommand === 'RIGHT' ? 'right' : 'circle'
                          } mr-2`}></i>
                          {lastCommand}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center text-gray-400">
                      <i className="fas fa-video-slash text-6xl mb-4"></i>
                      <p className="text-xl font-semibold">Camera Stream Not Available</p>
                      <p className="text-sm mt-2">Camera server is not running on port 5000</p>
                      <button
                        onClick={() => setStreamError(false)}
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
                  <i className="fas fa-ship text-6xl mb-4"></i>
                  <p className="text-xl font-semibold">Boat Offline</p>
                  <p className="text-sm mt-2">Unable to connect to boat system</p>
                </div>
              )}
            </div>

            {/* Keyboard Shortcuts Info */}
            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <i className="fas fa-keyboard"></i>
                  <span className="text-xs md:text-sm">Keyboard: Arrow Keys or WASD + Space to Stop</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fas fa-signal"></i>
                  <span className="text-xs md:text-sm">Quality: HD</span>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Navigation Controls - Shows under camera on mobile */}
          <div className="lg:hidden mt-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">Navigation Controls</h3>
              
              <div className="space-y-2">
                {/* Forward */}
                <div className="flex justify-center">
                  <button
                    onMouseDown={() => sendCommand('forward')}
                    onTouchStart={() => sendCommand('forward')}
                    onMouseUp={() => sendCommand('stop')}
                    onTouchEnd={() => sendCommand('stop')}
                    onMouseLeave={() => sendCommand('stop')}
                    className="w-20 h-20 bg-gradient-to-b from-cyan-500 to-cyan-600 text-white rounded-lg active:scale-95 transition-all shadow-lg flex items-center justify-center text-3xl"
                    disabled={!isConnected}
                  >
                    <i className="fas fa-arrow-up"></i>
                  </button>
                </div>

                {/* Left, Stop, Right */}
                <div className="flex justify-center gap-2">
                  <button
                    onMouseDown={() => sendCommand('left')}
                    onTouchStart={() => sendCommand('left')}
                    onMouseUp={() => sendCommand('stop')}
                    onTouchEnd={() => sendCommand('stop')}
                    onMouseLeave={() => sendCommand('stop')}
                    className="w-20 h-20 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg active:scale-95 transition-all shadow-lg flex items-center justify-center text-3xl"
                    disabled={!isConnected}
                  >
                    <i className="fas fa-arrow-left"></i>
                  </button>

                  <button
                    onClick={() => sendCommand('stop')}
                    className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg active:scale-95 transition-all shadow-lg flex items-center justify-center text-2xl"
                    disabled={!isConnected}
                  >
                    <i className="fas fa-stop"></i>
                  </button>

                  <button
                    onMouseDown={() => sendCommand('right')}
                    onTouchStart={() => sendCommand('right')}
                    onMouseUp={() => sendCommand('stop')}
                    onTouchEnd={() => sendCommand('stop')}
                    onMouseLeave={() => sendCommand('stop')}
                    className="w-20 h-20 bg-gradient-to-l from-cyan-500 to-cyan-600 text-white rounded-lg active:scale-95 transition-all shadow-lg flex items-center justify-center text-3xl"
                    disabled={!isConnected}
                  >
                    <i className="fas fa-arrow-right"></i>
                  </button>
                </div>

                {/* Backward */}
                <div className="flex justify-center">
                  <button
                    onMouseDown={() => sendCommand('backward')}
                    onTouchStart={() => sendCommand('backward')}
                    onMouseUp={() => sendCommand('stop')}
                    onTouchEnd={() => sendCommand('stop')}
                    onMouseLeave={() => sendCommand('stop')}
                    className="w-20 h-20 bg-gradient-to-t from-cyan-500 to-cyan-600 text-white rounded-lg active:scale-95 transition-all shadow-lg flex items-center justify-center text-3xl"
                    disabled={!isConnected}
                  >
                    <i className="fas fa-arrow-down"></i>
                  </button>
                </div>
              </div>

              {/* Speed Control - Mobile */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <label className="text-sm text-gray-600 block mb-2">Speed: {speed}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                <i className="fas fa-info-circle mr-1"></i>
                Hold buttons to move. Release to stop automatically.
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Control Panel - Right Side (hidden on mobile) */}
        <div className="hidden lg:block space-y-4 order-2">
          {/* Speed Control */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Speed Control</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 block mb-2">Speed: {speed}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <button
                  onClick={() => setSpeed(25)}
                  className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                >
                  Slow
                </button>
                <button
                  onClick={() => setSpeed(50)}
                  className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                >
                  Medium
                </button>
                <button
                  onClick={() => setSpeed(100)}
                  className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                >
                  Fast
                </button>
              </div>
            </div>
          </div>

          {/* Arrow Controls */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Navigation Controls</h3>
            
            <div className="space-y-2">
              {/* Forward */}
              <div className="flex justify-center">
                <button
                  onMouseDown={() => sendCommand('forward')}
                  onMouseUp={() => sendCommand('stop')}
                  onMouseLeave={() => sendCommand('stop')}
                  className="w-20 h-20 bg-gradient-to-b from-cyan-500 to-cyan-600 text-white rounded-lg hover:from-cyan-600 hover:to-cyan-700 active:scale-95 transition-all shadow-lg flex items-center justify-center text-3xl"
                  disabled={!isConnected}
                >
                  <i className="fas fa-arrow-up"></i>
                </button>
              </div>

              {/* Left, Stop, Right */}
              <div className="flex justify-center gap-2">
                <button
                  onMouseDown={() => sendCommand('left')}
                  onMouseUp={() => sendCommand('stop')}
                  onMouseLeave={() => sendCommand('stop')}
                  className="w-20 h-20 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg hover:from-cyan-600 hover:to-cyan-700 active:scale-95 transition-all shadow-lg flex items-center justify-center text-3xl"
                  disabled={!isConnected}
                >
                  <i className="fas fa-arrow-left"></i>
                </button>

                <button
                  onClick={() => sendCommand('stop')}
                  className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 active:scale-95 transition-all shadow-lg flex items-center justify-center text-2xl"
                  disabled={!isConnected}
                >
                  <i className="fas fa-stop"></i>
                </button>

                <button
                  onMouseDown={() => sendCommand('right')}
                  onMouseUp={() => sendCommand('stop')}
                  onMouseLeave={() => sendCommand('stop')}
                  className="w-20 h-20 bg-gradient-to-l from-cyan-500 to-cyan-600 text-white rounded-lg hover:from-cyan-600 hover:to-cyan-700 active:scale-95 transition-all shadow-lg flex items-center justify-center text-3xl"
                  disabled={!isConnected}
                >
                  <i className="fas fa-arrow-right"></i>
                </button>
              </div>

              {/* Backward */}
              <div className="flex justify-center">
                <button
                  onMouseDown={() => sendCommand('backward')}
                  onMouseUp={() => sendCommand('stop')}
                  onMouseLeave={() => sendCommand('stop')}
                  className="w-20 h-20 bg-gradient-to-t from-cyan-500 to-cyan-600 text-white rounded-lg hover:from-cyan-600 hover:to-cyan-700 active:scale-95 transition-all shadow-lg flex items-center justify-center text-3xl"
                  disabled={!isConnected}
                >
                  <i className="fas fa-arrow-down"></i>
                </button>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
              <i className="fas fa-info-circle mr-1"></i>
              Hold buttons to move. Release to stop automatically.
            </div>
          </div>

          {/* Status Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Status Information</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Connection:</span>
                <span className={`font-semibold ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                  {isConnected ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Current Speed:</span>
                <span className="font-semibold text-gray-800">{speed}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Last Command:</span>
                <span className="font-semibold text-gray-800">
                  {lastCommand || 'None'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Camera Status:</span>
                <span className={`font-semibold ${streamError ? 'text-red-600' : 'text-green-600'}`}>
                  {streamError ? 'Error' : 'Active'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Stop */}
      <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-xl shadow-lg p-4 md:p-6 text-white">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <h3 className="text-lg md:text-xl font-semibold mb-1 md:mb-2">Emergency Controls</h3>
            <p className="text-xs md:text-sm text-red-100">Use these controls for immediate boat stopping</p>
          </div>
          <button
            onClick={() => sendCommand('stop')}
            className="w-full md:w-auto px-6 md:px-8 py-3 md:py-4 bg-white text-red-600 rounded-lg hover:bg-red-50 transition-colors font-bold text-base md:text-lg shadow-xl flex items-center justify-center gap-2 md:gap-3"
          >
            <i className="fas fa-hand-paper text-xl md:text-2xl"></i>
            EMERGENCY STOP
          </button>
        </div>
      </div>
    </div>
  );
};

export default BoatNavigation;
