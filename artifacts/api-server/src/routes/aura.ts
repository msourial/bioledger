import { Router, type IRouter } from "express";
import { AuraChatBody } from "@workspace/api-zod";

const router: IRouter = Router();

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
