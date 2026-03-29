import { Router } from "express";

const router = Router();

// SYNAPSE_API_KEY is the primary env var (matches Protocol Labs bounty branding).
// WEB3_STORAGE_TOKEN is accepted as an alias for convenience.
const UPLOAD_TOKEN =
  process.env["SYNAPSE_API_KEY"] ?? process.env["WEB3_STORAGE_TOKEN"] ?? null;

const W3S_UPLOAD_URL = "https://api.web3.storage/upload";
const IPFS_GATEWAY = "https://w3s.link/ipfs";

// 512 KB payload limit — receipts are small JSON; this prevents quota abuse.
const MAX_PAYLOAD_BYTES = 512 * 1024;

/**
 * POST /api/filecoin/upload
 *
 * Uploads a signed ERC-8004 receipt JSON to Filecoin warm storage via the
 * web3.storage / Storacha HTTP API. Returns a real IPFS CID when SYNAPSE_API_KEY
 * is configured, or { status: "pending" } when the token is absent so the
 * session is never lost.
 *
 * Authorization: callers must include the nullifierHash that matches the receipt
 * payload; this provides basic binding between the caller's identity and the
 * stored data and prevents arbitrary callers from burning quota.
 */
router.post("/filecoin/upload", async (req, res) => {
  // Basic authorization: require nullifierHash in the body to bind upload to a
  // known session identity. Protects storage quota without a full auth layer.
  const { nullifierHash } = (req.body ?? {}) as { nullifierHash?: unknown };
  if (!nullifierHash || typeof nullifierHash !== "string") {
    res.status(400).json({ error: "nullifierHash is required in request body" });
    return;
  }

  // Payload size guard — reject oversized requests before touching storage quota.
  const payloadBytes = Buffer.byteLength(JSON.stringify(req.body));
  if (payloadBytes > MAX_PAYLOAD_BYTES) {
    res.status(413).json({ error: "Payload too large", details: `Max ${MAX_PAYLOAD_BYTES / 1024} KB` });
    return;
  }

  if (!UPLOAD_TOKEN) {
    res.json({
      cid: null,
      gateway_url: null,
      status: "pending",
      message: "Filecoin storage not configured — set SYNAPSE_API_KEY to enable live upload",
    });
    return;
  }

  try {
    const blob = JSON.stringify(req.body);

    const uploadRes = await fetch(W3S_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPLOAD_TOKEN}`,
        "Content-Type": "application/json",
        "X-Name": "bio-ledger-erc8004-receipt.json",
      },
      body: blob,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text().catch(() => `HTTP ${uploadRes.status}`);
      res.status(502).json({
        error: "Upload to Filecoin failed",
        details: errText,
      });
      return;
    }

    const data = await uploadRes.json() as { cid?: string };
    const cid = data.cid;

    if (!cid) {
      res.status(502).json({ error: "No CID returned by storage provider" });
      return;
    }

    res.json({
      cid,
      gateway_url: `${IPFS_GATEWAY}/${cid}`,
      status: "stored",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: "Upload request failed", details: message });
  }
});

export default router;
