import React, { useMemo } from 'react';

/**
 * 3D Animated Boat Tilt Visualization
 * Renders a CSS 3D boat model that tilts in real-time based on 
 * gyroscope/accelerometer data from the ESP32 MPU-6050 sensor.
 */

interface BoatTilt3DProps {
  angleX: number;   // Pitch: forward/backward tilt (degrees)
  angleY: number;   // Roll: left/right tilt (degrees)
  temperature: number;
  voltage: number;
  className?: string;
}

const BoatTilt3D: React.FC<BoatTilt3DProps> = ({ angleX, angleY, temperature, voltage, className = '' }) => {
  // Clamp angles to prevent wild spinning
  const pitch = Math.max(-45, Math.min(45, angleY));  // Forward/back
  const roll = Math.max(-45, Math.min(45, angleX));    // Left/right

  // Determine tilt severity for color coding
  const tiltSeverity = useMemo(() => {
    const maxTilt = Math.max(Math.abs(pitch), Math.abs(roll));
    if (maxTilt < 5) return { label: 'Stable', color: 'text-green-400', bg: 'from-green-500/20 to-green-600/10', ring: 'ring-green-400/30' };
    if (maxTilt < 15) return { label: 'Slight Tilt', color: 'text-yellow-400', bg: 'from-yellow-500/20 to-yellow-600/10', ring: 'ring-yellow-400/30' };
    if (maxTilt < 30) return { label: 'Tilting', color: 'text-orange-400', bg: 'from-orange-500/20 to-orange-600/10', ring: 'ring-orange-400/30' };
    return { label: 'DANGER', color: 'text-red-400', bg: 'from-red-500/20 to-red-600/10', ring: 'ring-red-400/40' };
  }, [pitch, roll]);

  // Water wave animation offset based on tilt
  const waveOffset = roll * 0.5;

  return (
    <div className={`bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 rounded-xl p-5 ${className}`}>
      {/* Title */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-lg flex items-center gap-2">
          <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          3D Boat Orientation
        </h3>
        <span className={`text-xs font-bold px-2 py-1 rounded-full bg-black/30 ${tiltSeverity.color}`}>
          {tiltSeverity.label}
        </span>
      </div>

      {/* 3D Scene */}
      <div className="relative" style={{ perspective: '600px' }}>
        {/* Ocean/Water background */}
        <div className="absolute inset-0 rounded-lg overflow-hidden">
          <div 
            className="absolute inset-0 bg-gradient-to-b from-cyan-900/40 via-blue-900/60 to-blue-950/80"
            style={{ transform: `translateX(${waveOffset}px)` }}
          />
          {/* Animated waves */}
          <svg className="absolute bottom-0 w-full h-16 opacity-30" viewBox="0 0 400 50" preserveAspectRatio="none">
            <path 
              d="M0,25 C50,15 100,35 150,25 C200,15 250,35 300,25 C350,15 400,35 400,25 L400,50 L0,50 Z" 
              fill="url(#waveGrad)" 
              className="animate-pulse"
            />
            <defs>
              <linearGradient id="waveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#0891b2" stopOpacity="0.1" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* 3D Boat Container */}
        <div className="flex justify-center items-center py-8 relative z-10">
          <div
            className="transition-transform duration-300 ease-out"
            style={{
              transform: `rotateX(${-pitch}deg) rotateZ(${roll}deg)`,
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Boat SVG - top-down view that tilts in 3D */}
            <div className="relative w-40 h-56">
              {/* Shadow/reflection */}
              <div
                className="absolute inset-0 blur-xl opacity-30"
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(6,182,212,0.5) 0%, transparent 70%)',
                  transform: `translateY(${10 + pitch * 0.3}px) scale(${1 - Math.abs(roll) * 0.005})`,
                }}
              />

              {/* Hull */}
              <svg viewBox="0 0 120 180" className="w-full h-full drop-shadow-2xl">
                {/* Water line glow */}
                <ellipse cx="60" cy="100" rx="52" ry="80" fill="none" stroke="rgba(6,182,212,0.15)" strokeWidth="8" />
                
                {/* Hull body */}
                <path
                  d="M60,10 C25,30 15,60 15,100 C15,140 30,165 60,175 C90,165 105,140 105,100 C105,60 95,30 60,10Z"
                  fill="url(#hullGrad)"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="1.5"
                />
                
                {/* Deck */}
                <path
                  d="M60,25 C35,40 28,65 28,100 C28,130 38,152 60,160 C82,152 92,130 92,100 C92,65 85,40 60,25Z"
                  fill="url(#deckGrad)"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="0.5"
                />

                {/* Center cabin */}
                <rect x="42" y="65" width="36" height="45" rx="4" fill="url(#cabinGrad)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
                
                {/* Cabin window */}
                <rect x="48" y="72" width="24" height="12" rx="2" fill="#0e7490" opacity="0.8" />
                <rect x="48" y="72" width="24" height="12" rx="2" fill="none" stroke="rgba(6,182,212,0.5)" strokeWidth="0.5" />
                
                {/* Motor/engine block */}
                <rect x="50" y="140" width="20" height="18" rx="3" fill="#374151" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                <circle cx="60" cy="149" r="4" fill="#1f2937" stroke="#06b6d4" strokeWidth="0.5" opacity="0.7" />
                
                {/* Bow point marker */}
                <circle cx="60" cy="18" r="3" fill="#06b6d4" opacity="0.9" />
                <circle cx="60" cy="18" r="6" fill="none" stroke="#06b6d4" strokeWidth="0.5" opacity="0.4">
                  <animate attributeName="r" values="4;8;4" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0.1;0.6" dur="2s" repeatCount="indefinite" />
                </circle>

                {/* Direction arrow (front) */}
                <path d="M55,30 L60,18 L65,30" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeLinecap="round" />

                {/* Gradients */}
                <defs>
                  <linearGradient id="hullGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1e3a5f" />
                    <stop offset="50%" stopColor="#1e293b" />
                    <stop offset="100%" stopColor="#0f172a" />
                  </linearGradient>
                  <linearGradient id="deckGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#334155" />
                    <stop offset="100%" stopColor="#1e293b" />
                  </linearGradient>
                  <linearGradient id="cabinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#475569" />
                    <stop offset="100%" stopColor="#334155" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Tilt axis indicators */}
              {/* Pitch indicator (vertical line) */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                <div className="w-px h-32 bg-gradient-to-b from-transparent via-cyan-400/30 to-transparent" />
              </div>
              {/* Roll indicator (horizontal line) */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                <div className="w-32 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Angle Data Readouts */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        {/* Pitch */}
        <div className={`bg-gradient-to-r ${tiltSeverity.bg} rounded-lg p-3 ring-1 ${tiltSeverity.ring}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12l7-7 7 7" />
              </svg>
              <span className="text-gray-400 text-xs font-medium">Pitch</span>
            </div>
            <span className={`text-sm font-bold ${tiltSeverity.color}`}>{pitch.toFixed(1)}°</span>
          </div>
          {/* Mini gauge */}
          <div className="mt-2 h-1.5 bg-black/30 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-300"
              style={{ width: `${Math.min(100, (Math.abs(pitch) / 45) * 100)}%` }}
            />
          </div>
        </div>

        {/* Roll */}
        <div className={`bg-gradient-to-r ${tiltSeverity.bg} rounded-lg p-3 ring-1 ${tiltSeverity.ring}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              <span className="text-gray-400 text-xs font-medium">Roll</span>
            </div>
            <span className={`text-sm font-bold ${tiltSeverity.color}`}>{roll.toFixed(1)}°</span>
          </div>
          <div className="mt-2 h-1.5 bg-black/30 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-300"
              style={{ width: `${Math.min(100, (Math.abs(roll) / 45) * 100)}%` }}
            />
          </div>
        </div>

        {/* Temperature */}
        <div className="bg-gradient-to-r from-slate-800/60 to-slate-700/40 rounded-lg p-3 ring-1 ring-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z" />
              </svg>
              <span className="text-gray-400 text-xs font-medium">Temp</span>
            </div>
            <span className="text-sm font-bold text-orange-400">{temperature.toFixed(1)}°C</span>
          </div>
        </div>

        {/* Voltage */}
        <div className="bg-gradient-to-r from-slate-800/60 to-slate-700/40 rounded-lg p-3 ring-1 ring-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              <span className="text-gray-400 text-xs font-medium">Battery</span>
            </div>
            <span className={`text-sm font-bold ${voltage > 5.5 ? 'text-green-400' : 'text-red-400'}`}>
              {voltage.toFixed(1)}V
            </span>
          </div>
        </div>
      </div>

      {/* Compass-style reference */}
      <div className="mt-3 flex justify-center">
        <div className="flex items-center gap-4 text-[10px] text-gray-500 font-medium">
          <span>◀ Port</span>
          <span className="text-cyan-500">▲ Bow</span>
          <span>Starboard ▶</span>
        </div>
      </div>
    </div>
  );
};

export default BoatTilt3D;
