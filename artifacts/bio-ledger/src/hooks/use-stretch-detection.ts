import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Detects "step away from computer" breaks using face detection.
 *
 * When the user's face disappears from the camera for at least
 * MIN_AWAY_SECONDS, and then reappears, the break is considered complete.
 * This proves the user physically left their desk.
 */

const MIN_AWAY_SECONDS = 5; // Must be away for at least 5 seconds (demo-friendly)

export interface BreakDetectionResult {
  /** true when face is currently not detected (user is away) */
  isAway: boolean;
  /** 0-100 progress toward completing the minimum away time */
  awayProgress: number;
  /** How many seconds the user has been away */
  awaySeconds: number;
  /** true when user left and came back after minimum time */
  breakCompleted: boolean;
  /** Reset to allow another detection */
  reset: () => void;
}

export function useBreakDetection(
  faceDetected: boolean,
  isActive: boolean,
): BreakDetectionResult {
  const [isAway, setIsAway] = useState(false);
  const [awayProgress, setAwayProgress] = useState(0);
  const [awaySeconds, setAwaySeconds] = useState(0);
  const [breakCompleted, setBreakCompleted] = useState(false);

  // Tracking refs
  const awayStartRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const metMinimumRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset when activation changes
  useEffect(() => {
    if (isActive) {
      awayStartRef.current = null;
      completedRef.current = false;
      metMinimumRef.current = false;
      setIsAway(false);
      setAwayProgress(0);
      setAwaySeconds(0);
      setBreakCompleted(false);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isActive]);

  // Main detection logic — monitors face presence
  useEffect(() => {
    if (!isActive || completedRef.current) return;

    if (!faceDetected) {
      // Face just disappeared — start tracking
      if (awayStartRef.current === null) {
        awayStartRef.current = Date.now();
        console.log('[Break] Face disappeared — user stepped away');
      }
      setIsAway(true);

      // Start a progress timer
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          if (awayStartRef.current === null) return;
          const elapsed = (Date.now() - awayStartRef.current) / 1000;
          const progress = Math.min(100, Math.round((elapsed / MIN_AWAY_SECONDS) * 100));
          setAwaySeconds(Math.floor(elapsed));
          setAwayProgress(progress);

          if (elapsed >= MIN_AWAY_SECONDS) {
            metMinimumRef.current = true;
          }
        }, 200);
      }
    } else {
      // Face reappeared
      if (awayStartRef.current !== null) {
        if (metMinimumRef.current && !completedRef.current) {
          // User was away long enough and came back — break completed!
          completedRef.current = true;
          setBreakCompleted(true);
          setAwayProgress(100);
          const elapsed = (Date.now() - awayStartRef.current) / 1000;
          console.log(`[Break] Completed! User was away for ${elapsed.toFixed(1)}s`);
        } else if (!metMinimumRef.current) {
          // Came back too early — reset
          console.log('[Break] Face returned too early — resetting');
          awayStartRef.current = null;
          setAwayProgress(0);
          setAwaySeconds(0);
        }
      }

      setIsAway(false);

      // Clear timer when face is back
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [faceDetected, isActive]);

  const reset = useCallback(() => {
    awayStartRef.current = null;
    completedRef.current = false;
    metMinimumRef.current = false;
    setIsAway(false);
    setAwayProgress(0);
    setAwaySeconds(0);
    setBreakCompleted(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { isAway, awayProgress, awaySeconds, breakCompleted, reset };
}

// ─── Arm Raise Detection (for Posture challenge) ─────────────────────────────

const ARM_HOLD_DURATION_MS = 3000;

export interface ArmRaiseResult {
  isArmsUp: boolean;
  holdProgress: number;
  armRaiseCompleted: boolean;
  reset: () => void;
}

/**
 * Detects "arms raised above head" using MediaPipe Pose Landmarker.
 * Both wrists must be above both shoulders (wristY < shoulderY).
 */
export function useArmRaiseDetection(
  leftWristY: number | null,
  rightWristY: number | null,
  leftShoulderY: number | null,
  rightShoulderY: number | null,
  isActive: boolean,
): ArmRaiseResult {
  const [isArmsUp, setIsArmsUp] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [armRaiseCompleted, setArmRaiseCompleted] = useState(false);

  const startRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    if (isActive) {
      startRef.current = null;
      completedRef.current = false;
      setIsArmsUp(false);
      setHoldProgress(0);
      setArmRaiseCompleted(false);
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive || completedRef.current) return;
    if (leftWristY === null || rightWristY === null || leftShoulderY === null || rightShoulderY === null) return;

    const armsUp = leftWristY < leftShoulderY && rightWristY < rightShoulderY;
    setIsArmsUp(armsUp);

    const now = Date.now();
    if (armsUp) {
      if (startRef.current === null) {
        startRef.current = now;
        console.log('[ArmRaise] Arms detected above head!');
      }
      const held = now - startRef.current;
      const progress = Math.min(100, Math.round((held / ARM_HOLD_DURATION_MS) * 100));
      setHoldProgress(progress);

      if (held >= ARM_HOLD_DURATION_MS && !completedRef.current) {
        completedRef.current = true;
        setArmRaiseCompleted(true);
        setHoldProgress(100);
        console.log('[ArmRaise] Completed! Held for ' + (held / 1000).toFixed(1) + 's');
      }
    } else {
      if (startRef.current !== null) {
        startRef.current = null;
        setHoldProgress(0);
      }
    }
  }, [leftWristY, rightWristY, leftShoulderY, rightShoulderY, isActive]);

  const reset = useCallback(() => {
    startRef.current = null;
    completedRef.current = false;
    setIsArmsUp(false);
    setHoldProgress(0);
    setArmRaiseCompleted(false);
  }, []);

  return { isArmsUp, holdProgress, armRaiseCompleted, reset };
}
