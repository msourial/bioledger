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
  receiptCid?: string;
  pieceCid?: string;
}

export interface FilecoinResult {
  cid: string | null;
  gateway_url: string | null;
  status: 'stored' | 'pending' | 'failed';
  message?: string;
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

  return {
    specVersion: 'erc-8004-draft',
    receiptType,
    timestamp,
    nullifierHash,
    sessionStats: stats,
    erc8004,
    companionSignature,
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
    }

    return data;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    console.warn('[Bio-Ledger] Filecoin upload failed:', message);
    return { cid: null, gateway_url: null, status: 'failed', message };
  }
}
