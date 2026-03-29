import { Router } from "express";

const router = Router();

// SYNAPSE_API_KEY is the primary env var (matches Protocol Labs bounty branding).
// WEB3_STORAGE_TOKEN is accepted as an alias for convenience.
const UPLOAD_TOKEN =
  process.env["SYNAPSE_API_KEY"] ?? process.env["WEB3_STORAGE_TOKEN"] ?? null;

const W3S_UPLOAD_URL = "https://api.web3.storage/upload";
const IPFS_GATEWAY = "https://w3s.link/ipfs";

/**
 * POST /api/filecoin/upload
 *
 * Uploads a signed ERC-8004 receipt JSON to Filecoin warm storage via the
 * web3.storage / Storacha HTTP API. Returns a real IPFS CID when SYNAPSE_API_KEY
 * is configured, or { status: "pending" } when the token is absent so the
 * session is never lost.
 */
router.post("/filecoin/upload", async (req, res) => {
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
    const payload = req.body as unknown;
    const blob = JSON.stringify(payload);

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
        cid: null,
        status: "failed",
        error: "Upload to Filecoin failed",
        details: errText,
      });
      return;
    }

    const data = await uploadRes.json() as { cid?: string };
    const cid = data.cid;

    if (!cid) {
      res.status(502).json({ cid: null, status: "failed", error: "No CID returned by storage provider" });
      return;
    }

    res.json({
      cid,
      gateway_url: `${IPFS_GATEWAY}/${cid}`,
      status: "stored",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ cid: null, status: "failed", error: "Upload request failed", details: message });
  }
});

export default router;
