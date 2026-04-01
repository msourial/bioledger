import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Brain, Activity, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import BrainwaveVisualizer from '@/components/BrainwaveVisualizer';

/**
 * Discreet pixelated camera orb — same style as Sovereign Lens on the main dashboard.
 * Draws from the existing video element via a 48×36 pixelated canvas.
 */
function SensorOrb({
  videoRef,
  faceDetected,
  blinkCount,
  blinkRate,
  headStability,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  faceDetected: boolean;
  blinkCount: number;
  blinkRate: number;
  headStability: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;
    const draw = () => {
      if (!running) return;
      if (video.readyState >= 2) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(video, 0, 0, 48, 36);
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    const interval = setInterval(() => { rafRef.current = requestAnimationFrame(draw); }, 66);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      clearInterval(interval);
    };
  }, [videoRef]);

  const ringColor = faceDetected ? '#8B5CF6' : '#ef4444';

  return (
    <div className="flex items-center gap-3">
      {/* Pixelated camera circle */}
      <div className="relative flex-shrink-0 w-16 h-16">
        {/* Scan ring */}
        <div
          className="absolute inset-[-3px] rounded-full pointer-events-none"
          style={{
            border: '1px solid transparent',
            borderTopColor: ringColor,
            borderRightColor: ringColor + '40',
          }}
        >
          <div className="absolute inset-0 rounded-full scan-ring" />
        </div>
        {/* Glow ring */}
        <motion.div
          className="absolute inset-0 rounded-full border"
          animate={{
            borderColor: faceDetected
              ? ['#8B5CF680', '#8B5CF620', '#8B5CF680']
              : ['#ef4444', '#7f1d1d', '#ef4444'],
            boxShadow: faceDetected
              ? ['0 0 0px #8B5CF6', '0 0 12px #8B5CF6', '0 0 0px #8B5CF6']
              : ['0 0 0px #ef4444', '0 0 10px #ef4444', '0 0 0px #ef4444'],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        {/* Canvas feed */}
        <div className="absolute inset-0.5 rounded-full overflow-hidden bg-black/80">
          <canvas
            ref={canvasRef}
            width={48}
            height={36}
            className="w-full h-full object-cover"
            style={{
              transform: 'scaleX(-1)',
              imageRendering: 'pixelated',
              filter: faceDetected
                ? 'contrast(1.4) saturate(0.25) brightness(0.9) hue-rotate(170deg)'
                : 'contrast(1.6) saturate(0.1) brightness(0.5)',
            }}
          />
          {/* Scanlines */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
            }}
          />
          {!faceDetected && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <EyeOff className="w-4 h-4 text-red-400" />
            </div>
          )}
        </div>
        {/* Status dot */}
        <motion.div
          className={cn(
            'absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center',
            faceDetected ? 'bg-violet-500' : 'bg-red-500'
          )}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Eye className="w-2 h-2 text-white" />
        </motion.div>
      </div>

      {/* Sensor readout */}
      <div className="flex flex-col gap-1 font-terminal text-[10px]">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground/60 uppercase tracking-widest">Blinks</span>
          <span className="text-violet-300 font-bold">{blinkCount}</span>
          <span className="text-muted-foreground/40">{blinkRate}/m</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground/60 uppercase tracking-widest">Stability</span>
          <span className={cn('font-bold', headStability >= 70 ? 'text-emerald-400' : 'text-amber-400')}>{headStability}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground/60 uppercase tracking-widest">Presence</span>
          <span className={cn('font-bold', faceDetected ? 'text-violet-300' : 'text-red-400')}>
            {faceDetected ? 'LOCKED' : 'LOST'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Neural Meditation Mode ────────────────────────────────────────────────────

interface BiometricSnapshot {
  hrv: number;
  blinkRate: number;
  headStability: number;
}

export interface MeditationResult {
  durationSeconds: number;
  depthScore: number;
  coherenceScore: number;
  beforeSnapshot: BiometricSnapshot;
  afterSnapshot: BiometricSnapshot;
  xpAwarded: number;
}

interface MeditationModeProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (result: MeditationResult) => void;
  hrv: number;
  blinkRate: number;
  headStability: number;
  /** Video element ref from useCamera — shown as background during meditation */
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  faceDetected?: boolean;
  blinkCount?: number;
}

type MeditationPhase = 'preparation' | 'active' | 'results';

const MIN_DURATION = 5; // seconds for demo

function computeDepthScore(
  baseline: BiometricSnapshot,
  current: { hrv: number; blinkRate: number; headStability: number },
): number {
  // HRV improvement (40%): +10ms from baseline = 100% contribution
  const hrvDelta = current.hrv - baseline.hrv;
  const hrvContribution = Math.min(Math.max(hrvDelta / 10, 0), 1);

  // Blink rate reduction (30%): -50% from baseline = 100% contribution
  const blinkReduction = baseline.blinkRate > 0
    ? (baseline.blinkRate - current.blinkRate) / baseline.blinkRate
    : 0;
  const blinkContribution = Math.min(Math.max(blinkReduction / 0.5, 0), 1);

  // Head stability (30%): direct percentage
  const stabilityContribution = Math.min(Math.max(current.headStability / 100, 0), 1);

  const raw = hrvContribution * 40 + blinkContribution * 30 + stabilityContribution * 30;
  return Math.round(Math.min(Math.max(raw, 0), 100));
}

function computeCoherenceScore(
  baseline: BiometricSnapshot,
  after: BiometricSnapshot,
): number {
  // Each metric: is it "improving"? 1 = yes, 0 = no
  const hrvImproving = after.hrv > baseline.hrv ? 1 : 0;
  const blinkImproving = after.blinkRate < baseline.blinkRate ? 1 : 0;
  const stabilityImproving = after.headStability >= baseline.headStability ? 1 : 0;

  const improvingCount = hrvImproving + blinkImproving + stabilityImproving;

  // Magnitude of each improvement (0-1 scale)
  const hrvMag = baseline.hrv > 0
    ? Math.min(Math.abs(after.hrv - baseline.hrv) / 10, 1)
    : 0;
  const blinkMag = baseline.blinkRate > 0
    ? Math.min(Math.abs(after.blinkRate - baseline.blinkRate) / baseline.blinkRate / 0.5, 1)
    : 0;
  const stabMag = Math.min(after.headStability / 100, 1);

  // Coherence = how many are improving together * average magnitude
  const avgMag = (hrvMag + blinkMag + stabMag) / 3;
  const syncFactor = improvingCount / 3; // 0, 0.33, 0.67, 1

  const raw = syncFactor * avgMag * 100;
  return Math.round(Math.min(Math.max(raw, 0), 100));
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function MeditationMode({
  isOpen,
  onClose,
  onComplete,
  hrv,
  blinkRate,
  headStability,
  videoRef,
  faceDetected = false,
  blinkCount = 0,
}: MeditationModeProps) {
  const [phase, setPhase] = useState<MeditationPhase>('preparation');
  const [elapsed, setElapsed] = useState(0);
  const [depthScore, setDepthScore] = useState(0);
  const [result, setResult] = useState<MeditationResult | null>(null);

  // Baseline snapshot
  const baselineRef = useRef<BiometricSnapshot | null>(null);

  // Live biometric refs
  const hrvRef = useRef(hrv);
  const blinkRef = useRef(blinkRate);
  const stabilityRef = useRef(headStability);
  hrvRef.current = hrv;
  blinkRef.current = blinkRate;
  stabilityRef.current = headStability;

  // Ambient pulse phase for aesthetic circle
  const [pulse, setPulse] = useState(0);

  const startMeditation = useCallback(() => {
    baselineRef.current = {
      hrv: hrvRef.current,
      blinkRate: blinkRef.current,
      headStability: stabilityRef.current,
    };
    setPhase('active');
    setElapsed(0);
    setDepthScore(0);
    setResult(null);
    console.log(
      `🧠 Neurotech: Meditation started — baseline HRV ${hrvRef.current}ms, blink ${blinkRef.current}/min, stability ${stabilityRef.current}%`,
    );
  }, []);

  // Timer + depth score update every second
  useEffect(() => {
    if (phase !== 'active') return;

    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);

      if (baselineRef.current) {
        const score = computeDepthScore(baselineRef.current, {
          hrv: hrvRef.current,
          blinkRate: blinkRef.current,
          headStability: stabilityRef.current,
        });
        setDepthScore(score);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [phase]);

  // Ambient pulse animation
  useEffect(() => {
    if (phase !== 'active') return;

    const interval = setInterval(() => {
      setPulse((prev) => (prev + 1) % 360);
    }, 50);

    return () => clearInterval(interval);
  }, [phase]);

  const endSession = useCallback(() => {
    if (!baselineRef.current) return;

    const afterSnapshot: BiometricSnapshot = {
      hrv: hrvRef.current,
      blinkRate: blinkRef.current,
      headStability: stabilityRef.current,
    };

    const depth = computeDepthScore(baselineRef.current, afterSnapshot);
    const coherence = computeCoherenceScore(baselineRef.current, afterSnapshot);
    const xp = Math.min(Math.round(30 + depth / 5), 50);

    const meditationResult: MeditationResult = {
      durationSeconds: elapsed,
      depthScore: depth,
      coherenceScore: coherence,
      beforeSnapshot: { ...baselineRef.current },
      afterSnapshot,
      xpAwarded: xp,
    };

    setResult(meditationResult);
    setPhase('results');

    console.log(
      `🧠 Neurotech: Meditation complete — ${elapsed}s, depth ${depth}, coherence ${coherence}, +${xp} XP`,
    );
  }, [elapsed]);

  const handleClaim = useCallback(() => {
    if (result) {
      onComplete(result);
    }
    onClose();
  }, [result, onComplete, onClose]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setPhase('preparation');
      setElapsed(0);
      setDepthScore(0);
      setResult(null);
      baselineRef.current = null;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const canEnd = elapsed >= MIN_DURATION;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden"
        style={{ background: 'rgba(5,3,20,0.98)' }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-20 text-muted-foreground hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="relative z-10 text-center max-w-lg mx-auto px-4 w-full">
          {/* Title */}
          <div className="font-terminal text-xs text-violet-400 uppercase tracking-[0.3em] mb-2">
            Neurotech Biofeedback
          </div>
          <h2 className="font-pixel text-2xl text-white mb-6">
            {phase === 'preparation' && 'Neural Meditation'}
            {phase === 'active' && 'Neural Meditation'}
            {phase === 'results' && 'Session Complete'}
          </h2>

          {/* ──────── Preparation Phase ──────── */}
          {phase === 'preparation' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* Brain icon */}
              <div className="relative flex items-center justify-center mb-8" style={{ height: 140 }}>
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-24 h-24 rounded-full flex items-center justify-center"
                  style={{
                    background: 'radial-gradient(circle, rgba(139,92,246,0.3), rgba(139,92,246,0.05))',
                    boxShadow: '0 0 50px rgba(139,92,246,0.25)',
                    border: '2px solid rgba(139,92,246,0.3)',
                  }}
                >
                  <Brain className="w-10 h-10 text-violet-400" />
                </motion.div>
              </div>

              <p className="font-terminal text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                Close your eyes, breathe deeply, and let your neural signals guide the session.
                AURA will track HRV, blink rate, and head stability in real time.
              </p>

              <button
                onClick={startMeditation}
                className="px-8 py-3 rounded-xl font-terminal text-sm font-bold uppercase tracking-wider text-white cursor-pointer
                  bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 transition-all
                  border border-violet-400/30 shadow-[0_0_20px_rgba(139,92,246,0.3)]"
              >
                Begin Meditation
              </button>

              <p className="font-terminal text-xs text-muted-foreground mt-4">
                Minimum {MIN_DURATION}s session for XP reward.
              </p>
            </motion.div>
          )}

          {/* ──────── Active Meditation Phase ──────── */}
          {phase === 'active' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              {/* Sensor orb (discreet pixelated camera) + Brainwave side by side */}
              {videoRef && (
                <div className="flex justify-center mb-4">
                  <SensorOrb
                    videoRef={videoRef}
                    faceDetected={faceDetected}
                    blinkCount={blinkCount}
                    blinkRate={blinkRate}
                    headStability={headStability}
                  />
                </div>
              )}

              {/* BrainwaveVisualizer — full width */}
              <div className="mb-3">
                <BrainwaveVisualizer
                  hrv={hrv}
                  blinkRate={blinkRate}
                  headStability={headStability}
                  isActive
                  className="w-full"
                />
              </div>

              {/* Depth of Meditation gauge */}
              <div className="mb-5">
                <div className="font-terminal text-xs text-muted-foreground uppercase tracking-widest mb-2">
                  Depth of Meditation
                </div>
                <div className="flex items-center justify-center gap-3">
                  <Activity className="w-4 h-4 text-violet-400" />
                  <span
                    className={cn(
                      'font-pixel text-4xl font-bold',
                      depthScore >= 70 ? 'text-emerald-400'
                      : depthScore >= 40 ? 'text-violet-300'
                      : 'text-blue-300',
                    )}
                  >
                    {depthScore}
                  </span>
                  <span className="font-terminal text-xs text-muted-foreground">/100</span>
                </div>

                {/* Depth bar */}
                <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden mt-2 max-w-xs mx-auto">
                  <motion.div
                    className={cn(
                      'absolute inset-y-0 left-0 rounded-full',
                      depthScore >= 70 ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      : depthScore >= 40 ? 'bg-gradient-to-r from-violet-500 to-blue-400'
                      : 'bg-gradient-to-r from-blue-500 to-cyan-400',
                    )}
                    animate={{ width: `${depthScore}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {/* Elapsed timer */}
              <div className="font-terminal text-2xl text-white mb-5 tracking-widest">
                {formatTime(elapsed)}
              </div>

              {/* Live biometrics row */}
              <div className="grid grid-cols-3 gap-3 mb-6 text-xs font-terminal">
                <div className="text-center px-2 py-2 rounded-lg border border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="text-muted-foreground">HRV</div>
                  <div className="text-violet-300 font-bold text-lg">{hrv}ms</div>
                </div>
                <div className="text-center px-2 py-2 rounded-lg border border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="text-muted-foreground">Blinks</div>
                  <div className="text-blue-300 font-bold text-lg">{blinkRate}/m</div>
                </div>
                <div className="text-center px-2 py-2 rounded-lg border border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="text-muted-foreground">Stability</div>
                  <div className="text-emerald-300 font-bold text-lg">{headStability}%</div>
                </div>
              </div>

              {/* End Session button */}
              <button
                onClick={endSession}
                disabled={!canEnd}
                className={cn(
                  'px-8 py-3 rounded-xl font-terminal text-sm font-bold uppercase tracking-wider transition-all cursor-pointer',
                  canEnd
                    ? 'text-white bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 border border-violet-400/30 shadow-[0_0_20px_rgba(139,92,246,0.3)]'
                    : 'text-muted-foreground bg-white/5 border border-white/10 cursor-not-allowed',
                )}
              >
                {canEnd ? 'End Session' : `${MIN_DURATION - elapsed}s remaining`}
              </button>
            </motion.div>
          )}

          {/* ──────── Results Phase ──────── */}
          {phase === 'results' && result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Duration */}
              <div className="font-terminal text-sm text-muted-foreground mb-4">
                Session Duration: {formatTime(result.durationSeconds)}
              </div>

              {/* Depth + Coherence scores */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="text-center px-3 py-4 rounded-xl border border-violet-500/20" style={{ background: 'rgba(139,92,246,0.08)' }}>
                  <div className="font-terminal text-xs text-muted-foreground uppercase tracking-widest mb-1">
                    Depth Score
                  </div>
                  <div className={cn(
                    'font-pixel text-3xl font-bold',
                    result.depthScore >= 70 ? 'text-emerald-400'
                    : result.depthScore >= 40 ? 'text-violet-300'
                    : 'text-blue-300',
                  )}>
                    {result.depthScore}
                  </div>
                  <div className="font-terminal text-xs text-muted-foreground">/100</div>
                </div>
                <div className="text-center px-3 py-4 rounded-xl border border-blue-500/20" style={{ background: 'rgba(59,130,246,0.08)' }}>
                  <div className="font-terminal text-xs text-muted-foreground uppercase tracking-widest mb-1">
                    Coherence
                  </div>
                  <div className={cn(
                    'font-pixel text-3xl font-bold',
                    result.coherenceScore >= 70 ? 'text-emerald-400'
                    : result.coherenceScore >= 40 ? 'text-blue-300'
                    : 'text-amber-300',
                  )}>
                    {result.coherenceScore}
                  </div>
                  <div className="font-terminal text-xs text-muted-foreground">/100</div>
                </div>
              </div>

              {/* Before/After comparison */}
              <div className="mb-6">
                <div className="font-terminal text-xs text-muted-foreground uppercase tracking-widest mb-3">
                  Neural Response
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs font-terminal">
                  {([
                    { label: 'HRV', before: result.beforeSnapshot.hrv, after: result.afterSnapshot.hrv, unit: 'ms', goodDir: 'up' as const },
                    { label: 'Blink Rate', before: result.beforeSnapshot.blinkRate, after: result.afterSnapshot.blinkRate, unit: '/m', goodDir: 'down' as const },
                    { label: 'Stability', before: result.beforeSnapshot.headStability, after: result.afterSnapshot.headStability, unit: '%', goodDir: 'up' as const },
                  ]).map(({ label, before, after, unit, goodDir }) => {
                    const delta = after - before;
                    const pct = before > 0 ? Math.round((delta / before) * 100) : 0;
                    const isGood = goodDir === 'up' ? delta >= 0 : delta <= 0;
                    return (
                      <div key={label} className="text-center px-2 py-3 rounded-lg border border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <div className="text-muted-foreground mb-1">{label}</div>
                        <div className="text-white font-bold">{before}{unit} → {after}{unit}</div>
                        <div className={cn('font-bold mt-1', isGood ? 'text-emerald-400' : 'text-amber-400')}>
                          {delta >= 0 ? '+' : ''}{pct}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* XP award */}
              <div className="font-terminal text-sm text-violet-300 mb-6">
                +{result.xpAwarded} XP — Neural meditation verified
              </div>

              {/* Claim button */}
              <button
                onClick={handleClaim}
                className="px-8 py-3 rounded-xl font-terminal text-sm font-bold uppercase tracking-wider text-white cursor-pointer
                  bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition-all
                  border border-emerald-400/30 shadow-[0_0_20px_rgba(52,211,153,0.3)]"
              >
                Claim +{result.xpAwarded} XP
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
