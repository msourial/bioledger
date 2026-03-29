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
} from 'lucide-react';
import { useMockBioData } from '@/lib/whoop-mock';
import { useAPM } from '@/hooks/use-apm';
import { useCamera } from '@/hooks/use-camera';
import { useMotionLock } from '@/hooks/use-motion-lock';
import { PixelPanel, PixelButton, NeonText } from '@/components/PixelUI';
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

/** Lerp HRV value → neon-cyan (#00F5FF) at ≥70ms, magenta (#FF00CC) at <55ms */
function getHrvBorderColor(hrv: number): string {
  if (hrv >= 70) return '#00F5FF';
  if (hrv <= 55) return '#FF00CC';
  const t = (hrv - 55) / 15; // 0..1
  // interpolate hue: 182 (cyan) → 311 (magenta)
  const h = Math.round(182 + (1 - t) * 129);
  return `hsl(${h}, 100%, 55%)`;
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
            <span className="font-pixel text-xs text-red-300">MOTION LOCK TRIGGERED — FLOW PAUSED</span>
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
            <span className="font-pixel text-[10px] text-red-300">
              SOVEREIGN PRESENCE LOST — FLOW PAUSED
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
            <span className="font-pixel text-[10px] text-yellow-300">
              POSTURE WARNING — STRAIGHTEN UP
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
            className="absolute bottom-0 inset-x-0 z-50 bg-background/95 border-t-2 border-primary/50 px-4 py-3"
          >
            <div className="max-w-lg mx-auto">
              {/* Step dots */}
              <div className="flex items-center gap-1 mb-2">
                {DEMO_PHASES.map((p, i) => (
                  <div
                    key={p.step}
                    className={cn(
                      'h-1 rounded-full transition-all duration-500',
                      i <= demoPhaseIndex ? 'bg-primary w-6' : 'bg-secondary/40 w-3'
                    )}
                  />
                ))}
                <span className="font-pixel text-[7px] text-muted-foreground/60 ml-2">
                  STEP {currentDemoPhase.step}/{DEMO_PHASES.length}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <Zap className="w-4 h-4 text-primary flex-shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <span className="font-pixel text-[9px] text-primary mr-2">
                    ⬡ {currentDemoPhase.label}
                  </span>
                  <span className="font-terminal text-xs text-muted-foreground">
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
            className="absolute bottom-0 inset-x-0 z-50 bg-background/95 border-t-2 border-primary/50 px-4 py-3"
          >
            <div className="max-w-lg mx-auto flex items-center gap-3">
              <HardDrive className="w-4 h-4 text-primary animate-bounce flex-shrink-0" />
              <div>
                <span className="font-pixel text-[9px] text-primary mr-2">⬡ STORAGE</span>
                <span className="font-terminal text-xs text-muted-foreground">{filingPhase}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════ LEFT PANE: LIVING ROOM ═══════════════ */}
      <motion.div
        className="w-full md:w-1/2 h-[50vh] md:h-screen relative border-b md:border-b-0 md:border-r overflow-hidden flex flex-col"
        style={{
          borderColor: isInterrupted || presenceLost
            ? '#ef4444'
            : camera.postureWarning
            ? '#facc15'
            : isDemoMode
            ? '#00F5FF'
            : hrvBorderColor,
          boxShadow: `inset -1px 0 0 0 ${
            isInterrupted || presenceLost ? '#ef444440' : hrvBorderColor + '30'
          }`,
          background: 'rgba(5, 2, 15, 0.6)',
          backdropFilter: 'blur(12px)',
        }}
        animate={{ borderColor: isInterrupted || presenceLost ? '#ef4444' : hrvBorderColor }}
        transition={{ duration: 1.5, ease: 'easeInOut' }}
      >
        <div className="absolute inset-0 z-0">
          <img
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
            alt="Room Background"
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        </div>

        {/* Header */}
        <div className="relative z-10 p-4 sm:p-6 flex justify-between items-start">
          <div>
            <h2 className="font-pixel text-sm sm:text-base mb-1">
              {isDemoMode ? (
                <motion.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="text-primary"
                >
                  ⚡ DEMO MODE
                </motion.span>
              ) : 'SOVEREIGN VAULT'}
            </h2>
            <div className="flex items-center gap-2 text-[10px] font-pixel text-muted-foreground">
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
            <motion.div
              className="flex items-center gap-1.5 mt-2 px-2 py-0.5 border border-primary/30 bg-primary/5 w-fit"
              animate={{ borderColor: ['rgba(0,245,255,0.3)', 'rgba(0,245,255,0.6)', 'rgba(0,245,255,0.3)'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Package className="w-2.5 h-2.5 text-primary" />
              <span className="font-pixel text-[7px] text-primary tracking-widest">AURA-AGENT-V1</span>
              <span className="font-pixel text-[7px] text-muted-foreground/50">·</span>
              <span className="font-pixel text-[7px] text-accent/80 tracking-wider">ERC-8004</span>
            </motion.div>
          </div>
          <button
            onClick={onLogout}
            className="p-2 bg-card border-2 border-muted hover:border-accent text-muted-foreground hover:text-accent transition-colors cursor-pointer"
            title="Lock Vault"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Companion Avatar */}
        <div className="relative z-10 flex-1 flex items-center justify-center">
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="relative"
          >
            <img
              src={`${import.meta.env.BASE_URL}images/avatar.png`}
              alt="User Avatar"
              className="w-48 h-48 sm:w-64 sm:h-64 object-contain filter drop-shadow-[0_0_15px_rgba(112,41,99,0.5)]"
            />

            {/* Companion AI Robot — state-aware animation */}
            <motion.div
              animate={
                companionState === 'signing'
                  ? { y: [0, -15, 0, -10, 0], x: [0, 8, -8, 4, 0], scale: [1, 1.15, 1, 1.1, 1] }
                  : companionState === 'presence-lost'
                  ? { rotate: [0, -5, 5, -5, 0] }
                  : companionState === 'posture'
                  ? { rotate: [0, -3, 3, -2, 0], y: [0, 3, 0] }
                  : companionState === 'demo'
                  ? { y: [0, -12, 0], x: [0, 6, -6, 0], scale: [1, 1.08, 1] }
                  : { y: [0, -10, 0], x: [0, 5, 0] }
              }
              transition={
                companionState === 'signing'
                  ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
                  : companionState === 'presence-lost'
                  ? { duration: 0.4, repeat: Infinity }
                  : companionState === 'posture'
                  ? { duration: 0.8, repeat: Infinity }
                  : companionState === 'demo'
                  ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
                  : { duration: 3, repeat: Infinity, ease: 'easeInOut' }
              }
              className="absolute -top-10 -right-10 w-24 h-24"
              style={
                companionState === 'signing'
                  ? { filter: 'drop-shadow(0 0 16px #00F5FF) drop-shadow(0 0 6px #00F5FF)' }
                  : companionState === 'presence-lost'
                  ? { filter: 'drop-shadow(0 0 12px #ef4444) hue-rotate(300deg)' }
                  : companionState === 'posture'
                  ? { filter: 'drop-shadow(0 0 10px #facc15) sepia(0.8)' }
                  : companionState === 'demo'
                  ? { filter: 'drop-shadow(0 0 20px #00F5FF) drop-shadow(0 0 8px #702963)' }
                  : {}
              }
            >
              <img
                src={`${import.meta.env.BASE_URL}images/companion.png`}
                alt="Companion AI"
                className="w-full h-full object-contain"
              />
              {/* Signing badge */}
              {companionState === 'signing' && (
                <motion.div
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap font-pixel text-[7px] text-primary bg-background/90 px-2 py-0.5 border border-primary/50"
                >
                  SIGNING...
                </motion.div>
              )}
              {/* Demo badge */}
              {companionState === 'demo' && (
                <motion.div
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                  className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap font-pixel text-[7px] text-primary bg-background/90 px-2 py-0.5 border border-primary/50"
                >
                  DEMO
                </motion.div>
              )}
              {/* Posture warning badge */}
              {companionState === 'posture' && (
                <motion.div
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                  className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap font-pixel text-[7px] text-yellow-400 bg-background/90 px-2 py-0.5 border border-yellow-600/50"
                >
                  POSTURE!
                </motion.div>
              )}
              {/* Presence lost badge */}
              {companionState === 'presence-lost' && (
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap font-pixel text-[7px] text-red-400 bg-background/90 px-2 py-0.5 border border-red-700/50">
                  NO PRESENCE
                </div>
              )}
            </motion.div>
          </motion.div>
        </div>

        {/* Camera Lens */}
        <CameraLens camera={camera} isSessionActive={isSessionActive} />

        {/* Bio-Markers with Provenance Badges */}
        <div className="relative z-10 p-4 sm:p-8 flex gap-4">
          <PixelPanel className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-muted-foreground font-pixel text-[10px]">
                <Activity className="w-3 h-3 text-accent" />
                HRV (ms)
              </div>
              <ProvBadge onClick={() => setProvenanceMetric('HRV')} />
            </div>
            <div className="text-3xl font-terminal font-bold">
              <AnimatedNumber value={hrv} className="text-accent text-shadow-magenta" />
            </div>
          </PixelPanel>
          <PixelPanel className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-muted-foreground font-pixel text-[10px]">
                <Brain className="w-3 h-3 text-accent" />
                STRAIN
              </div>
              <ProvBadge onClick={() => setProvenanceMetric('STRAIN')} />
            </div>
            <div className="text-3xl font-terminal font-bold text-foreground">
              <AnimatedNumber value={strain} className="text-foreground" />
              <span className="text-xs text-muted-foreground ml-1">/21</span>
            </div>
          </PixelPanel>
        </div>
      </motion.div>

      {/* ═══════════════ RIGHT PANE: LEDGER ═══════════════ */}
      <div
        className="w-full md:w-1/2 h-[50vh] md:h-screen flex flex-col"
        style={{
          background: 'rgba(8, 3, 20, 0.55)',
          backdropFilter: 'blur(16px)',
        }}
      >

        {/* Timer & Stats */}
        <div className="p-4 sm:p-8 border-b-4 border-secondary/30">
          <div className="flex justify-between items-end mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2 text-muted-foreground font-pixel text-[10px]">
                <Clock className="w-4 h-4 text-primary" />
                {isDemoMode ? (
                  <span className="text-primary animate-pulse">DEMO SESSION</span>
                ) : (
                  <>
                    FOCUS TIMER
                    {isSessionActive && motionLock.violationCount > 0 && (
                      <span className="text-red-400 ml-1">⚡ {motionLock.violationCount}</span>
                    )}
                  </>
                )}
              </div>
              <div
                className={cn(
                  'text-6xl sm:text-8xl font-terminal font-bold transition-colors duration-500',
                  isInterrupted || presenceLost
                    ? 'text-red-500'
                    : isDemoMode && isSessionActive
                    ? 'text-primary text-shadow-neon'
                    : isSessionActive
                    ? 'text-primary text-shadow-neon'
                    : 'text-foreground'
                )}
              >
                {formatTime(timeLeft)}
              </div>
            </div>
            <div className="text-right pb-2 flex flex-col gap-1 items-end">
              <div className="flex items-center justify-end gap-1 mb-1 text-muted-foreground font-pixel text-[10px]">
                <MousePointer2 className="w-3 h-3 text-primary" />
                APM
                <ProvBadge onClick={() => setProvenanceMetric('APM')} />
              </div>
              <AnimatedNumber value={apm} className="text-2xl sm:text-4xl font-terminal text-primary text-shadow-neon" />
              {isSessionActive && (
                <div
                  className={cn(
                    'flex items-center gap-1 font-pixel text-[8px] mt-1',
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
                <div className="font-pixel text-[8px] text-yellow-400 mt-0.5">
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
                className="w-full bg-primary/20 border-2 border-primary p-4 flex flex-col items-center justify-center gap-2 text-primary font-pixel text-xs"
              >
                <div className="flex items-center gap-3">
                  <HardDrive className="w-4 h-4 animate-bounce" />
                  {filingPhase ?? 'AURA AGENT SIGNING & FILING TO FILECOIN...'}
                </div>
                <p className="text-[8px] text-primary/60">ERC-8004 · SYNAPSE SDK</p>
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
                    className="w-full px-4 py-3 border-2 border-primary/60 font-pixel text-[10px] text-primary/80 hover:border-primary hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer flex items-center justify-center gap-2"
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
              'flex-1 flex items-center justify-center gap-1.5 py-2 font-pixel text-[9px] transition-colors cursor-pointer',
              rightTab === 'ledger'
                ? 'text-primary border-b-2 border-primary -mb-0.5 bg-primary/5'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <BookOpen className="w-3 h-3" />
            LEDGER
            {receipts && receipts.length > 0 && (
              <span className="font-terminal text-[8px] text-muted-foreground/60">({receipts.length})</span>
            )}
          </button>
          <button
            onClick={() => setRightTab('chat')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 font-pixel text-[9px] transition-colors cursor-pointer',
              rightTab === 'chat'
                ? 'text-accent border-b-2 border-accent -mb-0.5 bg-accent/5'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <MessageSquare className="w-3 h-3" />
            AURA CHAT
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {rightTab === 'ledger' ? (
            /* Receipt Log */
            <div className="flex-1 flex flex-col p-4 sm:p-8 overflow-hidden">
              <h3 className="font-pixel text-xs sm:text-sm mb-4 text-muted-foreground border-b-2 border-secondary/30 pb-2 flex items-center gap-2">
                PROOF CHAIN RECEIPTS
                <span className="font-pixel text-[7px] text-muted-foreground/50">ERC-8004</span>
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
                      isDemo={receipt.isDemo ?? false}
                      index={i}
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <div className="font-pixel text-[9px] text-muted-foreground/50 border border-dashed border-secondary/30 px-4 py-4 w-full">
                      NO RECEIPTS YET
                    </div>
                    <p className="font-terminal text-xs text-muted-foreground/50">
                      Complete a focus session to mint your first<br />
                      ERC-8004 Agentic Work Receipt on Filecoin.
                    </p>
                    <p className="font-pixel text-[8px] text-primary/60 border border-primary/20 px-3 py-2">
                      ⚡ USE DEMO MODE (60s) TO SEE THE FULL FLOW
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
              }}
              nullifierHash={nullifierHash}
              onInsightSigned={(text) => void signInsightReceipt(text)}
              proactiveNudge={proactiveNudge}
              onNudgeClear={() => setProactiveNudge(null)}
              recentReceipts={(receipts ?? []).slice(-3).map((r) => ({
                receiptType: r.receiptType ?? 'work',
                hrv: (r.sessionStats as { hrv?: number }).hrv ?? 0,
                strain: (r.sessionStats as { strain?: number }).strain ?? 0,
                apm: (r.sessionStats as { apm?: number }).apm ?? 0,
                durationSeconds: (r.sessionStats as { durationSeconds?: number }).durationSeconds ?? 0,
                createdAt: r.createdAt,
                insightText: r.insightText,
              }))}
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
                  <p className="font-terminal text-[10px] text-muted-foreground/60 mb-1">
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
      </div>
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
      <span className="font-terminal text-[9px] text-muted-foreground/60 ml-4">{sublabel}</span>
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
