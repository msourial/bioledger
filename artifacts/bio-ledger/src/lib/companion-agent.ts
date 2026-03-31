import type { VisionMetrics } from '@/hooks/use-camera';

export interface SessionStats {
  durationSeconds: number;
  apm: number;
  hrv: number;
  strain: number;
  focusScore: number;
}

export interface ERC8004Payload {
  agent_id: string;
  timestamp: string;
  duration: number;
  hrv_avg: number;
  strain_delta: number;
  apm_score: number;
  /** Certified human presence via MediaPipe Face Landmarker */
  certified_human_presence: boolean;
  /** 0–100 composite: focus quality × presence × head stability */
  focus_fidelity_score: number;
  /** Avg blink rate (blinks per minute) during session */
  avg_blink_rate: number;
  /** Head stability score (% of frames with stable pose), 0–100 */
  head_stability: number;
}

export interface WorkReceiptPayload {
  specVersion: string;
  receiptType: string;
  timestamp: string;
  nullifierHash: string;
  sessionStats: SessionStats;
  erc8004: ERC8004Payload;
  companionSignature: string;
  /** ERC-8004 naming convention — alias for companionSignature */
  agent_signature: string;
  receiptCid?: string;
  pieceCid?: string;
}

export interface FilecoinResult {
  cid: string | null;
  gateway_url: string | null;
  status: 'stored' | 'pending' | 'failed';
  message?: string;
}

// ─── Session Grade Types ──────────────────────────────────────────────────────

export type SessionGradeLetter = 'S' | 'A' | 'B' | 'C' | 'D';

export interface SessionGradeResult {
  grade: SessionGradeLetter;
  score: number;
  xpBonus: number;
  breakdown: {
    focus: number;
    biometric: number;
    challenge: number;
    presence: number;
    duration: number;
    engagement: number;
  };
  title: string;
  subtitle: string;
}

const GRADE_CONFIG: Record<SessionGradeLetter, { min: number; xp: number; title: string; subtitle: string }> = {
  S: { min: 90, xp: 150, title: 'EXCEPTIONAL', subtitle: 'Perfect flow state achieved' },
  A: { min: 75, xp: 100, title: 'EXCELLENT', subtitle: 'Strong session, body and mind in sync' },
  B: { min: 60, xp: 70, title: 'GOOD', subtitle: 'Solid work, room to optimize' },
  C: { min: 40, xp: 40, title: 'AVERAGE', subtitle: 'Your body needed more breaks' },
  D: { min: 0, xp: 20, title: 'NEEDS WORK', subtitle: 'Listen to your body next time' },
};

/**
 * Grade a completed session using a composite score inspired by
 * Whoop Recovery (HRV-heavy), Oura Readiness (multi-factor), and
 * gaming S/A/B/C/D systems.
 *
 * Weights: Focus 25% | Biometrics 20% | Challenge compliance 20% |
 *          Presence 15% | Duration 10% | Engagement 10%
 */
export function gradeSession(stats: SessionStats, opts: {
  challengesCompleted: number;
  challengesTriggered: number;
  certifiedPresence: boolean;
  headStability: number;
  avgBlinkRate: number;
  postureWarningRatio: number; // 0-1, fraction of time with bad posture
}): SessionGradeResult {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const sessionMins = stats.durationSeconds / 60;

  // 1. Focus (25%) — already 0-100
  const focus = clamp(stats.focusScore, 0, 100);

  // 2. Biometrics (20%) — HRV stability + strain optimality
  const hrvNorm = clamp((stats.hrv / 90) * 100, 0, 100); // 90ms = excellent
  const optimalStrain = 6;
  const strainNorm = clamp(100 - (Math.abs(stats.strain - optimalStrain) / optimalStrain) * 60, 0, 100);
  const biometric = hrvNorm * 0.7 + strainNorm * 0.3;

  // 3. Challenge compliance (20%) — % of challenges completed
  const challenge = opts.challengesTriggered > 0
    ? (opts.challengesCompleted / opts.challengesTriggered) * 100
    : 80; // neutral if none triggered

  // 4. Presence & posture (15%)
  const postureScore = clamp(100 - opts.postureWarningRatio * 300, 0, 100);
  const presence = (opts.certifiedPresence ? 100 : 0) * 0.4
    + opts.headStability * 0.3
    + postureScore * 0.3;

  // 5. Duration (10%) — ramp to 100 at 25min, plateau, gentle decay after 90min
  const duration = sessionMins <= 25
    ? (sessionMins / 25) * 100
    : sessionMins <= 90 ? 100
    : clamp(100 - (sessionMins - 90) * 0.5, 70, 100);

  // 6. Engagement (10%) — APM + blink rate health
  const apmNorm = clamp((stats.apm - 20) / 80 * 100, 0, 100);
  const blinkNorm = clamp(100 - Math.abs(opts.avgBlinkRate - 17) / 17 * 100, 0, 100);
  const engagement = apmNorm * 0.6 + blinkNorm * 0.4;

  // Composite
  const raw = focus * 0.25 + biometric * 0.20 + challenge * 0.20
            + presence * 0.15 + duration * 0.10 + engagement * 0.10;
  const score = Math.round(clamp(raw, 0, 100));

  const grade: SessionGradeLetter = score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';
  const config = GRADE_CONFIG[grade];

  console.log(`🏆 Session Grade: ${grade} (${score}/100) — ${config.title}`);
  console.log(`   Focus: ${Math.round(focus)} | Bio: ${Math.round(biometric)} | Challenge: ${Math.round(challenge)} | Presence: ${Math.round(presence)} | Duration: ${Math.round(duration)} | Engagement: ${Math.round(engagement)}`);

  return {
    grade,
    score,
    xpBonus: config.xp,
    breakdown: {
      focus: Math.round(focus),
      biometric: Math.round(biometric),
      challenge: Math.round(challenge),
      presence: Math.round(presence),
      duration: Math.round(duration),
      engagement: Math.round(engagement),
    },
    title: config.title,
    subtitle: config.subtitle,
  };
}

const AGENT_ID = 'AURA-AGENT-V1';

const API = import.meta.env.VITE_API_BASE_URL ?? '';

async function hmacSign(message: string): Promise<string> {
  const keyMaterial = 'bio-ledger-companion-v1-hackathon-key';
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(keyMaterial),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Compute a 0–100 focus fidelity score from session stats + vision data.
 * Weights: focus session quality (40%) + certified presence (30%) + head stability (30%)
 */
function computeFocusFidelity(stats: SessionStats, vision?: VisionMetrics): number {
  const qualityScore = Math.min(100, stats.focusScore);
  const presenceScore = vision?.certifiedPresence ? 100 : 0;
  const stabilityScore = vision?.headStability ?? 100;

  return Math.round(qualityScore * 0.4 + presenceScore * 0.3 + stabilityScore * 0.3);
}

export async function signWorkReceipt(
  nullifierHash: string,
  stats: SessionStats,
  prevStrain = 0,
  vision?: VisionMetrics,
  receiptType: 'sustainable-flow-session' | 'aura-insight' | 'wellness' = 'sustainable-flow-session'
): Promise<WorkReceiptPayload> {
  const timestamp = new Date().toISOString();

  const focusFidelityScore = computeFocusFidelity(stats, vision);

  const erc8004: ERC8004Payload = {
    agent_id: AGENT_ID,
    timestamp,
    duration: stats.durationSeconds,
    hrv_avg: stats.hrv,
    strain_delta: Number((stats.strain - prevStrain).toFixed(2)),
    apm_score: stats.apm,
    certified_human_presence: vision?.certifiedPresence ?? false,
    focus_fidelity_score: focusFidelityScore,
    avg_blink_rate: vision?.avgBlinkRate ?? 0,
    head_stability: vision?.headStability ?? 100,
  };

  const payload = JSON.stringify({ nullifierHash, receiptType, erc8004, timestamp });
  const companionSignature = await hmacSign(payload);

  console.log(`🤖 AURA Agent signing ERC-8004 receipt: type=${receiptType}`);
  console.log(`📊 Focus Fidelity Score: ${focusFidelityScore}/100`);
  console.log(`🔏 Signature: ${companionSignature.slice(0, 16)}...`);

  return {
    specVersion: 'erc-8004-draft',
    receiptType,
    timestamp,
    nullifierHash,
    sessionStats: stats,
    erc8004,
    companionSignature,
    agent_signature: companionSignature,
  };
}

/**
 * storeToFilecoin — Synapse / web3.storage upload.
 *
 * Calls the API server's /api/filecoin/upload endpoint which uploads the
 * signed receipt JSON to Filecoin warm storage via the Synapse/web3.storage
 * HTTP API. Returns a real PieceCID when SYNAPSE_API_KEY is configured on
 * the server, or { status: "pending" } so the session is never lost.
 */
export async function storeToFilecoin(receipt: WorkReceiptPayload): Promise<FilecoinResult> {
  try {
    const res = await fetch(`${API}/api/filecoin/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(receipt),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({})) as { error?: string };
      console.warn('[Bio-Ledger] Filecoin upload HTTP error:', res.status, errBody);
      return { cid: null, gateway_url: null, status: 'failed', message: errBody.error ?? `HTTP ${res.status}` };
    }

    const data = await res.json() as FilecoinResult;

    if (data.cid) {
      receipt.pieceCid = data.cid;
      receipt.receiptCid = data.cid;
      console.log(`🔒 Committing Bio-Ledger to Filecoin via Synapse: CID ${data.cid}`);
      console.log(`📦 Receipt permanently stored: ${data.gateway_url}`);
    } else {
      console.log(`⏳ Filecoin upload pending — status: ${data.status}`);
    }

    return data;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    console.warn('[Bio-Ledger] Filecoin upload failed:', message);
    return { cid: null, gateway_url: null, status: 'failed', message };
  }
}
