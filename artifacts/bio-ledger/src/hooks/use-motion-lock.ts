import { useState, useEffect, useRef } from 'react';

export interface UseMotionLockResult {
  isInterrupted: boolean;
  physicalIntegrity: boolean;
  violationCount: number;
}

const MOTION_THRESHOLD = 2.0; // m/s²
const FLASH_DURATION_MS = 2500;

/**
 * useMotionLock — listens for DeviceMotionEvent during an active session.
 * When acceleration magnitude exceeds MOTION_THRESHOLD (2.0 m/s²), fires an
 * 'Interruption Event': pauses the timer via onInterrupt, flashes UI red,
 * and increments the violation counter.
 *
 * physicalIntegrity is true only if the session completed with zero violations.
 */
export function useMotionLock(
  isSessionActive: boolean,
  onInterrupt: () => void,
): UseMotionLockResult {
  const [isInterrupted, setIsInterrupted] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset counters when a new session starts
  useEffect(() => {
    if (isSessionActive) {
      setViolationCount(0);
      setIsInterrupted(false);
    }
  }, [isSessionActive]);

  useEffect(() => {
    if (!isSessionActive) return;

    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.acceleration;
      if (!acc) return;

      const magnitude = Math.sqrt(
        (acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2,
      );

      if (magnitude > MOTION_THRESHOLD) {
        console.log('[Bio-Ledger] Interruption Event: motion lock triggered', {
          magnitude: magnitude.toFixed(3),
          threshold: MOTION_THRESHOLD,
          ts: Date.now(),
        });

        setIsInterrupted(true);
        setViolationCount((n) => n + 1);
        onInterrupt();

        // Clear any existing flash timer then set a new one
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => {
          setIsInterrupted(false);
        }, FLASH_DURATION_MS);
      }
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, [isSessionActive, onInterrupt]);

  return {
    isInterrupted,
    physicalIntegrity: violationCount === 0,
    violationCount,
  };
}
