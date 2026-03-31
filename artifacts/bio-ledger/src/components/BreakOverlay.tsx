import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PixelButton } from '@/components/PixelUI';

interface BreakOverlayProps {
  open: boolean;
  durationSeconds: number;
  exerciseTitle: string;
  exerciseSteps: string[];
  xpReward: number;
  onComplete: () => void;
}

/* ── tiny confetti particle ── */
interface Particle {
  id: number;
  x: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
}

function ConfettiParticles() {
  const particles = useMemo<Particle[]>(() => {
    const colors = ['#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#818cf8', '#e879f9'];
    return Array.from({ length: 28 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: 4 + Math.random() * 6,
      color: colors[i % colors.length],
      delay: Math.random() * 0.4,
      duration: 1.2 + Math.random() * 0.8,
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 1, y: '60vh', x: `${p.x}vw`, scale: 0 }}
          animate={{ opacity: [1, 1, 0], y: '-10vh', scale: [0, 1, 0.6] }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeOut' }}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 0 6px ${p.color}`,
          }}
        />
      ))}
    </div>
  );
}

/* ── circular countdown ring (SVG) ── */
function CountdownRing({
  remaining,
  total,
  completed,
}: {
  remaining: number;
  total: number;
  completed: boolean;
}) {
  const radius = 100;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const progress = completed ? 0 : (remaining / total) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 240, height: 240 }}>
      {/* glow behind ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: completed
            ? 'radial-gradient(circle, rgba(52,211,153,0.18) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)',
          transform: 'scale(1.4)',
          filter: 'blur(20px)',
        }}
      />

      <svg width={240} height={240} className="absolute -rotate-90">
        {/* track */}
        <circle
          cx={120}
          cy={120}
          r={radius}
          fill="none"
          stroke="rgba(139,92,246,0.15)"
          strokeWidth={stroke}
        />
        {/* progress arc */}
        <motion.circle
          cx={120}
          cy={120}
          r={radius}
          fill="none"
          stroke={completed ? '#34d399' : '#a78bfa'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: progress }}
          transition={{ duration: 0.4, ease: 'linear' }}
          style={{ filter: `drop-shadow(0 0 6px ${completed ? '#34d399' : '#a78bfa'})` }}
        />
      </svg>

      {/* center text */}
      <div className="relative z-10 flex flex-col items-center">
        {completed ? (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="font-pixel text-3xl text-emerald-400"
            style={{ textShadow: '0 0 14px rgba(52,211,153,0.6)' }}
          >
            DONE
          </motion.span>
        ) : (
          <>
            <span
              className="font-pixel text-5xl text-violet-300"
              style={{ textShadow: '0 0 18px rgba(167,139,250,0.5)' }}
            >
              {remaining}
            </span>
            <span className="font-terminal text-xs text-violet-400/60 mt-1">seconds</span>
          </>
        )}
      </div>
    </div>
  );
}

/* ── motivational messages ── */
const MOTIVATIONAL = [
  'Your body needs this break',
  'Protecting your health',
  'Rest fuels productivity',
  'Breathe deep, recharge',
];

/* ── main overlay ── */
export default function BreakOverlay({
  open,
  durationSeconds,
  exerciseTitle,
  exerciseSteps,
  xpReward,
  onComplete,
}: BreakOverlayProps) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const [completed, setCompleted] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset state when overlay opens
  useEffect(() => {
    if (!open) return;
    setRemaining(durationSeconds);
    setCompleted(false);
    setCurrentStepIdx(0);
  }, [open, durationSeconds]);

  // Countdown timer
  useEffect(() => {
    if (!open || completed) return;

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setCompleted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [open, completed]);

  // Auto-advance exercise steps
  useEffect(() => {
    if (!open || completed || exerciseSteps.length <= 1) return;
    const stepDuration = (durationSeconds / exerciseSteps.length) * 1000;
    const timer = setInterval(() => {
      setCurrentStepIdx((prev) => Math.min(prev + 1, exerciseSteps.length - 1));
    }, stepDuration);
    return () => clearInterval(timer);
  }, [open, completed, durationSeconds, exerciseSteps.length]);

  // Rotating motivational text
  const motivationalIdx = Math.floor((durationSeconds - remaining) / 8) % MOTIVATIONAL.length;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="break-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #1e1033 0%, #0f0a1e 40%, #120e24 100%)',
          }}
        >
          {/* Aurora background blobs (match LockScreen) */}
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            <div className="aurora-blob aurora-blob-1" />
            <div className="aurora-blob aurora-blob-2" />
            <div className="aurora-blob aurora-blob-3" />
          </div>

          {/* Content layer */}
          <div className="relative z-10 flex flex-col items-center px-6 max-w-md w-full">
            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="font-pixel text-lg tracking-widest text-violet-300 mb-2"
              style={{ textShadow: '0 0 12px rgba(167,139,250,0.4)' }}
            >
              BREAK TIME
            </motion.h1>

            {/* Motivational subtext */}
            <AnimatePresence mode="wait">
              <motion.p
                key={motivationalIdx}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="font-terminal text-sm text-violet-400/60 mb-8"
              >
                {MOTIVATIONAL[motivationalIdx]}
              </motion.p>
            </AnimatePresence>

            {/* Countdown ring */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 180, damping: 20 }}
              className="mb-8"
            >
              <CountdownRing remaining={remaining} total={durationSeconds} completed={completed} />
            </motion.div>

            {/* Exercise info */}
            <AnimatePresence mode="wait">
              {!completed ? (
                <motion.div
                  key="exercise"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col items-center text-center"
                >
                  <h2
                    className="font-pixel text-sm tracking-wider text-violet-200 mb-3"
                    style={{ textShadow: '0 0 8px rgba(167,139,250,0.3)' }}
                  >
                    {exerciseTitle}
                  </h2>

                  <AnimatePresence mode="wait">
                    <motion.p
                      key={currentStepIdx}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.3 }}
                      className="font-terminal text-sm text-violet-300/80 leading-relaxed max-w-sm"
                    >
                      <span className="text-violet-400/50 mr-2">
                        {currentStepIdx + 1}/{exerciseSteps.length}
                      </span>
                      {exerciseSteps[currentStepIdx]}
                    </motion.p>
                  </AnimatePresence>
                </motion.div>
              ) : (
                <motion.div
                  key="complete"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                  className="flex flex-col items-center gap-4"
                >
                  <ConfettiParticles />

                  <h2
                    className="font-pixel text-xl text-emerald-400 tracking-wider"
                    style={{ textShadow: '0 0 14px rgba(52,211,153,0.5)' }}
                  >
                    Great job!
                  </h2>

                  {/* XP badge */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 15 }}
                    className="px-5 py-2 rounded-full font-pixel text-lg text-emerald-300 border border-emerald-400/40"
                    style={{
                      background: 'linear-gradient(135deg, rgba(52,211,153,0.2) 0%, rgba(16,185,129,0.1) 100%)',
                      boxShadow: '0 0 20px rgba(52,211,153,0.25)',
                    }}
                  >
                    +{xpReward} XP
                  </motion.div>

                  <PixelButton onClick={onComplete} className="mt-4 min-w-[200px]">
                    Return to Work
                  </PixelButton>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
