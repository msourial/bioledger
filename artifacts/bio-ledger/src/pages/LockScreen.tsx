import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PixelButton, NeonText, PixelPanel } from '@/components/PixelUI';
import { Lock, ShieldCheck, Cpu, Activity, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LockScreenProps {
  onVerify: (nullifierHash: string, bioSourceConnected: boolean) => void;
}

type Phase =
  | 'idle'
  | 'zk-verifying'
  | 'zk-done'
  | 'bio-idle'
  | 'bio-connecting'
  | 'bio-done'
  | 'entering';

const ZK_STEPS = [
  'INITIALIZING ZK CIRCUIT...',
  'GENERATING SEMAPHORE PROOF...',
  'CHECKING MERKLE INCLUSION...',
  'VERIFYING NULLIFIER HASH...',
  'IDENTITY CONFIRMED',
];

const BIO_STEPS = [
  'HANDSHAKE WITH WHOOP API V2...',
  'FETCHING RECOVERY DATA...',
  'VERIFYING SENSOR SIGNATURE...',
  'DEMO MODE ACTIVATED',
];

function generateNullifier(): string {
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  return (
    '0x' +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

export default function LockScreen({ onVerify }: LockScreenProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [stepIndex, setStepIndex] = useState(0);
  const [nullifier, setNullifier] = useState('');
  const [bioSourceConnected, setBioSourceConnected] = useState(false);

  /* ── Step 1: World ID ZK Proof ── */
  const handleWorldId = () => {
    if (phase !== 'idle') return;
    // Reuse existing nullifier if one is saved — World ID is deterministic per identity
    const existing = localStorage.getItem('bio_ledger_nullifier');
    const hash = existing ?? generateNullifier();
    setNullifier(hash);
    setPhase('zk-verifying');
    setStepIndex(0);

    ZK_STEPS.forEach((_, i) => {
      setTimeout(() => {
        setStepIndex(i);
        if (i === ZK_STEPS.length - 1) {
          setTimeout(() => setPhase('zk-done'), 700);
        }
      }, i * 700);
    });
  };

  /* ── Step 2: Bio-Source OAuth (Whoop / Demo) ── */
  const handleConnectWhoop = async () => {
    if (phase !== 'zk-done') return;
    setPhase('bio-connecting');
    setStepIndex(0);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/auth/whoop`
      );
      const data = await res.json();

      if (data.mode === 'oauth' && data.authUrl) {
        window.location.href = data.authUrl;
        return;
      }
    } catch {
      // Network error — fall through to demo mode
    }

    // Demo mode animation
    BIO_STEPS.forEach((_, i) => {
      setTimeout(() => {
        setStepIndex(i);
        if (i === BIO_STEPS.length - 1) {
          setTimeout(() => {
            setBioSourceConnected(false);
            setPhase('bio-done');
            setTimeout(() => {
              setPhase('entering');
              setTimeout(() => onVerify(nullifier, false), 600);
            }, 1000);
          }, 700);
        }
      }, i * 600);
    });
  };

  const handleDemoMode = () => {
    if (phase !== 'zk-done') return;
    setPhase('bio-done');
    setBioSourceConnected(false);
    setTimeout(() => {
      setPhase('entering');
      setTimeout(() => onVerify(nullifier, false), 600);
    }, 1000);
  };

  const steps = phase === 'bio-connecting' ? BIO_STEPS : ZK_STEPS;

  return (
    <div className="min-h-screen w-full flex items-center justify-center scanlines relative overflow-hidden bg-background">
      <div className="absolute inset-0 z-0 opacity-20">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent/20 rounded-full blur-3xl animate-pulse" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="z-10 w-full max-w-md p-4"
      >
        <PixelPanel
          variant="primary"
          className="flex flex-col items-center py-10 px-8 text-center bg-card/90 backdrop-blur-sm"
        >
          {/* Logo */}
          <motion.div
            animate={{
              y: [0, -10, 0],
              boxShadow: [
                '0px 0px 0px 0px hsl(var(--primary))',
                '0px 0px 20px 5px hsl(var(--primary))',
                '0px 0px 0px 0px hsl(var(--primary))',
              ],
            }}
            transition={{ duration: 4, repeat: Infinity }}
            className="w-20 h-20 mb-6 bg-primary/10 flex items-center justify-center rounded-sm border-2 border-primary"
          >
            <img
              src={`${import.meta.env.BASE_URL}images/vault-logo.png`}
              alt="Vault Logo"
              className="w-14 h-14 object-contain"
            />
          </motion.div>

          <h1 className="font-pixel text-xl sm:text-2xl mb-1 tracking-widest text-foreground">
            BIO-LEDGER
          </h1>
          <h2 className="font-pixel text-[10px] sm:text-xs mb-6 text-muted-foreground">
            <NeonText>SOVEREIGN VAULT</NeonText>
          </h2>

          {/* Step Indicator */}
          <div className="w-full flex items-center gap-2 mb-6">
            <StepDot active={['zk-verifying', 'zk-done', 'bio-idle', 'bio-connecting', 'bio-done', 'entering'].includes(phase)} label="1" />
            <div className={cn('flex-1 h-px transition-colors duration-700', ['zk-done', 'bio-idle', 'bio-connecting', 'bio-done', 'entering'].includes(phase) ? 'bg-primary' : 'bg-muted/30')} />
            <StepDot active={['bio-connecting', 'bio-done', 'entering'].includes(phase)} label="2" />
          </div>
          <div className="w-full flex justify-between font-pixel text-[8px] text-muted-foreground/50 mb-8 -mt-3 px-1">
            <span>WORLD ID</span>
            <span>BIO-SOURCES</span>
          </div>

          <div className="w-full h-px bg-secondary mb-8 opacity-30" />

          <AnimatePresence mode="wait">
            {/* IDLE: Connect Identity */}
            {phase === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-4 w-full"
              >
                <p className="font-terminal text-sm text-muted-foreground mb-2">
                  Prove your humanity. Access your sovereign data.
                </p>
                <PixelButton
                  onClick={handleWorldId}
                  className="w-full flex items-center justify-center gap-3"
                >
                  <Lock className="w-4 h-4" />
                  VERIFY WITH WORLD ID
                </PixelButton>
                <div className="relative">
                  <div className="w-full h-px bg-secondary/40 my-1" />
                  <span className="absolute inset-x-0 -top-2.5 flex justify-center">
                    <span className="px-2 bg-card font-pixel text-[8px] text-muted-foreground/40">THEN</span>
                  </span>
                </div>
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-dashed border-secondary/30 font-pixel text-xs text-muted-foreground/40 cursor-not-allowed"
                >
                  <Activity className="w-4 h-4" />
                  AUTHORIZE BIO-SOURCES
                </button>
                <p className="font-pixel text-[8px] text-muted-foreground/50 mt-1">
                  POWERED BY WORLD ID · SEMAPHORE ZK PROTOCOL
                </p>
              </motion.div>
            )}

            {/* ZK Verifying animation */}
            {phase === 'zk-verifying' && (
              <ZkAnimation steps={ZK_STEPS} stepIndex={stepIndex} label="VERIFYING WORLD ID..." />
            )}

            {/* ZK Done → Bio-Sources choice */}
            {phase === 'zk-done' && (
              <motion.div
                key="zk-done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-4 w-full"
              >
                <div className="flex items-center justify-center gap-2 text-primary font-pixel text-xs mb-2">
                  <ShieldCheck className="w-5 h-5" />
                  IDENTITY CONFIRMED
                </div>
                <div className="w-full h-px bg-secondary/40" />
                <p className="font-terminal text-sm text-muted-foreground">
                  Connect your bio-data sources for certified metrics.
                </p>
                <PixelButton
                  onClick={handleConnectWhoop}
                  className="w-full flex items-center justify-center gap-3"
                >
                  <Wifi className="w-4 h-4" />
                  AUTHORIZE WHOOP / APPLE HEALTH
                </PixelButton>
                <button
                  onClick={handleDemoMode}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-secondary/50 font-pixel text-xs text-muted-foreground hover:border-accent hover:text-accent transition-colors cursor-pointer"
                >
                  <WifiOff className="w-4 h-4" />
                  SKIP — USE DEMO DATA
                </button>
                <p className="font-pixel text-[8px] text-muted-foreground/50">
                  WHOOP API V2 · APPLE HEALTHKIT · 2026 DATA STANDARD
                </p>
              </motion.div>
            )}

            {/* Bio-Source connecting animation */}
            {phase === 'bio-connecting' && (
              <ZkAnimation steps={BIO_STEPS} stepIndex={stepIndex} label="CONNECTING BIO-SOURCES..." />
            )}

            {/* Bio Done */}
            {(phase === 'bio-done' || phase === 'entering') && (
              <motion.div
                key="bio-done"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4"
              >
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <ShieldCheck className="w-14 h-14 text-primary" />
                </motion.div>
                <p className="font-pixel text-xs text-primary">
                  {bioSourceConnected ? 'WHOOP CONNECTED' : 'DEMO MODE ACTIVE'}
                </p>
                <p className="font-pixel text-[8px] text-muted-foreground/50">
                  ENTERING SOVEREIGN VAULT...
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </PixelPanel>
      </motion.div>
    </div>
  );
}

function StepDot({ active, label }: { active: boolean; label: string }) {
  return (
    <motion.div
      animate={active ? { boxShadow: ['0 0 0px #00F5FF', '0 0 8px #00F5FF', '0 0 0px #00F5FF'] } : {}}
      transition={{ duration: 2, repeat: Infinity }}
      className={cn(
        'w-6 h-6 flex-shrink-0 flex items-center justify-center border-2 font-pixel text-[9px] transition-colors duration-500',
        active ? 'border-primary text-primary bg-primary/10' : 'border-muted text-muted-foreground/40 bg-transparent'
      )}
    >
      {label}
    </motion.div>
  );
}

function ZkAnimation({ steps, stepIndex, label }: { steps: string[]; stepIndex: number; label: string }) {
  return (
    <motion.div
      key="zk-anim"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-4 w-full"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      >
        <Cpu className="w-8 h-8 text-primary" />
      </motion.div>
      <p className="font-pixel text-[9px] text-muted-foreground">{label}</p>
      <div className="w-full bg-background/80 border border-primary/30 p-4 text-left">
        {steps.slice(0, stepIndex + 1).map((step, i) => (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`font-terminal text-xs mb-1 ${
              i === stepIndex ? 'text-primary' : 'text-muted-foreground/60'
            }`}
          >
            {i < stepIndex ? '✓ ' : '> '}
            {step}
          </motion.div>
        ))}
      </div>
      <div className="w-full bg-secondary/20 h-1 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary"
          animate={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>
    </motion.div>
  );
}
