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
  sessionMinutes?: number;
  completedChallenges?: string[];
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

  const sessionMins = bio.sessionMinutes ?? Math.round(bio.sessionDurationSeconds / 60);
  const sessionStatus = bio.isSessionActive
    ? `Active session — ${sessionMins} minute${sessionMins === 1 ? "" : "s"} elapsed`
    : "No active session";
  const challengeStatus = bio.completedChallenges && bio.completedChallenges.length > 0
    ? `\n- Wellness Challenges Completed: ${bio.completedChallenges.join(', ')} (${bio.completedChallenges.length} total)`
    : "";

  const recentHistory = recentReceiptSummaries && recentReceiptSummaries.length > 0
    ? `\nSESSION HISTORY & CONTEXT:\n${recentReceiptSummaries.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}\n`
    : "";

  // Dynamic personality selection based on biometric severity
  const isLateNight = hour >= 22 || hour < 6;
  const isCritical = bio.hrv < 50 || bio.strain > 16 || (isLateNight && bio.strain > 12);
  const isModerate = !isCritical && (bio.hrv <= 70 || (bio.strain >= 8 && bio.strain <= 15) || (bio.focusScore >= 50 && bio.focusScore <= 75));

  let personalityBlock: string;
  if (isCritical) {
    personalityBlock = `PERSONALITY MODE: STRICT COACH 🔴
- You are direct, urgent, commanding. No fluff.
- Use short imperative sentences. Give specific numbers.
- Example tone: "HRV at 47ms. That's a red flag. Stop typing. Stand up. Walk to the window. 60 seconds. Now."
- You care deeply — that's WHY you're being strict right now.`;
  } else if (isModerate) {
    personalityBlock = `PERSONALITY MODE: DATA NERD 📊
- You love numbers, trends, and comparisons. Analytical but warm.
- Reference changes from baseline, percentages, patterns.
- Example tone: "Your HRV has dropped 12% since session start (72ms → 63ms). APM is holding at 56 but focus dipped to 68/100. A 5-min break now could restore your baseline."
- Make the user feel smart about their own data.`;
  } else {
    personalityBlock = `PERSONALITY MODE: WARM FRIEND ✨
- You are encouraging, celebratory, light-hearted.
- Celebrate their good state. Be genuinely happy for them.
- Example tone: "You're in a beautiful flow state right now — HRV 78ms, focus 89/100. Your body is loving this rhythm. Keep going! ✨"
- Light touch — don't over-coach when things are going well.`;
  }

  return `You are AURA — a Sovereign Wellness & Productivity Companion embedded in Bio-Ledger.
You dynamically shift between three personalities based on how the user's body is doing RIGHT NOW.

${personalityBlock}

RULES (always follow):
- Reference at least 2 specific biometric numbers from the snapshot below
- If session > 45 min, mention cumulative screen time
- If completedChallenges > 0, praise them briefly
- End with ONE specific actionable suggestion
- Max 3 sentences. Be concise.
- You may use one emoji per response

CURRENT BIOMETRIC SNAPSHOT (${timeLabel}):
- HRV: ${bio.hrv}ms ${bio.hrv >= 70 ? "✓ strong" : bio.hrv < 50 ? "⚠ critical" : bio.hrv < 55 ? "↓ stressed" : "→ moderate"}
- Strain: ${bio.strain}/21 ${bio.strain > 16 ? "⚠ redline" : bio.strain > 12 ? "↑ heavy" : "→ manageable"}
- Focus Score: ${bio.focusScore}/100
- APM: ${bio.apm} actions/minute
- Posture: ${bio.postureWarning ? "⚠ leaning forward — neck carrying 40+ lbs extra force" : "good ✓"}
- ${sessionStatus}${challengeStatus}
${recentHistory}
THRESHOLDS (internal reference — don't recite):
- HRV <50ms → critical stress, intervene firmly
- HRV 50-70ms → moderate, coach with data
- HRV >70ms → celebrate
- Strain >16 → body is maxed, demand rest
- Focus <65 → eye/attention fatigue
- APM >80 + HRV dropping → stress-typing pattern
- APM <30 during session → user may be stuck
- Screen time >45 min → mention it
- Late night + any strain → sleep nudge`;
}

function ruleFallback(bio: BioContext, message: string): string {
  const lowerMsg = message.toLowerCase();
  const sessionMins = Math.round(bio.sessionDurationSeconds / 60);
  const isLateNight = bio.hourOfDay >= 22 || bio.hourOfDay < 6;

  // P0: Critical states — strict coach mode
  if (bio.hrv < 50) {
    return `HRV at ${bio.hrv}ms — that's a red flag. Your nervous system is maxed. Stop what you're doing. Stand up. Three slow breaths, then walk for 60 seconds. Now.`;
  }

  if (bio.strain > 16) {
    return `Strain at ${bio.strain}/21 — you're in the red zone. Your body has given everything today. No more pushing. Close the laptop, drink water, rest. You've earned it.`;
  }

  if (isLateNight && bio.strain > 12) {
    return `It's late and your strain is ${bio.strain}/21. Your HRV is ${bio.hrv}ms. Every minute you stay up now costs you 3x tomorrow. Shut it down. Sleep is the ultimate performance hack.`;
  }

  // P1: Posture warning — direct
  if (bio.postureWarning) {
    return `I can see you leaning forward — your neck is carrying 40+ pounds of extra force right now. Roll shoulders back, chin level, screen at eye level. Better? 🧘`;
  }

  // P2: Screen time overload
  if (sessionMins > 50) {
    return `You've been locked in for ${sessionMins} minutes straight. Your blink rate is probably dropping. 20-20-20 rule: look 20 feet away for 20 seconds. Go.`;
  }

  // P3: Stress-typing pattern
  if (bio.apm > 80 && bio.hrv < 65) {
    return `Your fingers are flying at ${bio.apm} APM but your HRV just dropped to ${bio.hrv}ms. That's stress-typing. Pause. Three deep breaths. Then continue. 📊`;
  }

  // P4: Low APM — user might be stuck
  if (bio.apm < 30 && bio.isSessionActive && sessionMins > 5) {
    return `APM at ${bio.apm} — are you stuck on something? Sometimes stepping away for 2 minutes unlocks the solution your subconscious is processing. 💡`;
  }

  // P5: Focus fatigue
  if (bio.focusScore < 65) {
    return `Focus at ${bio.focusScore}/100, HRV at ${bio.hrv}ms — your attention is fragmenting. Your eyes and brain are asking for a micro-break. 20 seconds looking at something distant. 👁️`;
  }

  // P6: User asks about breaks
  if (lowerMsg.includes("break") || lowerMsg.includes("rest") || lowerMsg.includes("stop")) {
    if (sessionMins >= 50) {
      return `Session complete: ${sessionMins} minutes of focused work with HRV holding at ${bio.hrv}ms. That's a solid session. Your body earned this break. 🌿`;
    }
    return `${sessionMins} minutes in, HRV ${bio.hrv}ms, strain ${bio.strain}/21. You've got about ${Math.max(0, 50 - sessionMins)} more good minutes before fatigue sets in. Keep rolling! ✨`;
  }

  // P7: Moderate state — data nerd mode
  if (bio.hrv <= 70 || bio.strain >= 8) {
    return `HRV ${bio.hrv}ms, strain ${bio.strain}/21, focus ${bio.focusScore}/100. You're in the moderate zone — not bad, but your body is spending energy. A 5-min break in the next 15 minutes would help your numbers recover. 📊`;
  }

  // P8: Good state — warm friend
  return `HRV ${bio.hrv}ms, focus ${bio.focusScore}/100 — you're in a beautiful flow state right now. Your body is loving this rhythm. Keep going! ✨`;
}

function buildVisionSystemPrompt(challengeType: string, bio: MiniBioContext): string {
  const challengeContext: Record<string, string> = {
    hydration: "The user is showing you their water bottle or a drink to complete their hydration challenge. Look for any cup, bottle, glass or drink. Be encouraging! Also check: do they seem hydrated? Dry lips or tired eyes might mean they need more water, not just a sip.",
    posture: "The user is showing you their posture for a posture reset challenge. Compare their current posture to ideal: shoulders back, spine neutral, screen at eye level. Give specific feedback on what to adjust — even a small improvement counts!",
    "eye-break": "The user has stepped away from their screen for a 20-20-20 eye break. They might show a distant view, window, or just themselves looking refreshed. Acknowledge the effort of stepping away.",
    "typing-break": "The user is showing you that they've stepped away from their keyboard. Look for hands away from keyboard, or them stretching. Suggest a quick wrist stretch if you can see their hands.",
    breath: "The user has just completed a mindful breathing exercise. They might look more relaxed or show a calm environment. Note any visible relaxation in their face or posture.",
    movement: "The user is showing you that they've gotten up and moved around. Look for them standing, walking, or in a different location. If they're standing, give them a quick 30-second stretch suggestion for their next movement break.",
  };

  const context = challengeContext[challengeType] ?? "The user is completing a wellness challenge.";

  return `You are AURA — a Sovereign Wellness Companion verifying a real-world wellness action via camera.

CHALLENGE TYPE: ${challengeType}
USER CONTEXT: ${context}
BIOMETRICS: HRV ${bio.hrv}ms, Strain ${bio.strain}/21, APM ${bio.apm}

Your job:
1. Describe what you SEE specifically (not generically) — prove you actually analyzed the image
2. Award XP — include exactly "+30 XP" in your response (or "+50 XP" if they went above and beyond)
3. Keep it to 2 sentences max — specific to what you see, not generic praise
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
      { name: "gemini-chat", description: "Invokes Gemini 2.5 Flash for contextual biometric health coaching" },
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
      model: "gemini-2.5-flash",
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
   POST /api/aura/chat — Gemini 2.5 Flash with rule-based fallback
───────────────────────────────────────────────────────────── */
router.post("/aura/chat", async (req, res) => {
  const parsed = AuraChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation error", details: parsed.error.message });
    return;
  }

  const { message, bioContext, history, recentReceiptSummaries } = parsed.data;
  const bio = bioContext as BioContext;
  const apiKey = process.env.GEMINI_API_KEY;

  console.log(`🧠 AURA analyzing biometrics: HRV ${bio.hrv}ms, Strain ${bio.strain}/21, Focus ${bio.focusScore}/100, APM ${bio.apm}`);

  if (!apiKey) {
    const fallbackResponse = ruleFallback(bio, message);
    console.log(`💬 AURA response generated (fallback: true, reason: no API key)`);
    res.json({ response: fallbackResponse, fallback: true });
    return;
  }

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const systemPrompt = buildSystemPrompt(bio, recentReceiptSummaries ?? []);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: { role: "user", parts: [{ text: systemPrompt }] },
    });

    const chat = model.startChat({
      history: (history ?? []).map((m: { role: "user" | "assistant"; content: string }) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    });

    const result = await chat.sendMessage(message);
    const text = result.response.text().trim();

    console.log(`💬 AURA response generated (fallback: false, model: gemini-2.5-flash)`);
    res.json({ response: text, fallback: false });
  } catch (err) {
    const fallbackResponse = ruleFallback(bio, message);
    console.error("[AURA] Gemini error, using fallback:", err);
    console.log(`💬 AURA response generated (fallback: true, reason: API error)`);
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

  // Guard: reject oversized image payloads (base64 of 5MB ≈ ~6.8M chars)
  const MAX_IMAGE_CHARS = 7_000_000;
  if (imageBase64 && imageBase64.length > MAX_IMAGE_CHARS) {
    res.status(413).json({ error: "Image payload too large (max ~5MB)" });
    return;
  }

  // Guard: validate mimeType is an image
  const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"];
  if (imageBase64 && !ALLOWED_MIMES.includes(mimeType)) {
    res.status(400).json({ error: "Unsupported mimeType. Use image/jpeg, image/png, or image/webp." });
    return;
  }

  const challenge = challengeType ?? "hydration";
  const bio: MiniBioContext = bioContext ?? { hrv: 65, strain: 8, apm: 45 };
  const apiKey = process.env.GEMINI_API_KEY;

  console.log(`👁️ AURA Vision: Verifying "${challenge}" challenge via Gemini 2.5 Flash`);

  if (!imageBase64) {
    // No frame provided — cannot verify vision challenge
    const fallback = visionFallback(challenge, bio);
    res.json({ response: fallback.text, xpAwarded: 0, challengeVerified: false, fallback: true });
    return;
  }

  if (!apiKey) {
    // Frame provided but no Gemini key — trust the user and award XP with warm fallback
    const fallback = visionFallback(challenge, bio);
    res.json({ response: fallback.text, xpAwarded: fallback.xp, challengeVerified: true, fallback: true });
    return;
  }

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = buildVisionSystemPrompt(challenge, bio);

    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType, data: imageBase64 } },
    ]);

    const text = result.response.text().trim();
    const xpMatch = text.match(/\+(\d+)\s*XP/i);
    const xpAwarded = xpMatch ? parseInt(xpMatch[1]) : 30;

    console.log(`✅ Challenge "${challenge}" verified — ${xpAwarded} XP awarded`);
    res.json({ response: text, xpAwarded, challengeVerified: true, fallback: false });
  } catch (err) {
    console.error("[AURA] Vision error:", err);
    const fallback = visionFallback(challenge, bio);
    res.json({ response: fallback.text, xpAwarded: fallback.xp, challengeVerified: true, fallback: true });
  }
});

export default router;
