import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CameraOff, Eye, EyeOff, Scan } from 'lucide-react';
import type { UseCameraResult } from '@/hooks/use-camera';

interface CameraLensProps {
  camera: UseCameraResult;
  isSessionActive: boolean;
}

/**
 * CameraLens — Sovereign Lens panel for the Living Room pane.
 * Positioned as a normal in-flow section (not absolute).
 * Shows live pixel-diff activity bar, presence detection, and 30 s countdown.
 */
export default function CameraLens({ camera, isSessionActive }: CameraLensProps) {
  const { videoRef, canvasRef, isActive, faceDetected, secondsUntilLock, frameDiff, error } = camera;

  const presenceWarning = isActive && faceDetected && secondsUntilLock < 20;
  const presenceLost = isActive && !faceDetected;

  return (
    <div className="relative z-10 px-4 sm:px-8 pb-3">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 font-pixel text-[9px] text-muted-foreground/70">
          <Scan className="w-3 h-3 text-primary/70" />
          SOVEREIGN LENS
        </div>
        <span
          className={`font-pixel text-[8px] ${
            error
              ? 'text-destructive'
              : presenceLost
              ? 'text-red-400'
              : isActive
              ? 'text-primary'
              : 'text-muted-foreground/40'
          }`}
        >
          {error ? 'NO CAM' : presenceLost ? 'NO PRESENCE' : isActive ? 'ANALYZING' : 'STANDBY'}
        </span>
      </div>

      <div className="flex gap-3 items-start">
        {/* Circular video feed */}
        <div className="relative flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20">
          {/* Outer glow ring */}
          <motion.div
            className="absolute inset-0 rounded-full border-2"
            animate={
              presenceLost
                ? {
                    borderColor: ['#ef4444', '#7f1d1d', '#ef4444'],
                    boxShadow: ['0 0 0px #ef4444', '0 0 10px #ef4444', '0 0 0px #ef4444'],
                  }
                : isActive && faceDetected
                ? {
                    boxShadow: ['0 0 0px #00F5FF', '0 0 10px #00F5FF', '0 0 0px #00F5FF'],
                    borderColor: '#00F5FF',
                  }
                : { boxShadow: '0 0 0px transparent', borderColor: '#702963' }
            }
            transition={{ duration: 2, repeat: Infinity }}
          />

          {/* Video circle */}
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
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{
                      transform: 'scaleX(-1)',
                      filter: presenceLost
                        ? 'contrast(1.4) saturate(0.1) brightness(0.6)'
                        : 'contrast(1.4) saturate(0.3) brightness(0.9) hue-rotate(180deg)',
                      imageRendering: 'pixelated',
                    }}
                  />
                  {/* Scanlines */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
                    }}
                  />
                  <div
                    className={`absolute inset-0 mix-blend-color pointer-events-none ${
                      presenceLost ? 'bg-red-900/30' : 'bg-primary/10'
                    }`}
                  />
                  {presenceLost && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <EyeOff className="w-4 h-4 text-red-400" />
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full h-full flex items-center justify-center"
                >
                  {error ? (
                    <CameraOff className="w-5 h-5 text-destructive/60" />
                  ) : (
                    <Camera className="w-5 h-5 text-muted-foreground/30" />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Eye indicator dot */}
          {isActive && (
            <motion.div
              className={`absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center ${
                presenceLost ? 'bg-red-600' : 'bg-primary'
              }`}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {presenceLost ? (
                <EyeOff className="w-2 h-2 text-white" />
              ) : (
                <Eye className="w-2 h-2 text-background" />
              )}
            </motion.div>
          )}
        </div>

        {/* Right side: analysis readout */}
        <div className="flex-1 flex flex-col justify-center gap-1.5 py-1">
          {/* Activity bar */}
          <div>
            <div className="flex justify-between items-center mb-0.5">
              <span className="font-pixel text-[7px] text-muted-foreground/50">MOTION</span>
              <span className="font-terminal text-[9px] text-primary">{frameDiff}%</span>
            </div>
            <div className="h-1.5 w-full bg-background/60 border border-secondary/30 overflow-hidden rounded-sm">
              <motion.div
                className="h-full bg-primary"
                animate={{ width: `${frameDiff}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* Presence row */}
          <div className="flex items-center justify-between">
            <span className="font-pixel text-[7px] text-muted-foreground/50">PRESENCE</span>
            <span
              className={`font-terminal text-[9px] font-bold ${
                presenceLost ? 'text-red-400' : faceDetected ? 'text-primary' : 'text-muted-foreground/40'
              }`}
            >
              {presenceLost ? 'LOST' : isActive && faceDetected ? 'DETECTED' : '—'}
            </span>
          </div>

          {/* Countdown warning */}
          {presenceWarning && (
            <div className="flex items-center justify-between">
              <span className="font-pixel text-[7px] text-yellow-500/70">LOCK IN</span>
              <span className="font-terminal text-[9px] text-yellow-400">{secondsUntilLock}s</span>
            </div>
          )}

          {/* Session integrity row */}
          {isSessionActive && (
            <div className="flex items-center justify-between">
              <span className="font-pixel text-[7px] text-muted-foreground/50">SESSION</span>
              <span
                className={`font-pixel text-[7px] ${
                  faceDetected ? 'text-primary' : 'text-red-400'
                }`}
              >
                {faceDetected ? '⬡ SECURE' : '⚠ BREACH'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Off-screen analysis canvas */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
