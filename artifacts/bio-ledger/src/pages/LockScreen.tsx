import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PixelButton, NeonText, PixelPanel } from '@/components/PixelUI';
import { Lock, ShieldCheck, Cpu } from 'lucide-react';

interface LockScreenProps {
  onVerify: (nullifierHash: string) => void;
}

const VERIFY_STEPS = [
  "INITIALIZING ZK CIRCUIT...",
  "GENERATING SEMAPHORE PROOF...",
  "CHECKING MERKLE INCLUSION...",
  "VERIFYING NULLIFIER HASH...",
  "IDENTITY CONFIRMED",
];

function generateNullifier(): string {
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  return (
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export default function LockScreen({ onVerify }: LockScreenProps) {
  const [phase, setPhase] = useState<"idle" | "verifying" | "done">("idle");
  const [stepIndex, setStepIndex] = useState(0);

  const handleVerify = () => {
    if (phase !== "idle") return;
    setPhase("verifying");
    setStepIndex(0);

    const nullifier = generateNullifier();

    VERIFY_STEPS.forEach((_, i) => {
      setTimeout(() => {
        setStepIndex(i);
        if (i === VERIFY_STEPS.length - 1) {
          setTimeout(() => {
            setPhase("done");
            setTimeout(() => onVerify(nullifier), 600);
          }, 600);
        }
      }, i * 700);
    });
  };

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
        <PixelPanel variant="primary" className="flex flex-col items-center py-12 px-8 text-center bg-card/90 backdrop-blur-sm">

          <motion.div
            animate={{
              y: [0, -10, 0],
              boxShadow: [
                "0px 0px 0px 0px hsl(var(--primary))",
                "0px 0px 20px 5px hsl(var(--primary))",
                "0px 0px 0px 0px hsl(var(--primary))",
              ],
            }}
            transition={{ duration: 4, repeat: Infinity }}
            className="w-24 h-24 mb-8 bg-primary/10 flex items-center justify-center rounded-sm border-2 border-primary"
          >
            <img
              src={`${import.meta.env.BASE_URL}images/vault-logo.png`}
              alt="Vault Logo"
              className="w-16 h-16 object-contain"
            />
          </motion.div>

          <h1 className="font-pixel text-xl sm:text-2xl mb-2 tracking-widest text-foreground">
            BIO-LEDGER
          </h1>
          <h2 className="font-pixel text-[10px] sm:text-xs mb-10 text-muted-foreground">
            <NeonText>SOVEREIGN VAULT</NeonText>
          </h2>

          <div className="w-full h-px bg-secondary mb-10 opacity-50" />

          <AnimatePresence mode="wait">
            {phase === "idle" && (
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
                  onClick={handleVerify}
                  className="w-full flex items-center justify-center gap-3"
                >
                  <Lock className="w-4 h-4" />
                  VERIFY WITH WORLD ID
                </PixelButton>
                <p className="font-pixel text-[8px] text-muted-foreground/50 mt-2">
                  POWERED BY WORLD ID · SEMAPHORE ZK PROTOCOL
                </p>
              </motion.div>
            )}

            {phase === "verifying" && (
              <motion.div
                key="verifying"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-4 w-full"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Cpu className="w-8 h-8 text-primary" />
                </motion.div>
                <div className="w-full bg-background/80 border border-primary/30 p-4 text-left">
                  {VERIFY_STEPS.slice(0, stepIndex + 1).map((step, i) => (
                    <motion.div
                      key={step}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`font-terminal text-xs mb-1 ${
                        i === stepIndex ? "text-primary" : "text-muted-foreground/60"
                      }`}
                    >
                      {i < stepIndex ? "✓ " : "> "}{step}
                    </motion.div>
                  ))}
                </div>
                <div className="w-full bg-secondary/20 h-1 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary"
                    animate={{ width: `${((stepIndex + 1) / VERIFY_STEPS.length) * 100}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              </motion.div>
            )}

            {phase === "done" && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4"
              >
                <ShieldCheck className="w-12 h-12 text-primary" />
                <p className="font-pixel text-xs text-primary">
                  IDENTITY VERIFIED
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </PixelPanel>
      </motion.div>
    </div>
  );
}
