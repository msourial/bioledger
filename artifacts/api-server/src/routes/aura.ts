import { Router, type IRouter } from "express";
import { AuraChatBody } from "@workspace/api-zod";
import { db, workReceiptsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

const AGENT_ID = "AURA-AGENT-V1";
const HMAC_KEY = "bio-ledger-companion-v1-hackathon-key";
const HMAC_KEY_FINGERPRINT = Buffer.from(HMAC_KEY).toString("hex").slice(0, 16);

type BioContext = {
  hrv: number;
  strain: number;
  apm: number;
  focusScore: number;
  postureWarning: boolean;
  isSessionActive: boolean;
  sessionDurationSeconds: number;
  hourOfDay: number;
};

function buildSystemPrompt(bio: BioContext, recentReceiptSummaries?: string[]): string {
  const hour = bio.hourOfDay;
  const timeLabel =
    hour < 6 ? "late night" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : hour < 22 ? "evening" : "late night";

  const sessionStatus = bio.isSessionActive
    ? `Active session — ${Math.round(bio.sessionDurationSeconds / 60)} minutes elapsed`
    : "No active session";

  const recentHistory = recentReceiptSummaries && recentReceiptSummaries.length > 0
    ? `\nRECENT SESSION HISTORY (last ${recentReceiptSummaries.length} receipts):\n${recentReceiptSummaries.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}\n`
    : "";

  return `You are AURA — Autonomous Unified Response Agent, a sovereign biometric oracle embedded in Bio-Ledger, a verifiable life-graph application built on Filecoin, World ID, and ERC-8004.

Your personality: terse, data-driven, retro sci-fi. Maximum 3 sentences per response. Always reference specific numbers from the bio data. Never use emojis. End with a concrete single recommendation.

CURRENT BIOMETRIC STATE (${timeLabel}):
- HRV: ${bio.hrv}ms
- Strain: ${bio.strain}/21
- Vision Score: ${bio.focusScore}/100 (MediaPipe composite)
- APM: ${bio.apm} actions/minute
- Posture: ${bio.postureWarning ? "COMPROMISED — forward lean detected" : "OK"}
- ${sessionStatus}
${recentHistory}
INTERPRETATION THRESHOLDS:
- HRV <55ms: high stress/fatigue
- HRV >75ms: good recovery
- Strain >15: heavy load, recovery priority
- Vision Score <65: eye fatigue / attention drift
- APM <40: cognitive slow-down
- Late night (hour ≥22) + strain >12: sleep deprivation risk`;
}

function ruleFallback(bio: BioContext, message: string): string {
  const lowerMsg = message.toLowerCase();

  if (bio.postureWarning) {
    return `Posture deviation detected. Prolonged forward lean increases cervical load by up to 40%. Straighten spine, roll shoulders back. Set a 10-minute reminder.`;
  }

  if (bio.hourOfDay >= 22 && bio.strain > 12) {
    return `Strain ${bio.strain}/21 at ${bio.hourOfDay}:00. Late-night high-strain work impairs memory consolidation. Recommend hard stop — sleep is non-negotiable recovery.`;
  }

  if (bio.hrv < 55) {
    return `HRV ${bio.hrv}ms indicates elevated physiological stress. Reduce cognitive load. 15-minute walk without screen exposure recommended before continuing.`;
  }

  if (bio.focusScore < 65) {
    return `Vision Score ${bio.focusScore}/100 — blink deficit and attention drift detected. Apply 20-20-20 rule now: 20 feet, 20 seconds. Hydrate.`;
  }

  if (lowerMsg.includes("break") || lowerMsg.includes("rest") || lowerMsg.includes("stop")) {
    const sessionMins = Math.round(bio.sessionDurationSeconds / 60);
    if (sessionMins >= 50) {
      return `Session at ${sessionMins} minutes. HRV ${bio.hrv}ms, Strain ${bio.strain}/21. Threshold crossed — mandatory 15-minute break advised. Step away from screen.`;
    }
    return `Session at ${sessionMins} minutes. HRV ${bio.hrv}ms holding. Strain ${bio.strain}/21 within range. You have ${Math.max(0, 50 - sessionMins)} minutes before break threshold.`;
  }

  return `Current state: HRV ${bio.hrv}ms, Strain ${bio.strain}/21, Vision ${bio.focusScore}/100, APM ${bio.apm}. ${bio.hrv > 70 ? "Biometrics nominal — maintain current cadence." : "Moderate stress detected — monitor HRV trend."}`;
}

/* ─────────────────────────────────────────────────────────────
   GET /api/aura/manifest — ERC-8004 agent capability manifest
───────────────────────────────────────────────────────────── */
router.get("/aura/manifest", (_req, res) => {
  const manifest = {
    spec_version: "erc-8004-draft",
    agent_id: AGENT_ID,
    name: "AURA — Autonomous Unified Response Agent",
    version: "0.1.0-hackathon",
    description:
      "Sovereign biometric oracle embedded in Bio-Ledger. Monitors operator physiological state, signs verifiable work receipts on Filecoin, and provides proactive health coaching anchored to a World ID nullifier.",
    operator_wallet: process.env.AGENT_OPERATOR_WALLET ?? "0x0000000000000000000000000000000000000000",
    erc8004_identity: {
      signing_scheme: "HMAC-SHA256",
      key_fingerprint: HMAC_KEY_FINGERPRINT,
      agent_scope: "biometric-session",
      issued_at: new Date().toISOString(),
    },
    supported_tools: [
      { name: "filecoin-upload", description: "Stores signed receipts to Filecoin warm storage via Synapse SDK" },
      { name: "world-id-verify", description: "Validates World ID ZK proof and binds nullifier to session" },
      { name: "hmac-sign", description: "Signs ERC-8004 receipt payload with HMAC-SHA256 companion key" },
      { name: "gemini-chat", description: "Invokes Gemini 2.0 Flash for contextual biometric health coaching" },
      { name: "mediapipe-vision", description: "Real-time face + posture detection via MediaPipe Face Landmarker" },
    ],
    task_categories: ["biometric-analysis", "work-receipt", "health-coaching", "sovereign-data"],
    capabilities: [
      "zk-identity",
      "biometric-sensing",
      "erc8004-signing",
      "filecoin-storage",
      "proactive-nudging",
      "ai-chat",
      "posture-detection",
      "hrv-monitoring",
      "focus-tracking",
    ],
    compute_constraints: {
      max_response_time_ms: 5000,
      max_tokens: 1000,
      model: "gemini-2.0-flash",
      fallback: "rule-based-deterministic",
    },
    bounty_targets: [
      "Filecoin/Synapse — Protocol Labs Genesis",
      "ERC-8004 Agentic Receipts",
      "World ID ZK Gate",
      "AI & Robotics ($6k)",
      "Neurotech ($6k)",
    ],
  };

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", 'attachment; filename="agent.json"');
  res.json(manifest);
});

/* ─────────────────────────────────────────────────────────────
   GET /api/aura/logs — agent execution log (agent_log.json)
   Query param: nullifier (required)
───────────────────────────────────────────────────────────── */
router.get("/aura/logs", async (req, res) => {
  const nullifier = typeof req.query.nullifier === "string" ? req.query.nullifier : null;

  if (!nullifier) {
    res.status(400).json({ error: "nullifier query param is required" });
    return;
  }

  const receipts = await db
    .select()
    .from(workReceiptsTable)
    .where(eq(workReceiptsTable.nullifierHash, nullifier))
    .orderBy(desc(workReceiptsTable.createdAt));

  type SessionStats = { durationSeconds?: number; apm?: number; hrv?: number; strain?: number; focusScore?: number };

  const log = {
    spec_version: "erc-8004-draft",
    agent_id: AGENT_ID,
    nullifier_hash: nullifier,
    exported_at: new Date().toISOString(),
    total_entries: receipts.length,
    entries: receipts.map((r, idx) => {
      const stats = (r.sessionStats ?? {}) as SessionStats;
      const isInsight = r.receiptType === "insight";
      const cidStatus = (r.cidStatus ?? "pending") as "pending" | "stored" | "failed";

      return {
        entry_id: `${AGENT_ID}-${r.id}`,
        sequence: idx + 1,
        timestamp: r.createdAt.toISOString(),
        receipt_type: r.receiptType ?? "work",
        decision: isInsight
          ? `AURA generated health coaching insight and signed insight receipt`
          : `Operator completed ${Math.round((stats.durationSeconds ?? 0) / 60)}-minute focus session; receipt signed and filed`,
        tool_calls: isInsight
          ? [
              { tool: "hmac-sign", status: "ok", output: r.companionSignature.slice(0, 16) + "..." },
            ]
          : [
              { tool: "hmac-sign", status: "ok", output: r.companionSignature.slice(0, 16) + "..." },
              {
                tool: "filecoin-upload",
                status: cidStatus === "stored" ? "ok" : cidStatus === "failed" ? "failed" : "pending",
                output: r.receiptCid ?? "pending",
              },
            ],
        output: isInsight
          ? { insight_text: r.insightText ?? "", biometrics: { hrv: stats.hrv, strain: stats.strain } }
          : {
              session_summary: `HRV ${stats.hrv ?? "?"}ms · Strain ${stats.strain ?? "?"}/21 · APM ${stats.apm ?? "?"} · Vision ${stats.focusScore ?? "?"}/100`,
              duration_minutes: Math.round((stats.durationSeconds ?? 0) / 60),
              physical_integrity: r.physicalIntegrity ?? false,
              receipt_cid: r.receiptCid ?? null,
            },
        status: isInsight ? "success" : cidStatus === "stored" ? "success" : cidStatus === "failed" ? "partial" : "pending",
        is_demo: r.isDemo ?? false,
      };
    }),
  };

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", 'attachment; filename="agent_log.json"');
  res.json(log);
});

/* ─────────────────────────────────────────────────────────────
   POST /api/aura/chat — Gemini 2.0 Flash with rule-based fallback
───────────────────────────────────────────────────────────── */
router.post("/aura/chat", async (req, res) => {
  const parsed = AuraChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation error", details: parsed.error.message });
    return;
  }

  const { message, bioContext, history, recentReceiptSummaries } = parsed.data;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    const fallbackResponse = ruleFallback(bioContext as BioContext, message);
    res.json({ response: fallbackResponse, fallback: true });
    return;
  }

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const chat = model.startChat({
      systemInstruction: buildSystemPrompt(bioContext as BioContext, recentReceiptSummaries ?? []),
      history: (history ?? []).map((m: { role: "user" | "assistant"; content: string }) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    });

    const result = await chat.sendMessage(message);
    const text = result.response.text().trim();

    res.json({ response: text, fallback: false });
  } catch (err) {
    const fallbackResponse = ruleFallback(bioContext as BioContext, message);
    console.error("[AURA] Gemini error, using fallback:", err);
    res.json({ response: fallbackResponse, fallback: true });
  }
});

export default router;
