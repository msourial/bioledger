import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CameraOff, Eye, EyeOff } from 'lucide-react';
import type { UseCameraResult } from '@/hooks/use-camera';

interface CameraLensProps {
  camera: UseCameraResult;
  isSessionActive: boolean;
}

/**
 * CameraLens — circular camera feed widget for the Living Room pane.
 * Shows a pulsing eye when face is detected, EyeOff when presence lost.
 * Displays countdown timer when presence is waning (< 20 seconds).
 */
export default function CameraLens({ camera, isSessionActive }: CameraLensProps) {
  const { videoRef, canvasRef, isActive, faceDetected, secondsUntilLock, error } = camera;

  const presenceWarning = isActive && faceDetected && secondsUntilLock < 20;
  const presenceLost = isActive && !faceDetected;

  return (
    <div className="absolute bottom-4 right-4 z-20">
      <div className="relative w-20 h-20 sm:w-24 sm:h-24">
        {/* Outer ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-2"
          animate={
            presenceLost
              ? {
                  borderColor: ['#ef4444', '#7f1d1d', '#ef4444'],
                  boxShadow: ['0 0 0px #ef4444', '0 0 12px #ef4444', '0 0 0px #ef4444'],
                }
              : isActive && faceDetected
              ? { boxShadow: ['0 0 0px #00F5FF', '0 0 12px #00F5FF', '0 0 0px #00F5FF'], borderColor: '#00F5FF' }
              : { boxShadow: '0 0 0px transparent', borderColor: '#702963' }
          }
          transition={{ duration: 2, repeat: Infinity }}
        />

        {/* Video feed circle */}
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
                      ? 'contrast(1.4) saturate(0.1) brightness(0.6) hue-rotate(0deg)'
                      : 'contrast(1.4) saturate(0.3) brightness(0.9) hue-rotate(180deg)',
                    imageRendering: 'pixelated',
                  }}
                />
                {/* Scanline overlay */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 4px)',
                  }}
                />
                {/* Color overlay */}
                <div
                  className={`absolute inset-0 mix-blend-color pointer-events-none ${presenceLost ? 'bg-red-900/30' : 'bg-primary/10'}`}
                />
                {/* Presence lost overlay text */}
                {presenceLost && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <EyeOff className="w-5 h-5 text-red-400" />
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
                  <CameraOff className="w-6 h-6 text-destructive/60" />
                ) : (
                  <Camera className="w-6 h-6 text-muted-foreground/40" />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Face detected / Presence Lost indicator */}
        {isActive && (
          <motion.div
            className={`absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center ${
              presenceLost ? 'bg-red-600' : 'bg-primary'
            }`}
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {presenceLost ? (
              <EyeOff className="w-2.5 h-2.5 text-white" />
            ) : (
              <Eye className="w-2.5 h-2.5 text-background" />
            )}
          </motion.div>
        )}

        {/* Countdown ring overlay when warning */}
        {presenceWarning && (
          <div className="absolute inset-0 flex items-end justify-center pb-0.5">
            <span className="font-pixel text-[7px] text-yellow-400 bg-black/70 px-1 rounded-sm">
              {secondsUntilLock}s
            </span>
          </div>
        )}

        {/* Session active, camera not yet started */}
        {isSessionActive && !isActive && !error && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        )}
      </div>

      {/* Off-screen canvas for frame analysis */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Status label */}
      <div className="text-center mt-1">
        <span
          className={`font-pixel text-[6px] tracking-widest ${
            presenceLost
              ? 'text-red-400'
              : isActive
              ? 'text-primary'
              : 'text-muted-foreground/60'
          }`}
        >
          {error ? 'NO CAM' : presenceLost ? 'NO PRESENCE' : isActive ? 'LENS' : 'CAM OFF'}
        </span>
      </div>
    </div>
  );
}
