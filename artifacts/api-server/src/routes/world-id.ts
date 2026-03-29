import { Router } from "express";
import { signRequest } from "@worldcoin/idkit-server";

const router = Router();

const APP_ID = process.env["WORLD_ID_APP_ID"] as `app_${string}` | undefined;
const ACTION = process.env["WORLD_ID_ACTION"] ?? "bio-ledger-verify";
const RP_ID = process.env["WORLD_ID_RP_ID"];
const SIGNING_KEY = process.env["WORLD_ID_SIGNING_KEY"];

router.get("/world-id/config", (_req, res) => {
  res.json({
    configured: Boolean(APP_ID),
    app_id: APP_ID ?? null,
    action: ACTION,
    rp_id: RP_ID ?? null,
    rp_context_available: Boolean(APP_ID && RP_ID && SIGNING_KEY),
  });
});

router.get("/world-id/rp-context", (_req, res) => {
  if (!APP_ID) {
    res.status(503).json({ error: "WORLD_ID_APP_ID is not set" });
    return;
  }
  if (!RP_ID || !SIGNING_KEY) {
    res.status(503).json({
      error: "RP context signing not configured",
      hint: "Set WORLD_ID_RP_ID and WORLD_ID_SIGNING_KEY to enable full ZK proof flow",
    });
    return;
  }

  try {
    const sig = signRequest(ACTION, SIGNING_KEY);
    res.json({
      rp_id: RP_ID,
      nonce: sig.nonce,
      created_at: sig.createdAt,
      expires_at: sig.expiresAt,
      signature: sig.sig,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Failed to generate RP context", details: message });
  }
});

/**
 * POST /api/verify-world-id
 * Verifies a World ID proof against the Worldcoin cloud verification API.
 * Body: { proof, merkle_root, nullifier_hash, verification_level, protocol_version }
 */
router.post("/verify-world-id", async (req, res) => {
  if (!APP_ID) {
    res.status(503).json({ error: "World ID not configured — set WORLD_ID_APP_ID" });
    return;
  }

  const { nullifier_hash, merkle_root, proof, verification_level, protocol_version } = req.body ?? {};

  if (!nullifier_hash || !proof) {
    res.status(400).json({ error: "Missing required fields: nullifier_hash, proof" });
    return;
  }

  try {
    const apiVersion = protocol_version === "3.0" ? "v1" : "v2";
    const verifyRes = await fetch(
      `https://developer.worldcoin.org/api/${apiVersion}/verify/${APP_ID}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nullifier_hash,
          merkle_root,
          proof,
          verification_level: verification_level ?? "device",
          action: ACTION,
        }),
      }
    );

    if (!verifyRes.ok) {
      const errorData = await verifyRes.json().catch(() => ({}));
      res.status(400).json({ error: "Proof verification failed", worldcoin_error: errorData });
      return;
    }

    const data = await verifyRes.json() as { nullifier_hash?: string; verification_level?: string };
    res.json({
      success: true,
      nullifier_hash: data.nullifier_hash ?? nullifier_hash,
      verification_level: data.verification_level ?? verification_level,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Verification request failed", details: message });
  }
});

export default router;
