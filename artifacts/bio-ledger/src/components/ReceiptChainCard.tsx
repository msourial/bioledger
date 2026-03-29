import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, ExternalLink, Brain } from 'lucide-react';
import { cn, truncateHash } from '@/lib/utils';
import { type WorkReceipt } from '@workspace/api-client-react';

type StepStatus = 'ok' | 'partial' | 'failed';

interface ChainStep {
  label: string;
  sublabel: string;
  value: string;
  detail?: string;
  status: StepStatus;
  link?: string;
}

function StatusIcon({ status, className }: { status: StepStatus; className?: string }) {
  if (status === 'ok') return <CheckCircle2 className={cn('w-4 h-4 text-primary', className)} />;
  if (status === 'partial') return <AlertTriangle className={cn('w-4 h-4 text-yellow-400', className)} />;
  return <XCircle className={cn('w-4 h-4 text-red-400', className)} />;
}

function statusColor(status: StepStatus) {
  if (status === 'ok') return 'border-primary/60 text-primary';
  if (status === 'partial') return 'border-yellow-500/60 text-yellow-400';
  return 'border-red-600/60 text-red-400';
}

function statusGlyph(status: StepStatus) {
  if (status === 'ok') return '✓';
  if (status === 'partial') return '⚠';
  return '✗';
}

function buildWorkSteps(receipt: WorkReceipt): ChainStep[] {
  const { sessionStats, physicalIntegrity, companionSignature, receiptCid, cidStatus } = receipt;

  const storageStatus: StepStatus =
    cidStatus === 'stored' ? 'ok' :
    cidStatus === 'failed' ? 'failed' : 'partial';

  return [
    {
      label: 'IDENTITY',
      sublabel: 'WORLD ID · ZK PROOF',
      value: truncateHash(receipt.nullifierHash),
      detail: 'Semaphore nullifier bound',
      status: 'ok',
    },
    {
      label: 'BIOMETRICS',
      sublabel: 'WHOOP · MEDIAPIPE',
      value: `HRV ${sessionStats.hrv}ms · Strain ${sessionStats.strain} · Vision ${sessionStats.focusScore}/100`,
      detail: physicalIntegrity ? 'Physical Integrity ✓' : 'Physical Integrity ✗',
      status: physicalIntegrity ? 'ok' : 'partial',
    },
    {
      label: 'SIGNATURE',
      sublabel: 'ERC-8004 · HMAC-SHA256',
      value: truncateHash(companionSignature),
      detail: 'AURA-AGENT-V1',
      status: 'ok',
    },
    {
      label: 'STORAGE',
      sublabel: 'FILECOIN · SYNAPSE',
      value: receiptCid ? `${receiptCid.slice(0, 18)}…` : cidStatus === 'failed' ? 'UPLOAD FAILED' : 'STORAGE PENDING',
      detail: receiptCid ? 'Warm storage confirmed' : 'Set SYNAPSE_API_KEY',
      status: storageStatus,
      link: receiptCid ? `https://w3s.link/ipfs/${receiptCid}` : undefined,
    },
  ];
}

function buildInsightSteps(receipt: WorkReceipt): ChainStep[] {
  const { sessionStats, physicalIntegrity, companionSignature, insightText } = receipt;
  const summaryText = insightText
    ? (insightText.length > 60 ? insightText.slice(0, 60) + '…' : insightText)
    : `HRV ${sessionStats.hrv}ms · Strain ${sessionStats.strain}`;

  return [
    {
      label: 'IDENTITY',
      sublabel: 'WORLD ID · ZK PROOF',
      value: truncateHash(receipt.nullifierHash),
      detail: 'Semaphore nullifier bound',
      status: 'ok',
    },
    {
      label: 'AI INSIGHT',
      sublabel: 'AURA ANALYSIS · LIVE BIO',
      value: summaryText,
      detail: physicalIntegrity ? 'Physical Integrity ✓' : 'Physical Integrity ✗',
      status: physicalIntegrity ? 'ok' : 'partial',
    },
    {
      label: 'SIGNATURE',
      sublabel: 'AURA INSIGHT · HMAC-SHA256',
      value: truncateHash(companionSignature),
      detail: 'AURA-AGENT-V1',
      status: 'ok',
    },
  ];
}

interface ReceiptChainCardProps {
  receipt: WorkReceipt;
  isDemo?: boolean;
  index?: number;
}

export default function ReceiptChainCard({ receipt, isDemo = false, index = 0 }: ReceiptChainCardProps) {
  const isInsight = receipt.receiptType === 'insight';
  const steps = isInsight ? buildInsightSteps(receipt) : buildWorkSteps(receipt);
  const allOk = steps.every((s) => s.status === 'ok');
  const hasFailed = steps.some((s) => s.status === 'failed');
  const overallStatus: StepStatus = hasFailed ? 'failed' : allOk ? 'ok' : 'partial';

  const createdAt = new Date(receipt.createdAt);
  const timeStr = createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = createdAt.toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'glass-panel rounded-sm border-l-4 p-4 relative overflow-hidden',
        isInsight
          ? 'border-accent'
          : overallStatus === 'ok' ? 'border-primary' :
          overallStatus === 'partial' ? 'border-yellow-500' : 'border-red-600'
      )}
      style={{
        boxShadow: isInsight
          ? '0 0 12px rgba(255,0,200,0.08)'
          : overallStatus === 'ok'
          ? '0 0 12px rgba(0,245,255,0.08)'
          : overallStatus === 'partial'
          ? '0 0 10px rgba(250,204,21,0.08)'
          : '0 0 10px rgba(239,68,68,0.08)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {isInsight ? (
            <Brain className="w-4 h-4 text-accent" />
          ) : (
            <StatusIcon status={overallStatus} />
          )}
          <span className="font-terminal text-sm text-muted-foreground">{dateStr} {timeStr}</span>
        </div>
        <div className="flex items-center gap-1">
          {isDemo && (
            <span className="font-pixel text-[7px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 border border-yellow-600/30">
              DEMO
            </span>
          )}
          {isInsight ? (
            <span className="font-pixel text-[7px] px-1.5 py-0.5 border bg-accent/10 text-accent border-accent/30">
              ◈ AURA INSIGHT
            </span>
          ) : (
            <span className={cn(
              'font-pixel text-[7px] px-1.5 py-0.5 border',
              overallStatus === 'ok'
                ? 'bg-primary/10 text-primary border-primary/30'
                : overallStatus === 'partial'
                ? 'bg-yellow-500/10 text-yellow-400 border-yellow-600/30'
                : 'bg-red-900/20 text-red-400 border-red-700/30'
            )}>
              {overallStatus === 'ok' ? '⬡ VERIFIED' : overallStatus === 'partial' ? '⬡ PARTIAL' : '⚠ ERROR'}
            </span>
          )}
        </div>
      </div>

      {/* Insight text preview */}
      {isInsight && receipt.insightText && (
        <div className="mb-3 p-2 bg-accent/5 border border-accent/20 text-[10px] font-terminal text-foreground/80 leading-relaxed line-clamp-3">
          {receipt.insightText}
        </div>
      )}

      {/* Chain steps */}
      <div className="flex flex-col">
        {steps.map((step, i) => (
          <div key={step.label} className="flex gap-2">
            {/* Connector column */}
            <div className="flex flex-col items-center w-4 flex-shrink-0">
              <div className={cn(
                'w-2 h-2 rounded-sm border flex-shrink-0 mt-0.5',
                step.status === 'ok' ? 'bg-primary/30 border-primary' :
                step.status === 'partial' ? 'bg-yellow-500/20 border-yellow-500' :
                'bg-red-900/20 border-red-500'
              )} />
              {i < steps.length - 1 && (
                <div className={cn(
                  'w-px flex-1 my-0.5',
                  step.status === 'ok' ? 'bg-primary/30' : 'bg-secondary/40'
                )} />
              )}
            </div>

            {/* Step content */}
            <div className={cn('pb-2 flex-1 min-w-0', i < steps.length - 1 && 'border-none')}>
              <div className="flex items-baseline gap-1.5 mb-0.5 flex-wrap">
                <span className={cn('font-pixel text-[8px]', statusColor(step.status))}>
                  {statusGlyph(step.status)} {step.label}
                </span>
                <span className="font-pixel text-[7px] text-muted-foreground/50">{step.sublabel}</span>
              </div>
              <div className="font-terminal text-xs text-foreground/80 break-all">
                {step.link ? (
                  <a
                    href={step.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline hover:text-primary/80 inline-flex items-center gap-1"
                  >
                    {step.value}
                    <ExternalLink className="w-2.5 h-2.5 inline flex-shrink-0" />
                  </a>
                ) : (
                  <span>{step.value}</span>
                )}
              </div>
              {step.detail && (
                <div className="font-terminal text-[9px] text-muted-foreground/50 mt-0.5">{step.detail}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Score footer */}
      <div className="mt-2 pt-2 border-t border-secondary/20 flex justify-between items-center">
        {isInsight ? (
          <span className="font-pixel text-[7px] text-accent/50">AURA NEUROTECH INSIGHT</span>
        ) : (
          <span className="font-pixel text-[7px] text-muted-foreground/40">
            {Math.round(receipt.sessionStats.durationSeconds / 60)}m session
          </span>
        )}
        <span className={cn('font-terminal text-xs', isInsight ? 'text-accent' : 'text-primary')}>
          {isInsight ? 'AI SIGNED' : <>Focus <span className="font-bold">{receipt.sessionStats.focusScore}</span>/100</>}
        </span>
      </div>
    </motion.div>
  );
}
