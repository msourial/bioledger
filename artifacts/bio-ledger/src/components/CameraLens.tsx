import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CameraOff, Eye, EyeOff, Scan, AlertTriangle } from 'lucide-react';
import type { UseCameraResult } from '@/hooks/use-camera';

interface CameraLensProps {
  camera: UseCameraResult;
  isSessionActive: boolean;
}

/**
 * CameraLens — Sovereign Lens panel.
 * Left: pixelated 48×36 canvas feed.
 * Right: 2×2 grid of clearly labelled metric tiles (PRESENCE, BLINKS, HEAD, STABILITY).
 */
export default function CameraLens({ camera, isSessionActive }: CameraLensProps) {
  const {
    videoRef,
    pixelCanvasRef,
    isActive,
    faceDetected,
    secondsUntilLock,
    frameDiff,
    blinkCount,
    postureWarning,
    visionMetrics,
    error,
  } = camera;

  const presenceWarning = isActive && faceDetected && secondsUntilLock < 4;
  const presenceLost = isActive && !faceDetected;

  // ── Status badge ─────────────────────────────────────────────────────────
  const statusText = error
    ? 'NO CAM'
    : presenceLost
    ? 'PRESENCE LOST'
    : postureWarning
    ? 'POSTURE!'
    : isActive
    ? 'ANALYZING'
    : 'STANDBY';

  const statusColor = error
    ? 'text-destructive'
    : presenceLost
    ? 'text-red-400'
    : postureWarning
    ? 'text-yellow-400'
    : isActive
    ? 'text-primary'
    : 'text-muted-foreground/40';

  // ── Ring glow ─────────────────────────────────────────────────────────────
  const ringAnim = presenceLost
    ? { borderColor: ['#ef4444', '#7f1d1d', '#ef4444'], boxShadow: ['0 0 0px #ef4444', '0 0 10px #ef4444', '0 0 0px #ef4444'] }
    : postureWarning
    ? { borderColor: ['#facc15', '#78350f', '#facc15'], boxShadow: ['0 0 0px #facc15', '0 0 8px #facc15', '0 0 0px #facc15'] }
    : isActive && faceDetected
    ? { boxShadow: ['0 0 0px #00F5FF', '0 0 10px #00F5FF', '0 0 0px #00F5FF'], borderColor: '#00F5FF' }
    : { boxShadow: '0 0 0px transparent', borderColor: '#702963' };

  return (
    <div className="relative z-10 px-4 sm:px-8 pb-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 font-pixel text-[9px] text-muted-foreground/70">
          <Scan className="w-3 h-3 text-primary/70" />
          SOVEREIGN LENS
        </div>
        <span className={`font-pixel text-[9px] ${statusColor}`}>{statusText}</span>
      </div>

      <div className="flex gap-4 items-stretch">
        {/* ── Camera circle ── */}
        <div className="relative flex-shrink-0 w-20 h-20">
          <motion.div
            className="absolute inset-0 rounded-full border-2"
            animate={ringAnim}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <div className="absolute inset-0.5 rounded-full overflow-hidden bg-black/80">
            <AnimatePresence>
              {isActive && !error ? (
                <motion.div
                  key="feed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full h-full relative"
                >
                  <canvas
                    ref={pixelCanvasRef}
                    width={48}
                    height={36}
                    className="w-full h-full object-cover"
                    style={{
                      transform: 'scaleX(-1)',
                      imageRendering: 'pixelated',
                      filter: presenceLost
                        ? 'contrast(1.6) saturate(0.1) brightness(0.5)'
                        : postureWarning
                        ? 'contrast(1.3) saturate(0.6) sepia(0.5) brightness(0.85)'
                        : 'contrast(1.4) saturate(0.25) brightness(0.9) hue-rotate(170deg)',
                    }}
                  />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 4px)' }}
                  />
                  <div className={`absolute inset-0 mix-blend-color pointer-events-none ${presenceLost ? 'bg-red-900/30' : postureWarning ? 'bg-yellow-900/20' : 'bg-primary/10'}`} />
                  {presenceLost && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <EyeOff className="w-5 h-5 text-red-400" />
                    </div>
                  )}
                  {postureWarning && !presenceLost && (
                    <motion.div
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 0.6, repeat: Infinity }}
                      className="absolute inset-0 flex items-center justify-center bg-yellow-900/40"
                    >
                      <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full h-full flex items-center justify-center"
                >
                  {error
                    ? <CameraOff className="w-6 h-6 text-destructive/60" />
                    : <Camera className="w-6 h-6 text-muted-foreground/30" />}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {/* Indicator dot */}
          {isActive && (
            <motion.div
              className={`absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center ${presenceLost ? 'bg-red-600' : postureWarning ? 'bg-yellow-500' : 'bg-primary'}`}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {presenceLost
                ? <EyeOff className="w-2 h-2 text-white" />
                : postureWarning
                ? <AlertTriangle className="w-2 h-2 text-black" />
                : <Eye className="w-2 h-2 text-background" />}
            </motion.div>
          )}
        </div>

        {/* ── 2×2 Metric grid ── */}
        <div className="flex-1 grid grid-cols-2 gap-2">

          {/* PRESENCE */}
          <MetricTile
            label="PRESENCE"
            value={presenceLost ? 'LOST' : isActive && faceDetected ? 'OK' : '—'}
            valueColor={presenceLost ? 'text-red-400' : isActive && faceDetected ? 'text-primary' : 'text-muted-foreground/30'}
            sub={presenceWarning ? `LOCK IN ${secondsUntilLock}s` : undefined}
            subColor="text-yellow-400"
            alert={presenceLost}
          />

          {/* BLINKS */}
          <MetricTile
            label="BLINKS"
            value={String(blinkCount)}
            valueColor="text-primary"
            sub={visionMetrics.avgBlinkRate > 0 ? `${visionMetrics.avgBlinkRate} /min` : undefined}
            subColor="text-muted-foreground/60"
          />

          {/* HEAD MOTION */}
          <div className="bg-background/40 border border-secondary/30 px-2.5 py-2 flex flex-col gap-1.5">
            <span className="font-pixel text-[8px] text-muted-foreground/60 uppercase tracking-widest leading-none">
              HEAD
            </span>
            <div className="h-2 w-full bg-background/60 border border-secondary/20 overflow-hidden">
              <motion.div
                className={`h-full ${postureWarning ? 'bg-yellow-400' : 'bg-primary'}`}
                animate={{ width: `${frameDiff}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
            <span className={`font-terminal text-xs font-bold leading-none ${postureWarning ? 'text-yellow-400' : 'text-primary'}`}>
              {frameDiff}%
              {postureWarning && <span className="font-pixel text-[7px] text-yellow-500/80 ml-1">SLOUCH!</span>}
            </span>
          </div>

          {/* STABILITY */}
          <MetricTile
            label="STABILITY"
            value={`${visionMetrics.headStability}%`}
            valueColor={visionMetrics.headStability < 70 ? 'text-yellow-400' : 'text-primary'}
            sub={isSessionActive ? (faceDetected && !postureWarning ? '⬡ SECURE' : '⚠ BREACH') : undefined}
            subColor={faceDetected && !postureWarning ? 'text-primary/60' : 'text-red-400/80'}
          />
        </div>
      </div>

      {/* Hidden <video> — required for MediaPipe detectForVideo; canvas is the visible feed */}
      <video ref={videoRef} className="hidden" autoPlay playsInline muted />
    </div>
  );
}

// ── Shared tile component ────────────────────────────────────────────────────

interface MetricTileProps {
  label: string;
  value: string;
  valueColor: string;
  sub?: string;
  subColor?: string;
  alert?: boolean;
}

function MetricTile({ label, value, valueColor, sub, subColor = 'text-muted-foreground/60', alert }: MetricTileProps) {
  return (
    <div className={`bg-background/40 border px-2.5 py-2 flex flex-col gap-0.5 ${alert ? 'border-red-700/60' : 'border-secondary/30'}`}>
      <span className="font-pixel text-[8px] text-muted-foreground/60 uppercase tracking-widest leading-none">
        {label}
      </span>
      <span className={`font-terminal text-base font-bold leading-tight ${valueColor}`}>
        {value}
      </span>
      {sub && (
        <span className={`font-pixel text-[7px] leading-none ${subColor}`}>
          {sub}
        </span>
      )}
    </div>
  );
}
