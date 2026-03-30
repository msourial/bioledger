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

export interface WellnessCoachState {
  activeChallenge: WellnessChallenge | null;
  completedChallenges: CompletedChallenge[];
  totalXP: number;
  dismissChallenge: () => void;
  completeChallenge: (id: string, xpOverride?: number) => void;
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
    nudgeMessage: "⌨️ You've been typing for over 60 minutes! AURA says — step away from the keyboard for at least 30 seconds. I'll automatically reward you when your APM drops!",
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
  hydration: 30 * 60_000,      // 30 min
  posture: 20 * 60_000,        // 20 min
  'eye-break': 40 * 60_000,    // 40 min
  'typing-break': 60 * 60_000, // 60 min
  breath: 25 * 60_000,         // 25 min
  movement: 90 * 60_000,       // 90 min
};

// Trigger thresholds in seconds (cumulative active session time)
const TRIGGER_SECONDS: Partial<Record<WellnessChallengeType, number>> = {
  hydration: 30 * 60,      // 30 min
  'eye-break': 40 * 60,    // 40 min
  'typing-break': 60 * 60, // 60 min — proactive nudge
  movement: 90 * 60,       // 90 min
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
}

export function useWellnessCoach({
  isSessionActive,
  postureWarning,
  faceDetected,
  apm,
  hrv,
  onChallenge,
}: WellnessCoachInput): WellnessCoachState {
  const [activeChallenge, setActiveChallenge] = useState<WellnessChallenge | null>(null);
  const [completedChallenges, setCompletedChallenges] = useState<CompletedChallenge[]>([]);
  const [totalXP, setTotalXP] = useState(0);

  // ── Cumulative active session seconds (persists across Pomodoro resets) ──
  const [cumulativeSeconds, setCumulativeSeconds] = useState(0);

  useEffect(() => {
    if (!isSessionActive) return;
    const interval = setInterval(() => {
      setCumulativeSeconds((s) => s + 1);
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

  // Ref that always reflects the latest activeChallenge for effects
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
    const template = CHALLENGE_TEMPLATES[type];
    const challenge: WellnessChallenge = {
      ...template,
      id: `${type}-${Date.now()}`,
    };
    lastIssuedRef.current[type] = Date.now();
    setActiveChallenge(challenge);
    onChallenge(challenge);
  }, [canIssue, onChallenge]);

  const completeChallenge = useCallback((id: string, xpOverride?: number) => {
    setActiveChallenge((current) => {
      if (!current || current.id !== id) return current;
      const xp = xpOverride ?? current.xpReward;
      setCompletedChallenges((prev) => [
        ...prev,
        { challenge: current, xpAwarded: xp, completedAt: new Date() },
      ]);
      setTotalXP((prev) => prev + xp);
      return null;
    });
  }, []);

  const dismissChallenge = useCallback(() => {
    setActiveChallenge(null);
  }, []);

  // ── Session start: capture HRV baseline ─────────────────────────────────
  useEffect(() => {
    if (isSessionActive && baselineHrvRef.current === null) {
      baselineHrvRef.current = hrv;
    }
    if (!isSessionActive) {
      baselineHrvRef.current = null;
      apmDropStartRef.current = null;
      postureStartRef.current = null;
      // Preserve absence refs only if an absence-based behavioral challenge is active
      const challenge = activeChallengeRef.current;
      const hasAbsenceChallenge = challenge?.type === 'movement' || challenge?.type === 'eye-break';
      if (!hasAbsenceChallenge) {
        absenceStartRef.current = null;
        wasAbsentRef.current = false;
      }
    }
  }, [isSessionActive, hrv]);

  // ── Time-based triggers (cumulative session seconds) ────────────────────
  // Fire once when threshold is crossed; cooldown prevents repeat within period

  // Hydration: every 30 min
  useEffect(() => {
    if (!isSessionActive) return;
    const elapsed = cumulativeSeconds;
    const threshold = TRIGGER_SECONDS.hydration!;
    if (elapsed >= threshold && elapsed % threshold < 2) {
      issueChallenge('hydration');
    }
  }, [isSessionActive, cumulativeSeconds, issueChallenge]);

  // Eye-break: every 40 min
  useEffect(() => {
    if (!isSessionActive) return;
    const elapsed = cumulativeSeconds;
    const threshold = TRIGGER_SECONDS['eye-break']!;
    if (elapsed >= threshold && elapsed % threshold < 2) {
      issueChallenge('eye-break');
    }
  }, [isSessionActive, cumulativeSeconds, issueChallenge]);

  // Typing-break: PROACTIVELY at 60+ min of cumulative session (user still working)
  useEffect(() => {
    if (!isSessionActive) return;
    const elapsed = cumulativeSeconds;
    const threshold = TRIGGER_SECONDS['typing-break']!;
    if (elapsed >= threshold && elapsed % threshold < 2) {
      issueChallenge('typing-break');
    }
  }, [isSessionActive, cumulativeSeconds, issueChallenge]);

  // Movement: every 90 min
  useEffect(() => {
    if (!isSessionActive) return;
    const elapsed = cumulativeSeconds;
    const threshold = TRIGGER_SECONDS.movement!;
    if (elapsed >= threshold && elapsed % threshold < 2) {
      issueChallenge('movement');
    }
  }, [isSessionActive, cumulativeSeconds, issueChallenge]);

  // ── Posture: after 3 min sustained posture warning ───────────────────────
  useEffect(() => {
    if (!isSessionActive || !postureWarning) {
      postureStartRef.current = null;
      return;
    }
    if (postureStartRef.current === null) {
      postureStartRef.current = Date.now();
    }
    const elapsed = (Date.now() - postureStartRef.current) / 1000;
    if (elapsed >= 180) {
      issueChallenge('posture');
      postureStartRef.current = null;
    }
  }, [isSessionActive, postureWarning, cumulativeSeconds, issueChallenge]);

  // ── Breath: HRV drops ≥10% from session baseline ─────────────────────────
  useEffect(() => {
    if (!isSessionActive || baselineHrvRef.current === null) return;
    const baseline = baselineHrvRef.current;
    const drop = ((baseline - hrv) / baseline) * 100;
    if (drop >= 10) {
      issueChallenge('breath');
      baselineHrvRef.current = hrv; // Reset baseline so we don't spam
    }
  }, [isSessionActive, hrv, issueChallenge]);

  // ── Behavioral: typing-break auto-complete — near-zero APM for 30s ───────
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
      apmDropStartRef.current = null; // Reset if typing resumes
    }
  }, [apm, completeChallenge]);

  // ── Behavioral: movement (≥2 min absence) and eye-break (≥20s absence) ───
  // Absence refs are preserved during these challenges even if session pauses
  useEffect(() => {
    const challenge = activeChallengeRef.current;
    if (!challenge || (challenge.type !== 'movement' && challenge.type !== 'eye-break')) {
      return;
    }
    const absenceThreshold = challenge.type === 'movement' ? 120 : 20; // seconds

    if (!faceDetected) {
      if (!wasAbsentRef.current) {
        wasAbsentRef.current = true;
        absenceStartRef.current = Date.now();
      }
    } else if (wasAbsentRef.current) {
      const absenceDuration = absenceStartRef.current
        ? (Date.now() - absenceStartRef.current) / 1000
        : 0;
      wasAbsentRef.current = false;
      absenceStartRef.current = null;
      if (absenceDuration >= absenceThreshold) {
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
