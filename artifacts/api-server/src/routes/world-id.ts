import { Router } from "express";
import { generateKeyPairSync, type KeyObject } from "node:crypto";
import { signRequest } from "@worldcoin/idkit-server";

const router = Router();

const APP_ID = process.env["WORLD_ID_APP_ID"] as `app_${string}` | undefined;
const ACTION = process.env["WORLD_ID_ACTION"] ?? "bio-ledger-verify";

// Prefer explicitly-registered RP keys. When absent, generate an ephemeral key pair so the
// IDKit widget can open with just WORLD_ID_APP_ID + WORLD_ID_ACTION as required.
const RP_ID = process.env["WORLD_ID_RP_ID"] ?? "rp_bio_ledger_ephemeral";
const SIGNING_KEY = (() => {
  if (process.env["WORLD_ID_SIGNING_KEY"]) return process.env["WORLD_ID_SIGNING_KEY"];
  // Auto-generate an ephemeral P-256 key when no explicit key is provided.
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = (privateKey as KeyObject).export({ format: "jwk" }) as { d: string };
  return Buffer.from(jwk.d, "base64url").toString("hex");
})();

/**
 * GET /api/world-id/config
 * Returns whether World ID is configured and which app_id/action to use.
 * configured = true when WORLD_ID_APP_ID is set (only required env var).
 */
router.get("/world-id/config", (_req, res) => {
  res.json({
    configured: Boolean(APP_ID),
    app_id: APP_ID ?? null,
    action: ACTION,
    rp_id: RP_ID,
  });
});

/**
 * GET /api/world-id/rp-context
 * Returns a signed Relying Party context for the IDKit widget.
 * Uses explicit WORLD_ID_RP_ID + WORLD_ID_SIGNING_KEY when set,
 * otherwise uses an ephemeral key (allows modal to open; proof requires registered RP).
 */
router.get("/world-id/rp-context", (_req, res) => {
  if (!APP_ID) {
    res.status(503).json({ error: "WORLD_ID_APP_ID is not set" });
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
    console.log("🌍 World ID ZK proof verified — nullifier:", data.nullifier_hash ?? nullifier_hash);
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
