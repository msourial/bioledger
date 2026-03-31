import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, ExternalLink, Brain, Sparkles, Heart, Shield, Database, Leaf } from 'lucide-react';
import { cn, truncateHash } from '@/lib/utils';
import { type WorkReceipt } from '@workspace/api-client-react';

type StepStatus = 'ok' | 'partial' | 'failed';

const EMPTY_STATS = { hrv: 0, strain: 0, focusScore: 0, apm: 0, durationSeconds: 0 };

/** Safely read sessionStats — receipts from the DB may have null/undefined stats */
function safeStats(receipt: WorkReceipt) {
  const s = receipt.sessionStats as unknown as Record<string, number> | null | undefined;
  return s ? { ...EMPTY_STATS, ...s } : EMPTY_STATS;
}

interface ChainStep {
  label: string;
  sublabel: string;
  value: string;
  detail?: string;
  status: StepStatus;
  link?: string;
  icon: React.ReactNode;
}

function StatusIcon({ status, className }: { status: StepStatus; className?: string }) {
  if (status === 'ok') return <CheckCircle2 className={cn('w-3.5 h-3.5 text-emerald-400', className)} />;
  if (status === 'partial') return <AlertTriangle className={cn('w-3.5 h-3.5 text-amber-400', className)} />;
  return <XCircle className={cn('w-3.5 h-3.5 text-red-400', className)} />;
}

function statusColor(status: StepStatus) {
  if (status === 'ok') return 'text-emerald-400';
  if (status === 'partial') return 'text-amber-400';
  return 'text-red-400';
}

function buildWorkSteps(receipt: WorkReceipt): ChainStep[] {
  const sessionStats = safeStats(receipt);
  const { physicalIntegrity, companionSignature, receiptCid, cidStatus } = receipt;

  const storageStatus: StepStatus =
    cidStatus === 'stored' ? 'ok' :
    cidStatus === 'failed' ? 'failed' : 'partial';

  return [
    {
      label: 'Identity Verified',
      sublabel: 'World ID · Zero-Knowledge Proof',
      value: truncateHash(receipt.nullifierHash),
      detail: 'You proved your humanity — privately.',
      status: 'ok',
      icon: <Shield className="w-3.5 h-3.5" />,
    },
    {
      label: 'Body Metrics Captured',
      sublabel: 'WHOOP · MediaPipe Vision',
      value: `HRV ${sessionStats.hrv}ms · Strain ${sessionStats.strain} · Focus ${sessionStats.focusScore}/100`,
      detail: physicalIntegrity ? 'Physical presence confirmed ✓' : 'Session presence incomplete',
      status: physicalIntegrity ? 'ok' : 'partial',
      icon: <Heart className="w-3.5 h-3.5" />,
    },
    {
      label: 'AURA Co-Signed',
      sublabel: 'ERC-8004 · HMAC-SHA256',
      value: truncateHash(companionSignature),
      detail: 'Your AI companion verified this session.',
      status: 'ok',
      icon: <Sparkles className="w-3.5 h-3.5" />,
    },
    {
      label: 'Saved to Filecoin',
      sublabel: 'Synapse SDK · Decentralized Storage',
      value: receiptCid ? `${receiptCid.slice(0, 18)}…` : cidStatus === 'failed' ? 'Upload failed' : 'Pending upload',
      detail: receiptCid ? 'Permanently stored — yours forever.' : 'Add SYNAPSE_API_KEY to enable.',
      status: storageStatus,
      link: receiptCid ? `https://w3s.link/ipfs/${receiptCid}` : undefined,
      icon: <Database className="w-3.5 h-3.5" />,
    },
  ];
}

function buildInsightSteps(receipt: WorkReceipt): ChainStep[] {
  const sessionStats = safeStats(receipt);
  const { physicalIntegrity, companionSignature, insightText } = receipt;
  const summaryText = insightText
    ? (insightText.length > 60 ? insightText.slice(0, 60) + '…' : insightText)
    : `HRV ${sessionStats.hrv}ms · Strain ${sessionStats.strain}`;

  return [
    {
      label: 'Body Metrics',
      sublabel: 'HRV · Strain · Focus Score',
      value: summaryText,
      detail: physicalIntegrity ? 'Session integrity confirmed' : 'Partial presence',
      status: physicalIntegrity ? 'ok' : 'partial',
      icon: <Heart className="w-3.5 h-3.5" />,
    },
    {
      label: 'AURA Reflection',
      sublabel: 'AI Wellness Insight',
      value: truncateHash(companionSignature),
      detail: 'Signed by your personal AURA companion.',
      status: 'ok',
      icon: <Sparkles className="w-3.5 h-3.5" />,
    },
  ];
}

function buildWellnessSteps(receipt: WorkReceipt): ChainStep[] {
  const sessionStats = safeStats(receipt);
  const { physicalIntegrity, companionSignature, insightText, receiptCid, cidStatus } = receipt;
  const xpMatch = insightText?.match(/\+(\d+)XP/);
  const xp = xpMatch ? xpMatch[1] : '?';
  const challengeLabel = insightText?.replace(/^\[WELLNESS \+\d+XP\] /, '') ?? 'Wellness challenge';
  const storageStatus: StepStatus = cidStatus === 'stored' ? 'ok' : cidStatus === 'failed' ? 'failed' : 'partial';

  return [
    {
      label: 'Wellness Challenge',
      sublabel: 'AURA Proactive Coaching',
      value: challengeLabel,
      detail: physicalIntegrity ? 'Physical presence confirmed ✓' : 'Challenge completed',
      status: 'ok',
      icon: <Leaf className="w-3.5 h-3.5" />,
    },
    {
      label: `XP Earned: +${xp} XP`,
      sublabel: 'AURA Co-Signed · ERC-8004',
      value: truncateHash(companionSignature),
      detail: `HRV ${sessionStats.hrv}ms · Strain ${sessionStats.strain}/21`,
      status: 'ok',
      icon: <Sparkles className="w-3.5 h-3.5" />,
    },
    {
      label: 'Saved to Filecoin',
      sublabel: 'Synapse SDK · Decentralized Storage',
      value: receiptCid ? `${receiptCid.slice(0, 18)}…` : cidStatus === 'failed' ? 'Upload failed' : 'Pending upload',
      detail: receiptCid ? 'Wellness receipt permanently stored.' : 'Add SYNAPSE_API_KEY to enable.',
      status: storageStatus,
      link: receiptCid ? `https://w3s.link/ipfs/${receiptCid}` : undefined,
      icon: <Database className="w-3.5 h-3.5" />,
    },
  ];
}

interface ReceiptChainCardProps {
  receipt: WorkReceipt;
  index: number;
}

export default function ReceiptChainCard({ receipt, index }: ReceiptChainCardProps) {
  const isInsight = receipt.receiptType === 'insight';
  const isWellness = receipt.receiptType === 'wellness';
  const steps = isWellness ? buildWellnessSteps(receipt) : isInsight ? buildInsightSteps(receipt) : buildWorkSteps(receipt);
  const okCount = steps.filter(s => s.status === 'ok').length;
  const overallStatus: StepStatus =
    okCount === steps.length ? 'ok' :
    okCount === 0 ? 'failed' : 'partial';

  const date = new Date(receipt.createdAt);
  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const focusScore = safeStats(receipt).focusScore;
  const scoreGradient =
    focusScore >= 80 ? 'from-emerald-400/20 to-violet-500/10' :
    focusScore >= 60 ? 'from-violet-500/20 to-rose-400/10' :
    'from-amber-400/15 to-rose-400/10';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease: 'easeOut' }}
      className={cn(
        'milestone-card p-4 relative overflow-hidden',
        isInsight && 'milestone-card-mint',
        isWellness && 'milestone-card-mint'
      )}
    >
      {/* Top gradient accent bar */}
      <div className={cn(
        'absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r',
        isWellness ? 'from-emerald-400/80 via-teal-400/50 to-transparent'
          : overallStatus === 'ok' ? 'from-violet-400/80 via-emerald-400/60 to-transparent'
          : overallStatus === 'partial' ? 'from-amber-400/80 via-violet-400/40 to-transparent'
          : 'from-red-400/60 to-transparent'
      )} />

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {isWellness ? (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400/20 to-teal-400/20 border border-emerald-400/30 flex items-center justify-center flex-shrink-0">
              <Leaf className="w-4 h-4 text-emerald-300" />
            </div>
          ) : isInsight ? (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400/20 to-rose-400/20 border border-violet-400/30 flex items-center justify-center flex-shrink-0">
              <Brain className="w-4 h-4 text-violet-300" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400/20 to-violet-400/20 border border-emerald-400/30 flex items-center justify-center flex-shrink-0">
              <StatusIcon status={overallStatus} className="w-4 h-4" />
            </div>
          )}
          <div>
            <div className="font-terminal text-sm font-semibold text-white/90">
              {isWellness ? '🌿 Wellness Receipt' : isInsight ? 'AURA Wellness Insight' : 'Focus Session'}
            </div>
            <div className="font-terminal text-sm text-muted-foreground">
              {dateStr} · {timeStr}
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div className="flex flex-col items-end gap-1">
          {receipt.isDemo && (
            <span className="font-terminal text-xs font-semibold px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/25 rounded-full">
              Demo
            </span>
          )}
          {isWellness ? (
            <span className="font-terminal text-xs font-semibold px-2 py-0.5 border bg-emerald-500/10 text-emerald-300 border-emerald-400/30 rounded-full">
              🌿 Wellness
            </span>
          ) : isInsight ? (
            <span className="font-terminal text-xs font-semibold px-2 py-0.5 border bg-violet-500/10 text-violet-300 border-violet-400/30 rounded-full">
              ✦ Insight
            </span>
          ) : (
            <span className={cn(
              'font-terminal text-xs font-semibold px-2 py-0.5 border rounded-full',
              overallStatus === 'ok'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-400/30'
                : overallStatus === 'partial'
                ? 'bg-amber-500/10 text-amber-300 border-amber-400/30'
                : 'bg-red-500/10 text-red-300 border-red-400/30'
            )}>
              {overallStatus === 'ok' ? '✓ Verified' : overallStatus === 'partial' ? '~ Partial' : '✗ Error'}
            </span>
          )}
        </div>
      </div>

      {/* Wellness insight preview */}
      {isWellness && receipt.insightText && (
        <div className="mb-3 p-3 bg-emerald-500/8 border border-emerald-400/15 rounded-xl font-terminal text-sm text-emerald-100/80 leading-relaxed line-clamp-2">
          {receipt.insightText.replace(/^\[WELLNESS \+\d+XP\] /, '')}
        </div>
      )}

      {/* Insight text preview */}
      {isInsight && receipt.insightText && (
        <div className="mb-3 p-3 bg-violet-500/8 border border-violet-400/15 rounded-xl font-terminal text-sm text-white/80 leading-relaxed italic line-clamp-3">
          "{receipt.insightText}"
        </div>
      )}

      {/* Chain steps — clean card list */}
      <div className="flex flex-col gap-2">
        {steps.map((step, i) => (
          <div
            key={step.label}
            className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]"
          >
            {/* Step icon */}
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
              step.status === 'ok'
                ? 'bg-emerald-400/15 text-emerald-400 border border-emerald-400/30'
                : step.status === 'partial'
                ? 'bg-amber-400/15 text-amber-400 border border-amber-400/30'
                : 'bg-red-400/15 text-red-400 border border-red-400/30'
            )}>
              {step.icon}
            </div>

            {/* Step text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-terminal text-sm font-semibold text-white/90">
                  {step.label}
                </span>
                <span className="font-terminal text-sm text-muted-foreground">
                  {step.sublabel}
                </span>
              </div>
              <div className="font-terminal text-sm text-white/60 break-all mt-0.5">
                {step.link ? (
                  <a
                    href={step.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-300 underline hover:text-violet-200 inline-flex items-center gap-1"
                  >
                    {step.value}
                    <ExternalLink className="w-2.5 h-2.5 inline flex-shrink-0" />
                  </a>
                ) : (
                  <span>{step.value}</span>
                )}
              </div>
              {step.detail && (
                <div className="font-terminal text-sm text-muted-foreground/70 mt-0.5">{step.detail}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Score footer */}
      <div className={cn('mt-3 pt-3 border-t border-white/8 flex justify-between items-center')}>
        <span className="font-terminal text-sm text-muted-foreground">
          {isInsight ? 'AI Wellness Note' : `${Math.round(safeStats(receipt).durationSeconds / 60)} min session`}
        </span>
        <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold font-terminal bg-gradient-to-r', scoreGradient, 'border border-white/10')}>
          {isInsight ? (
            <span className="text-violet-300">✦ AURA Signed</span>
          ) : (
            <span className="text-emerald-300">
              Focus <span className="font-bold">{safeStats(receipt).focusScore}</span>/100
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
