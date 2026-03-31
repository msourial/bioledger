import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, X, CheckCircle2, SkipForward, Activity } from 'lucide-react';
import { PixelPanel, PixelButton } from '@/components/PixelUI';

/* ------------------------------------------------------------------ */
/*  Exercise catalogue                                                 */
/* ------------------------------------------------------------------ */

export const EXERCISES = [
  {
    id: 'wrist-stretch',
    title: 'Wrist & Finger Stretch',
    duration: 30,
    steps: [
      'Extend your arm forward, palm up',
      'Gently pull fingers back with other hand',
      'Hold for 15 seconds, then switch hands',
      'Make 10 fists, then spread fingers wide',
    ],
    icon: '\u{1F91A}',
    targetArea: 'Wrists & Fingers',
  },
  {
    id: 'neck-roll',
    title: 'Neck Roll & Release',
    duration: 30,
    steps: [
      'Drop your chin to chest slowly',
      'Roll head to right shoulder \u2014 hold 5s',
      'Roll back to center, then left \u2014 hold 5s',
      'Look up gently, return to neutral',
    ],
    icon: '\u{1F9D8}',
    targetArea: 'Neck & Cervical Spine',
  },
  {
    id: 'eye-relief',
    title: '20-20-20 Eye Relief',
    duration: 20,
    steps: [
      'Look at something 20 feet away',
      'Focus on it for 20 seconds',
      'Blink rapidly 10 times',
      'Close eyes and breathe for 5 seconds',
    ],
    icon: '\u{1F441}\uFE0F',
    targetArea: 'Eyes & Focus',
  },
  {
    id: 'shoulder-shrug',
    title: 'Shoulder Shrug & Roll',
    duration: 25,
    steps: [
      'Raise both shoulders to ears \u2014 hold 5s',
      'Release and drop shoulders completely',
      'Roll shoulders forward 5 times',
      'Roll shoulders backward 5 times',
    ],
    icon: '\u{1F4AA}',
    targetArea: 'Shoulders & Upper Back',
  },
  {
    id: 'standing-stretch',
    title: 'Stand & Full Body Stretch',
    duration: 45,
    steps: [
      'Stand up from your chair',
      'Reach both arms overhead, interlace fingers',
      'Lean gently left \u2014 hold 10s, then right',
      'Touch your toes or reach as far as comfortable',
      'Shake out arms and legs for 10 seconds',
    ],
    icon: '\u{1F9CD}',
    targetArea: 'Full Body',
  },
  {
    id: 'deep-breathing',
    title: 'Box Breathing Reset',
    duration: 40,
    steps: [
      'Breathe IN through nose for 4 seconds',
      'HOLD your breath for 4 seconds',
      'Breathe OUT through mouth for 4 seconds',
      'HOLD empty for 4 seconds',
      'Repeat 4 times',
    ],
    icon: '\u{1F32C}\uFE0F',
    targetArea: 'Nervous System & Stress',
  },
] as const;

export type Exercise = (typeof EXERCISES)[number];

/* ------------------------------------------------------------------ */
/*  Component props                                                    */
/* ------------------------------------------------------------------ */

interface ExerciseBreakModalProps {
  open: boolean;
  exercise: Exercise | null;
  onComplete: () => void;
  onSkip: () => void;
  onDismiss: () => void;
}

/* ------------------------------------------------------------------ */
/*  ExerciseBreakModal                                                 */
/* ------------------------------------------------------------------ */

export default function ExerciseBreakModal({
  open,
  exercise,
  onComplete,
  onSkip,
  onDismiss,
}: ExerciseBreakModalProps) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset timer whenever the exercise changes or modal opens
  useEffect(() => {
    if (open && exercise) {
      setElapsed(0);
    }
  }, [open, exercise]);

  // Countdown tick
  useEffect(() => {
    if (!open || !exercise) return;

    intervalRef.current = setInterval(() => {
      setElapsed((prev) => {
        if (prev + 1 >= exercise.duration) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return exercise.duration;
        }
        return prev + 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [open, exercise]);

  const remaining = exercise ? Math.max(exercise.duration - elapsed, 0) : 0;
  const progress = exercise ? elapsed / exercise.duration : 0;
  const currentStepIndex = exercise
    ? Math.min(
        Math.floor(progress * exercise.steps.length),
        exercise.steps.length - 1,
      )
    : 0;

  const formatTime = useCallback((secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  // Progress bar color shifts as time runs out
  const barColor =
    progress < 0.5
      ? 'bg-emerald-400'
      : progress < 0.8
        ? 'bg-amber-400'
        : 'bg-rose-400';

  const barGlow =
    progress < 0.5
      ? 'shadow-[0_0_12px_rgba(52,211,153,0.5)]'
      : progress < 0.8
        ? 'shadow-[0_0_12px_rgba(251,191,36,0.5)]'
        : 'shadow-[0_0_12px_rgba(251,113,133,0.5)]';

  return (
    <AnimatePresence>
      {open && exercise && (
        <>
          {/* Backdrop */}
          <motion.div
            key="exercise-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md"
            onClick={onDismiss}
          />

          {/* Center panel */}
          <motion.div
            key="exercise-panel"
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none px-4"
          >
            <PixelPanel
              className="pointer-events-auto w-full max-w-md border border-violet-400/30 shadow-[0_0_40px_rgba(139,92,246,0.2)]"
            >
              {/* ---- Close button ---- */}
              <button
                onClick={onDismiss}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              {/* ---- Header ---- */}
              <div className="flex flex-col items-center gap-2 mb-5">
                <motion.span
                  className="text-4xl"
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  {exercise.icon}
                </motion.span>

                <h2 className="font-terminal text-lg font-bold text-foreground text-center">
                  {exercise.title}
                </h2>

                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-violet-500/15 border border-violet-400/30 font-terminal text-xs text-violet-300">
                  <Activity className="w-3 h-3" />
                  {exercise.targetArea}
                </span>
              </div>

              {/* ---- Steps ---- */}
              <ol className="flex flex-col gap-2 mb-6">
                {exercise.steps.map((step, idx) => {
                  const isActive = idx === currentStepIndex;
                  const isDone = idx < currentStepIndex;
                  return (
                    <motion.li
                      key={idx}
                      animate={isActive ? { x: [0, 4, 0] } : {}}
                      transition={
                        isActive
                          ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
                          : {}
                      }
                      className={`flex items-start gap-3 rounded-lg px-3 py-2 transition-colors duration-300 ${
                        isActive
                          ? 'bg-violet-500/15 border border-violet-400/30'
                          : isDone
                            ? 'opacity-50'
                            : 'opacity-70'
                      }`}
                    >
                      <span
                        className={`flex-shrink-0 mt-0.5 flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                          isActive
                            ? 'bg-violet-500 text-white'
                            : isDone
                              ? 'bg-emerald-500/60 text-white'
                              : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          idx + 1
                        )}
                      </span>
                      <span className="font-terminal text-sm text-foreground/90">
                        {step}
                      </span>
                    </motion.li>
                  );
                })}
              </ol>

              {/* ---- Timer ---- */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5 font-terminal text-xs text-muted-foreground">
                    <Timer className="w-3.5 h-3.5" />
                    Time remaining
                  </span>
                  <span className="font-terminal text-sm font-bold text-foreground tabular-nums">
                    {formatTime(remaining)}
                  </span>
                </div>

                {/* Progress bar track */}
                <div className="relative h-2 rounded-full bg-muted/40 overflow-hidden">
                  <motion.div
                    className={`absolute inset-y-0 left-0 rounded-full ${barColor} ${barGlow}`}
                    initial={{ width: '0%' }}
                    animate={{ width: `${Math.min(progress * 100, 100)}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  />
                </div>
              </div>

              {/* ---- Actions ---- */}
              <div className="flex gap-3">
                <PixelButton
                  variant="primary"
                  className="flex-1 flex items-center justify-center gap-2"
                  onClick={onComplete}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  I Did It! (+XP)
                </PixelButton>

                <PixelButton
                  variant="secondary"
                  className="flex items-center justify-center gap-2 opacity-70 hover:opacity-100"
                  onClick={onSkip}
                >
                  <SkipForward className="w-4 h-4" />
                  Skip
                </PixelButton>
              </div>
            </PixelPanel>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
