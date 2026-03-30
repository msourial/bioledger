import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IDKitRequestWidget, deviceLegacy } from '@worldcoin/idkit';
import type { IDKitResult } from '@worldcoin/idkit';
import { PixelButton, NeonText, PixelPanel } from '@/components/PixelUI';
import { Lock, ShieldCheck, Cpu, Activity, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
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

interface WorldIdConfig {
  configured: boolean;
  app_id: string | null;
  action: string;
  rp_id: string | null;
}

interface RpContext {
  rp_id: string;
  nonce: string;
  created_at: number;
  expires_at: number;
  signature: string;
}

const API = import.meta.env.VITE_API_BASE_URL ?? '';

export default function LockScreen({ onVerify }: LockScreenProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [stepIndex, setStepIndex] = useState(0);
  const [nullifier, setNullifier] = useState('');
  const [bioSourceConnected, setBioSourceConnected] = useState(false);

  const [worldIdConfig, setWorldIdConfig] = useState<WorldIdConfig | null>(null);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/world-id/config`)
      .then((r) => r.json())
      .then((cfg: WorldIdConfig) => setWorldIdConfig(cfg))
      .catch(() =>
        setWorldIdConfig({ configured: false, app_id: null, action: 'bio-ledger-verify', rp_id: null })
      );
  }, []);

  function runSimulation(existingNullifier?: string) {
    const hash = existingNullifier ?? generateNullifier();
    setNullifier(hash);
    setPhase('zk-verifying');
    setStepIndex(0);
    ZK_STEPS.forEach((_, i) => {
      setTimeout(() => {
        setStepIndex(i);
        if (i === ZK_STEPS.length - 1) setTimeout(() => setPhase('zk-done'), 700);
      }, i * 700);
    });
  }

  const handleWorldId = async () => {
    if (phase !== 'idle') return;
    if (worldIdConfig === null) return; // still loading — button is disabled
    setVerifyError(null);

    const existing = localStorage.getItem('bio_ledger_nullifier');

    if (!worldIdConfig.configured) {
      // No WORLD_ID_APP_ID — run the cosmetic simulation
      runSimulation(existing ?? undefined);
      return;
    }

    // WORLD_ID_APP_ID is set → open real IDKit widget
    try {
      const res = await fetch(`${API}/api/world-id/rp-context`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `RP context request failed (${res.status})`);
      }
      const ctx: RpContext = await res.json();
      setRpContext(ctx);
      setWidgetOpen(true);
    } catch (err) {
      console.error('[World ID] RP context error:', err);
      setVerifyError(err instanceof Error ? err.message : 'Failed to load World ID configuration.');
    }
  };

  const handleVerify = useCallback(async (result: IDKitResult) => {
    const response = result.responses?.[0];
    if (!response) throw new Error('No credential in proof result');

    let nullifier_hash: string;
    let proof: string | string[];
    let merkle_root: string | undefined;

    if (result.protocol_version === '3.0') {
      const r = response as { nullifier: string; proof: string; merkle_root: string };
      nullifier_hash = r.nullifier;
      proof = r.proof;
      merkle_root = r.merkle_root;
    } else {
      const r = response as { nullifier: string; proof: string[] };
      nullifier_hash = r.nullifier;
      proof = r.proof;
    }

    const verifyRes = await fetch(`${API}/api/verify-world-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nullifier_hash,
        merkle_root,
        proof,
        verification_level: 'device',
        protocol_version: result.protocol_version,
      }),
    });

    if (!verifyRes.ok) {
      const err = await verifyRes.json().catch(() => ({})) as { error?: string };
      throw new Error(err.error ?? 'Server verification failed');
    }

    const data = await verifyRes.json() as { nullifier_hash: string };
    localStorage.setItem('bio_ledger_nullifier', data.nullifier_hash);
    setNullifier(data.nullifier_hash);
  }, []);

  const handleSuccess = useCallback((_result: IDKitResult) => {
    setWidgetOpen(false);
    setPhase('zk-done');
  }, []);

  const handleError = useCallback(() => {
    setWidgetOpen(false);
    setVerifyError('World ID verification failed. Please try again.');
  }, []);

  const handleConnectWhoop = async () => {
    if (phase !== 'zk-done') return;
    setPhase('bio-connecting');
    setStepIndex(0);

    try {
      const res = await fetch(`${API}/api/auth/whoop`);
      const data = await res.json() as { mode: string; authUrl?: string };
      if (data.mode === 'oauth' && data.authUrl) {
        window.location.href = data.authUrl;
        return;
      }
    } catch {
      // fall through to demo mode
    }

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

  const widgetProps =
    worldIdConfig?.configured && worldIdConfig.app_id && rpContext
      ? {
          app_id: worldIdConfig.app_id as `app_${string}`,
          action: worldIdConfig.action,
          rp_context: rpContext,
          allow_legacy_proofs: true as const,
          preset: deviceLegacy(),
          open: widgetOpen,
          onOpenChange: setWidgetOpen,
          handleVerify,
          onSuccess: handleSuccess,
          onError: handleError,
        }
      : null;

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-background">
      {/* Aurora background orbs */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
      </div>

      {widgetProps && (
        <IDKitRequestWidget {...widgetProps}>
          {() => null}
        </IDKitRequestWidget>
      )}

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
          {/* Aurora orb logo */}
          <motion.div
            animate={{ y: [0, -8, 0], scale: [1, 1.04, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="w-24 h-24 mb-6 flex items-center justify-center"
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{
                background: 'radial-gradient(circle at 38% 38%, #a78bfa 0%, #8b5cf6 45%, #6d28d9 100%)',
                boxShadow: '0 0 32px rgba(139,92,246,0.55), 0 0 12px rgba(139,92,246,0.35)',
              }}
            >
              <ShieldCheck className="w-10 h-10 text-white/90" />
            </div>
          </motion.div>

          <h1 className="font-pixel text-xl sm:text-2xl mb-1 tracking-widest text-foreground">
            Bio-Ledger
          </h1>
          <h2 className="font-terminal text-sm sm:text-base mb-6 font-semibold" style={{ color: '#a78bfa' }}>
            Your Verifiable Life Graph
          </h2>

          <div className="w-full flex items-center gap-2 mb-6">
            <StepDot active={['zk-verifying', 'zk-done', 'bio-idle', 'bio-connecting', 'bio-done', 'entering'].includes(phase)} label="1" />
            <div className={cn('flex-1 h-px transition-colors duration-700', ['zk-done', 'bio-idle', 'bio-connecting', 'bio-done', 'entering'].includes(phase) ? 'bg-primary' : 'bg-muted/30')} />
            <StepDot active={['bio-connecting', 'bio-done', 'entering'].includes(phase)} label="2" />
          </div>
          <div className="w-full flex justify-between font-pixel text-[8px] text-muted-foreground/50 mb-8 -mt-3 px-1">
            <span>WORLD ID</span>
            <span>BIO-SOURCES</span>
          </div>

          {worldIdConfig && (
            <div className={`w-full flex items-center justify-center gap-1.5 mb-3 font-pixel text-[7px] ${worldIdConfig.configured ? 'text-primary/70' : 'text-muted-foreground/40'}`}>
              <span className={`w-1.5 h-1.5 rounded-full inline-block ${worldIdConfig.configured ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
              {worldIdConfig.configured ? 'WORLD ID — LIVE ZK PROOF' : 'WORLD ID — DEMO MODE'}
            </div>
          )}

          {verifyError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full flex items-center gap-2 bg-yellow-900/30 border border-yellow-700/40 p-2 mb-3 text-left"
            >
              <AlertTriangle className="w-3 h-3 text-yellow-400 flex-shrink-0" />
              <span className="font-terminal text-[10px] text-yellow-300">{verifyError}</span>
            </motion.div>
          )}

          <div className="w-full h-px bg-secondary mb-8 opacity-30" />

          <AnimatePresence mode="wait">
            {phase === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-4 w-full"
              >
                <p className="font-terminal text-sm text-muted-foreground mb-2 leading-relaxed">
                  Welcome! Prove your humanity privately with World ID, then unlock your personal wellness data.
                </p>
                <PixelButton
                  onClick={handleWorldId}
                  disabled={worldIdConfig === null}
                  className="w-full flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-wait"
                >
                  <Lock className="w-4 h-4" />
                  {worldIdConfig === null ? 'Loading…' : 'Sign in with World ID'}
                </PixelButton>
                <div className="relative">
                  <div className="w-full h-px bg-secondary/40 my-1" />
                  <span className="absolute inset-x-0 -top-2.5 flex justify-center">
                    <span className="px-2 bg-card font-terminal text-sm text-muted-foreground/40">then</span>
                  </span>
                </div>
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-dashed border-secondary/30 rounded-xl font-terminal text-sm text-muted-foreground/40 cursor-not-allowed"
                >
                  <Activity className="w-4 h-4" />
                  Connect bio-sources
                </button>
                <p className="font-pixel text-[8px] text-muted-foreground/40 mt-1">
                  Privacy-first · ZK proofs · Your data, forever yours
                </p>
              </motion.div>
            )}

            {phase === 'zk-verifying' && (
              <ZkAnimation steps={ZK_STEPS} stepIndex={stepIndex} label="VERIFYING WORLD ID..." />
            )}

            {phase === 'zk-done' && (
              <motion.div
                key="zk-done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-4 w-full"
              >
                <div className="flex items-center justify-center gap-2 font-terminal text-base font-semibold mb-2" style={{ color: '#34d399' }}>
                  <ShieldCheck className="w-5 h-5" />
                  Identity confirmed!
                </div>
                {worldIdConfig?.configured && (
                  <p className="font-terminal text-sm text-emerald-400/60 text-center">✓ ZK proof verified on-chain</p>
                )}
                <div className="w-full h-px bg-secondary/40" />
                <p className="font-terminal text-sm text-muted-foreground leading-relaxed">
                  Connect your wearables to unlock certified health metrics, or try the demo to explore.
                </p>
                <PixelButton
                  onClick={handleConnectWhoop}
                  className="w-full flex items-center justify-center gap-3"
                >
                  <Wifi className="w-4 h-4" />
                  Connect WHOOP / Apple Health
                </PixelButton>
                <button
                  onClick={handleDemoMode}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-violet-500/30 rounded-xl font-terminal text-sm text-muted-foreground hover:border-violet-400/60 hover:text-violet-300 transition-colors cursor-pointer"
                >
                  <WifiOff className="w-4 h-4" />
                  Try demo first
                </button>
                <p className="font-pixel text-[8px] text-muted-foreground/40">
                  WHOOP API V2 · Apple HealthKit · Privacy-first
                </p>
              </motion.div>
            )}

            {phase === 'bio-connecting' && (
              <ZkAnimation steps={BIO_STEPS} stepIndex={stepIndex} label="CONNECTING BIO-SOURCES..." />
            )}

            {(phase === 'bio-done' || phase === 'entering') && (
              <motion.div
                key="bio-done"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4"
              >
                <motion.div
                  animate={{ scale: [1, 1.12, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: 'radial-gradient(circle, #a78bfa 0%, #6d28d9 100%)', boxShadow: '0 0 28px rgba(139,92,246,0.5)' }}
                >
                  <ShieldCheck className="w-8 h-8 text-white" />
                </motion.div>
                <p className="font-terminal text-base font-semibold text-violet-300">
                  {bioSourceConnected ? 'WHOOP connected!' : 'Ready to explore!'}
                </p>
                <p className="font-terminal text-sm text-muted-foreground/60">Opening your wellness journey…</p>
              </motion.div>
            )}
          </AnimatePresence>
        </PixelPanel>
      </motion.div>
    </div>
  );
}

function generateNullifier(): string {
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  return '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function StepDot({ active, label }: { active: boolean; label: string }) {
  return (
    <motion.div
      animate={active ? { boxShadow: ['0 0 0px #8b5cf6', '0 0 10px #8b5cf6', '0 0 0px #8b5cf6'] } : {}}
      transition={{ duration: 2, repeat: Infinity }}
      className={cn(
        'w-6 h-6 flex-shrink-0 flex items-center justify-center border-2 rounded-full font-pixel text-[9px] transition-colors duration-500',
        active ? 'border-violet-400 text-violet-300 bg-violet-500/12' : 'border-muted text-muted-foreground/40 bg-transparent'
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
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
        <Cpu className="w-8 h-8 text-violet-400" />
      </motion.div>
      <p className="font-terminal text-sm text-muted-foreground/70">{label}</p>
      <div className="w-full bg-violet-500/5 border border-violet-500/20 rounded-xl p-4 text-left">
        {steps.slice(0, stepIndex + 1).map((step, i) => (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`font-terminal text-sm mb-1 ${i === stepIndex ? 'text-violet-300' : 'text-muted-foreground/50'}`}
          >
            {i < stepIndex ? '✓ ' : '↳ '}{step}
          </motion.div>
        ))}
      </div>
      <div className="w-full bg-secondary/20 h-1.5 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #8b5cf6, #fb7185)' }}
          animate={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>
    </motion.div>
  );
}
