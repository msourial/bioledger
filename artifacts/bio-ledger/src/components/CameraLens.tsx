import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CameraOff, Eye } from 'lucide-react';
import type { UseCameraResult } from '@/hooks/use-camera';

interface CameraLensProps {
  camera: UseCameraResult;
  isSessionActive: boolean;
}

/**
 * CameraLens — circular camera feed widget for the Living Room pane.
 * Applies a pixel-art CSS filter (saturate + contrast) and a scanline overlay.
 * Shows a pulsing eye icon when face is detected.
 */
export default function CameraLens({ camera, isSessionActive }: CameraLensProps) {
  const { videoRef, canvasRef, isActive, faceDetected, error } = camera;

  return (
    <div className="absolute bottom-4 right-4 z-20">
      <div className="relative w-20 h-20 sm:w-24 sm:h-24">
        {/* Outer ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-primary"
          animate={
            isActive && faceDetected
              ? { boxShadow: ['0 0 0px #00F5FF', '0 0 12px #00F5FF', '0 0 0px #00F5FF'] }
              : { boxShadow: '0 0 0px transparent' }
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
                {/* Mirror + pixel-art filter */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{
                    transform: 'scaleX(-1)',
                    filter: 'contrast(1.4) saturate(0.3) brightness(0.9) hue-rotate(180deg)',
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
                {/* Teal color overlay */}
                <div className="absolute inset-0 bg-primary/10 mix-blend-color pointer-events-none" />
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

        {/* Face detected indicator */}
        {isActive && faceDetected && (
          <motion.div
            className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Eye className="w-2.5 h-2.5 text-background" />
          </motion.div>
        )}

        {/* Session active indicator */}
        {isSessionActive && !isActive && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        )}
      </div>

      {/* Off-screen canvas for frame analysis */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Status label */}
      <div className="text-center mt-1">
        <span className="font-pixel text-[6px] text-muted-foreground/60 tracking-widest">
          {error ? 'NO CAM' : isActive ? 'LENS' : 'CAM OFF'}
        </span>
      </div>
    </div>
  );
}
