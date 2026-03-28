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

const AGENT_ID = 'AURA-AGENT-V1';

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

export async function signWorkReceipt(
  nullifierHash: string,
  stats: SessionStats,
  prevStrain = 0
): Promise<WorkReceiptPayload> {
  const timestamp = new Date().toISOString();

  const erc8004: ERC8004Payload = {
    agent_id: AGENT_ID,
    timestamp,
    duration: stats.durationSeconds,
    hrv_avg: stats.hrv,
    strain_delta: Number((stats.strain - prevStrain).toFixed(2)),
    apm_score: stats.apm,
  };

  const payload = JSON.stringify({ nullifierHash, erc8004, timestamp });
  const companionSignature = await hmacSign(payload);

  return {
    specVersion: 'erc-8004-draft',
    receiptType: 'sustainable-flow-session',
    timestamp,
    nullifierHash,
    sessionStats: stats,
    erc8004,
    companionSignature,
  };
}

/**
 * storeToFilecoin — Synapse SDK stub.
 * Commits the receipt JSON to a mock Filecoin/Synapse storage node.
 * Returns a deterministic PieceCID derived from the receipt signature.
 */
export async function storeToFilecoin(receipt: WorkReceiptPayload): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Generate a unique CID per session by hashing the companion signature
  const sigBytes = new TextEncoder().encode(receipt.companionSignature.slice(0, 16));
  const hashBuf = await crypto.subtle.digest('SHA-256', sigBytes);
  const hashHex = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 38);

  const pieceCid = `bafkrei${hashHex}`;
  receipt.pieceCid = pieceCid;
  receipt.receiptCid = pieceCid;
  return pieceCid;
}
