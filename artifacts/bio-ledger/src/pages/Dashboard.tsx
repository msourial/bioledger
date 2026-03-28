import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
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
} from 'lucide-react';
import { useMockBioData } from '@/lib/whoop-mock';
import { useAPM } from '@/hooks/use-apm';
import { useCamera } from '@/hooks/use-camera';
import { useMotionLock } from '@/hooks/use-motion-lock';
import { PixelPanel, PixelButton, NeonText } from '@/components/PixelUI';
import CameraLens from '@/components/CameraLens';
import ProvenanceModal, { type MetricKey } from '@/components/ProvenanceModal';
import { cn, truncateHash } from '@/lib/utils';
import { signWorkReceipt, storeToFilecoin } from '@/lib/companion-agent';
import { useListReceipts, useCreateReceipt } from '@workspace/api-client-react';

interface DashboardProps {
  nullifierHash: string;
  bioSourceConnected: boolean;
  onLogout: () => void;
}

interface SessionHistoryEntry {
  id: string;
  completedAt: Date;
  apm: number;
  hrv: number;
  strain: number;
  focusScore: number;
  physicalIntegrity: boolean;
  pieceCid?: string;
}

const POMODORO_TIME = 25 * 60;

export default function Dashboard({ nullifierHash, bioSourceConnected, onLogout }: DashboardProps) {
  const { hrv, strain } = useMockBioData();
  const [isSessionActive, setIsSessionActive] = useState(false);
  const apm = useAPM(isSessionActive);

  const [timeLeft, setTimeLeft] = useState(POMODORO_TIME);
  const [isFiling, setIsFiling] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryEntry[]>([]);

  // Track physical integrity over the session
  const physicalIntegrityRef = useRef(true);

  // Provenance modal
  const [provenanceMetric, setProvenanceMetric] = useState<MetricKey | null>(null);

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

  // Reset integrity tracking when session starts
  useEffect(() => {
    if (isSessionActive) {
      physicalIntegrityRef.current = true;
    }
  }, [isSessionActive]);

  // Timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSessionActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    } else if (isSessionActive && timeLeft === 0) {
      handleSessionComplete();
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
    setIsFiling(true);

    const focusScore = Math.min(100, Math.round((apm / 100) * 40 + (hrv / 120) * 60));
    const stats = { durationSeconds: POMODORO_TIME, apm, hrv, strain, focusScore };

    const physicalIntegrity =
      physicalIntegrityRef.current &&
      motionLock.physicalIntegrity &&
      camera.faceDetected;

    const signedReceipt = await signWorkReceipt(nullifierHash, stats, strainAtSessionStart.current);
    const pieceCid = await storeToFilecoin(signedReceipt);

    const historyEntry: SessionHistoryEntry = {
      id: crypto.randomUUID(),
      completedAt: new Date(),
      ...stats,
      physicalIntegrity,
      pieceCid,
    };
    setSessionHistory((prev) => [historyEntry, ...prev]);

    createReceiptMutation.mutate(
      {
        data: {
          nullifierHash,
          sessionStats: stats,
          companionSignature: signedReceipt.companionSignature,
          receiptCid: pieceCid,
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

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const isInterrupted = motionLock.isInterrupted;

  // Companion state
  const companionState: 'signing' | 'presence-lost' | 'active' | 'idle' =
    isFiling ? 'signing' : presenceLost ? 'presence-lost' : isSessionActive ? 'active' : 'idle';

  return (
    <motion.div
      className="min-h-screen w-full bg-background scanlines flex flex-col md:flex-row overflow-hidden text-foreground relative"
      animate={
        isInterrupted
          ? { backgroundColor: ['#2D1B4E', '#4a0000', '#2D1B4E', '#4a0000', '#2D1B4E'] }
          : { backgroundColor: '#2D1B4E' }
      }
      transition={{ duration: 0.4, repeat: isInterrupted ? 3 : 0 }}
    >
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

      {/* ═══════════════ LEFT PANE: LIVING ROOM ═══════════════ */}
      <div
        className={cn(
          'w-full md:w-1/2 h-[50vh] md:h-screen relative border-b-4 md:border-b-0 md:border-r-4 overflow-hidden flex flex-col transition-colors duration-300',
          isInterrupted || presenceLost ? 'border-red-700' : 'border-secondary'
        )}
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
            <h2 className="font-pixel text-sm sm:text-base mb-1">SOVEREIGN VAULT</h2>
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
                  : companionState === 'active'
                  ? { y: [0, -10, 0], x: [0, 5, 0] }
                  : { y: [0, -10, 0], x: [0, 5, 0] }
              }
              transition={
                companionState === 'signing'
                  ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
                  : companionState === 'presence-lost'
                  ? { duration: 0.4, repeat: Infinity }
                  : { duration: 3, repeat: Infinity, ease: 'easeInOut' }
              }
              className="absolute -top-10 -right-10 w-24 h-24"
              style={
                companionState === 'signing'
                  ? { filter: 'drop-shadow(0 0 16px #00F5FF) drop-shadow(0 0 6px #00F5FF)' }
                  : companionState === 'presence-lost'
                  ? { filter: 'drop-shadow(0 0 12px #ef4444) hue-rotate(300deg)' }
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
          <PixelPanel className="flex-1 bg-card/80 backdrop-blur-md">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-muted-foreground font-pixel text-[10px]">
                <Activity className="w-3 h-3 text-accent" />
                HRV (ms)
              </div>
              <ProvBadge onClick={() => setProvenanceMetric('HRV')} />
            </div>
            <div className="text-3xl font-terminal font-bold">
              <NeonText color="magenta">{hrv}</NeonText>
            </div>
          </PixelPanel>
          <PixelPanel className="flex-1 bg-card/80 backdrop-blur-md">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-muted-foreground font-pixel text-[10px]">
                <Brain className="w-3 h-3 text-accent" />
                STRAIN
              </div>
              <ProvBadge onClick={() => setProvenanceMetric('STRAIN')} />
            </div>
            <div className="text-3xl font-terminal font-bold text-foreground">
              {strain}
              <span className="text-xs text-muted-foreground ml-1">/21</span>
            </div>
          </PixelPanel>
        </div>
      </div>

      {/* ═══════════════ RIGHT PANE: LEDGER ═══════════════ */}
      <div className="w-full md:w-1/2 h-[50vh] md:h-screen flex flex-col bg-background/95">

        {/* Timer & Stats */}
        <div className="p-4 sm:p-8 border-b-4 border-secondary/30">
          <div className="flex justify-between items-end mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2 text-muted-foreground font-pixel text-[10px]">
                <Clock className="w-4 h-4 text-primary" />
                FOCUS TIMER
                {isSessionActive && motionLock.violationCount > 0 && (
                  <span className="text-red-400 ml-1">⚡ {motionLock.violationCount}</span>
                )}
              </div>
              <div
                className={cn(
                  'text-6xl sm:text-8xl font-terminal font-bold transition-colors duration-500',
                  isInterrupted || presenceLost
                    ? 'text-red-500'
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
              <div className="text-2xl sm:text-4xl font-terminal text-primary">{apm}</div>
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
                    ? `PRESENCE LOST`
                    : 'INTEGRITY LOST'}
                </div>
              )}
              {/* Countdown before presence lock */}
              {isSessionActive && camera.isActive && camera.faceDetected && camera.secondsUntilLock < 20 && (
                <div className="font-pixel text-[8px] text-yellow-400 mt-0.5">
                  ⏳ {camera.secondsUntilLock}s
                </div>
              )}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {isFiling ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="w-full bg-primary/20 border-2 border-primary p-4 flex flex-col items-center justify-center gap-2 text-primary font-pixel text-xs"
              >
                <div className="flex items-center gap-3">
                  <HardDrive className="w-4 h-4 animate-bounce" />
                  AURA AGENT SIGNING & FILING TO FILECOIN...
                </div>
                <p className="text-[8px] text-primary/60">ERC-8004 · SYNAPSE SDK</p>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <PixelButton
                  onClick={toggleTimer}
                  variant={isSessionActive ? 'danger' : 'primary'}
                  className="w-full text-lg"
                >
                  {isSessionActive ? 'ABORT FLOW' : 'ENGAGE FLOW'}
                </PixelButton>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Receipt Log */}
        <div className="flex-1 flex flex-col p-4 sm:p-8 overflow-hidden">
          {/* Local session history */}
          {sessionHistory.length > 0 && (
            <div className="mb-4">
              <h3 className="font-pixel text-[10px] mb-2 text-accent border-b-2 border-accent/20 pb-1">
                SESSION HISTORY (THIS VAULT)
              </h3>
              <div className="flex flex-col gap-1">
                {sessionHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-col bg-accent/5 border-l-2 border-accent px-3 py-1.5 gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-terminal text-xs text-muted-foreground">
                        {format(entry.completedAt, 'HH:mm')}
                      </span>
                      <span className="font-terminal text-xs">
                        Score <NeonText>{entry.focusScore}</NeonText>
                      </span>
                      <span className="font-terminal text-xs text-muted-foreground">
                        APM {entry.apm} · HRV {entry.hrv}
                      </span>
                      <span
                        className={cn(
                          'font-pixel text-[8px]',
                          entry.physicalIntegrity ? 'text-primary' : 'text-red-400'
                        )}
                      >
                        {entry.physicalIntegrity ? '✓ INT' : '✗ INT'}
                      </span>
                    </div>
                    {entry.pieceCid && (
                      <div className="font-terminal text-[9px] text-muted-foreground/50 break-all">
                        <span className="text-primary mr-1">PIECE CID:</span>
                        {entry.pieceCid}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <h3 className="font-pixel text-xs sm:text-sm mb-4 text-muted-foreground border-b-2 border-secondary/30 pb-2">
            AGENTIC WORK RECEIPTS (ERC-8004)
          </h3>

          <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3">
            {isReceiptsLoading ? (
              <div className="text-center font-terminal text-muted-foreground py-8 animate-pulse">
                SYNCING LEDGER...
              </div>
            ) : receipts && receipts.length > 0 ? (
              receipts.map((receipt) => (
                <div
                  key={receipt.id}
                  className="bg-card border-l-4 border-primary p-4 hover:bg-card/80 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-terminal text-xs text-muted-foreground">
                      {format(new Date(receipt.createdAt), 'MMM dd, yyyy HH:mm')}
                    </span>
                    <div className="flex items-center gap-2">
                      {receipt.physicalIntegrity !== undefined && (
                        <span
                          className={cn(
                            'font-pixel text-[7px] px-1.5 py-0.5 border',
                            receipt.physicalIntegrity
                              ? 'bg-primary/10 text-primary border-primary/30'
                              : 'bg-red-900/20 text-red-400 border-red-700/30'
                          )}
                        >
                          {receipt.physicalIntegrity ? '⬡ INTEGRITY' : '⚠ DISRUPTED'}
                        </span>
                      )}
                      <span className="font-pixel text-[8px] px-2 py-1 bg-primary/10 text-primary border border-primary/30">
                        VERIFIED
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="font-terminal text-lg">
                      Dur: <span className="text-foreground">{Math.round(receipt.sessionStats.durationSeconds / 60)}m</span>
                    </div>
                    <div className="font-terminal text-lg">
                      APM: <span className="text-foreground">{receipt.sessionStats.apm}</span>
                    </div>
                    <div className="font-terminal text-lg">
                      HRV: <span className="text-accent">{receipt.sessionStats.hrv}</span>
                    </div>
                    <div className="font-terminal text-lg">
                      Score: <NeonText>{receipt.sessionStats.focusScore}</NeonText>
                    </div>
                  </div>
                  <div className="bg-background/50 p-2 font-terminal text-[10px] sm:text-xs text-muted-foreground break-all rounded-sm border border-secondary/20 space-y-1">
                    <div className="flex gap-2">
                      <span className="text-accent flex-shrink-0">SIG:</span>
                      {truncateHash(receipt.companionSignature)}
                    </div>
                    {receipt.receiptCid && (
                      <div className="flex gap-2">
                        <span className="text-primary flex-shrink-0">PIECE CID:</span>
                        {receipt.receiptCid}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center font-terminal text-muted-foreground py-8">
                NO RECEIPTS FOUND. ENGAGE FLOW TO BEGIN.
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
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
