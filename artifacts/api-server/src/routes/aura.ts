import { Router, type IRouter } from "express";
import { AuraChatBody } from "@workspace/api-zod";
import { db, hasDb, inMemory, workReceiptsTable } from "@workspace/db";
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
    ? `\n- Wellness Challenges Completed: ${bio.completedChallenges.join(', ')} (${bio.completedChallenges.length} total) 🌿`
    : "";

  const recentHistory = recentReceiptSummaries && recentReceiptSummaries.length > 0
    ? `\nSESSION HISTORY & CONTEXT:\n${recentReceiptSummaries.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}\n`
    : "";

  // Dynamic personality mode based on biometric severity
  const isLateNight = hour >= 22 || hour < 6;
  const isCritical = bio.hrv < 50 || bio.strain > 16 || (isLateNight && bio.strain > 12);
  const isModerate = !isCritical && (bio.hrv <= 70 || (bio.strain >= 8 && bio.strain <= 15) || (bio.focusScore >= 50 && bio.focusScore <= 75));

  const personalityMode = isCritical
    ? `CURRENT PERSONALITY MODE: STRICT COACH 🔴
You are URGENT and DIRECT right now. Short imperative sentences. No fluff. The user's body is in a critical state — act like it.`
    : isModerate
    ? `CURRENT PERSONALITY MODE: DATA NERD 📊
You love numbers, trends, and comparisons right now. Reference changes, percentages, patterns. Make the user feel smart about their own data.`
    : `CURRENT PERSONALITY MODE: WARM FRIEND ✨
You are encouraging and celebratory right now. The user is doing great — be genuinely happy for them. Light touch.`;

  return `You are AURA — a certified health & productivity coach embedded in Bio-Ledger. You combine the expertise of a sports physiologist, an ergonomist, and a wellness coach. You give REAL, SPECIFIC, ACTIONABLE health advice.

${personalityMode}

YOUR CORE ROLE:
- You are a HEALTH COACH first. When the user mentions what they ate, drank, how they feel, or how long they worked — give direct, expert health guidance.
- ALWAYS respond to what the user ACTUALLY SAID before mentioning biometrics.
- If they mention unhealthy habits (energy drinks, soda, junk food, no sleep, long hours), address it directly with a better alternative.
- Be direct but warm. Like a coach who genuinely cares, not a robot reading metrics.

YOUR COACHING STYLE:
- Lead with empathy: acknowledge what they said first
- Then give ONE clear health recommendation
- Back it up with their biometric data when relevant
- Keep responses 2-4 sentences, conversational
- Use plain language, not medical jargon
- You may use one emoji per message

EXAMPLES OF GOOD RESPONSES:
- User: "I've been working all night and drank some coke"
  → "Working all night is rough on your body — and soda actually dehydrates you more. With your HRV at ${bio.hrv}ms and it being ${timeLabel}, your nervous system needs real hydration. Grab a big glass of water or herbal tea, and try to wrap up soon. 💧"

- User: "I'm so tired but need to finish this"
  → "I hear you — but at ${bio.strain}/21 strain and HRV ${bio.hrv}ms, pushing through will actually slow you down. A 15-minute power nap or a walk outside would reset your focus faster than another hour of grinding."

- User: "how am I doing?"
  → "HRV ${bio.hrv}ms, Strain ${bio.strain}/21, Focus ${bio.focusScore}/100. ${bio.hrv >= 70 ? "Your body is in a solid recovery state — nice work taking care of yourself!" : bio.hrv < 55 ? "Your stress markers are elevated. Time to slow down and breathe." : "You're holding steady. Keep listening to your body."}"

CURRENT BIOMETRIC SNAPSHOT (${timeLabel}):
- HRV: ${bio.hrv}ms ${bio.hrv >= 70 ? "(strong recovery)" : bio.hrv < 55 ? "(elevated stress)" : "(normal)"}
- Strain: ${bio.strain}/21 ${bio.strain > 15 ? "(heavy — prioritize rest)" : ""}
- Focus Score: ${bio.focusScore}/100
- APM: ${bio.apm} actions/min
- Posture: ${bio.postureWarning ? "slouching detected" : "good"}
- ${sessionStatus}${challengeStatus}
${recentHistory}
HEALTH ALERTS TO WEAVE IN NATURALLY (don't list these, work them into conversation):
${bio.hourOfDay >= 22 ? `- It's ${timeLabel}. Late-night work damages sleep quality and HRV recovery. Gently encourage wrapping up.` : ""}
${bio.strain > 15 ? "- Strain is very high. The body needs recovery, not more output." : ""}
${bio.hrv < 55 ? "- HRV is low — stress or fatigue. Suggest hydration, deep breathing, or a walk." : ""}
${bio.apm > 70 ? `- High typing intensity (${bio.apm} APM). Risk of repetitive strain injury. Suggest wrist stretches.` : ""}
${sessionMins > 25 ? `- ${sessionMins} min without break. Recommend micro-break for ergonomic health.` : ""}

IMPORTANT: Always respond to the user's MESSAGE first. Don't just dump biometric data. Be a coach, not a dashboard.`;
}

function ruleFallback(bio: BioContext, message: string): string {
  const lowerMsg = message.toLowerCase();
  const sessionMins = bio.sessionMinutes ?? Math.round(bio.sessionDurationSeconds / 60);
  const isLateNight = bio.hourOfDay >= 22 || bio.hourOfDay < 5;

  // ── Respond to what the user SAID first ──

  // Mentions of unhealthy drinks
  if (lowerMsg.includes("coke") || lowerMsg.includes("soda") || lowerMsg.includes("energy drink") || lowerMsg.includes("red bull") || lowerMsg.includes("monster")) {
    return `I appreciate the honesty! But soda and energy drinks actually dehydrate you and spike your cortisol. With your HRV at ${bio.hrv}ms, your body needs real hydration — a big glass of water or herbal tea will do way more for your focus than caffeine and sugar. 💧`;
  }

  // Mentions of coffee
  if (lowerMsg.includes("coffee") || lowerMsg.includes("caffeine")) {
    return `Coffee can help in moderation, but ${isLateNight ? "this late it will wreck your sleep quality" : "too much raises your strain"}. Your strain is already at ${bio.strain}/21. Try matching every coffee with a glass of water to stay balanced. 💧`;
  }

  // Working all night / tired / exhausted
  if (lowerMsg.includes("all night") || lowerMsg.includes("no sleep") || lowerMsg.includes("didn't sleep") || lowerMsg.includes("exhausted") || lowerMsg.includes("so tired")) {
    return `Your body is not designed for all-nighters — sleep deprivation tanks your HRV (yours is ${bio.hrv}ms) and makes every hour of work less effective. The best thing you can do right now is hydrate, take a 20-minute power nap, and then finish with a fresh mind. Your health is worth more than any deadline. 🌙`;
  }

  // Tired but need to continue
  if (lowerMsg.includes("tired") || lowerMsg.includes("sleepy") || lowerMsg.includes("fatigue")) {
    return `Feeling tired with HRV at ${bio.hrv}ms and strain at ${bio.strain}/21 — your body is telling you something real. A 10-minute walk outside would reset your alertness better than pushing through. Fresh air + movement = natural energy boost. 🌿`;
  }

  // Asking how they're doing
  if (lowerMsg.includes("how am i") || lowerMsg.includes("how do i look") || lowerMsg.includes("my stats") || lowerMsg.includes("status")) {
    return `Here's your snapshot: HRV ${bio.hrv}ms ${bio.hrv >= 70 ? "(strong!)" : bio.hrv < 55 ? "(stressed)" : "(okay)"}, Strain ${bio.strain}/21, Focus ${bio.focusScore}/100. ${bio.hrv >= 70 ? "You're in great shape — your recovery is solid!" : "You could use a break and some water. Take care of yourself."} 📊`;
  }

  // Break / rest requests
  if (lowerMsg.includes("break") || lowerMsg.includes("rest") || lowerMsg.includes("stop") || lowerMsg.includes("pause")) {
    return `Smart move. After ${sessionMins} minutes with strain at ${bio.strain}/21, a break is exactly what your body needs. Stand up, stretch your wrists and neck, grab some water. Even 5 minutes makes a huge difference for your tendons and focus. 🌿`;
  }

  // Greetings
  if (lowerMsg.includes("hi") || lowerMsg.includes("hello") || lowerMsg.includes("hey") || lowerMsg === "yo" || lowerMsg === "sup") {
    if (isLateNight) {
      return `Hey! Burning the midnight oil? Your strain is at ${bio.strain}/21 and HRV ${bio.hrv}ms. ${bio.strain > 12 ? "You've pushed hard today — make sure you're hydrating and planning to wrap up soon." : "Looking okay for now, but keep checking in with your body."} How can I help? 💜`;
    }
    return `Hey! HRV ${bio.hrv}ms, Strain ${bio.strain}/21, Focus ${bio.focusScore}/100. ${bio.hrv >= 70 ? "You're looking great — solid biometrics!" : "Doing okay — remember to hydrate and take breaks."} What's on your mind? ✨`;
  }

  // Food mentions
  if (lowerMsg.includes("eat") || lowerMsg.includes("food") || lowerMsg.includes("hungry") || lowerMsg.includes("snack") || lowerMsg.includes("lunch") || lowerMsg.includes("dinner")) {
    return `Good that you're thinking about nutrition! With strain at ${bio.strain}/21, go for something with protein and complex carbs — nuts, fruit, or a proper meal. Avoid heavy sugar that'll crash your focus in 30 minutes. Hydrate first though — sometimes hunger is actually thirst. 🍎`;
  }

  // Stress / anxiety
  if (lowerMsg.includes("stress") || lowerMsg.includes("anxious") || lowerMsg.includes("overwhelm") || lowerMsg.includes("pressure")) {
    return `I can see it in your data too — HRV at ${bio.hrv}ms ${bio.hrv < 55 ? "confirms elevated stress" : "is holding but could be better"}. Right now: close your eyes, breathe in for 4 counts, hold for 4, out for 4. Do that 3 times. It directly lowers your cortisol and improves HRV. You've got this. 🧘`;
  }

  // ── Proactive biometric-based responses (only if nothing matched above) ──

  if (bio.postureWarning) {
    return `Quick posture check — I noticed you're leaning forward. Your neck is carrying extra strain in that position. Roll your shoulders back, sit tall, screen at eye level. Your spine and tendons will thank you. 🌿`;
  }

  if (bio.apm > 70 && sessionMins > 5) {
    return `You're typing at ${bio.apm} APM — that's intense. After ${sessionMins} minutes at this pace, your wrist tendons need a break. Extend your arms, pull fingers back gently for 15 seconds each side. RSI prevention is about these small moments. 🤲`;
  }

  if (isLateNight && bio.strain > 12) {
    return `It's late and your strain is ${bio.strain}/21 — you've earned your rest tonight. Sleep is when your body repairs and your HRV recovers. Try to wind down soon. 🌙`;
  }

  return `HRV ${bio.hrv}ms, Strain ${bio.strain}/21, Focus ${bio.focusScore}/100. ${bio.hrv >= 70 ? "Looking strong — you're taking good care of yourself!" : bio.hrv < 55 ? "Your stress markers are up. Hydrate, breathe, and consider a break." : "Steady state. Remember to keep hydrating and stretching."} What's on your mind? 💜`;
}

function buildVisionSystemPrompt(challengeType: string, bio: MiniBioContext): string {
  const challengeContext: Record<string, string> = {
    hydration: "The user is showing you their water bottle or a drink to complete their hydration challenge. Look for any cup, bottle, glass or drink. Be encouraging!",
    posture: "The user is showing you their posture for a posture reset challenge. Look at how they're sitting — is their back straighter than before? Even a small improvement counts!",
    "eye-break": "The user has stepped away from their screen for a 20-20-20 eye break. They might show a distant view, window, or just themselves looking refreshed.",
    "typing-break": "The user is showing you that they've stepped away from their keyboard. Look for hands away from keyboard, or them stretching.",
    breath: "The user has just completed a mindful breathing exercise. They might look more relaxed or show a calm environment.",
    movement: "The user is showing you that they've gotten up and moved around. Look for them standing, walking, or in a different location.",
    "wrist-stretch": "The user is doing a wrist stretch for RSI prevention. Look for extended arms, pulled-back fingers, or wrist rotation movements.",
    "neck-roll": "The user is doing neck rolls to prevent repetitive strain. Look for head tilting or rotating movements.",
    "eye-relief": "The user is looking away from the screen for eye relief. They might show a distant view or be looking away from the camera.",
    "standing-break": "The user has stood up from their desk to prevent RSI. Look for them standing, stretching their arms, or shaking out their hands.",
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
    "wrist-stretch": `Great wrist stretch — your tendons appreciate the love! 🤲 Consistent stretching is the best carpal tunnel prevention. +40 XP earned!`,
    "neck-roll": `Nice neck roll! 🧣 Releasing that tension keeps repetitive strain at bay. +35 XP earned!`,
    "eye-relief": `Your eyes needed that break from the screen! 👀 Regular eye relief keeps your focus sharp and prevents strain. +30 XP earned!`,
    "standing-break": `Standing break complete — your whole body thanks you! 🧍 Shaking out those arms does wonders for tendon health. +50 XP earned!`,
  };

  const xpByType: Record<string, number> = {
    hydration: 30, posture: 30, "eye-break": 35, "typing-break": 25, breath: 40, movement: 50,
    "wrist-stretch": 40, "neck-roll": 35, "eye-relief": 30, "standing-break": 50,
  };

  return {
    text: responses[challengeType] ?? `Wellness challenge completed — great work taking care of yourself! ✨ +30 XP earned!`,
    xp: xpByType[challengeType] ?? 30,
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

  const receipts = hasDb && db
    ? await db
        .select()
        .from(workReceiptsTable)
        .where(eq(workReceiptsTable.nullifierHash, nullifier))
        .orderBy(desc(workReceiptsTable.createdAt))
    : inMemory.select(nullifier).reverse();

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
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const mappedHistory = (history ?? [])
      .map((m: { role: "user" | "assistant"; content: string }) => ({
        role: m.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text: m.content }],
      }));

    // Gemini requires the first content in history to be role 'user'
    const firstUserIdx = mappedHistory.findIndex((m) => m.role === "user");
    const sanitizedHistory = firstUserIdx > 0 ? mappedHistory.slice(firstUserIdx) : mappedHistory;

    const chat = model.startChat({
      systemInstruction: { role: "user" as const, parts: [{ text: buildSystemPrompt(bioContext as BioContext, recentReceiptSummaries ?? []) }] },
      history: sanitizedHistory,
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
