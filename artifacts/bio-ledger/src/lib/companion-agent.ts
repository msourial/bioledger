export interface SessionStats {
  durationSeconds: number;
  apm: number;
  hrv: number;
  strain: number;
  focusScore: number;
}

export interface WorkReceiptPayload {
  specVersion: string;
  receiptType: string;
  timestamp: string;
  nullifierHash: string;
  sessionStats: SessionStats;
  companionSignature: string;
  receiptCid?: string;
}

async function hmacSign(message: string): Promise<string> {
  const keyMaterial = "bio-ledger-companion-v1-hackathon-key";
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(keyMaterial),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signWorkReceipt(
  nullifierHash: string,
  stats: SessionStats
): Promise<WorkReceiptPayload> {
  const timestamp = new Date().toISOString();
  const payload = JSON.stringify({ nullifierHash, stats, timestamp });
  const companionSignature = await hmacSign(payload);

  return {
    specVersion: "erc-8004-draft",
    receiptType: "sustainable-flow-session",
    timestamp,
    nullifierHash,
    sessionStats: stats,
    companionSignature,
  };
}

export async function storeToFilecoin(receipt: WorkReceiptPayload): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const mockCid =
    "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy";
  return mockCid;
}
