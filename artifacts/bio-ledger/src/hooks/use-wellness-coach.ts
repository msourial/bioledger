import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WellnessChallengeType =
  | 'hydration'
  | 'posture'
  | 'eye-break'
  | 'typing-break'
  | 'breath'
  | 'movement';

export type VerificationMethod = 'vision' | 'behavioral' | 'manual';

export interface WellnessChallenge {
  id: string;
  type: WellnessChallengeType;
  title: string;
  nudgeMessage: string;
  verificationMethod: VerificationMethod;
  xpReward: number;
  emoji: string;
}

export interface CompletedChallenge {
  challenge: WellnessChallenge;
  xpAwarded: number;
  completedAt: Date;
}

// ─── Challenge Templates ───────────────────────────────────────────────────

const CHALLENGE_TEMPLATES: Record<WellnessChallengeType, Omit<WellnessChallenge, 'id'>> = {
  hydration: {
    type: 'hydration',
    title: 'Hydration Check',
    nudgeMessage: "💧 It's been 30 minutes — AURA wants to check in on your hydration! Show me your water bottle or drink to earn XP.",
    verificationMethod: 'vision',
    xpReward: 30,
    emoji: '💧',
  },
  posture: {
    type: 'posture',
    title: 'Posture Reset',
    nudgeMessage: "🧘 AURA noticed your posture has been off a while — let's do a quick reset! Sit up straight and show me your best posture for XP.",
    verificationMethod: 'vision',
    xpReward: 30,
    emoji: '🧘',
  },
  'eye-break': {
    type: 'eye-break',
    title: '20-20-20 Eye Break',
    nudgeMessage: "👁️ Time for a 20-20-20 break! Look away from your screen at something 20 feet away for 20 seconds. AURA will detect when you step away and return.",
    verificationMethod: 'behavioral',
    xpReward: 35,
    emoji: '👁️',
  },
  'typing-break': {
    type: 'typing-break',
    title: 'Typing Break',
    nudgeMessage: "⌨️ You've been typing intensely for over 60 minutes! AURA says — step away from the keyboard for at least 30 seconds. I'll automatically reward you when your APM drops!",
    verificationMethod: 'behavioral',
    xpReward: 25,
    emoji: '⌨️',
  },
  breath: {
    type: 'breath',
    title: 'Mindful Breath',
    nudgeMessage: "🌿 Your HRV is dipping — AURA suggests 4 slow deep breaths right now (inhale 4s, hold 4s, exhale 6s). Tap \"Done\" when finished and I'll note your calm!",
    verificationMethod: 'manual',
    xpReward: 40,
    emoji: '🌿',
  },
  movement: {
    type: 'movement',
    title: 'Movement Break',
    nudgeMessage: "🚶 You've been seated for 90 minutes — AURA says get up and move! Take a 2-minute walk. I'll detect when you leave and return to your desk!",
    verificationMethod: 'behavioral',
    xpReward: 50,
    emoji: '🚶',
  },
};

// Cooldowns in ms (how long before AURA can re-issue the same challenge)
const COOLDOWNS: Record<WellnessChallengeType, number> = {
  hydration: 30 * 60_000,
  posture: 20 * 60_000,
  'eye-break': 40 * 60_000,
  'typing-break': 60 * 60_000,
  breath: 25 * 60_000,
  movement: 90 * 60_000,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface WellnessCoachInput {
  isSessionActive: boolean;
  postureWarning: boolean;
  faceDetected: boolean;
  apm: number;
  hrv: number;
  /** Called when AURA issues a new wellness challenge */
  onChallenge: (challenge: WellnessChallenge) => void;
  /** Called when ANY challenge is completed (all paths: manual, vision, behavioral) */
  onComplete?: (challenge: WellnessChallenge, xpAwarded: number) => void;
}

export interface WellnessCoachState {
  activeChallenge: WellnessChallenge | null;
  completedChallenges: CompletedChallenge[];
  totalXP: number;
  dismissChallenge: () => void;
  completeChallenge: (id: string, xpOverride?: number) => void;
}

export function useWellnessCoach({
  isSessionActive,
  postureWarning,
  faceDetected,
  apm,
  hrv,
  onChallenge,
  onComplete,
}: WellnessCoachInput): WellnessCoachState {
  const [activeChallenge, setActiveChallenge] = useState<WellnessChallenge | null>(null);
  const [completedChallenges, setCompletedChallenges] = useState<CompletedChallenge[]>([]);
  const [totalXP, setTotalXP] = useState(0);

  // pendingCompletion drives side-effects after completeChallenge so we avoid
  // calling onComplete inside a setState updater (which React may call twice in StrictMode)
  const [pendingCompletion, setPendingCompletion] = useState<{ challenge: WellnessChallenge; xp: number } | null>(null);

  // ── Cumulative active-session seconds (persists across Pomodoro resets) ──
  const [cumulativeSeconds, setCumulativeSeconds] = useState(0);
  useEffect(() => {
    if (!isSessionActive) return;
    const interval = setInterval(() => setCumulativeSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isSessionActive]);

  // ── High-APM seconds (sustained typing load counter) ─────────────────────
  // Accumulates every second where APM ≥ 30, regardless of whether APM just changed
  const [highApmSeconds, setHighApmSeconds] = useState(0);
  const apmRef = useRef(apm);
  apmRef.current = apm;
  useEffect(() => {
    if (!isSessionActive) return;
    const interval = setInterval(() => {
      if (apmRef.current >= 30) setHighApmSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isSessionActive]);

  // Refs for trigger tracking
  const lastIssuedRef = useRef<Partial<Record<WellnessChallengeType, number>>>({});
  const baselineHrvRef = useRef<number | null>(null);
  const apmDropStartRef = useRef<number | null>(null);
  const absenceStartRef = useRef<number | null>(null);
  const wasAbsentRef = useRef(false);
  const postureStartRef = useRef<number | null>(null);
  const activeChallengeRef = useRef<WellnessChallenge | null>(null);
  activeChallengeRef.current = activeChallenge;

  const canIssue = useCallback((type: WellnessChallengeType): boolean => {
    if (activeChallengeRef.current !== null) return false;
    const last = lastIssuedRef.current[type];
    if (!last) return true;
    return Date.now() - last >= COOLDOWNS[type];
  }, []);

  const issueChallenge = useCallback((type: WellnessChallengeType) => {
    if (!canIssue(type)) return;
    const challenge: WellnessChallenge = {
      ...CHALLENGE_TEMPLATES[type],
      id: `${type}-${Date.now()}`,
    };
    lastIssuedRef.current[type] = Date.now();
    setActiveChallenge(challenge);
    onChallenge(challenge);
  }, [canIssue, onChallenge]);

  // ── completeChallenge: enqueues pendingCompletion (avoids side effects in setter) ──
  const completeChallenge = useCallback((id: string, xpOverride?: number) => {
    setActiveChallenge((current) => {
      if (!current || current.id !== id) return current;
      const xp = xpOverride ?? current.xpReward;
      setPendingCompletion({ challenge: current, xp });
      return null;
    });
  }, []);

  // ── Flush pendingCompletion: update completed list + totalXP + call onComplete ──
  useEffect(() => {
    if (!pendingCompletion) return;
    const { challenge, xp } = pendingCompletion;
    setPendingCompletion(null);
    setCompletedChallenges((prev) => [
      ...prev,
      { challenge, xpAwarded: xp, completedAt: new Date() },
    ]);
    setTotalXP((prev) => prev + xp);
    onComplete?.(challenge, xp);
  }, [pendingCompletion, onComplete]);

  const dismissChallenge = useCallback(() => {
    setActiveChallenge(null);
  }, []);

  // ── HRV baseline capture + session reset ───────────────────────────────────
  useEffect(() => {
    if (isSessionActive && baselineHrvRef.current === null) {
      baselineHrvRef.current = hrv;
    }
    if (!isSessionActive) {
      baselineHrvRef.current = null;
      apmDropStartRef.current = null;
      postureStartRef.current = null;
      // Preserve absence refs if a behavioral absence-based challenge is active
      const challenge = activeChallengeRef.current;
      const hasAbsenceChallenge = challenge?.type === 'movement' || challenge?.type === 'eye-break';
      if (!hasAbsenceChallenge) {
        absenceStartRef.current = null;
        wasAbsentRef.current = false;
      }
    }
  }, [isSessionActive, hrv]);

  // ── Hydration: every 30 min of cumulative session ───────────────────────────
  useEffect(() => {
    if (!isSessionActive) return;
    const t = 30 * 60;
    if (cumulativeSeconds >= t && cumulativeSeconds % t < 2) issueChallenge('hydration');
  }, [isSessionActive, cumulativeSeconds, issueChallenge]);

  // ── Eye-break: every 40 min of cumulative session ───────────────────────────
  useEffect(() => {
    if (!isSessionActive) return;
    const t = 40 * 60;
    if (cumulativeSeconds >= t && cumulativeSeconds % t < 2) issueChallenge('eye-break');
  }, [isSessionActive, cumulativeSeconds, issueChallenge]);

  // ── Typing-break: PROACTIVE after 60 min of sustained high APM (≥30 apm) ──
  // Trigger fires while user is still typing, before they stop; APM drop verifies the break
  useEffect(() => {
    if (!isSessionActive) return;
    const t = 60 * 60;
    if (highApmSeconds >= t && highApmSeconds % t < 2) issueChallenge('typing-break');
  }, [isSessionActive, highApmSeconds, issueChallenge]);

  // ── Movement: every 90 min of cumulative session ────────────────────────────
  useEffect(() => {
    if (!isSessionActive) return;
    const t = 90 * 60;
    if (cumulativeSeconds >= t && cumulativeSeconds % t < 2) issueChallenge('movement');
  }, [isSessionActive, cumulativeSeconds, issueChallenge]);

  // ── Posture: after 3 min of sustained bad posture ──────────────────────────
  useEffect(() => {
    if (!isSessionActive || !postureWarning) {
      postureStartRef.current = null;
      return;
    }
    if (postureStartRef.current === null) postureStartRef.current = Date.now();
    const elapsed = (Date.now() - postureStartRef.current) / 1000;
    if (elapsed >= 180) {
      issueChallenge('posture');
      postureStartRef.current = null;
    }
  }, [isSessionActive, postureWarning, cumulativeSeconds, issueChallenge]);

  // ── Breath: HRV drops ≥10% from session baseline ──────────────────────────
  useEffect(() => {
    if (!isSessionActive || baselineHrvRef.current === null) return;
    const baseline = baselineHrvRef.current;
    const drop = ((baseline - hrv) / baseline) * 100;
    if (drop >= 10) {
      issueChallenge('breath');
      baselineHrvRef.current = hrv;
    }
  }, [isSessionActive, hrv, issueChallenge]);

  // ── Behavioral auto-verify: typing-break — near-zero APM for 30s ───────────
  useEffect(() => {
    const challenge = activeChallengeRef.current;
    if (!challenge || challenge.type !== 'typing-break') {
      apmDropStartRef.current = null;
      return;
    }
    if (apm < 10) {
      if (apmDropStartRef.current === null) {
        apmDropStartRef.current = Date.now();
      } else if (Date.now() - apmDropStartRef.current >= 30_000) {
        completeChallenge(challenge.id, challenge.xpReward);
        apmDropStartRef.current = null;
      }
    } else {
      apmDropStartRef.current = null; // Typing resumed — reset
    }
  }, [apm, completeChallenge]);

  // ── Behavioral auto-verify: movement (≥2 min away) / eye-break (≥20s away) ─
  // Works even when session pauses (absence refs preserved above)
  useEffect(() => {
    const challenge = activeChallengeRef.current;
    if (!challenge || (challenge.type !== 'movement' && challenge.type !== 'eye-break')) return;
    const absenceThreshold = challenge.type === 'movement' ? 120 : 20;

    if (!faceDetected) {
      if (!wasAbsentRef.current) {
        wasAbsentRef.current = true;
        absenceStartRef.current = Date.now();
      }
    } else if (wasAbsentRef.current) {
      const absent = absenceStartRef.current
        ? (Date.now() - absenceStartRef.current) / 1000
        : 0;
      wasAbsentRef.current = false;
      absenceStartRef.current = null;
      if (absent >= absenceThreshold) {
        completeChallenge(challenge.id, challenge.xpReward);
      }
    }
  }, [faceDetected, completeChallenge]);

  return {
    activeChallenge,
    completedChallenges,
    totalXP,
    dismissChallenge,
    completeChallenge,
  };
}
