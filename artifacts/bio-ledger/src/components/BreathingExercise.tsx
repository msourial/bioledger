import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Box Breathing: 4-4-4-4 ─────────────────────────────────────────────────

type Phase = 'inhale' | 'hold-in' | 'exhale' | 'hold-out';

const PHASES: { phase: Phase; label: string; duration: number }[] = [
  { phase: 'inhale', label: 'BREATHE IN', duration: 4 },
  { phase: 'hold-in', label: 'HOLD', duration: 4 },
  { phase: 'exhale', label: 'BREATHE OUT', duration: 4 },
  { phase: 'hold-out', label: 'HOLD', duration: 4 },
];

const TOTAL_CYCLES = 4;
const CYCLE_DURATION = PHASES.reduce((sum, p) => sum + p.duration, 0); // 16s

interface BiometricSnapshot {
  hrv: number;
  blinkRate: number;
  headStability: number;
}

interface BreathingExerciseProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (xpAwarded: number, before: BiometricSnapshot, after: BiometricSnapshot) => void;
  hrv: number;
  blinkRate: number;
  headStability: number;
}

export default function BreathingExercise({
  isOpen,
  onClose,
  onComplete,
  hrv,
  blinkRate,
  headStability,
}: BreathingExerciseProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentCycle, setCurrentCycle] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [phaseTimer, setPhaseTimer] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  // Before/after snapshots
  const beforeRef = useRef<BiometricSnapshot | null>(null);
  const [afterSnapshot, setAfterSnapshot] = useState<BiometricSnapshot | null>(null);

  // Live biometric refs (updated every render)
  const hrvRef = useRef(hrv);
  const blinkRef = useRef(blinkRate);
  const stabilityRef = useRef(headStability);
  hrvRef.current = hrv;
  blinkRef.current = blinkRate;
  stabilityRef.current = headStability;

  const currentPhase = PHASES[phaseIndex];
  const totalPhases = TOTAL_CYCLES * PHASES.length;
  const completedPhases = currentCycle * PHASES.length + phaseIndex;
  const overallProgress = isComplete ? 100 : Math.round((completedPhases / totalPhases) * 100);

  // Circle scale: grows on inhale, shrinks on exhale, holds otherwise
  const circleScale =
    currentPhase.phase === 'inhale' ? 1 + (phaseTimer / currentPhase.duration) * 0.5
    : currentPhase.phase === 'exhale' ? 1.5 - (phaseTimer / currentPhase.duration) * 0.5
    : currentPhase.phase === 'hold-in' ? 1.5
    : 1.0;

  const start = useCallback(() => {
    beforeRef.current = { hrv: hrvRef.current, blinkRate: blinkRef.current, headStability: stabilityRef.current };
    setIsRunning(true);
    setCurrentCycle(0);
    setPhaseIndex(0);
    setPhaseTimer(0);
    setIsComplete(false);
    setAfterSnapshot(null);
    console.log(`🧠 Neurotech: Breathing exercise started — baseline HRV ${hrvRef.current}ms, blink ${blinkRef.current}/min`);
  }, []);

  // Timer loop
  useEffect(() => {
    if (!isRunning || isComplete) return;

    const interval = setInterval(() => {
      setPhaseTimer((prev) => {
        const next = prev + 0.1;
        if (next >= currentPhase.duration) {
          // Advance to next phase
          const nextPhaseIdx = phaseIndex + 1;
          if (nextPhaseIdx >= PHASES.length) {
            // Completed one cycle
            const nextCycle = currentCycle + 1;
            if (nextCycle >= TOTAL_CYCLES) {
              // All cycles done
              setIsRunning(false);
              setIsComplete(true);
              const after: BiometricSnapshot = {
                hrv: hrvRef.current,
                blinkRate: blinkRef.current,
                headStability: stabilityRef.current,
              };
              setAfterSnapshot(after);
              console.log(`🧠 Neurotech: Breathing exercise complete — HRV ${after.hrv}ms (was ${beforeRef.current?.hrv}ms), blink ${after.blinkRate}/min`);
              return 0;
            }
            setCurrentCycle(nextCycle);
            setPhaseIndex(0);
          } else {
            setPhaseIndex(nextPhaseIdx);
          }
          return 0;
        }
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, isComplete, phaseIndex, currentCycle, currentPhase.duration]);

  const handleComplete = () => {
    if (beforeRef.current && afterSnapshot) {
      onComplete(40, beforeRef.current, afterSnapshot);
    }
    onClose();
  };

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setIsRunning(false);
      setCurrentCycle(0);
      setPhaseIndex(0);
      setPhaseTimer(0);
      setIsComplete(false);
      setAfterSnapshot(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-center justify-center"
        style={{ background: 'rgba(5,3,20,0.92)', backdropFilter: 'blur(24px)' }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-muted-foreground hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center max-w-md mx-auto px-4">
          {/* Title */}
          <div className="font-terminal text-xs text-violet-400 uppercase tracking-[0.3em] mb-2">
            Neurotech Biofeedback
          </div>
          <h2 className="font-pixel text-2xl text-white mb-8">
            {isComplete ? 'Exercise Complete' : isRunning ? 'Box Breathing' : 'Mindful Breathing'}
          </h2>

          {/* Breathing circle */}
          {!isComplete && (
            <div className="relative flex items-center justify-center mb-8" style={{ height: 200 }}>
              <motion.div
                animate={{ scale: isRunning ? circleScale : 1 }}
                transition={{ type: 'tween', duration: 0.1 }}
                className="w-32 h-32 rounded-full flex items-center justify-center"
                style={{
                  background: currentPhase.phase === 'inhale' || currentPhase.phase === 'hold-in'
                    ? 'radial-gradient(circle, rgba(139,92,246,0.4), rgba(139,92,246,0.1))'
                    : 'radial-gradient(circle, rgba(59,130,246,0.4), rgba(59,130,246,0.1))',
                  boxShadow: `0 0 ${40 + circleScale * 20}px rgba(139,92,246,${0.2 + circleScale * 0.15})`,
                  border: '2px solid rgba(139,92,246,0.3)',
                }}
              >
                {isRunning ? (
                  <div className="text-center">
                    <div className="font-terminal text-sm text-white font-bold">
                      {currentPhase.label}
                    </div>
                    <div className="font-terminal text-xs text-violet-300 mt-1">
                      {Math.ceil(currentPhase.duration - phaseTimer)}s
                    </div>
                  </div>
                ) : (
                  <div className="font-terminal text-sm text-violet-300">
                    4-4-4-4
                  </div>
                )}
              </motion.div>
            </div>
          )}

          {/* Progress */}
          {isRunning && (
            <div className="mb-6">
              <div className="flex justify-between font-terminal text-xs text-muted-foreground mb-1">
                <span>Cycle {currentCycle + 1}/{TOTAL_CYCLES}</span>
                <span>{overallProgress}%</span>
              </div>
              <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 to-blue-400"
                  animate={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Live biometrics during exercise */}
          {isRunning && (
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
          )}

          {/* Before/After comparison on complete */}
          {isComplete && beforeRef.current && afterSnapshot && (
            <div className="mb-6">
              <div className="font-terminal text-xs text-muted-foreground uppercase tracking-widest mb-3">
                Neural Response
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs font-terminal">
                {([
                  { label: 'HRV', before: beforeRef.current.hrv, after: afterSnapshot.hrv, unit: 'ms', goodDir: 'up' },
                  { label: 'Blink Rate', before: beforeRef.current.blinkRate, after: afterSnapshot.blinkRate, unit: '/m', goodDir: 'down' },
                  { label: 'Stability', before: beforeRef.current.headStability, after: afterSnapshot.headStability, unit: '%', goodDir: 'up' },
                ] as const).map(({ label, before, after, unit, goodDir }) => {
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
              <div className="font-terminal text-sm text-violet-300 mt-4">
                +40 XP — Mindful breathing verified
              </div>
            </div>
          )}

          {/* Action button */}
          {!isRunning && !isComplete && (
            <button
              onClick={start}
              className="px-8 py-3 rounded-xl font-terminal text-sm font-bold uppercase tracking-wider text-white cursor-pointer
                bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 transition-all
                border border-violet-400/30 shadow-[0_0_20px_rgba(139,92,246,0.3)]"
            >
              Begin Breathing Exercise
            </button>
          )}

          {isComplete && (
            <button
              onClick={handleComplete}
              className="px-8 py-3 rounded-xl font-terminal text-sm font-bold uppercase tracking-wider text-white cursor-pointer
                bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition-all
                border border-emerald-400/30 shadow-[0_0_20px_rgba(52,211,153,0.3)]"
            >
              Claim +40 XP
            </button>
          )}

          {!isRunning && !isComplete && (
            <p className="font-terminal text-xs text-muted-foreground mt-4 max-w-xs mx-auto">
              4 cycles of box breathing (4s inhale, 4s hold, 4s exhale, 4s hold).
              AURA will track your biometric response.
            </p>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
