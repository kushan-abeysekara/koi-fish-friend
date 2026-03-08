import React, { useMemo, useEffect, useRef, useState } from 'react';

/**
 * 3D Animated Boat Tilt + Radar Obstacle Visualization
 * 
 * Features:
 * - CSS 3D boat model tilting in real-time from MPU-6050 gyroscope data
 * - Radar-style obstacle display (4 ultrasonic sensors)  
 * - Voice alerts via Web Speech API when obstacles < 40cm
 * - Wake/moving animation when motors active
 * - Tilt severity color coding (Stable → DANGER)
 */

interface BoatTilt3DProps {
  angleX: number;       // Pitch: forward/backward tilt (degrees)
  angleY: number;       // Roll: left/right tilt (degrees)
  temperature: number;
  voltage: number;
  distanceFront: number;
  distanceBack: number;
  distanceLeft: number;
  distanceRight: number;
  motorLeft: number;
  motorRight: number;
  command: string;
  className?: string;
}

// ─── Voice Alert System ───
const ALERT_COOLDOWN_MS = 4000; // Minimum 4s between voice alerts
const OBSTACLE_THRESHOLD_CM = 40;
let lastAlertTime = 0;
let speechSynth: SpeechSynthesis | null = null;

function speakAlert(message: string) {
  if (typeof window === 'undefined') return;
  if (!speechSynth) speechSynth = window.speechSynthesis;
  if (!speechSynth) return;

  const now = Date.now();
  if (now - lastAlertTime < ALERT_COOLDOWN_MS) return;
  lastAlertTime = now;

  speechSynth.cancel(); // Stop any current speech
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.rate = 1.1;
  utterance.pitch = 1.0;
  utterance.volume = 0.9;
  utterance.lang = 'en-US';
  speechSynth.speak(utterance);
}

// ─── Radar helpers ───
const RADAR_RADIUS = 110;
const RADAR_MAX_CM = 200; // Max range displayed on radar

function distToRadarR(distCm: number): number {
  if (distCm <= 0) return RADAR_RADIUS; // 0 = no reading → edge
  return Math.min(RADAR_RADIUS, (distCm / RADAR_MAX_CM) * RADAR_RADIUS);
}

function getObstacleColor(distCm: number): string {
  if (distCm <= 0) return '#6b7280'; // gray - no reading
  if (distCm < 15) return '#ef4444'; // red - danger
  if (distCm < 30) return '#f97316'; // orange - warning
  if (distCm < 40) return '#eab308'; // yellow - caution
  return '#22c55e'; // green - clear
}

const BoatTilt3D: React.FC<BoatTilt3DProps> = ({
  angleX, angleY, temperature, voltage,
  distanceFront, distanceBack, distanceLeft, distanceRight,
  motorLeft, motorRight, command, className = ''
}) => {
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const prevObstaclesRef = useRef({ front: 999, back: 999, left: 999, right: 999 });

  // Clamp angles
  const pitch = Math.max(-60, Math.min(60, angleY));
  const roll = Math.max(-60, Math.min(60, angleX));

  // Is boat moving?
  const isMoving = motorLeft > 0 || motorRight > 0 || (command !== 'STOP' && command !== 'HEARTBEAT');

  // Tilt severity
  const tiltSeverity = useMemo(() => {
    const maxTilt = Math.max(Math.abs(pitch), Math.abs(roll));
    if (maxTilt < 5) return { label: 'Stable', color: 'text-green-400', bg: 'from-green-500/20 to-green-600/10', ring: 'ring-green-400/30', dot: 'bg-green-400' };
    if (maxTilt < 15) return { label: 'Slight Tilt', color: 'text-yellow-400', bg: 'from-yellow-500/20 to-yellow-600/10', ring: 'ring-yellow-400/30', dot: 'bg-yellow-400' };
    if (maxTilt < 30) return { label: 'Tilting', color: 'text-orange-400', bg: 'from-orange-500/20 to-orange-600/10', ring: 'ring-orange-400/30', dot: 'bg-orange-400' };
    return { label: 'DANGER!', color: 'text-red-400 animate-pulse', bg: 'from-red-500/30 to-red-600/20', ring: 'ring-red-400/40', dot: 'bg-red-500 animate-pulse' };
  }, [pitch, roll]);

  // ─── Voice Alerts for obstacle proximity ───
  useEffect(() => {
    if (!alertsEnabled) return;

    const obstacles = [
      { dir: 'Front', dist: distanceFront },
      { dir: 'Back', dist: distanceBack },
      { dir: 'Left', dist: distanceLeft },
      { dir: 'Right', dist: distanceRight },
    ];

    const prev = prevObstaclesRef.current;
    const dangerous = obstacles.filter(o => o.dist > 0 && o.dist < OBSTACLE_THRESHOLD_CM);

    if (dangerous.length > 0) {
      // Find the closest
      const closest = dangerous.reduce((a, b) => a.dist < b.dist ? a : b);
      const prevDist = prev[closest.dir.toLowerCase() as keyof typeof prev];

      // Only alert if newly entering danger zone or getting closer
      if (prevDist >= OBSTACLE_THRESHOLD_CM || closest.dist < prevDist - 5) {
        const urgency = closest.dist < 15 ? 'Warning! ' : '';
        speakAlert(`${urgency}${closest.dir} side obstacle detected, ${Math.round(closest.dist)} centimeters`);
      }
    }

    prevObstaclesRef.current = {
      front: distanceFront,
      back: distanceBack,
      left: distanceLeft,
      right: distanceRight,
    };
  }, [distanceFront, distanceBack, distanceLeft, distanceRight, alertsEnabled]);

  // Tilt danger voice alert
  useEffect(() => {
    if (!alertsEnabled) return;
    const maxTilt = Math.max(Math.abs(pitch), Math.abs(roll));
    if (maxTilt >= 30) {
      speakAlert(`Danger! Boat tilting ${Math.round(maxTilt)} degrees. Stabilize immediately.`);
    }
  }, [pitch, roll, alertsEnabled]);

  // Radar obstacle dots positions (relative to center)
  const radarDots = useMemo(() => [
    { label: 'F', dist: distanceFront, x: 0, y: -distToRadarR(distanceFront), angle: 0 },
    { label: 'B', dist: distanceBack,  x: 0, y: distToRadarR(distanceBack),   angle: 180 },
    { label: 'L', dist: distanceLeft,  x: -distToRadarR(distanceLeft), y: 0,  angle: 270 },
    { label: 'R', dist: distanceRight, x: distToRadarR(distanceRight), y: 0,  angle: 90 },
  ], [distanceFront, distanceBack, distanceLeft, distanceRight]);

  const waveOffset = roll * 0.5;

  return (
    <div className={`bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 rounded-xl p-5 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-lg flex items-center gap-2">
          <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          3D Boat Orientation & Radar
        </h3>
        <div className="flex items-center gap-2">
          {/* Voice toggle */}
          <button
            onClick={() => setAlertsEnabled(!alertsEnabled)}
            className={`text-xs px-2 py-1 rounded-full transition-all ${
              alertsEnabled ? 'bg-cyan-600/30 text-cyan-300' : 'bg-gray-700 text-gray-500'
            }`}
            title={alertsEnabled ? 'Voice alerts ON' : 'Voice alerts OFF'}
          >
            {alertsEnabled ? '🔊' : '🔇'}
          </button>
          <span className={`text-xs font-bold px-2 py-1 rounded-full bg-black/30 ${tiltSeverity.color}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${tiltSeverity.dot}`} />
            {tiltSeverity.label}
          </span>
        </div>
      </div>

      {/* Main 2-column layout: 3D Boat + Radar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ═══ LEFT: 3D Tilting Boat ═══ */}
        <div className="relative" style={{ perspective: '600px' }}>
          {/* Ocean background */}
          <div className="absolute inset-0 rounded-lg overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-cyan-900/40 via-blue-900/60 to-blue-950/80"
              style={{ transform: `translateX(${waveOffset}px)` }} />

            {/* Animated waves */}
            <svg className="absolute bottom-0 w-full h-20 opacity-40" viewBox="0 0 400 60" preserveAspectRatio="none">
              <path d="M0,30 C50,20 100,40 150,30 C200,20 250,40 300,30 C350,20 400,40 400,30 L400,60 L0,60 Z"
                fill="url(#waveGrad1)">
                <animateTransform attributeName="transform" type="translate" values="0,0;-50,0;0,0" dur="4s" repeatCount="indefinite" />
              </path>
              <path d="M0,35 C60,25 120,45 180,35 C240,25 300,45 360,35 C390,28 400,35 400,35 L400,60 L0,60 Z"
                fill="url(#waveGrad2)" opacity="0.5">
                <animateTransform attributeName="transform" type="translate" values="0,0;40,0;0,0" dur="3s" repeatCount="indefinite" />
              </path>
              <defs>
                <linearGradient id="waveGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#0891b2" stopOpacity="0.1" />
                </linearGradient>
                <linearGradient id="waveGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.05" />
                </linearGradient>
              </defs>
            </svg>

            {/* Wake effect when moving */}
            {isMoving && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full">
                <svg className="w-full h-24 opacity-60" viewBox="0 0 200 60" preserveAspectRatio="none">
                  <path d="M80,10 L60,55 L140,55 L120,10" fill="none" stroke="#22d3ee" strokeWidth="1" opacity="0.6">
                    <animate attributeName="opacity" values="0.6;0.2;0.6" dur="0.8s" repeatCount="indefinite" />
                  </path>
                  <path d="M85,10 L70,50 L130,50 L115,10" fill="none" stroke="#06b6d4" strokeWidth="0.5" opacity="0.4">
                    <animate attributeName="opacity" values="0.4;0.1;0.4" dur="0.6s" repeatCount="indefinite" />
                  </path>
                  {/* Splashes */}
                  <circle cx="75" cy="40" r="2" fill="#22d3ee" opacity="0.5">
                    <animate attributeName="cy" values="40;55;40" dur="1s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.5;0;0.5" dur="1s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="125" cy="40" r="2" fill="#22d3ee" opacity="0.5">
                    <animate attributeName="cy" values="40;55;40" dur="1.2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.5;0;0.5" dur="1.2s" repeatCount="indefinite" />
                  </circle>
                </svg>
              </div>
            )}
          </div>

          {/* Moving indicator */}
          {isMoving && (
            <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-cyan-600/40 backdrop-blur-sm px-2 py-1 rounded-full">
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
              <span className="text-[10px] text-cyan-300 font-semibold">{command}</span>
            </div>
          )}

          {/* 3D Boat Container */}
          <div className="flex justify-center items-center py-8 relative z-10 min-h-[220px]">
            <div
              className="transition-transform duration-200 ease-out"
              style={{
                transform: `rotateX(${-pitch * 0.8}deg) rotateZ(${roll * 0.8}deg)`,
                transformStyle: 'preserve-3d',
              }}
            >
              <div className="relative w-36 h-52">
                {/* Glow shadow under boat */}
                <div className="absolute inset-0 blur-xl opacity-30"
                  style={{
                    background: `radial-gradient(ellipse at center, ${
                      Math.max(Math.abs(pitch), Math.abs(roll)) > 25 ? 'rgba(239,68,68,0.4)' : 'rgba(6,182,212,0.5)'
                    } 0%, transparent 70%)`,
                    transform: `translateY(${10 + pitch * 0.3}px)`,
                  }}
                />

                {/* Hull SVG */}
                <svg viewBox="0 0 120 180" className="w-full h-full drop-shadow-2xl">
                  <ellipse cx="60" cy="100" rx="52" ry="80" fill="none" stroke="rgba(6,182,212,0.15)" strokeWidth="8" />
                  <path d="M60,10 C25,30 15,60 15,100 C15,140 30,165 60,175 C90,165 105,140 105,100 C105,60 95,30 60,10Z"
                    fill="url(#hullG)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
                  <path d="M60,25 C35,40 28,65 28,100 C28,130 38,152 60,160 C82,152 92,130 92,100 C92,65 85,40 60,25Z"
                    fill="url(#deckG)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                  <rect x="42" y="65" width="36" height="45" rx="4" fill="url(#cabG)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
                  <rect x="48" y="72" width="24" height="12" rx="2" fill="#0e7490" opacity="0.8" />
                  <rect x="50" y="140" width="20" height="18" rx="3" fill="#374151" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />

                  {/* Motor activity indicators */}
                  {isMoving && <>
                    <circle cx="55" cy="165" r="3" fill="#22d3ee" opacity="0.6">
                      <animate attributeName="r" values="2;5;2" dur="0.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.6;0.1;0.6" dur="0.5s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="65" cy="165" r="3" fill="#22d3ee" opacity="0.6">
                      <animate attributeName="r" values="2;5;2" dur="0.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.6;0.1;0.6" dur="0.5s" repeatCount="indefinite" />
                    </circle>
                  </>}

                  {/* Bow marker */}
                  <circle cx="60" cy="18" r="3" fill="#06b6d4" opacity="0.9" />
                  <circle cx="60" cy="18" r="6" fill="none" stroke="#06b6d4" strokeWidth="0.5" opacity="0.4">
                    <animate attributeName="r" values="4;8;4" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0.1;0.6" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <path d="M55,30 L60,18 L65,30" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeLinecap="round" />

                  <defs>
                    <linearGradient id="hullG" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#1e3a5f" /><stop offset="50%" stopColor="#1e293b" /><stop offset="100%" stopColor="#0f172a" />
                    </linearGradient>
                    <linearGradient id="deckG" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#334155" /><stop offset="100%" stopColor="#1e293b" />
                    </linearGradient>
                    <linearGradient id="cabG" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#475569" /><stop offset="100%" stopColor="#334155" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT: Radar + Obstacle Display ═══ */}
        <div className="flex flex-col items-center justify-center">
          <p className="text-gray-400 text-xs font-medium mb-2">Obstacle Radar (4 Sensors)</p>

          {/* Radar SVG */}
          <svg width="240" height="240" viewBox="-120 -120 240 240" className="drop-shadow-lg">
            {/* Background circles */}
            <circle cx="0" cy="0" r={RADAR_RADIUS} fill="rgba(6,182,212,0.03)" stroke="rgba(6,182,212,0.15)" strokeWidth="0.5" />
            <circle cx="0" cy="0" r={RADAR_RADIUS * 0.66} fill="none" stroke="rgba(6,182,212,0.1)" strokeWidth="0.5" strokeDasharray="3,3" />
            <circle cx="0" cy="0" r={RADAR_RADIUS * 0.33} fill="none" stroke="rgba(6,182,212,0.1)" strokeWidth="0.5" strokeDasharray="3,3" />

            {/* 40cm threshold ring (alert zone) */}
            <circle cx="0" cy="0" r={(OBSTACLE_THRESHOLD_CM / RADAR_MAX_CM) * RADAR_RADIUS}
              fill="rgba(239,68,68,0.04)" stroke="rgba(239,68,68,0.3)" strokeWidth="0.5" strokeDasharray="4,2" />

            {/* Cross lines */}
            <line x1="0" y1={-RADAR_RADIUS} x2="0" y2={RADAR_RADIUS} stroke="rgba(6,182,212,0.08)" strokeWidth="0.5" />
            <line x1={-RADAR_RADIUS} y1="0" x2={RADAR_RADIUS} y2="0" stroke="rgba(6,182,212,0.08)" strokeWidth="0.5" />

            {/* Radar sweep animation */}
            <line x1="0" y1="0" x2="0" y2={-RADAR_RADIUS} stroke="rgba(6,182,212,0.4)" strokeWidth="1">
              <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="4s" repeatCount="indefinite" />
            </line>

            {/* Direction labels */}
            <text x="0" y={-RADAR_RADIUS - 5} textAnchor="middle" fill="#06b6d4" fontSize="9" fontWeight="bold">FRONT</text>
            <text x="0" y={RADAR_RADIUS + 12} textAnchor="middle" fill="#06b6d4" fontSize="9" fontWeight="bold">BACK</text>
            <text x={-RADAR_RADIUS - 5} y="4" textAnchor="end" fill="#06b6d4" fontSize="9" fontWeight="bold">LEFT</text>
            <text x={RADAR_RADIUS + 5} y="4" textAnchor="start" fill="#06b6d4" fontSize="9" fontWeight="bold">RIGHT</text>

            {/* Range labels */}
            <text x="3" y={-(RADAR_RADIUS * 0.33) + 3} fill="rgba(148,163,184,0.5)" fontSize="7">{Math.round(RADAR_MAX_CM * 0.33)}cm</text>
            <text x="3" y={-(RADAR_RADIUS * 0.66) + 3} fill="rgba(148,163,184,0.5)" fontSize="7">{Math.round(RADAR_MAX_CM * 0.66)}cm</text>
            <text x="3" y={-RADAR_RADIUS + 10} fill="rgba(148,163,184,0.5)" fontSize="7">{RADAR_MAX_CM}cm</text>

            {/* Boat icon at center */}
            <ellipse cx="0" cy="0" rx="6" ry="10" fill="#1e3a5f" stroke="#06b6d4" strokeWidth="0.8" />
            <line x1="0" y1="-7" x2="0" y2="-12" stroke="#06b6d4" strokeWidth="1" strokeLinecap="round" />

            {/* Obstacle dots with range arcs */}
            {radarDots.map((dot, i) => {
              const color = getObstacleColor(dot.dist);
              const isDanger = dot.dist > 0 && dot.dist < OBSTACLE_THRESHOLD_CM;
              const dotSize = isDanger ? 6 : 4;
              return (
                <g key={i}>
                  {/* Connection line from center to dot */}
                  {dot.dist > 0 && (
                    <line x1="0" y1="0" x2={dot.x} y2={dot.y} stroke={color} strokeWidth="0.8" opacity="0.4" />
                  )}
                  {/* Obstacle dot */}
                  <circle cx={dot.x} cy={dot.y} r={dotSize} fill={color} opacity="0.9">
                    {isDanger && <animate attributeName="r" values={`${dotSize};${dotSize + 3};${dotSize}`} dur="0.8s" repeatCount="indefinite" />}
                    {isDanger && <animate attributeName="opacity" values="0.9;0.4;0.9" dur="0.8s" repeatCount="indefinite" />}
                  </circle>
                  {/* Distance text near dot */}
                  {dot.dist > 0 && (
                    <text
                      x={dot.x + (dot.label === 'L' ? -10 : dot.label === 'R' ? 10 : 0)}
                      y={dot.y + (dot.label === 'F' ? -10 : dot.label === 'B' ? 14 : -8)}
                      textAnchor="middle" fill={color} fontSize="10" fontWeight="bold"
                    >
                      {dot.dist.toFixed(0)}cm
                    </text>
                  )}
                  {/* Danger ring */}
                  {isDanger && (
                    <circle cx={dot.x} cy={dot.y} r={dotSize + 6} fill="none" stroke={color} strokeWidth="0.5" opacity="0.3">
                      <animate attributeName="r" values={`${dotSize + 4};${dotSize + 10};${dotSize + 4}`} dur="1.2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.3;0;0.3" dur="1.2s" repeatCount="indefinite" />
                    </circle>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Alert zone legend */}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Safe &gt;40cm</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />Caution 30-40cm</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />Danger &lt;15cm</span>
          </div>
        </div>
      </div>

      {/* ═══ Bottom: Angle Gauges + Readouts ═══ */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        {/* Pitch gauge */}
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
          <div className="mt-2 h-2 bg-black/30 rounded-full overflow-hidden relative">
            {/* Center marker */}
            <div className="absolute left-1/2 top-0 w-px h-full bg-gray-500/50 z-10" />
            <div
              className="absolute top-0 h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-200"
              style={{
                left: pitch >= 0 ? '50%' : `${50 - (Math.abs(pitch) / 60) * 50}%`,
                width: `${(Math.abs(pitch) / 60) * 50}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
            <span>-60°</span><span>0°</span><span>+60°</span>
          </div>
        </div>

        {/* Roll gauge */}
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
          <div className="mt-2 h-2 bg-black/30 rounded-full overflow-hidden relative">
            <div className="absolute left-1/2 top-0 w-px h-full bg-gray-500/50 z-10" />
            <div
              className="absolute top-0 h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-200"
              style={{
                left: roll >= 0 ? '50%' : `${50 - (Math.abs(roll) / 60) * 50}%`,
                width: `${(Math.abs(roll) / 60) * 50}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
            <span>-60°</span><span>0°</span><span>+60°</span>
          </div>
        </div>

        {/* Temp */}
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

      {/* Compass reference */}
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
