import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WellnessChallengeType =
  | 'hydration'
  | 'posture'
  | 'eye-break'
  | 'typing-break'
  | 'breath'
  | 'movement'
  | 'wrist-stretch'
  | 'neck-roll'
  | 'eye-relief'
  | 'standing-break';

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
  'wrist-stretch': {
    type: 'wrist-stretch',
    title: 'Wrist Stretch',
    nudgeMessage: "⚠️ RSI Alert: Your wrists have been under strain for 15 minutes of continuous typing. Time for a wrist stretch! Show me you're doing it for +40 XP",
    verificationMethod: 'vision',
    xpReward: 40,
    emoji: '🤲',
  },
  'neck-roll': {
    type: 'neck-roll',
    title: 'Neck Roll',
    nudgeMessage: "⚠️ RSI Alert: You've been locked in without a break for 20 minutes — your neck and shoulders are taking the load. Time for a neck roll! Show me you're doing it for +35 XP",
    verificationMethod: 'vision',
    xpReward: 35,
    emoji: '🧣',
  },
  'eye-relief': {
    type: 'eye-relief',
    title: 'Eye Relief',
    nudgeMessage: "⚠️ RSI Alert: 25 minutes of unbroken screen time detected. Your eye muscles need a reset — look away at a distant point for 30 seconds. Show me for +30 XP",
    verificationMethod: 'vision',
    xpReward: 30,
    emoji: '👀',
  },
  'standing-break': {
    type: 'standing-break',
    title: 'Standing Break',
    nudgeMessage: "⚠️ RSI Alert: Your repetitive strain risk is elevated. Stand up and shake out your hands and arms for 60 seconds — your tendons will thank you! Show me for +50 XP",
    verificationMethod: 'behavioral',
    xpReward: 50,
    emoji: '🧍',
  },
};

// Cooldowns in ms (how long before AURA can re-issue the same challenge)
const PROD_COOLDOWNS: Record<WellnessChallengeType, number> = {
  hydration: 30 * 60_000,
  posture: 20 * 60_000,
  'eye-break': 40 * 60_000,
  'typing-break': 60 * 60_000,
  breath: 25 * 60_000,
  movement: 90 * 60_000,
  'wrist-stretch': 10 * 60_000,
  'neck-roll': 10 * 60_000,
  'eye-relief': 10 * 60_000,
  'standing-break': 10 * 60_000,
};

const DEMO_COOLDOWNS: Record<WellnessChallengeType, number> = {
  hydration: 30_000,
  posture: 30_000,
  'eye-break': 30_000,
  'typing-break': 30_000,
  breath: 30_000,
  movement: 30_000,
  'wrist-stretch': 30_000,
  'neck-roll': 30_000,
  'eye-relief': 30_000,
  'standing-break': 30_000,
};

// Demo mode trigger thresholds (seconds) for original 6 challenges
const DEMO_TRIGGERS = {
  hydration: 45,
  posture: 15,
  'eye-break': 90,
  'typing-break': 30,
  breath: 5,       // 5% HRV drop instead of 10%
  movement: 120,
} as const;

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface WellnessCoachInput {
  isSessionActive: boolean;
  postureWarning: boolean;
  faceDetected: boolean;
  apm: number;
  hrv: number;
  /** Enable demo-mode timings (shorter thresholds & cooldowns for RSI challenges) */
  isDemoMode?: boolean;
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
  /** Force-trigger a challenge (for testing/debug) */
  issueChallenge: (type: WellnessChallengeType) => void;
}

export function useWellnessCoach({
  isSessionActive,
  postureWarning,
  faceDetected,
  apm,
  hrv,
  isDemoMode = false,
  onChallenge,
  onComplete,
}: WellnessCoachInput): WellnessCoachState {
  const COOLDOWNS = isDemoMode ? DEMO_COOLDOWNS : PROD_COOLDOWNS;
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
      const hasAbsenceChallenge = challenge?.type === 'movement' || challenge?.type === 'eye-break' || challenge?.type === 'standing-break';
      if (!hasAbsenceChallenge) {
        absenceStartRef.current = null;
        wasAbsentRef.current = false;
      }
    }
  }, [isSessionActive, hrv]);

  // ── Hydration: every 30 min (demo: 45s) of cumulative session ──────────────
  useEffect(() => {
    if (!isSessionActive) return;
    const t = isDemoMode ? DEMO_TRIGGERS.hydration : 30 * 60;
    if (cumulativeSeconds >= t && cumulativeSeconds % t < 2) issueChallenge('hydration');
  }, [isSessionActive, cumulativeSeconds, issueChallenge, isDemoMode]);

  // ── Eye-break: every 40 min (demo: 90s) of cumulative session ─────────────
  useEffect(() => {
    if (!isSessionActive) return;
    const t = isDemoMode ? DEMO_TRIGGERS['eye-break'] : 40 * 60;
    if (cumulativeSeconds >= t && cumulativeSeconds % t < 2) issueChallenge('eye-break');
  }, [isSessionActive, cumulativeSeconds, issueChallenge, isDemoMode]);

  // ── Typing-break: PROACTIVE after 60 min (demo: 30s) of sustained high APM ──
  useEffect(() => {
    if (!isSessionActive) return;
    const t = isDemoMode ? DEMO_TRIGGERS['typing-break'] : 60 * 60;
    if (highApmSeconds >= t && highApmSeconds % t < 2) issueChallenge('typing-break');
  }, [isSessionActive, highApmSeconds, issueChallenge, isDemoMode]);

  // ── Movement: every 90 min (demo: 120s) of cumulative session ─────────────
  useEffect(() => {
    if (!isSessionActive) return;
    const t = isDemoMode ? DEMO_TRIGGERS.movement : 90 * 60;
    if (cumulativeSeconds >= t && cumulativeSeconds % t < 2) issueChallenge('movement');
  }, [isSessionActive, cumulativeSeconds, issueChallenge, isDemoMode]);

  // ── Posture: after 3 min (demo: 15s) of sustained bad posture ─────────────
  useEffect(() => {
    if (!isSessionActive || !postureWarning) {
      postureStartRef.current = null;
      return;
    }
    if (postureStartRef.current === null) postureStartRef.current = Date.now();
    const elapsed = (Date.now() - postureStartRef.current) / 1000;
    const threshold = isDemoMode ? DEMO_TRIGGERS.posture : 180;
    if (elapsed >= threshold) {
      issueChallenge('posture');
      postureStartRef.current = null;
    }
  }, [isSessionActive, postureWarning, cumulativeSeconds, issueChallenge, isDemoMode]);

  // ── Breath: HRV drops ≥10% (demo: 5%) from session baseline ──────────────
  useEffect(() => {
    if (!isSessionActive || baselineHrvRef.current === null) return;
    const baseline = baselineHrvRef.current;
    const drop = ((baseline - hrv) / baseline) * 100;
    const threshold = isDemoMode ? DEMO_TRIGGERS.breath : 10;
    if (drop >= threshold) {
      issueChallenge('breath');
      baselineHrvRef.current = hrv;
    }
  }, [isSessionActive, hrv, issueChallenge, isDemoMode]);

  // ── RSI: wrist-stretch — after 15 min continuous typing (45s demo) ──────────
  useEffect(() => {
    if (!isSessionActive) return;
    const t = isDemoMode ? 45 : 15 * 60;
    if (highApmSeconds >= t && highApmSeconds % t < 2) {
      const mins = Math.round(highApmSeconds / 60);
      const tpl = CHALLENGE_TEMPLATES['wrist-stretch'];
      const msg = `⚠️ RSI Alert: Your wrists have been under strain for ${mins} minutes of continuous typing. Time for a wrist stretch! Show me you're doing it for +${tpl.xpReward} XP`;
      // Issue with dynamic message
      if (canIssue('wrist-stretch')) {
        const challenge: WellnessChallenge = {
          ...tpl,
          id: `wrist-stretch-${Date.now()}`,
          nudgeMessage: msg,
        };
        lastIssuedRef.current['wrist-stretch'] = Date.now();
        setActiveChallenge(challenge);
        onChallenge(challenge);
      }
    }
  }, [isSessionActive, highApmSeconds, isDemoMode, canIssue, onChallenge]);

  // ── RSI: neck-roll — after 20 min without break (60s demo) ────────────────
  useEffect(() => {
    if (!isSessionActive) return;
    const t = isDemoMode ? 60 : 20 * 60;
    if (cumulativeSeconds >= t && cumulativeSeconds % t < 2) issueChallenge('neck-roll');
  }, [isSessionActive, cumulativeSeconds, isDemoMode, issueChallenge]);

  // ── RSI: eye-relief — after 25 min screen time (90s demo) ────────────────
  useEffect(() => {
    if (!isSessionActive) return;
    const t = isDemoMode ? 90 : 25 * 60;
    if (cumulativeSeconds >= t && cumulativeSeconds % t < 2) issueChallenge('eye-relief');
  }, [isSessionActive, cumulativeSeconds, isDemoMode, issueChallenge]);

  // ── RSI: standing-break — RSI risk > 60 (2 min session in demo) ───────────
  // RSI risk heuristic: weighted combo of sustained high APM + session length without breaks
  useEffect(() => {
    if (!isSessionActive) return;
    if (isDemoMode) {
      const t = 2 * 60;
      if (cumulativeSeconds >= t && cumulativeSeconds % t < 2) issueChallenge('standing-break');
    } else {
      // RSI risk score: 0-100, based on typing intensity and session duration
      const typingIntensity = Math.min(apm / 120, 1) * 50; // 0-50 from APM
      const sessionLoad = Math.min(cumulativeSeconds / (60 * 60), 1) * 30; // 0-30 from duration
      const sustainedTyping = Math.min(highApmSeconds / (30 * 60), 1) * 20; // 0-20 from sustained APM
      const rsiRisk = typingIntensity + sessionLoad + sustainedTyping;
      if (rsiRisk > 60) issueChallenge('standing-break');
    }
  }, [isSessionActive, isDemoMode, apm, cumulativeSeconds, highApmSeconds, issueChallenge]);

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
    if (!challenge || (challenge.type !== 'movement' && challenge.type !== 'eye-break' && challenge.type !== 'standing-break')) return;
    const absenceThreshold = challenge.type === 'movement' ? 120 : challenge.type === 'standing-break' ? 60 : 20;

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
    issueChallenge,
  };
}
