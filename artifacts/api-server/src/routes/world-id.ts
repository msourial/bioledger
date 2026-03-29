import { Router } from "express";
import { signRequest } from "@worldcoin/idkit-server";

const router = Router();

const APP_ID = process.env["WORLD_ID_APP_ID"] as `app_${string}` | undefined;
const ACTION = process.env["WORLD_ID_ACTION"] ?? "bio-ledger-verify";
const RP_ID = process.env["WORLD_ID_RP_ID"];
const SIGNING_KEY = process.env["WORLD_ID_SIGNING_KEY"];

/**
 * GET /api/world-id/config
 * Returns public configuration for the frontend to determine whether to use
 * the real IDKit widget or fall back to the simulation.
 */
router.get("/world-id/config", (_req, res) => {
  const configured = Boolean(APP_ID && RP_ID && SIGNING_KEY);
  res.json({
    configured,
    app_id: APP_ID ?? null,
    action: ACTION,
    rp_id: RP_ID ?? null,
  });
});

/**
 * GET /api/world-id/rp-context
 * Generates and returns a signed Relying Party context for the IDKit widget.
 * Requires WORLD_ID_RP_ID and WORLD_ID_SIGNING_KEY to be configured.
 */
router.get("/world-id/rp-context", (_req, res) => {
  if (!RP_ID || !SIGNING_KEY || !APP_ID) {
    res.status(503).json({
      error: "World ID not configured",
      hint: "Set WORLD_ID_APP_ID, WORLD_ID_RP_ID, and WORLD_ID_SIGNING_KEY env vars",
    });
    return;
  }

  try {
    const signature = signRequest(ACTION, SIGNING_KEY);
    res.json({
      rp_id: RP_ID,
      nonce: signature.nonce,
      created_at: signature.createdAt,
      expires_at: signature.expiresAt,
      signature: signature.sig,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Failed to generate RP context", details: message });
  }
});

/**
 * POST /api/world-id/verify
 * Verifies a World ID proof against the Worldcoin cloud verification API.
 *
 * Body: { nullifier_hash, merkle_root, proof, verification_level, protocol_version }
 * Returns: { success: true, nullifier_hash } on success.
 */
router.post("/world-id/verify", async (req, res) => {
  if (!APP_ID) {
    res.status(503).json({ error: "World ID not configured" });
    return;
  }

  const { nullifier_hash, merkle_root, proof, verification_level, protocol_version } = req.body ?? {};

  if (!nullifier_hash || !proof) {
    res.status(400).json({ error: "Missing required fields: nullifier_hash, proof" });
    return;
  }

  try {
    let verifyRes: Response;

    if (protocol_version === "3.0") {
      // Legacy v3 proof — use v1 cloud verify API
      verifyRes = await fetch(`https://developer.worldcoin.org/api/v1/verify/${APP_ID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nullifier_hash,
          merkle_root,
          proof,
          verification_level: verification_level ?? "device",
          action: ACTION,
        }),
      });
    } else {
      // v4 proof — use v2 cloud verify API
      verifyRes = await fetch(`https://developer.worldcoin.org/api/v2/verify/${APP_ID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nullifier_hash,
          merkle_root,
          proof,
          verification_level: verification_level ?? "device",
          action: ACTION,
        }),
      });
    }

    if (!verifyRes.ok) {
      const errorData = await verifyRes.json().catch(() => ({}));
      res.status(400).json({
        error: "Proof verification failed",
        worldcoin_error: errorData,
      });
      return;
    }

    const verifyData = await verifyRes.json() as { nullifier_hash?: string; verification_level?: string };
    res.json({
      success: true,
      nullifier_hash: verifyData.nullifier_hash ?? nullifier_hash,
      verification_level: verifyData.verification_level ?? verification_level,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Verification request failed", details: message });
  }
});

export default router;
