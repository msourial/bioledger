import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import {
  Activity,
  Brain,
  Clock,
  MousePointer2,
  ShieldCheck,
  HardDrive,
  LogOut,
  AlertTriangle,
  Shield,
  CheckCircle2,
  EyeOff,
  Zap,
  MessageSquare,
  BookOpen,
  Download,
  ChevronDown,
  ChevronUp,
  Package,
  Star,
} from 'lucide-react';
import { useMockBioData } from '@/lib/whoop-mock';
import { useAPM } from '@/hooks/use-apm';
import { useCamera } from '@/hooks/use-camera';
import { useMotionLock } from '@/hooks/use-motion-lock';
import { useWellnessCoach, type WellnessChallenge } from '@/hooks/use-wellness-coach';
import { PixelPanel, PixelButton, NeonText, AuraOrb } from '@/components/PixelUI';
import CameraLens from '@/components/CameraLens';
import ProvenanceModal, { type MetricKey } from '@/components/ProvenanceModal';
import ReceiptChainCard from '@/components/ReceiptChainCard';
import AuraChat from '@/components/AuraChat';
import { cn, truncateHash } from '@/lib/utils';
import { signWorkReceipt, storeToFilecoin, type FilecoinResult } from '@/lib/companion-agent';
import { useListReceipts, useCreateReceipt } from '@workspace/api-client-react';

interface DashboardProps {
  nullifierHash: string;
  bioSourceConnected: boolean;
  onLogout: () => void;
}

const POMODORO_TIME = 25 * 60;
const DEMO_TIME = 60;

// Demo tooltip phases — 4-step guided narration keyed by seconds-remaining thresholds
const DEMO_PHASES = [
  { threshold: DEMO_TIME,      step: 1, label: 'IDENTITY',   msg: 'World ID nullifier bound to session — ZK proof active' },
  { threshold: DEMO_TIME - 18, step: 2, label: 'BIOMETRICS', msg: 'Live HRV, strain & vision score streaming from sensors' },
  { threshold: DEMO_TIME - 36, step: 3, label: 'SIGNING',    msg: 'AURA Agent preparing ERC-8004 HMAC receipt for signing' },
  { threshold: DEMO_TIME - 50, step: 4, label: 'STORAGE',    msg: 'Queuing Filecoin upload via Synapse SDK warm storage…' },
] as const;

/** Lerp HRV value → soft violet (#8B5CF6) at ≥70ms, warm coral (#FB7185) at <55ms */
function getHrvBorderColor(hrv: number): string {
  if (hrv >= 70) return '#8B5CF6';
  if (hrv <= 55) return '#FB7185';
  const t = (hrv - 55) / 15; // 0..1
  // interpolate hue: 258 (violet) → 352 (coral)
  const h = Math.round(258 + (1 - t) * 94);
  const s = Math.round(85 + (1 - t) * 11);
  const l = Math.round(66 + (1 - t) * 6);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

/** Smooth counting number powered by framer-motion useSpring */
function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const spring = useSpring(value, { stiffness: 80, damping: 22 });
  useEffect(() => { spring.set(value); }, [value, spring]);
  const display = useTransform(spring, (v) => Math.round(v).toString());
  return <motion.span className={className}>{display}</motion.span>;
}

export default function Dashboard({ nullifierHash, bioSourceConnected, onLogout }: DashboardProps) {
  const { hrv, strain } = useMockBioData();
  const [isSessionActive, setIsSessionActive] = useState(false);
  const apm = useAPM(isSessionActive);

  const [timeLeft, setTimeLeft] = useState(POMODORO_TIME);
  const [isFiling, setIsFiling] = useState(false);
  const [filingPhase, setFilingPhase] = useState<string | null>(null);

  // Demo mode
  const [isDemoMode, setIsDemoMode] = useState(false);
  const isDemoRef = useRef(false);
  const [demoPhaseIndex, setDemoPhaseIndex] = useState(0);

  // Track physical integrity over the session
  const physicalIntegrityRef = useRef(true);

  // Provenance modal
  const [provenanceMetric, setProvenanceMetric] = useState<MetricKey | null>(null);

  // Right pane tab
  const [rightTab, setRightTab] = useState<'ledger' | 'chat'>('ledger');

  // Proactive nudge tracking
  const [proactiveNudge, setProactiveNudge] = useState<string | null>(null);
  // AURA inject message — wellness challenge nudge injected directly as an AURA message
  const [challengeNudge, setChallengeNudge] = useState<string | null>(null);
  const nudgeSentRef = useRef<{ posture: boolean; hrv: boolean; lateNight: boolean }>({
    posture: false,
    hrv: false,
    lateNight: false,
  });
  const postureElapsedRef = useRef<number>(0);
  const postureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const baselineHrvRef = useRef<number | null>(null);

  // Sovereign Export panel
  const [exportOpen, setExportOpen] = useState(false);

  /** Fetch a URL and trigger a browser file download */
  const downloadJson = useCallback(async (url: string, filename: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error('[Bio-Ledger] Export failed — server returned', res.status);
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error('[Bio-Ledger] Export failed', err);
    }
  }, []);

  const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

  const handleDownloadAgentJson = useCallback(() => {
    void downloadJson(`${apiBase}/api/aura/manifest`, 'agent.json');
  }, [downloadJson, apiBase]);

  const handleDownloadLogsJson = useCallback(() => {
    void downloadJson(`${apiBase}/api/aura/logs?nullifier=${encodeURIComponent(nullifierHash)}`, 'agent_log.json');
  }, [downloadJson, apiBase, nullifierHash]);

  // Motion lock
  const handleMotionInterrupt = useCallback(() => {
    setIsSessionActive(false);
    physicalIntegrityRef.current = false;
    console.log('[Bio-Ledger] Interruption Event: focus timer paused');
  }, []);
  const motionLock = useMotionLock(isSessionActive, handleMotionInterrupt);

  // Camera / Sovereign Senses — always on while in the vault
  const camera = useCamera(true);

  // Sovereign Presence Lost: camera active but no face detected during session
  const presenceLost = isSessionActive && camera.isActive && !camera.faceDetected;
  const presenceLostAlerted = useRef(false);

  useEffect(() => {
    if (presenceLost && !presenceLostAlerted.current) {
      presenceLostAlerted.current = true;
      setIsSessionActive(false);
      physicalIntegrityRef.current = false;
      console.log('[Bio-Ledger] Sovereign Presence Lost — flow paused');
    }
    if (!presenceLost) {
      presenceLostAlerted.current = false;
    }
  }, [presenceLost]);

  const { data: receipts, isLoading: isReceiptsLoading, refetch: refetchReceipts } = useListReceipts({ nullifier: nullifierHash });
  const createReceiptMutation = useCreateReceipt();

  const handleDownloadReceiptsJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(receipts ?? [], null, 2)], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = 'receipts.json';
    a.click();
    URL.revokeObjectURL(objectUrl);
  }, [receipts]);

  // Insight receipt signing helper (called from AuraChat via onInsightSigned)
  const signInsightReceipt = useCallback(async (insightText: string) => {
    const focusScore = Math.min(100, Math.round((apm / 100) * 40 + (hrv / 120) * 60));
    const stats = { durationSeconds: 0, apm, hrv, strain, focusScore };
    const signed = await signWorkReceipt(nullifierHash, stats, strain, undefined, 'aura-insight');
    createReceiptMutation.mutate(
      {
        data: {
          nullifierHash,
          sessionStats: stats,
          companionSignature: signed.companionSignature,
          isDemo: false,
          physicalIntegrity: camera.faceDetected,
          receiptType: 'insight',
          insightText,
        },
      },
      { onSuccess: () => refetchReceipts() }
    );
  }, [apm, hrv, strain, nullifierHash, camera.faceDetected, createReceiptMutation, refetchReceipts]);

  // Proactive nudges — posture timer: use setInterval so elapsed time actually advances
  useEffect(() => {
    if (isSessionActive && camera.postureWarning) {
      if (!postureIntervalRef.current) {
        postureElapsedRef.current = 0;
        postureIntervalRef.current = setInterval(() => {
          postureElapsedRef.current += 1;
          if (postureElapsedRef.current >= 180 && !nudgeSentRef.current.posture) {
            nudgeSentRef.current.posture = true;
            setProactiveNudge('Posture warning active for over 3 minutes. What should I do?');
            setRightTab('chat');
          }
        }, 1000);
      }
    } else {
      if (postureIntervalRef.current) {
        clearInterval(postureIntervalRef.current);
        postureIntervalRef.current = null;
      }
      postureElapsedRef.current = 0;
      nudgeSentRef.current.posture = false;
    }
    return () => {
      if (postureIntervalRef.current) {
        clearInterval(postureIntervalRef.current);
        postureIntervalRef.current = null;
      }
    };
  }, [isSessionActive, camera.postureWarning]);

  useEffect(() => {
    if (isSessionActive) {
      if (baselineHrvRef.current === null) {
        baselineHrvRef.current = hrv;
      } else {
        const drop = ((baselineHrvRef.current - hrv) / baselineHrvRef.current) * 100;
        if (drop >= 15 && !nudgeSentRef.current.hrv) {
          nudgeSentRef.current.hrv = true;
          setProactiveNudge(`My HRV just dropped from ${baselineHrvRef.current}ms to ${hrv}ms. Is that bad?`);
          setRightTab('chat');
        }
      }
    } else {
      baselineHrvRef.current = null;
      nudgeSentRef.current.hrv = false;
    }
  }, [isSessionActive, hrv]);

  useEffect(() => {
    if (!isSessionActive) {
      nudgeSentRef.current.lateNight = false;
      return;
    }
    const hour = new Date().getHours();
    if (hour >= 22 && strain > 12 && !nudgeSentRef.current.lateNight) {
      nudgeSentRef.current.lateNight = true;
      setProactiveNudge(`It's ${hour}:00 and my strain is ${strain}. Should I stop working?`);
      setRightTab('chat');
    }
  }, [strain, isSessionActive]);

  // Reset integrity tracking when session starts
  useEffect(() => {
    if (isSessionActive) {
      physicalIntegrityRef.current = true;
    }
  }, [isSessionActive]);

  // Sign and file a wellness receipt through the full sign + Filecoin pipeline
  const signWellnessReceipt = useCallback(async (challengeType: string, xpAwarded: number) => {
    const stats = { durationSeconds: 0, apm, hrv, strain, focusScore: Math.min(100, Math.round((apm / 100) * 40 + (hrv / 120) * 60)) };
    const signed = await signWorkReceipt(nullifierHash, stats, strain, undefined, 'wellness');
    const filecoin = await storeToFilecoin(signed);
    createReceiptMutation.mutate(
      {
        data: {
          nullifierHash,
          sessionStats: stats,
          companionSignature: signed.companionSignature,
          receiptCid: filecoin.cid ?? undefined,
          cidStatus: filecoin.status,
          isDemo: false,
          physicalIntegrity: camera.faceDetected,
          receiptType: 'wellness',
          insightText: `[WELLNESS +${xpAwarded}XP] ${challengeType} challenge completed`,
        },
      },
      { onSuccess: () => refetchReceipts() }
    );
  }, [apm, hrv, strain, nullifierHash, camera.faceDetected, createReceiptMutation, refetchReceipts]);

  // Wellness coach callbacks — defined after signWellnessReceipt to avoid forward-ref issues
  const handleWellnessChallenge = useCallback((challenge: WellnessChallenge) => {
    setRightTab('chat');
    setChallengeNudge(challenge.nudgeMessage);
  }, []);

  const handleWellnessComplete = useCallback((challenge: WellnessChallenge, xpAwarded: number) => {
    void signWellnessReceipt(challenge.type, xpAwarded);
  }, [signWellnessReceipt]);

  const wellnessCoach = useWellnessCoach({
    isSessionActive,
    postureWarning: camera.postureWarning,
    faceDetected: camera.faceDetected,
    apm,
    hrv,
    onChallenge: handleWellnessChallenge,
    onComplete: handleWellnessComplete,
  });

  // Advance demo phase tooltip based on time remaining
  useEffect(() => {
    if (!isDemoMode || !isSessionActive) return;
    const idx = DEMO_PHASES.findLastIndex((p) => timeLeft <= p.threshold);
    setDemoPhaseIndex(Math.max(0, idx));
  }, [isDemoMode, isSessionActive, timeLeft]);

  // Timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSessionActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    } else if (isSessionActive && timeLeft === 0) {
      void handleSessionComplete();
    }
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSessionActive, timeLeft]);

  const strainAtSessionStart = useRef(strain);
  useEffect(() => {
    if (isSessionActive) strainAtSessionStart.current = strain;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSessionActive]);

  const handleSessionComplete = async () => {
    setIsSessionActive(false);
    setIsDemoMode(false);
    setIsFiling(true);
    setFilingPhase('SIGNING RECEIPT...');

    const isDemo = isDemoRef.current;
    isDemoRef.current = false;

    const sessionDuration = isDemo ? DEMO_TIME : POMODORO_TIME;
    const focusScore = Math.min(100, Math.round((apm / 100) * 40 + (hrv / 120) * 60));
    const stats = { durationSeconds: sessionDuration, apm, hrv, strain, focusScore };

    const physicalIntegrity =
      physicalIntegrityRef.current &&
      motionLock.physicalIntegrity &&
      camera.faceDetected;

    const signedReceipt = await signWorkReceipt(nullifierHash, stats, strainAtSessionStart.current, camera.visionMetrics);

    setFilingPhase('FILING TO FILECOIN...');
    const filecoin = await storeToFilecoin(signedReceipt);

    setFilingPhase(null);

    createReceiptMutation.mutate(
      {
        data: {
          nullifierHash,
          sessionStats: stats,
          companionSignature: signedReceipt.companionSignature,
          receiptCid: filecoin.cid ?? undefined,
          cidStatus: filecoin.status,
          isDemo,
          physicalIntegrity,
        },
      },
      {
        onSuccess: () => { setIsFiling(false); setTimeLeft(POMODORO_TIME); refetchReceipts(); },
        onError: (err: unknown) => {
          console.error('Failed to save receipt', err);
          setIsFiling(false);
          setTimeLeft(POMODORO_TIME);
        },
      }
    );
  };

  const toggleTimer = () => setIsSessionActive((prev) => !prev);

  const startDemoMode = () => {
    isDemoRef.current = true;
    setIsDemoMode(true);
    setDemoPhaseIndex(0);
    setTimeLeft(DEMO_TIME);
    physicalIntegrityRef.current = true;
    setIsSessionActive(true);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const isInterrupted = motionLock.isInterrupted;

  // Companion state
  const companionState: 'signing' | 'presence-lost' | 'posture' | 'active' | 'demo' | 'idle' =
    isFiling
      ? 'signing'
      : presenceLost
      ? 'presence-lost'
      : camera.postureWarning && isSessionActive
      ? 'posture'
      : isDemoMode && isSessionActive
      ? 'demo'
      : isSessionActive
      ? 'active'
      : 'idle';

  const currentDemoPhase = DEMO_PHASES[demoPhaseIndex];

  const hrvBorderColor = getHrvBorderColor(hrv);

  return (
    <motion.div
      className="min-h-screen w-full flex flex-col md:flex-row overflow-hidden text-foreground relative"
      style={{ background: 'linear-gradient(135deg, #050505 0%, #0a0414 40%, #1A0B2E 100%)' }}
      animate={isSessionActive ? { scale: [1, 1.015, 1] } : { scale: 1 }}
      transition={isSessionActive ? { duration: 0.6, ease: 'easeInOut' } : { duration: 0.3 }}
    >
      {/* Global scanline overlay */}
      <div className="scanlines-overlay" />

      {/* Red flash overlay on motion lock */}
      <AnimatePresence>
        {isInterrupted && (
          <motion.div
            className="absolute inset-0 z-[60] pointer-events-none"
            animate={{ backgroundColor: ['rgba(180,0,0,0)', 'rgba(180,0,0,0.25)', 'rgba(180,0,0,0)', 'rgba(180,0,0,0.2)', 'rgba(180,0,0,0)'] }}
            transition={{ duration: 0.4, repeat: 3 }}
          />
        )}
      </AnimatePresence>
      {/* Provenance Modal */}
      <ProvenanceModal
        metric={provenanceMetric}
        value={
          provenanceMetric === 'HRV' ? hrv : provenanceMetric === 'STRAIN' ? strain : apm
        }
        bioSource={bioSourceConnected ? 'connected' : 'demo'}
        onClose={() => setProvenanceMetric(null)}
      />

      {/* Motion Lock Banner */}
      <AnimatePresence>
        {isInterrupted && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="absolute top-0 inset-x-0 z-50 bg-red-900/90 border-b-2 border-red-500 px-4 py-2 flex items-center justify-center gap-3"
          >
            <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
            <span className="font-terminal text-sm font-bold uppercase tracking-widest text-red-300">Motion Lock — Flow Paused</span>
            <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sovereign Presence Lost Banner */}
      <AnimatePresence>
        {presenceLost && !isInterrupted && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="absolute top-0 inset-x-0 z-50 bg-red-950/95 border-b-2 border-red-700 px-4 py-2 flex items-center justify-center gap-3"
          >
            <EyeOff className="w-4 h-4 text-red-400 animate-pulse" />
            <span className="font-terminal text-sm font-bold uppercase tracking-widest text-red-300">
              Sovereign Presence Lost — Flow Paused
            </span>
            <EyeOff className="w-4 h-4 text-red-400 animate-pulse" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Posture Warning Banner */}
      <AnimatePresence>
        {camera.postureWarning && isSessionActive && !presenceLost && !isInterrupted && !isDemoMode && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="absolute top-0 inset-x-0 z-50 bg-yellow-950/95 border-b-2 border-yellow-600 px-4 py-2 flex items-center justify-center gap-3"
          >
            <AlertTriangle className="w-4 h-4 text-yellow-400 animate-pulse" />
            <span className="font-terminal text-sm font-bold uppercase tracking-widest text-yellow-300">
              Posture Warning — Straighten Up
            </span>
            <AlertTriangle className="w-4 h-4 text-yellow-400 animate-pulse" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── DEMO MODE TOOLTIP OVERLAY ─── */}
      <AnimatePresence>
        {isDemoMode && isSessionActive && currentDemoPhase && (
          <motion.div
            key={currentDemoPhase.step}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="absolute bottom-0 inset-x-0 z-50 px-4 py-4"
            style={{ background: 'linear-gradient(0deg, rgba(16,12,48,0.98) 0%, rgba(16,12,48,0.92) 100%)', borderTop: '1px solid rgba(139,92,246,0.35)' }}
          >
            <div className="max-w-lg mx-auto">
              {/* Step dots */}
              <div className="flex items-center gap-1.5 mb-2.5">
                {DEMO_PHASES.map((p, i) => (
                  <div
                    key={p.step}
                    className={cn(
                      'h-1.5 rounded-full transition-all duration-500',
                      i <= demoPhaseIndex ? 'bg-violet-400 w-8' : 'bg-violet-400/20 w-3'
                    )}
                  />
                ))}
                <span className="font-terminal text-sm font-semibold text-violet-300/70 ml-2">
                  Step {currentDemoPhase.step}/{DEMO_PHASES.length}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <Zap className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <span className="font-terminal text-sm font-bold text-violet-300 mr-2">
                    ✦ {currentDemoPhase.label}
                  </span>
                  <span className="font-terminal text-sm text-muted-foreground">
                    {currentDemoPhase.msg}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filing tooltip overlay */}
      <AnimatePresence>
        {isFiling && filingPhase && (
          <motion.div
            key={filingPhase}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="absolute bottom-0 inset-x-0 z-50 px-4 py-4"
            style={{ background: 'linear-gradient(0deg, rgba(16,12,48,0.98) 0%, rgba(16,12,48,0.92) 100%)', borderTop: '1px solid rgba(139,92,246,0.35)' }}
          >
            <div className="max-w-lg mx-auto flex items-center gap-3">
              <HardDrive className="w-4 h-4 text-violet-400 animate-bounce flex-shrink-0" />
              <div>
                <span className="font-terminal text-sm font-bold text-violet-300 mr-2">✦ Saving to Filecoin…</span>
                <span className="font-terminal text-sm text-muted-foreground">{filingPhase}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════ LEFT PANE: LIVING ROOM ═══════════════ */}
      <motion.div
        className="w-full md:w-1/2 h-[50vh] md:h-screen relative border-b md:border-b-0 md:border-r overflow-hidden flex flex-col backdrop-blur-xl"
        style={{
          boxShadow: `inset -1px 0 0 0 ${
            isInterrupted || presenceLost ? '#ef444440' : hrvBorderColor + '40'
          }`,
          background: 'linear-gradient(160deg, rgba(20, 16, 56, 0.75) 0%, rgba(13, 10, 40, 0.85) 100%)',
        }}
        animate={{ borderColor: isInterrupted || presenceLost ? '#ef4444' : hrvBorderColor }}
        transition={{ duration: 1.5, ease: 'easeInOut' }}
      >
        {/* Aurora blobs behind content */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="aurora-blob aurora-blob-1" style={{ opacity: 0.12 }} />
          <div className="aurora-blob aurora-blob-2" style={{ opacity: 0.08 }} />
        </div>

        {/* Header */}
        <div className="relative z-10 p-4 sm:p-6 flex justify-between items-start">
          <div>
            <h2 className="font-terminal text-sm sm:text-base font-bold uppercase tracking-widest mb-1">
              {isDemoMode ? (
                <motion.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="text-primary"
                >
                  ⚡ Demo Mode
                </motion.span>
              ) : 'Sovereign Vault'}
            </h2>
            <div className="flex items-center gap-2 text-sm font-terminal text-muted-foreground">
              <ShieldCheck className="w-3 h-3 text-primary" />
              ID: {truncateHash(nullifierHash)}
              {bioSourceConnected && (
                <span className="text-green-400 ml-1">· WHOOP ✓</span>
              )}
              {!bioSourceConnected && (
                <span className="text-yellow-500/70 ml-1">· DEMO</span>
              )}
            </div>
            {/* AURA-AGENT-V1 Identity Badge */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <motion.div
                className="flex items-center gap-1.5 px-3 py-1 border border-violet-400/30 bg-violet-500/8 rounded-full w-fit"
                animate={{ borderColor: ['rgba(139,92,246,0.3)', 'rgba(139,92,246,0.6)', 'rgba(139,92,246,0.3)'] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Package className="w-2.5 h-2.5 text-violet-400" />
                <span className="font-pixel text-[7px] text-violet-300 tracking-widest">AURA-AGENT-V1</span>
                <span className="font-pixel text-[7px] text-muted-foreground/50">·</span>
                <span className="font-pixel text-[7px] text-rose-300/80 tracking-wider">ERC-8004</span>
              </motion.div>
            </div>
            {/* Wellness XP progress bar — always visible in header */}
            {(() => {
              const xp = wellnessCoach.totalXP;
              const level = Math.floor(xp / 100);
              const progress = xp % 100;
              return (
                <div className="mt-2 flex items-center gap-2">
                  <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400 flex-shrink-0" />
                  <div className="flex-1 flex items-center gap-1.5">
                    <div className="relative flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-400 to-amber-300"
                        animate={{ width: `${progress}%` }}
                        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                      />
                    </div>
                    <motion.span
                      key={xp}
                      initial={{ scale: 1.3, color: '#fcd34d' }}
                      animate={{ scale: 1, color: '#d97706' }}
                      transition={{ duration: 0.4 }}
                      className="font-pixel text-[7px] text-amber-600 tabular-nums w-12 text-right"
                    >
                      {xp} XP
                    </motion.span>
                  </div>
                  {level > 0 && (
                    <span className="font-pixel text-[6px] text-amber-400/70 border border-amber-400/30 px-1 py-px rounded-sm">
                      LVL {level}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
          <button
            onClick={onLogout}
            className="p-2 bg-card border-2 border-muted hover:border-accent text-muted-foreground hover:text-accent transition-colors cursor-pointer"
            title="Lock Vault"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Companion Avatar — AURA Orb */}
        <div className="relative z-10 flex-1 flex items-center justify-center">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="relative flex flex-col items-center gap-4"
          >
            <AuraOrb
              state={
                companionState === 'signing' ? 'signing'
                  : companionState === 'presence-lost' ? 'warning'
                  : companionState === 'posture' ? 'warning'
                  : companionState === 'demo' ? 'demo'
                  : isSessionActive ? 'active'
                  : 'idle'
              }
              size="lg"
            />
            {/* State label beneath orb */}
            <AnimatePresence mode="wait">
              {companionState === 'signing' && (
                <motion.div
                  key="signing"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="font-terminal text-sm font-semibold text-violet-300 px-3 py-1 rounded-full bg-violet-500/15 border border-violet-400/30"
                >
                  ✦ AURA Signing…
                </motion.div>
              )}
              {companionState === 'demo' && (
                <motion.div
                  key="demo"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: [0.8, 1, 0.8] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="font-terminal text-sm font-semibold text-violet-300 px-3 py-1 rounded-full bg-violet-500/15 border border-violet-400/30"
                >
                  ✦ Demo Mode
                </motion.div>
              )}
              {companionState === 'posture' && (
                <motion.div
                  key="posture"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: [0, 1, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.7, repeat: Infinity }}
                  className="font-terminal text-sm font-semibold text-amber-300 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30"
                >
                  💛 Sit up straight!
                </motion.div>
              )}
              {companionState === 'presence-lost' && (
                <motion.div
                  key="presence"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="font-terminal text-sm font-semibold text-rose-300 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-400/30"
                >
                  👁 Come back!
                </motion.div>
              )}
              {isSessionActive && companionState === 'idle' && (
                <motion.div
                  key="active"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="font-terminal text-sm font-semibold text-emerald-300 px-3 py-1 rounded-full bg-emerald-500/12 border border-emerald-400/25"
                >
                  🌿 In the zone
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Camera Lens */}
        <CameraLens camera={camera} isSessionActive={isSessionActive} />

        {/* Bio-Markers with Provenance Badges */}
        <div className="relative z-10 p-4 sm:p-8 flex gap-4">
          <PixelPanel className="flex-1">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 font-terminal text-sm font-bold uppercase tracking-widest text-muted-foreground">
                <Activity className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                HRV
                <span className="font-terminal text-sm font-normal text-muted-foreground/50 normal-case tracking-normal">ms</span>
              </div>
              <ProvBadge onClick={() => setProvenanceMetric('HRV')} />
            </div>
            <div className="flex items-baseline gap-1">
              <AnimatedNumber value={hrv} className="text-4xl font-terminal font-bold text-primary text-shadow-violet" />
            </div>
          </PixelPanel>
          <PixelPanel className="flex-1">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 font-terminal text-sm font-bold uppercase tracking-widest text-muted-foreground">
                <Brain className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                STRAIN
              </div>
              <ProvBadge onClick={() => setProvenanceMetric('STRAIN')} />
            </div>
            <div className="flex items-baseline gap-1">
              <AnimatedNumber value={strain} className="text-4xl font-terminal font-bold text-foreground" />
              <span className="font-terminal text-sm font-bold text-muted-foreground/60">/21</span>
            </div>
          </PixelPanel>
        </div>
      </motion.div>

      {/* ═══════════════ RIGHT PANE: LEDGER ═══════════════ */}
      <motion.div
        className="w-full md:w-1/2 h-[50vh] md:h-screen flex flex-col backdrop-blur-xl border-l"
        style={{
          background: 'linear-gradient(160deg, rgba(16, 12, 48, 0.80) 0%, rgba(20, 14, 50, 0.90) 100%)',
          borderColor: isInterrupted || presenceLost ? '#ef4444' : hrvBorderColor,
        }}
        animate={{ borderColor: isInterrupted || presenceLost ? '#ef4444' : hrvBorderColor }}
        transition={{ duration: 1.5, ease: 'easeInOut' }}
      >

        {/* Timer & Stats */}
        <div
          className="p-4 sm:p-8 border-b-4"
          style={{ borderColor: isInterrupted || presenceLost ? '#ef444440' : hrvBorderColor + '30' }}
        >
          <div className="flex justify-between items-end mb-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-primary flex-shrink-0" />
                {isDemoMode ? (
                  <span className="font-terminal text-sm font-bold uppercase tracking-widest text-primary animate-pulse">Demo Session</span>
                ) : (
                  <span className="font-terminal text-sm font-bold uppercase tracking-widest text-muted-foreground">
                    Focus Timer
                    {isSessionActive && motionLock.violationCount > 0 && (
                      <span className="text-red-400 ml-2">⚡ {motionLock.violationCount}</span>
                    )}
                  </span>
                )}
              </div>
              <div
                className={cn(
                  'text-5xl sm:text-7xl font-pixel leading-none tracking-tight transition-colors duration-500',
                  isInterrupted || presenceLost
                    ? 'text-red-500'
                    : isDemoMode && isSessionActive
                    ? 'text-primary text-shadow-neon'
                    : isSessionActive
                    ? 'text-primary text-shadow-neon'
                    : 'text-foreground/80'
                )}
              >
                {formatTime(timeLeft)}
              </div>
            </div>
            <div className="text-right pb-2 flex flex-col gap-1 items-end">
              <div className="flex items-center justify-end gap-1.5 mb-1">
                <MousePointer2 className="w-3.5 h-3.5 text-primary" />
                <span className="font-terminal text-sm font-bold uppercase tracking-widest text-muted-foreground">APM</span>
                <ProvBadge onClick={() => setProvenanceMetric('APM')} />
              </div>
              <AnimatedNumber value={apm} className="text-3xl sm:text-4xl font-terminal font-bold text-primary text-shadow-neon" />
              {isSessionActive && (
                <div
                  className={cn(
                    'flex items-center gap-1 font-terminal text-sm font-bold mt-1',
                    motionLock.physicalIntegrity && camera.faceDetected
                      ? 'text-primary'
                      : 'text-red-400'
                  )}
                >
                  <Shield className="w-3 h-3" />
                  {motionLock.physicalIntegrity && camera.faceDetected
                    ? 'INTEGRITY OK'
                    : presenceLost
                    ? 'PRESENCE LOST'
                    : 'INTEGRITY LOST'}
                </div>
              )}
              {isSessionActive && camera.isActive && camera.faceDetected && camera.secondsUntilLock < 4 && (
                <div className="font-terminal text-sm font-bold text-yellow-400 mt-0.5">
                  ⏳ {camera.secondsUntilLock}s
                </div>
              )}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {isFiling ? (
              <motion.div
                key="filing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="w-full bg-primary/20 border-2 border-primary p-4 flex flex-col items-center justify-center gap-2 text-primary font-terminal text-sm font-bold uppercase tracking-widest"
              >
                <div className="flex items-center gap-3">
                  <HardDrive className="w-4 h-4 animate-bounce" />
                  {filingPhase ?? 'AURA AGENT SIGNING & FILING TO FILECOIN...'}
                </div>
                <p className="font-terminal text-sm text-primary/60">ERC-8004 · SYNAPSE SDK</p>
              </motion.div>
            ) : (
              <motion.div key="controls" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-2">
                {/* Main session button — only shown when not in demo mode */}
                {!isDemoMode && (
                  <PixelButton
                    onClick={toggleTimer}
                    variant={isSessionActive ? 'danger' : 'primary'}
                    className="w-full text-lg"
                  >
                    {isSessionActive ? 'ABORT FLOW' : 'ENGAGE FLOW'}
                  </PixelButton>
                )}

                {/* Demo mode button — always visible when idle */}
                {!isSessionActive && !isDemoMode && (
                  <button
                    onClick={startDemoMode}
                    className="w-full px-4 py-3 border-2 border-primary/60 font-terminal text-sm font-bold uppercase tracking-wider text-primary/80 hover:border-primary hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Zap className="w-3 h-3" />
                    ⚡ DEMO MODE — 60s GUIDED WALKTHROUGH
                  </button>
                )}

                {/* Abort demo */}
                {isDemoMode && isSessionActive && (
                  <PixelButton
                    onClick={() => { setIsSessionActive(false); setIsDemoMode(false); setTimeLeft(POMODORO_TIME); isDemoRef.current = false; }}
                    variant="danger"
                    className="w-full"
                  >
                    ABORT DEMO
                  </PixelButton>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Tab bar: LEDGER / AURA CHAT */}
        <div className="flex border-b-2 border-secondary/30">
          <button
            onClick={() => setRightTab('ledger')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 font-terminal text-sm font-bold uppercase tracking-widest transition-colors cursor-pointer',
              rightTab === 'ledger'
                ? 'text-primary border-b-2 border-primary -mb-0.5 bg-primary/5'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Ledger
            {receipts && receipts.length > 0 && (
              <span className="font-terminal text-sm font-normal text-muted-foreground/60">({receipts.length})</span>
            )}
          </button>
          <button
            onClick={() => setRightTab('chat')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 font-terminal text-sm font-bold uppercase tracking-widest transition-colors cursor-pointer',
              rightTab === 'chat'
                ? 'text-accent border-b-2 border-accent -mb-0.5 bg-accent/5'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            AURA Chat
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {rightTab === 'ledger' ? (
            /* Receipt Log */
            <div className="flex-1 flex flex-col p-4 sm:p-8 overflow-hidden">
              <h3 className="font-terminal text-sm font-bold uppercase tracking-widest mb-4 text-muted-foreground border-b-2 border-secondary/30 pb-2.5 flex items-center gap-2">
                Proof Chain Receipts
                <span className="font-pixel text-[7px] text-muted-foreground/40">ERC-8004</span>
              </h3>

              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
                {isReceiptsLoading ? (
                  <div className="text-center font-terminal text-muted-foreground py-8 animate-pulse">
                    SYNCING LEDGER...
                  </div>
                ) : receipts && receipts.length > 0 ? (
                  [...receipts].reverse().map((receipt, i) => (
                    <ReceiptChainCard
                      key={receipt.id}
                      receipt={receipt}
                      index={i}
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <div className="font-terminal text-sm font-bold text-muted-foreground/50 border border-dashed border-secondary/30 px-4 py-4 w-full uppercase tracking-widest">
                      No Receipts Yet
                    </div>
                    <p className="font-terminal text-sm text-muted-foreground/50">
                      Complete a focus session to mint your first<br />
                      ERC-8004 Agentic Work Receipt on Filecoin.
                    </p>
                    <p className="font-terminal text-sm text-primary/60 border border-primary/20 px-3 py-2 font-bold uppercase tracking-wider">
                      ⚡ Use Demo Mode (60s) to see the full flow
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* AURA Chat */
            <AuraChat
              bioContext={{
                hrv,
                strain,
                apm,
                focusScore: Math.min(100, Math.round((apm / 100) * 40 + (hrv / 120) * 60)),
                postureWarning: camera.postureWarning,
                isSessionActive,
                sessionDurationSeconds: POMODORO_TIME - timeLeft,
                hourOfDay: new Date().getHours(),
                sessionMinutes: Math.round((POMODORO_TIME - timeLeft) / 60),
                completedChallenges: wellnessCoach.completedChallenges.map((c) => c.challenge.type),
              }}
              nullifierHash={nullifierHash}
              onInsightSigned={(text) => void signInsightReceipt(text)}
              proactiveNudge={proactiveNudge}
              onNudgeClear={() => setProactiveNudge(null)}
              auraInjectMessage={challengeNudge}
              onAuraInjectClear={() => setChallengeNudge(null)}
              recentReceipts={(receipts ?? []).slice(-3).map((r) => ({
                receiptType: r.receiptType ?? 'work',
                hrv: (r.sessionStats as { hrv?: number }).hrv ?? 0,
                strain: (r.sessionStats as { strain?: number }).strain ?? 0,
                apm: (r.sessionStats as { apm?: number }).apm ?? 0,
                durationSeconds: (r.sessionStats as { durationSeconds?: number }).durationSeconds ?? 0,
                createdAt: r.createdAt,
                insightText: r.insightText,
              }))}
              activeChallenge={wellnessCoach.activeChallenge}
              captureFrame={camera.captureFrame}
              onChallengeComplete={(challengeId, xpAwarded) => {
                // Receipt signing is handled centrally by useWellnessCoach onComplete
                wellnessCoach.completeChallenge(challengeId, xpAwarded);
              }}
              onChallengeDismiss={wellnessCoach.dismissChallenge}
            />
          )}
        </div>

        {/* ─── SOVEREIGN EXPORT PANEL ─── */}
        <div className="border-t border-primary/20 flex-shrink-0">
          <button
            onClick={() => setExportOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 sm:px-8 py-2.5 hover:bg-primary/5 transition-colors group"
          >
            <div className="flex items-center gap-2">
              <Download className="w-3 h-3 text-primary group-hover:text-primary" />
              <span className="font-pixel text-[8px] text-primary tracking-widest">SOVEREIGN EXPORT</span>
              <span className="font-pixel text-[6px] text-muted-foreground/50 border border-muted/30 px-1 py-px">ERC-8004</span>
            </div>
            {exportOpen
              ? <ChevronUp className="w-3 h-3 text-muted-foreground/50" />
              : <ChevronDown className="w-3 h-3 text-muted-foreground/50" />
            }
          </button>

          <AnimatePresence>
            {exportOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="px-4 sm:px-8 pb-4 pt-1 flex flex-col gap-2">
                  <p className="font-terminal text-sm text-muted-foreground/60 mb-1">
                    Download verifiable agent artifacts for hackathon submission.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <ExportButton
                      label="agent.json"
                      sublabel="ERC-8004 Manifest"
                      onClick={handleDownloadAgentJson}
                    />
                    <ExportButton
                      label="agent_log.json"
                      sublabel="Execution Log"
                      onClick={handleDownloadLogsJson}
                    />
                    <ExportButton
                      label="receipts.json"
                      sublabel={`${(receipts ?? []).length} receipts`}
                      onClick={handleDownloadReceiptsJson}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Compact download button for the Sovereign Export panel */
function ExportButton({ label, sublabel, onClick }: { label: string; sublabel: string; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className="flex flex-col items-start gap-0.5 px-3 py-2.5 border border-primary/25 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all cursor-pointer text-left"
    >
      <div className="flex items-center gap-1.5">
        <Download className="w-2.5 h-2.5 text-primary flex-shrink-0" />
        <span className="font-pixel text-[7px] text-primary">{label}</span>
      </div>
      <span className="font-terminal text-sm text-muted-foreground/60 ml-4">{sublabel}</span>
    </motion.button>
  );
}

/** Small glowing green checkmark badge that opens the Provenance Modal */
function ProvBadge({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.2 }}
      whileTap={{ scale: 0.9 }}
      animate={{
        filter: [
          'drop-shadow(0 0 0px #22c55e)',
          'drop-shadow(0 0 5px #22c55e)',
          'drop-shadow(0 0 0px #22c55e)',
        ],
      }}
      transition={{ duration: 2, repeat: Infinity }}
      className="text-green-400 cursor-pointer"
      title="View Provenance Trace"
    >
      <CheckCircle2 className="w-3.5 h-3.5" />
    </motion.button>
  );
}
