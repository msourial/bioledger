import { useState } from 'react';
import { motion } from 'framer-motion';
import { IDKitRequestWidget } from '@worldcoin/idkit';
import type { IDKitResult } from '@worldcoin/idkit';
import { deviceLegacy } from '@worldcoin/idkit';
import { PixelButton, NeonText, PixelPanel } from '@/components/PixelUI';
import { Lock, ShieldCheck } from 'lucide-react';

interface LockScreenProps {
  onVerify: (nullifierHash: string) => void;
}

export default function LockScreen({ onVerify }: LockScreenProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleDevBypass = () => {
    onVerify("0x" + Math.random().toString(16).slice(2, 10) + "dev_hash_override");
  };

  const onSuccess = (result: IDKitResult) => {
    setIsVerifying(true);
    setTimeout(() => {
      const response = result.responses[0];
      const nullifier =
        "nullifier" in response
          ? response.nullifier
          : "session_nullifier" in response
          ? response.session_nullifier[0]
          : result.nonce;
      onVerify(nullifier);
    }, 1500);
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

          {isVerifying ? (
            <div className="flex flex-col items-center gap-4">
              <ShieldCheck className="w-8 h-8 text-primary animate-pulse" />
              <p className="font-pixel text-xs text-primary animate-pulse">
                CRYPTOGRAPHIC VERIFICATION...
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 w-full">
              <IDKitRequestWidget
                app_id={"app_staging_bio_ledger_dev" as `app_${string}`}
                action="bio-ledger-verify"
                rp_context={{
                  rp_id: "rp_bio_ledger_dev",
                  nonce: "hackathon-dev-nonce",
                  created_at: Math.floor(Date.now() / 1000),
                  expires_at: Math.floor(Date.now() / 1000) + 3600,
                  signature: "0x00",
                }}
                allow_legacy_proofs={true}
                preset={deviceLegacy()}
                open={isOpen}
                onOpenChange={setIsOpen}
                onSuccess={onSuccess}
              />
              <PixelButton
                onClick={() => setIsOpen(true)}
                className="w-full flex items-center justify-center gap-3"
              >
                <Lock className="w-4 h-4" />
                VERIFY WITH WORLD ID
              </PixelButton>

              <button
                onClick={handleDevBypass}
                className="mt-4 text-[10px] font-pixel text-muted-foreground hover:text-accent underline underline-offset-4 transition-colors"
              >
                [DEV BYPASS] Skip Verification
              </button>
            </div>
          )}
        </PixelPanel>
      </motion.div>
    </div>
  );
}
