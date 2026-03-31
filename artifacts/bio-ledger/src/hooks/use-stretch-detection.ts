import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Detects "arms raised above head" stretch gesture using face landmark Y-position.
 *
 * When you raise arms overhead, your face drops lower in the camera frame
 * (nose Y increases) and you lean back slightly. This hook:
 * 1. Captures a baseline nose Y during normal sitting (first 3 seconds)
 * 2. Detects when nose Y drops significantly below baseline (>12% of frame)
 * 3. Requires the stretch to be held for HOLD_DURATION seconds
 * 4. Returns progress (0-100) and completion state
 */

const BASELINE_CAPTURE_MS = 3000;  // Capture baseline for 3 seconds
const Y_DELTA_THRESHOLD = 0.12;     // 12% of frame height = significant drop
const HOLD_DURATION_MS = 5000;      // Must hold stretch for 5 seconds

export interface StretchDetectionResult {
  /** true when face Y has dropped below threshold */
  isStretching: boolean;
  /** 0-100 progress toward completing the hold */
  holdProgress: number;
  /** true when stretch was held for the full duration */
  stretchCompleted: boolean;
  /** Reset to allow another detection */
  reset: () => void;
}

export function useStretchDetection(
  noseY: number | null,
  isActive: boolean,
): StretchDetectionResult {
  const [isStretching, setIsStretching] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [stretchCompleted, setStretchCompleted] = useState(false);

  // Baseline tracking
  const baselineRef = useRef<number | null>(null);
  const baselineSamplesRef = useRef<number[]>([]);
  const baselineCapturedRef = useRef(false);
  const activeSinceRef = useRef<number | null>(null);

  // Hold tracking
  const stretchStartRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  // Reset when activation changes
  useEffect(() => {
    if (isActive) {
      activeSinceRef.current = Date.now();
      baselineCapturedRef.current = false;
      baselineSamplesRef.current = [];
      baselineRef.current = null;
      stretchStartRef.current = null;
      completedRef.current = false;
      setIsStretching(false);
      setHoldProgress(0);
      setStretchCompleted(false);
    }
  }, [isActive]);

  // Main detection loop — runs every frame via noseY changes
  useEffect(() => {
    if (!isActive || noseY === null || completedRef.current) return;

    const now = Date.now();

    // Phase 1: Capture baseline (first 3 seconds)
    if (!baselineCapturedRef.current) {
      if (activeSinceRef.current && now - activeSinceRef.current < BASELINE_CAPTURE_MS) {
        baselineSamplesRef.current.push(noseY);
        return;
      }
      // Compute baseline as median of samples
      const samples = baselineSamplesRef.current;
      if (samples.length > 0) {
        samples.sort((a, b) => a - b);
        baselineRef.current = samples[Math.floor(samples.length / 2)];
        baselineCapturedRef.current = true;
        console.log(`💪 Stretch baseline captured: noseY=${baselineRef.current.toFixed(3)} (${samples.length} samples)`);
      }
      return;
    }

    // Phase 2: Detect stretch (nose Y drops significantly)
    const baseline = baselineRef.current;
    if (baseline === null) return;

    const delta = noseY - baseline; // positive = face moved down in frame
    const isCurrentlyStretching = delta > Y_DELTA_THRESHOLD;

    setIsStretching(isCurrentlyStretching);

    if (isCurrentlyStretching) {
      if (stretchStartRef.current === null) {
        stretchStartRef.current = now;
        console.log(`💪 Stretch detected! Face Y-delta: ${(delta * 100).toFixed(1)}%`);
      }

      const held = now - stretchStartRef.current;
      const progress = Math.min(100, Math.round((held / HOLD_DURATION_MS) * 100));
      setHoldProgress(progress);

      if (held >= HOLD_DURATION_MS && !completedRef.current) {
        completedRef.current = true;
        setStretchCompleted(true);
        setHoldProgress(100);
        console.log(`💪 Stretch completed! Held for ${(held / 1000).toFixed(1)}s, Y-delta: ${(delta * 100).toFixed(1)}%`);
      }
    } else {
      // Stretch interrupted — reset hold timer
      if (stretchStartRef.current !== null) {
        stretchStartRef.current = null;
        setHoldProgress(0);
      }
    }
  }, [noseY, isActive]);

  const reset = useCallback(() => {
    stretchStartRef.current = null;
    completedRef.current = false;
    setIsStretching(false);
    setHoldProgress(0);
    setStretchCompleted(false);
    // Re-capture baseline
    baselineCapturedRef.current = false;
    baselineSamplesRef.current = [];
    baselineRef.current = null;
    activeSinceRef.current = Date.now();
  }, []);

  return { isStretching, holdProgress, stretchCompleted, reset };
}
