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
    nudgeMessage: "⌨️ Your fingers have been busy! AURA's issuing a 30-second typing break. Step away from the keyboard — I'll automatically reward you when your APM drops!",
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
    nudgeMessage: "🚶 You've been seated a while — AURA's issuing a movement break! Get up, stretch, take a 2-minute walk. I'll detect when you leave and return to your desk!",
    verificationMethod: 'behavioral',
    xpReward: 50,
    emoji: '🚶',
  },
};

// Cooldown in ms per challenge type (how long before AURA can issue the same challenge again)
const COOLDOWNS: Record<WellnessChallengeType, number> = {
  hydration: 30 * 60_000,      // 30 min
  posture: 20 * 60_000,        // 20 min
  'eye-break': 40 * 60_000,    // 40 min
  'typing-break': 60 * 60_000, // 60 min
  breath: 25 * 60_000,         // 25 min
  movement: 90 * 60_000,       // 90 min
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface WellnessCoachInput {
  isSessionActive: boolean;
  sessionSeconds: number;
  postureWarning: boolean;
  faceDetected: boolean;
  apm: number;
  hrv: number;
  /** Called when AURA wants to dispatch a new challenge as a proactive nudge */
  onChallenge: (challenge: WellnessChallenge) => void;
}

export function useWellnessCoach({
  isSessionActive,
  sessionSeconds,
  postureWarning,
  faceDetected,
  apm,
  hrv,
  onChallenge,
}: WellnessCoachInput): WellnessCoachState {
  const [activeChallenge, setActiveChallenge] = useState<WellnessChallenge | null>(null);
  const [completedChallenges, setCompletedChallenges] = useState<CompletedChallenge[]>([]);
  const [totalXP, setTotalXP] = useState(0);

  // Track last issue time per challenge type
  const lastIssuedRef = useRef<Partial<Record<WellnessChallengeType, number>>>({});

  // Track baseline HRV for breath challenge
  const baselineHrvRef = useRef<number | null>(null);

  // Track typing-break state — was APM recently high?
  const wasHighApmRef = useRef(false);
  // Track typing-break auto-verify timer (near-zero APM for 30s)
  const apmDropStartRef = useRef<number | null>(null);

  // Track movement/eye-break absence state (shared — only one challenge active at a time)
  const absenceStartRef = useRef<number | null>(null);
  const wasAbsentRef = useRef(false);

  // Track posture duration
  const postureStartRef = useRef<number | null>(null);

  // Track session start for hydration/eye-break triggers
  const sessionStartRef = useRef<number | null>(null);

  // Active challenge ref for behavioral verification (always reflects latest render)
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

  // ── Session start tracking ────────────────────────────────────────────
  useEffect(() => {
    if (isSessionActive && sessionStartRef.current === null) {
      sessionStartRef.current = Date.now();
      baselineHrvRef.current = hrv;
      wasHighApmRef.current = false;
    }
    if (!isSessionActive) {
      sessionStartRef.current = null;
      baselineHrvRef.current = null;
      apmDropStartRef.current = null;
      absenceStartRef.current = null;
      wasAbsentRef.current = false;
      postureStartRef.current = null;
      wasHighApmRef.current = false;
    }
  }, [isSessionActive, hrv]);

  // ── Hydration: every 30 min during session ────────────────────────────
  useEffect(() => {
    if (!isSessionActive) return;
    const sessionMins = sessionSeconds / 60;
    if (sessionMins >= 30 && sessionMins % 30 < 0.5) {
      issueChallenge('hydration');
    }
  }, [isSessionActive, sessionSeconds, issueChallenge]);

  // ── Eye-break: every 40 min (behavioral: look away for ≥20s) ─────────
  useEffect(() => {
    if (!isSessionActive) return;
    const sessionMins = sessionSeconds / 60;
    if (sessionMins >= 40 && sessionMins % 40 < 0.5) {
      issueChallenge('eye-break');
    }
  }, [isSessionActive, sessionSeconds, issueChallenge]);

  // ── Posture: after 3 min posture warning ──────────────────────────────
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
  }, [isSessionActive, postureWarning, sessionSeconds, issueChallenge]);

  // ── Typing break: APM was high (≥30) then drops to near-zero (<10) after 60+ min session ──
  useEffect(() => {
    if (!isSessionActive) return;
    const sessionMins = sessionSeconds / 60;
    if (sessionMins < 60) return;

    if (apm >= 30) {
      wasHighApmRef.current = true;
    } else if (apm < 10 && wasHighApmRef.current) {
      // High APM dropped to near-zero → issue typing-break challenge
      issueChallenge('typing-break');
      wasHighApmRef.current = false;
    }
  }, [isSessionActive, sessionSeconds, apm, issueChallenge]);

  // ── Movement break: every 90 min session triggers it once ─────────────
  useEffect(() => {
    if (!isSessionActive) return;
    const sessionMins = sessionSeconds / 60;
    if (sessionMins >= 90 && sessionMins % 90 < 0.5) {
      issueChallenge('movement');
    }
  }, [isSessionActive, sessionSeconds, issueChallenge]);

  // ── Breath: HRV drops ≥10% from baseline ─────────────────────────────
  useEffect(() => {
    if (!isSessionActive || baselineHrvRef.current === null) return;
    const baseline = baselineHrvRef.current;
    const drop = ((baseline - hrv) / baseline) * 100;
    if (drop >= 10) {
      issueChallenge('breath');
      baselineHrvRef.current = hrv; // Reset baseline after issuing
    }
  }, [isSessionActive, hrv, issueChallenge]);

  // ── Behavioral verification: typing-break auto-complete ───────────────
  // Near-zero APM for 30 continuous seconds → auto-complete typing-break
  useEffect(() => {
    const challenge = activeChallengeRef.current;
    if (!challenge || challenge.type !== 'typing-break') {
      if (apm >= 10) apmDropStartRef.current = null;
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
      // APM went back up — reset timer
      apmDropStartRef.current = null;
    }
  }, [apm, completeChallenge]);

  // ── Behavioral verification: movement (≥2 min away) and eye-break (≥20s away) ──
  useEffect(() => {
    const challenge = activeChallengeRef.current;
    if (!challenge || (challenge.type !== 'movement' && challenge.type !== 'eye-break')) return;

    // Threshold: movement = 120s, eye-break = 20s
    const absenceThreshold = challenge.type === 'movement' ? 120 : 20;

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
