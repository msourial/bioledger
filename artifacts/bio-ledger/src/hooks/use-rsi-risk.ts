import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export interface RSIRiskState {
  riskScore: number;           // 0-100
  riskLevel: RiskLevel;
  minutesSinceBreak: number;
  totalKeystrokes: number;
  totalClicks: number;
  totalMouseDistance: number;   // meters (approx, assuming 96 DPI)
  complianceRate: number;      // 0-100 (% of suggested breaks taken)
  breaksTaken: number;
  breaksSuggested: number;
  streak: number;              // consecutive breaks taken
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BREAK_ABSENCE_THRESHOLD_MS = 30_000;      // 30s without face = break detected
const BREAK_ABSENCE_THRESHOLD_DEMO_MS = 5_000;  // 5s in demo mode
const BREAK_SUGGEST_INTERVAL_MIN = 25;           // suggest a break every 25 min
const BREAK_SUGGEST_INTERVAL_DEMO_MIN = 0.25;    // every 15s in demo

function getRiskLevel(score: number): RiskLevel {
  if (score <= 25) return 'low';
  if (score <= 50) return 'moderate';
  if (score <= 75) return 'high';
  return 'critical';
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRSIRisk(
  isSessionActive: boolean,
  apm: number,
  faceDetected: boolean,
  demoMode = false,
): RSIRiskState {
  const [riskScore, setRiskScore] = useState(0);
  const [minutesSinceBreak, setMinutesSinceBreak] = useState(0);
  const [totalKeystrokes, setTotalKeystrokes] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [totalMouseDistance, setTotalMouseDistance] = useState(0); // stored in pixels, displayed in meters
  const [breaksTaken, setBreaksTaken] = useState(0);
  const [breaksSuggested, setBreaksSuggested] = useState(0);
  const [streak, setStreak] = useState(0);

  // Refs for tracking
  const lastBreakTimeRef = useRef(Date.now());
  const absenceStartRef = useRef<number | null>(null);
  const wasAbsentRef = useRef(false);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const apmRef = useRef(apm);
  apmRef.current = apm;

  // Track last suggestion time so we don't double-suggest
  const lastSuggestMinuteRef = useRef(0);

  // ── Keystroke tracking (always active on dashboard) ─────────────────────────
  useEffect(() => {
    const onKey = () => setTotalKeystrokes((k) => k + 1);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Mouse distance tracking (throttled to every 100ms) + click tracking ────
  const mouseDistAccum = useRef(0);
  useEffect(() => {
    let lastX = 0;
    let lastY = 0;
    let hasLast = false;

    const onMove = (e: MouseEvent) => {
      if (hasLast) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        mouseDistAccum.current += Math.sqrt(dx * dx + dy * dy);
      }
      lastX = e.clientX;
      lastY = e.clientY;
      hasLast = true;
    };

    const onClick = () => setTotalClicks((c) => c + 1);

    // Flush accumulated distance every 500ms to avoid excessive re-renders
    const flushInterval = setInterval(() => {
      if (mouseDistAccum.current > 0) {
        const px = mouseDistAccum.current;
        mouseDistAccum.current = 0;
        setTotalMouseDistance((d) => d + px);
      }
    }, 500);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('click', onClick);
    window.addEventListener('contextmenu', onClick);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('click', onClick);
      window.removeEventListener('contextmenu', onClick);
      clearInterval(flushInterval);
    };
  }, []);

  // ── Break detection via face absence ────────────────────────────────────────
  useEffect(() => {
    if (!faceDetected) {
      // Face disappeared — mark start of absence
      if (!wasAbsentRef.current) {
        wasAbsentRef.current = true;
        absenceStartRef.current = Date.now();
      }
    } else if (wasAbsentRef.current) {
      // Face returned — check if absence was long enough for a break
      const absentDuration = absenceStartRef.current
        ? Date.now() - absenceStartRef.current
        : 0;
      wasAbsentRef.current = false;
      absenceStartRef.current = null;

      const threshold = demoMode ? BREAK_ABSENCE_THRESHOLD_DEMO_MS : BREAK_ABSENCE_THRESHOLD_MS;
      if (absentDuration >= threshold) {
        // Break taken!
        lastBreakTimeRef.current = Date.now();
        setBreaksTaken((b) => b + 1);
        setStreak((s) => s + 1);
      }
    }
  }, [faceDetected]);

  // ── Risk calculation tick (every second, always active) ─────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const minSinceBreak = (now - lastBreakTimeRef.current) / 60_000;
      setMinutesSinceBreak(Math.floor(minSinceBreak));

      // Suggest break at intervals
      const suggestInterval = demoMode ? BREAK_SUGGEST_INTERVAL_DEMO_MIN : BREAK_SUGGEST_INTERVAL_MIN;
      const suggestBucket = Math.floor(minSinceBreak / suggestInterval);
      if (suggestBucket > 0 && suggestBucket > lastSuggestMinuteRef.current) {
        lastSuggestMinuteRef.current = suggestBucket;
        setBreaksSuggested((s) => s + 1);
      }

      // ── Risk formula ──
      let risk: number;

      if (demoMode) {
        // Demo: risk hits 50 (high) at ~10s, 76 (critical) at ~20s
        const secSinceBreak = minSinceBreak * 60;
        risk = secSinceBreak * 3.5;
        const currentApm = apmRef.current;
        if (currentApm > 30) risk += (currentApm - 30) * 0.5;
      } else {
        // Production: gradual climb over minutes
        risk = minSinceBreak * 2;
        const currentApm = apmRef.current;
        if (currentApm > 60) risk += (currentApm - 60) * 0.3;
        if (minSinceBreak > 25) risk += (minSinceBreak - 25) * 3;
      }

      // Cap at 100
      setRiskScore(Math.min(100, Math.max(0, Math.round(risk))));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // ── Reset streak on missed break ────────────────────────────────────────────
  // If a break was suggested but risk goes critical without compliance, reset streak
  useEffect(() => {
    if (riskScore >= 76 && breaksSuggested > breaksTaken) {
      setStreak(0);
    }
  }, [riskScore, breaksSuggested, breaksTaken]);

  const complianceRate = breaksSuggested > 0
    ? Math.round((breaksTaken / breaksSuggested) * 100)
    : 100;

  // Convert pixels to meters (approx: 96 DPI → 1 pixel ≈ 0.264mm)
  const mouseDistMeters = Number((totalMouseDistance * 0.000264).toFixed(2));

  return {
    riskScore,
    riskLevel: getRiskLevel(riskScore),
    minutesSinceBreak,
    totalKeystrokes,
    totalClicks,
    totalMouseDistance: mouseDistMeters,
    complianceRate,
    breaksTaken,
    breaksSuggested,
    streak,
  };
}
