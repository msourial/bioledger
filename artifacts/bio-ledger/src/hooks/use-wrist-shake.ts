import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Detects rapid wrist/hand shaking motion for RSI stretch verification.
 *
 * Tracks wristY position changes over time. When wrists oscillate
 * rapidly (direction changes), it counts as "shaking". User must
 * accumulate enough shakes within the time window to complete.
 */

const MIN_SHAKES = 20;          // Need 20 direction changes (10 up-down cycles)
const SHAKE_WINDOW_MS = 15000;  // Must happen within 15 seconds
const MIN_DELTA = 0.015;        // Minimum Y movement to count as direction change

export interface WristShakeResult {
  /** true when active shaking is detected */
  isShaking: boolean;
  /** Number of direction changes detected */
  shakeCount: number;
  /** 0-100 progress toward completion */
  progress: number;
  /** true when enough shakes detected */
  shakeCompleted: boolean;
  /** Reset for another detection */
  reset: () => void;
}

export function useWristShake(
  leftWristY: number | null,
  rightWristY: number | null,
  isActive: boolean,
): WristShakeResult {
  const [isShaking, setIsShaking] = useState(false);
  const [shakeCount, setShakeCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [shakeCompleted, setShakeCompleted] = useState(false);

  // Tracking refs
  const prevLeftY = useRef<number | null>(null);
  const prevRightY = useRef<number | null>(null);
  const lastDirectionLeft = useRef<'up' | 'down' | null>(null);
  const lastDirectionRight = useRef<'up' | 'down' | null>(null);
  const shakeTimestamps = useRef<number[]>([]);
  const completedRef = useRef(false);

  // Reset when activation changes
  useEffect(() => {
    if (isActive) {
      prevLeftY.current = null;
      prevRightY.current = null;
      lastDirectionLeft.current = null;
      lastDirectionRight.current = null;
      shakeTimestamps.current = [];
      completedRef.current = false;
      setIsShaking(false);
      setShakeCount(0);
      setProgress(0);
      setShakeCompleted(false);
    }
  }, [isActive]);

  // Detection loop
  useEffect(() => {
    if (!isActive || completedRef.current) return;
    if (leftWristY === null && rightWristY === null) return;

    const now = Date.now();
    let newShake = false;

    // Check left wrist direction change
    if (leftWristY !== null && prevLeftY.current !== null) {
      const delta = leftWristY - prevLeftY.current;
      if (Math.abs(delta) > MIN_DELTA) {
        const dir = delta > 0 ? 'down' : 'up';
        if (lastDirectionLeft.current !== null && dir !== lastDirectionLeft.current) {
          newShake = true;
        }
        lastDirectionLeft.current = dir;
      }
    }
    if (leftWristY !== null) prevLeftY.current = leftWristY;

    // Check right wrist direction change
    if (rightWristY !== null && prevRightY.current !== null) {
      const delta = rightWristY - prevRightY.current;
      if (Math.abs(delta) > MIN_DELTA) {
        const dir = delta > 0 ? 'down' : 'up';
        if (lastDirectionRight.current !== null && dir !== lastDirectionRight.current) {
          newShake = true;
        }
        lastDirectionRight.current = dir;
      }
    }
    if (rightWristY !== null) prevRightY.current = rightWristY;

    if (newShake) {
      shakeTimestamps.current.push(now);
      // Prune old timestamps outside window
      shakeTimestamps.current = shakeTimestamps.current.filter(
        (t) => now - t < SHAKE_WINDOW_MS
      );

      const count = shakeTimestamps.current.length;
      setShakeCount(count);
      setIsShaking(true);
      setProgress(Math.min(100, Math.round((count / MIN_SHAKES) * 100)));

      if (count >= MIN_SHAKES && !completedRef.current) {
        completedRef.current = true;
        setShakeCompleted(true);
        setProgress(100);
        console.log(`[WristShake] Completed! ${count} shakes detected`);
      }
    } else {
      // Check if we haven't had a shake recently
      const recentShakes = shakeTimestamps.current.filter(
        (t) => now - t < 1000
      );
      if (recentShakes.length === 0) {
        setIsShaking(false);
      }
    }
  }, [leftWristY, rightWristY, isActive]);

  const reset = useCallback(() => {
    prevLeftY.current = null;
    prevRightY.current = null;
    lastDirectionLeft.current = null;
    lastDirectionRight.current = null;
    shakeTimestamps.current = [];
    completedRef.current = false;
    setIsShaking(false);
    setShakeCount(0);
    setProgress(0);
    setShakeCompleted(false);
  }, []);

  return { isShaking, shakeCount, progress, shakeCompleted, reset };
}
