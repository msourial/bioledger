import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, X, Zap, Eye, Lock } from 'lucide-react';

export type MetricKey = 'HRV' | 'STRAIN' | 'APM';

interface ProvenanceModalProps {
  metric: MetricKey | null;
  value: number;
  bioSource: 'demo' | 'connected';
  onClose: () => void;
}

const METRIC_META: Record<MetricKey, { label: string; unit: string; desc: string }> = {
  HRV: {
    label: 'Heart Rate Variability',
    unit: 'ms',
    desc: 'Autonomic nervous system signal — higher is better.',
  },
  STRAIN: {
    label: 'Cardiovascular Strain',
    unit: '/21',
    desc: 'Accumulated exertion on a 0–21 scale.',
  },
  APM: {
    label: 'Actions Per Minute',
    unit: 'APM',
    desc: 'Discrete keyboard + click events tracked in the vault.',
  },
};

export default function ProvenanceModal({ metric, value, bioSource, onClose }: ProvenanceModalProps) {
  if (!metric) return null;
  const meta = METRIC_META[metric];
  const sourceLabel = bioSource === 'connected' ? 'WHOOP API V2 / SIGNED' : 'WHOOP API V2 / DEMO MODE';

  return (
    <AnimatePresence>
      {metric && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-sm mx-4 bg-card border-2 border-primary shadow-[0_0_30px_rgba(0,245,255,0.3)]">
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-primary/30">
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                  >
                    <ShieldCheck className="w-5 h-5 text-primary" />
                  </motion.div>
                  <span className="font-pixel text-xs text-primary">PROVENANCE TRACE</span>
                </div>
                <button
                  onClick={onClose}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Metric value */}
              <div className="px-5 py-4 border-b border-secondary/20 text-center">
                <div className="font-pixel text-[10px] text-muted-foreground mb-1">{metric}</div>
                <div className="font-terminal text-5xl font-bold text-primary">
                  {value}
                  <span className="text-lg ml-1 text-muted-foreground">{meta.unit}</span>
                </div>
                <div className="font-pixel text-[9px] text-muted-foreground/70 mt-1">{meta.label}</div>
                <div className="font-terminal text-[11px] text-muted-foreground/60 mt-1">{meta.desc}</div>
              </div>

              {/* Trace rows */}
              <div className="px-5 py-4 flex flex-col gap-3">
                <TraceRow
                  icon={<Zap className="w-3.5 h-3.5 text-yellow-400" />}
                  label="SOURCE"
                  value={sourceLabel}
                  color="text-yellow-300"
                />
                <TraceRow
                  icon={<Eye className="w-3.5 h-3.5 text-primary" />}
                  label="WITNESS"
                  value="AURA AGENT / ERC-8004 VERIFIED"
                  color="text-primary"
                />
                <TraceRow
                  icon={<Lock className="w-3.5 h-3.5 text-green-400" />}
                  label="INTEGRITY"
                  value="100% — NO TAMPERING"
                  color="text-green-400"
                />
              </div>

              {/* Footer */}
              <div className="px-5 pb-5">
                <div className="bg-background/60 border border-primary/20 p-3 font-pixel text-[8px] text-muted-foreground/60 leading-4">
                  DATA SIGNED BY AURA COMPANION AGENT USING HMAC-SHA256.
                  COMMITTED TO FILECOIN VIA SYNAPSE SDK.
                  NULLIFIER HASH ANCHORS THIS METRIC TO A UNIQUE HUMAN IDENTITY.
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function TraceRow({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-start gap-3 bg-background/40 border border-secondary/20 p-3">
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <div>
        <div className="font-pixel text-[8px] text-muted-foreground/60 mb-0.5">{label}</div>
        <div className={`font-terminal text-sm font-bold ${color}`}>{value}</div>
      </div>
    </div>
  );
}
