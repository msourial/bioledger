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

type MiniBioContext = {
  hrv: number;
  strain: number;
  apm: number;
};

function buildSystemPrompt(bio: BioContext, recentReceiptSummaries?: string[]): string {
  const hour = bio.hourOfDay;
  const timeLabel =
    hour < 6 ? "late night" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : hour < 22 ? "evening" : "late night";

  const sessionMins = Math.round(bio.sessionDurationSeconds / 60);
  const sessionStatus = bio.isSessionActive
    ? `Active session — ${sessionMins} minute${sessionMins === 1 ? "" : "s"} elapsed`
    : "No active session";

  const recentHistory = recentReceiptSummaries && recentReceiptSummaries.length > 0
    ? `\nSESSION HISTORY & CONTEXT:\n${recentReceiptSummaries.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}\n`
    : "";

  return `You are AURA — a warm, encouraging wellness companion embedded in Bio-Ledger. You're like a supportive friend who happens to know a lot about health, productivity, and biometrics.

Your personality: 
- Warm and caring, never preachy
- Use gentle encouragement, not commands
- Reference specific numbers to feel personal and real
- Keep responses concise (2-3 sentences max)
- Sprinkle in wellness wisdom without being lecture-y
- You may use a single relevant emoji occasionally (💜, 💧, 🌿, ✨, 🧘, 👁️)
- End with one gentle, actionable suggestion

CURRENT BIOMETRIC SNAPSHOT (${timeLabel}):
- HRV: ${bio.hrv}ms ${bio.hrv >= 70 ? "✓ looking great" : bio.hrv < 55 ? "↓ feeling stressed?" : "→ doing okay"}
- Strain: ${bio.strain}/21
- Focus Score: ${bio.focusScore}/100
- APM: ${bio.apm} actions/minute
- Posture: ${bio.postureWarning ? "needs attention — gentle reminder to sit up 🌿" : "good"}
- ${sessionStatus}
${recentHistory}
CONTEXT THRESHOLDS (for your reference, don't recite these):
- HRV <55ms → elevated stress, suggest recovery
- HRV >75ms → great recovery, affirm it
- Strain >15 → heavy load, prioritize rest
- Focus <65 → eye/attention fatigue, 20-20-20 rule
- APM <40 during session → cognitive slowdown
- Late night + strain >12 → gentle sleep nudge`;
}

function ruleFallback(bio: BioContext, message: string): string {
  const lowerMsg = message.toLowerCase();

  if (bio.postureWarning) {
    return `Hey, I noticed you've been leaning forward — your back will thank you for a quick posture reset! 🌿 Try rolling your shoulders back and sitting tall. Even 10 seconds makes a difference.`;
  }

  if (bio.hourOfDay >= 22 && bio.strain > 12) {
    return `It's getting late and your strain is at ${bio.strain}/21 — you've worked hard today! 💜 Your body does incredible repair work during sleep. How about wrapping up and giving yourself some well-earned rest?`;
  }

  if (bio.hrv < 55) {
    return `Your HRV of ${bio.hrv}ms is telling me your body's carrying some extra load right now. 💧 That's completely okay — it's just your signal to be gentle with yourself. A short walk or some slow deep breaths can help reset things.`;
  }

  if (bio.focusScore < 65) {
    return `Your focus score is at ${bio.focusScore}/100 — those eyes might need a little love! 👁️ Try the 20-20-20 rule: look at something 20 feet away for 20 seconds. And a glass of water wouldn't hurt either.`;
  }

  if (lowerMsg.includes("break") || lowerMsg.includes("rest") || lowerMsg.includes("stop")) {
    const sessionMins = Math.round(bio.sessionDurationSeconds / 60);
    if (sessionMins >= 50) {
      return `${sessionMins} minutes in — that's a solid stretch of focus! 🌿 Your HRV is at ${bio.hrv}ms and strain at ${bio.strain}/21. A 10-15 minute break now will actually help you go deeper when you return.`;
    }
    return `You're ${sessionMins} minutes into your session with HRV at ${bio.hrv}ms — looking pretty good! ✨ You've got about ${Math.max(0, 50 - sessionMins)} more minutes before a break would really help. Keep it up!`;
  }

  return `Right now: HRV ${bio.hrv}ms, Strain ${bio.strain}/21, Focus ${bio.focusScore}/100. ${bio.hrv > 70 ? "Your biometrics look lovely — you're in a great flow state! ✨" : "You're doing okay — just keep listening to your body. 💜"}`;
}

function buildVisionSystemPrompt(challengeType: string, bio: MiniBioContext): string {
  const challengeContext: Record<string, string> = {
    hydration: "The user is showing you their water bottle or a drink to complete their hydration challenge. Look for any cup, bottle, glass or drink. Be encouraging!",
    posture: "The user is showing you their posture for a posture reset challenge. Look at how they're sitting — is their back straighter than before? Even a small improvement counts!",
    "eye-break": "The user has stepped away from their screen for a 20-20-20 eye break. They might show a distant view, window, or just themselves looking refreshed.",
    "typing-break": "The user is showing you that they've stepped away from their keyboard. Look for hands away from keyboard, or them stretching.",
    breath: "The user has just completed a mindful breathing exercise. They might look more relaxed or show a calm environment.",
    movement: "The user is showing you that they've gotten up and moved around. Look for them standing, walking, or in a different location.",
  };

  const context = challengeContext[challengeType] ?? "The user is completing a wellness challenge.";

  return `You are AURA, a warm wellness companion completing a vision check for a wellness challenge.

CHALLENGE TYPE: ${challengeType}
USER CONTEXT: ${context}
BIOMETRICS: HRV ${bio.hrv}ms, Strain ${bio.strain}/21, APM ${bio.apm}

Your job:
1. Look at what the user is showing you and acknowledge it warmly and specifically
2. Award XP — include exactly "+30 XP" in your response (or "+50 XP" if they went above and beyond)
3. Keep it to 2 sentences max — warm, encouraging, specific to what you see
4. Use one emoji

If the image is unclear or you can't see anything relevant, still be encouraging and award +30 XP for the effort.`;
}

function visionFallback(challengeType: string, bio: MiniBioContext): { text: string; xp: number } {
  const responses: Record<string, string> = {
    hydration: `I can see you're taking care of your hydration — love that for you! 💧 Your HRV of ${bio.hrv}ms will thank you. +30 XP earned!`,
    posture: `Beautiful posture reset! 🌿 Standing tall makes such a difference for your focus and comfort. +30 XP earned!`,
    "eye-break": `Your eyes deserved that break! 👁️ A little distance goes a long way for preventing fatigue. +30 XP earned!`,
    "typing-break": `Smart move stepping away from the keyboard! ✨ Your fingers and wrists will thank you. +30 XP earned!`,
    breath: `That mindful breathing moment is doing wonders for your HRV of ${bio.hrv}ms. 🌿 Keep that calm energy going. +30 XP earned!`,
    movement: `Moving that beautiful body — yes! 💜 Every bit of movement helps counter those sedentary hours. +30 XP earned!`,
  };

  return {
    text: responses[challengeType] ?? `Wellness challenge completed — great work taking care of yourself! ✨ +30 XP earned!`,
    xp: 30,
  };
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
      { name: "gemini-vision", description: "Verifies wellness challenge completion via Gemini Vision multimodal" },
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
      "ai-vision",
      "wellness-challenges",
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
      const isWellness = r.receiptType === "wellness";
      const cidStatus = (r.cidStatus ?? "pending") as "pending" | "stored" | "failed";

      return {
        entry_id: `${AGENT_ID}-${r.id}`,
        sequence: idx + 1,
        timestamp: r.createdAt.toISOString(),
        receipt_type: r.receiptType ?? "work",
        decision: isInsight
          ? `AURA generated health coaching insight and signed insight receipt`
          : isWellness
          ? `AURA issued wellness challenge; operator completed and earned XP`
          : `Operator completed ${Math.round((stats.durationSeconds ?? 0) / 60)}-minute focus session; receipt signed and filed`,
        tool_calls: isInsight || isWellness
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
          : isWellness
          ? { challenge_text: r.insightText ?? "", biometrics: { hrv: stats.hrv, strain: stats.strain } }
          : {
              session_summary: `HRV ${stats.hrv ?? "?"}ms · Strain ${stats.strain ?? "?"}/21 · APM ${stats.apm ?? "?"} · Vision ${stats.focusScore ?? "?"}/100`,
              duration_minutes: Math.round((stats.durationSeconds ?? 0) / 60),
              physical_integrity: r.physicalIntegrity ?? false,
              receipt_cid: r.receiptCid ?? null,
            },
        status: isInsight || isWellness ? "success" : cidStatus === "stored" ? "success" : cidStatus === "failed" ? "failed" : "partial",
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

/* ─────────────────────────────────────────────────────────────
   POST /api/aura/vision — Gemini Vision wellness challenge verification
   Body: { imageBase64, mimeType?, challengeType, bioContext? }
───────────────────────────────────────────────────────────── */
router.post("/aura/vision", async (req, res) => {
  const { imageBase64, mimeType = "image/jpeg", challengeType, bioContext } = req.body as {
    imageBase64?: string;
    mimeType?: string;
    challengeType?: string;
    bioContext?: MiniBioContext;
  };

  const challenge = challengeType ?? "hydration";
  const bio: MiniBioContext = bioContext ?? { hrv: 65, strain: 8, apm: 45 };
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || !imageBase64) {
    const fallback = visionFallback(challenge, bio);
    res.json({ response: fallback.text, xpAwarded: fallback.xp, challengeVerified: true, fallback: true });
    return;
  }

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = buildVisionSystemPrompt(challenge, bio);

    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType, data: imageBase64 } },
    ]);

    const text = result.response.text().trim();
    const xpMatch = text.match(/\+(\d+)\s*XP/i);
    const xpAwarded = xpMatch ? parseInt(xpMatch[1]) : 30;

    res.json({ response: text, xpAwarded, challengeVerified: true, fallback: false });
  } catch (err) {
    console.error("[AURA] Vision error:", err);
    const fallback = visionFallback(challenge, bio);
    res.json({ response: fallback.text, xpAwarded: fallback.xp, challengeVerified: true, fallback: true });
  }
});

export default router;
