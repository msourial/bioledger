import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Detects "drinking water" gesture using head pitch angle.
 *
 * When you drink from a glass/bottle, your head tilts backward
 * (pitch becomes significantly negative, typically -15° to -40°).
 * This hook:
 * 1. Detects when head pitch drops below -15° (tilted back)
 * 2. Requires the tilt to be held for 3 seconds (genuine sip, not just looking up)
 * 3. Returns progress (0-100) and completion state
 */

const PITCH_THRESHOLD = -15;       // degrees — head tilted back this much = drinking
const HOLD_DURATION_MS = 3000;     // Must hold tilt for 3 seconds

export interface DrinkDetectionResult {
  /** true when head pitch indicates drinking position */
  isDrinking: boolean;
  /** 0-100 progress toward completing the hold */
  holdProgress: number;
  /** true when drinking was held for the full duration */
  drinkCompleted: boolean;
  /** Reset to allow another detection */
  reset: () => void;
}

export function useDrinkDetection(
  headPitch: number | null,
  isActive: boolean,
): DrinkDetectionResult {
  const [isDrinking, setIsDrinking] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [drinkCompleted, setDrinkCompleted] = useState(false);

  const drinkStartRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  // Reset when activation changes
  useEffect(() => {
    if (isActive) {
      drinkStartRef.current = null;
      completedRef.current = false;
      setIsDrinking(false);
      setHoldProgress(0);
      setDrinkCompleted(false);
    }
  }, [isActive]);

  // Detection loop
  useEffect(() => {
    if (!isActive || headPitch === null || completedRef.current) return;

    const now = Date.now();
    const isTiltedBack = headPitch < PITCH_THRESHOLD;

    setIsDrinking(isTiltedBack);

    if (isTiltedBack) {
      if (drinkStartRef.current === null) {
        drinkStartRef.current = now;
        console.log(`💧 Drink detected! Head pitch: ${headPitch.toFixed(1)}°`);
      }

      const held = now - drinkStartRef.current;
      const progress = Math.min(100, Math.round((held / HOLD_DURATION_MS) * 100));
      setHoldProgress(progress);

      if (held >= HOLD_DURATION_MS && !completedRef.current) {
        completedRef.current = true;
        setDrinkCompleted(true);
        setHoldProgress(100);
        console.log(`💧 Hydration verified! Head tilted back for ${(held / 1000).toFixed(1)}s, pitch: ${headPitch.toFixed(1)}°`);
      }
    } else {
      // Head returned to normal — reset hold timer
      if (drinkStartRef.current !== null) {
        drinkStartRef.current = null;
        setHoldProgress(0);
      }
    }
  }, [headPitch, isActive]);

  const reset = useCallback(() => {
    drinkStartRef.current = null;
    completedRef.current = false;
    setIsDrinking(false);
    setHoldProgress(0);
    setDrinkCompleted(false);
  }, []);

  return { isDrinking, holdProgress, drinkCompleted, reset };
}
