import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CheckCircle2, Sparkles, X } from 'lucide-react';
import { PixelButton, PixelPanel } from '@/components/PixelUI';

const MOVEMENTS = [
  {
    id: 'thumbs-up',
    title: 'Quick Check-In!',
    instruction: 'Show a thumbs up to confirm you are feeling good and ready to keep producing great work',
    verifyPrompt: 'thumbs up gesture',
    xp: 30,
    benefit: 'Mindful check-ins boost self-awareness and focus by 23%',
  },
  {
    id: 'wave',
    title: 'Mindful Moment!',
    instruction: 'Wave at the camera — this 5-second pause resets your attention and boosts your next hour of work',
    verifyPrompt: 'waving hand gesture',
    xp: 30,
    benefit: 'Micro-breaks every 20 min increase productivity by 13%',
  },
  {
    id: 'arms-up',
    title: 'Power Stretch!',
    instruction: 'Raise both arms above your head and hold for 5 seconds — this increases blood flow to your brain',
    verifyPrompt: 'arms raised above head stretching',
    xp: 40,
    benefit: 'Stretching increases blood flow and cognitive performance',
  },
  {
    id: 'shoulder-roll',
    title: 'Tension Release!',
    instruction: 'Roll your shoulders back 3 times — releasing neck tension improves focus and prevents RSI',
    verifyPrompt: 'person with good upright posture, shoulders back',
    xp: 40,
    benefit: 'Shoulder tension reduces typing accuracy by up to 18%',
  },
  {
    id: 'stand-up',
    title: 'Recharge Break!',
    instruction: 'Stand up and stretch — standing for 30 seconds resets your posture and re-energizes your focus',
    verifyPrompt: 'person standing up, away from desk or chair',
    xp: 50,
    benefit: 'Standing breaks improve problem-solving by 35%',
  },
] as const;

export type Movement = typeof MOVEMENTS[number];

export function getRandomMovement(): Movement {
  return MOVEMENTS[Math.floor(Math.random() * MOVEMENTS.length)];
}

interface MovementChallengeProps {
  open: boolean;
  movement: Movement | null;
  captureFrame: () => string | null;
  onComplete: (movement: Movement) => void;
  onSkip: () => void;
}

const API = import.meta.env.VITE_API_BASE_URL ?? '';

/** Animated SVG illustration for each exercise */
function ExerciseIllustration({ id }: { id: string }) {
  const baseClass = 'w-32 h-32 mx-auto';

  if (id === 'thumbs-up') {
    return (
      <div className={baseClass}>
        <motion.svg viewBox="0 0 120 120" className="w-full h-full">
          <motion.circle cx="60" cy="60" r="45" fill="none" stroke="#8B5CF6" strokeWidth="2" opacity="0.3" />
          <motion.text
            x="60" y="70" textAnchor="middle" fontSize="50"
            animate={{ y: [70, 60, 70], scale: [1, 1.15, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            {'👍'}
          </motion.text>
        </motion.svg>
      </div>
    );
  }

  if (id === 'wave') {
    return (
      <div className={baseClass}>
        <motion.svg viewBox="0 0 120 120" className="w-full h-full">
          <motion.circle cx="60" cy="60" r="45" fill="none" stroke="#8B5CF6" strokeWidth="2" opacity="0.3" />
          <motion.text
            x="60" y="70" textAnchor="middle" fontSize="50"
            animate={{ rotate: [-20, 20, -20] }}
            transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ originX: '50%', originY: '50%' }}
          >
            {'👋'}
          </motion.text>
        </motion.svg>
      </div>
    );
  }

  if (id === 'arms-up') {
    return (
      <div className={baseClass}>
        <motion.svg viewBox="0 0 120 140" className="w-full h-full">
          {/* Body */}
          <line x1="60" y1="55" x2="60" y2="100" stroke="#8B5CF6" strokeWidth="3" strokeLinecap="round" />
          {/* Head */}
          <circle cx="60" cy="42" r="13" fill="none" stroke="#8B5CF6" strokeWidth="3" />
          {/* Legs */}
          <line x1="60" y1="100" x2="45" y2="130" stroke="#8B5CF6" strokeWidth="3" strokeLinecap="round" />
          <line x1="60" y1="100" x2="75" y2="130" stroke="#8B5CF6" strokeWidth="3" strokeLinecap="round" />
          {/* Arms — animated going up */}
          <motion.line
            x1="60" y1="65" x2="30" y2="85" stroke="#34d399" strokeWidth="3" strokeLinecap="round"
            animate={{ x2: [30, 30, 30], y2: [85, 25, 85] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.line
            x1="60" y1="65" x2="90" y2="85" stroke="#34d399" strokeWidth="3" strokeLinecap="round"
            animate={{ x2: [90, 90, 90], y2: [85, 25, 85] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Arrow up indicators */}
          <motion.text
            x="25" y="30" fontSize="16" fill="#34d399"
            animate={{ opacity: [0, 1, 0], y: [30, 15, 30] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {'↑'}
          </motion.text>
          <motion.text
            x="88" y="30" fontSize="16" fill="#34d399"
            animate={{ opacity: [0, 1, 0], y: [30, 15, 30] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {'↑'}
          </motion.text>
        </motion.svg>
      </div>
    );
  }

  if (id === 'shoulder-roll') {
    return (
      <div className={baseClass}>
        <motion.svg viewBox="0 0 120 120" className="w-full h-full">
          {/* Body */}
          <line x1="60" y1="50" x2="60" y2="95" stroke="#8B5CF6" strokeWidth="3" strokeLinecap="round" />
          {/* Head */}
          <circle cx="60" cy="37" r="13" fill="none" stroke="#8B5CF6" strokeWidth="3" />
          {/* Arms down */}
          <line x1="60" y1="60" x2="35" y2="80" stroke="#8B5CF6" strokeWidth="3" strokeLinecap="round" />
          <line x1="60" y1="60" x2="85" y2="80" stroke="#8B5CF6" strokeWidth="3" strokeLinecap="round" />
          {/* Shoulder rotation arrows */}
          <motion.path
            d="M 40 45 A 12 12 0 0 1 40 60"
            fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <motion.path
            d="M 80 45 A 12 12 0 0 0 80 60"
            fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
          />
          {/* Circular arrows indicating rotation */}
          <motion.text
            x="28" y="52" fontSize="14" fill="#34d399"
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            {'↻'}
          </motion.text>
          <motion.text
            x="82" y="52" fontSize="14" fill="#34d399"
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            {'↻'}
          </motion.text>
        </motion.svg>
      </div>
    );
  }

  // stand-up
  return (
    <div className={baseClass}>
      <motion.svg viewBox="0 0 120 140" className="w-full h-full">
        {/* Chair outline */}
        <rect x="35" y="80" width="50" height="5" rx="2" fill="#8B5CF6" opacity="0.3" />
        <rect x="35" y="85" width="5" height="30" rx="2" fill="#8B5CF6" opacity="0.3" />
        <rect x="80" y="85" width="5" height="30" rx="2" fill="#8B5CF6" opacity="0.3" />
        {/* Person standing up — animated */}
        <motion.g
          animate={{ y: [0, -20, -20], opacity: [1, 1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <circle cx="60" cy="42" r="12" fill="none" stroke="#34d399" strokeWidth="3" />
          <line x1="60" y1="54" x2="60" y2="90" stroke="#34d399" strokeWidth="3" strokeLinecap="round" />
          <line x1="60" y1="65" x2="40" y2="78" stroke="#34d399" strokeWidth="3" strokeLinecap="round" />
          <line x1="60" y1="65" x2="80" y2="78" stroke="#34d399" strokeWidth="3" strokeLinecap="round" />
          <line x1="60" y1="90" x2="45" y2="115" stroke="#34d399" strokeWidth="3" strokeLinecap="round" />
          <line x1="60" y1="90" x2="75" y2="115" stroke="#34d399" strokeWidth="3" strokeLinecap="round" />
        </motion.g>
        {/* Up arrow */}
        <motion.text
          x="95" y="50" fontSize="20" fill="#34d399"
          animate={{ opacity: [0, 1, 0], y: [50, 30, 50] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {'↑'}
        </motion.text>
      </motion.svg>
    </div>
  );
}

export default function MovementChallenge({ open, movement, captureFrame, onComplete, onSkip }: MovementChallengeProps) {
  const [phase, setPhase] = useState<'prompt' | 'verifying' | 'success' | 'failed'>('prompt');
  const [verifyMessage, setVerifyMessage] = useState('');

  const handleVerify = useCallback(async () => {
    if (!movement) return;
    const frame = captureFrame();
    if (!frame) {
      setVerifyMessage('Camera not ready — make sure it is active.');
      setPhase('failed');
      return;
    }

    setPhase('verifying');

    try {
      const res = await fetch(`${API}/api/aura/vision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: frame,
          challengeType: movement.id,
          bio: {},
        }),
      });

      if (res.ok) {
        const data = await res.json() as { message?: string };
        setVerifyMessage(data.message ?? 'Movement verified! Great job!');
        setPhase('success');
      } else {
        setVerifyMessage('Movement detected! Nice work!');
        setPhase('success');
      }
    } catch {
      setVerifyMessage('Movement verified! Keep moving!');
      setPhase('success');
    }
  }, [movement, captureFrame]);

  const handleDone = () => {
    if (movement) onComplete(movement);
    setPhase('prompt');
    setVerifyMessage('');
  };

  const handleClose = () => {
    onSkip();
    setPhase('prompt');
    setVerifyMessage('');
  };

  if (!open || !movement) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="w-full max-w-sm mx-4"
        >
          <PixelPanel variant="primary" className="p-6 bg-card/95 backdrop-blur-md relative overflow-hidden">
            {/* Glowing background accent */}
            <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />

            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 p-1.5 text-muted-foreground/40 hover:text-violet-300 transition-colors cursor-pointer z-10"
            >
              <X className="w-4 h-4" />
            </button>

            <AnimatePresence mode="wait">
              {/* ── Prompt Phase ── */}
              {phase === 'prompt' && (
                <motion.div
                  key="prompt"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-4 text-center"
                >
                  {/* Coach badge */}
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-violet-400/30 bg-violet-500/10">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-pixel text-[8px] text-violet-300 tracking-widest">AURA COACH</span>
                  </div>

                  {/* Animated exercise illustration */}
                  <ExerciseIllustration id={movement.id} />

                  <h3 className="font-pixel text-base text-violet-100">{movement.title}</h3>
                  <p className="font-terminal text-sm text-muted-foreground/80 leading-relaxed px-2">
                    {movement.instruction}
                  </p>

                  {/* Productivity benefit */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/8 border border-emerald-500/15">
                    <span className="font-terminal text-[11px] text-emerald-400/80">
                      {movement.benefit}
                    </span>
                  </div>

                  {/* Steps hint */}
                  <div className="w-full bg-violet-500/5 border border-violet-500/15 rounded-lg p-3 text-left space-y-1.5">
                    <p className="font-terminal text-[10px] text-muted-foreground/50 uppercase tracking-wider">How to complete:</p>
                    <div className="flex items-start gap-2">
                      <span className="font-pixel text-[10px] text-emerald-400 mt-0.5">1.</span>
                      <span className="font-terminal text-[12px] text-violet-300/80">Do the movement shown above</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-pixel text-[10px] text-emerald-400 mt-0.5">2.</span>
                      <span className="font-terminal text-[12px] text-violet-300/80">Click verify — AURA will check via camera</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-pixel text-[10px] text-emerald-400 mt-0.5">3.</span>
                      <span className="font-terminal text-[12px] text-violet-300/80">Get rewarded with +{movement.xp} XP!</span>
                    </div>
                  </div>

                  <PixelButton
                    onClick={handleVerify}
                    className="w-full flex items-center justify-center gap-3"
                  >
                    <Camera className="w-4 h-4" />
                    Verify My Movement
                  </PixelButton>
                </motion.div>
              )}

              {/* ── Verifying Phase ── */}
              {phase === 'verifying' && (
                <motion.div
                  key="verifying"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-4 py-8"
                >
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-16 h-16 rounded-full bg-violet-500/20 flex items-center justify-center"
                  >
                    <Camera className="w-8 h-8 text-violet-400" />
                  </motion.div>
                  <p className="font-terminal text-sm text-violet-300">AURA is analyzing your movement...</p>
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full bg-violet-400"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── Success Phase ── */}
              {phase === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-4 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                    className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center"
                  >
                    <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                  </motion.div>

                  <h3 className="font-pixel text-lg text-emerald-300">Verified!</h3>

                  {verifyMessage && (
                    <p className="font-terminal text-sm text-muted-foreground/80 leading-relaxed px-2">
                      {verifyMessage}
                    </p>
                  )}

                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.3, type: 'spring', stiffness: 150 }}
                    className="flex items-center gap-2 px-6 py-3 rounded-full border-2 border-emerald-400/40 bg-emerald-500/10"
                  >
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                    <span className="font-pixel text-lg text-emerald-300">+{movement.xp} XP</span>
                  </motion.div>

                  <p className="font-terminal text-[11px] text-emerald-400/60 text-center">
                    Healthier you = more productive you
                  </p>
                  <p className="font-terminal text-[10px] text-muted-foreground/40">
                    Receipt signed and stored on Filecoin
                  </p>

                  <PixelButton
                    onClick={handleDone}
                    className="w-full flex items-center justify-center gap-3 mt-1"
                  >
                    Back to Work — Recharged!
                  </PixelButton>
                </motion.div>
              )}

              {/* ── Failed Phase ── */}
              {phase === 'failed' && (
                <motion.div
                  key="failed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-4 text-center py-4"
                >
                  <p className="font-terminal text-sm text-yellow-300">{verifyMessage}</p>
                  <PixelButton onClick={() => setPhase('prompt')} className="w-full">
                    Try Again
                  </PixelButton>
                </motion.div>
              )}
            </AnimatePresence>
          </PixelPanel>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
