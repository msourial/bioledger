# BioLedger — Hackathon Implementation Plan
## PL Genesis: Frontiers of Collaboration | Deadline: March 31, 2026

> **This is a living document.** Update status after each task.
> **Two developers working in parallel. Zero merge conflicts by design.**

---

## CURRENT STATE: What's Real vs Mocked vs Missing

### REAL (Working)
| Feature | File | Notes |
|---------|------|-------|
| Camera face detection | `use-camera.ts` | MediaPipe Face Landmarker loads, detects face, blink rate, head stability |
| APM tracking | `use-apm.ts` | Tracks keyboard + mouse events, rolling 60s window |
| Motion lock | `use-motion-lock.ts` | Accelerometer-based interruption detection |
| Pomodoro timer | `Dashboard.tsx` | 25-min timer with start/abort/demo modes |
| Wellness coach logic | `use-wellness-coach.ts` | 6 challenge types with trigger logic + behavioral auto-verify |
| Gemini Chat API | `routes/aura.ts` | Real `@google/generative-ai` integration — needs `GEMINI_API_KEY` |
| Gemini Vision API | `routes/aura.ts` | Real multimodal image analysis — needs `GEMINI_API_KEY` |
| Rule-based fallback | `routes/aura.ts` | Works without API key — warm, biometric-aware responses |
| AURA Chat UI | `AuraChat.tsx` | Chat interface with voice input/output, vision challenges |
| Receipt chain card UI | `ReceiptChainCard.tsx` | 4-step chain visualization |
| ERC-8004 manifest | `routes/aura.ts` | Returns agent capability JSON |
| ERC-8004 agent logs | `routes/aura.ts` | Returns receipt-based execution log |
| Express API server | `app.ts` + `index.ts` | Express 5 with Pino logging, CORS |
| PostgreSQL + Drizzle | `lib/db/` | work_receipts table, connection pool |
| OpenAPI codegen | `lib/api-spec/` | Orval generates React Query hooks + Zod schemas |

### MOCKED (Fake but looks real)
| Feature | File | What's Fake | What's Needed for Real |
|---------|------|-------------|----------------------|
| HRV + Strain data | `whoop-mock.ts` | Random walk ±3ms every 5s | Real Whoop OAuth (skip for hackathon — demo mode is fine) |
| World ID login | `LockScreen.tsx` | Simulated 5-step ZK animation | Set `WORLD_ID_APP_ID` env var for real IDKit popup |
| Filecoin upload | `routes/filecoin.ts` | Uses `web3.storage` HTTP API; returns "pending" without token | Need real Storacha token OR `@filoz/synapse-sdk` import |
| Whoop OAuth | `routes/auth.ts` | Pure stub — returns hardcoded demo data | Token exchange never implemented (skip for hackathon) |
| HMAC signing | `companion-agent.ts` | Client-side with hardcoded key | Acceptable for hackathon demo |

### MISSING (Not Built)
| Feature | Impact on Demo | Priority |
|---------|---------------|----------|
| `GEMINI_API_KEY` not set | Chat/vision returns fallback only | **P0 — BLOCKER** |
| `WORLD_ID_APP_ID` not set | Login is simulated animation only | **P1 — Bounty critical** |
| Storacha/Filecoin token not set | Receipts show "pending" forever | **P1 — Bounty critical** |
| `@filoz/synapse-sdk` not imported | Judges check for this import | **P1 — Bounty critical** |
| README.md with Bounty Matrix | Judges see this first | **P1 — Required** |
| Console.logs for judges | Visual proof in screen recording | **P2 — Easy win** |
| Demo-friendly timers (shorter cooldowns) | Challenges won't trigger in 3-min video | **P0 — Demo critical** |
| AI personality tuning (mixed mode) | Chat feels generic | **P1 — Demo quality** |

---

## INFRASTRUCTURE LIMITATIONS (Know Before You Build)

### Cannot Fix in 24 Hours (Accept These)
1. **No auth middleware** — All endpoints are public. Fine for hackathon demo.
2. **No rate limiting** — Won't matter for single-user demo.
3. **No database indexes** — Single user, <100 receipts. No performance issue.
4. **Client-side HMAC key** — Hardcoded. Judges won't penalize this for hackathon.
5. **No real Whoop data** — Demo mode with mock data is acceptable.
6. **ERC-8004 compliance** — Real spec requires on-chain contracts. Your implementation is "ERC-8004 inspired." Frame it as "draft implementation for hackathon."
7. **sessionStats not in signed payload** — Won't matter for demo.

### Must Fix in 24 Hours
1. **GEMINI_API_KEY** — Without this, chat/vision is just rule-based fallback.
2. **Challenge cooldown timers** — 30min/40min/60min/90min won't trigger in a 3-5 min demo video.
3. **Storacha integration** — Judges check code for real `upload()` calls.
4. **World ID app_id** — Judges check for real ZK proof flow.
5. **README** — info.md says "do this first." Judges click repo → README is first thing they see.

---

## GIT STRATEGY

```
main (protected — merge target)
  ├── dev-a/ai-wellness      ← Dev A's branch
  └── dev-b/blockchain-id    ← Dev B's branch
```

### File Ownership (Zero Conflicts)

| File / Directory | Owner | Notes |
|-----------------|-------|-------|
| `routes/aura.ts` | **Dev A** | AI prompts, chat, vision |
| `use-wellness-coach.ts` | **Dev A** | Challenge timers, triggers |
| `AuraChat.tsx` | **Dev A** | Chat UI, voice, nudges |
| `companion-agent.ts` | **Dev A** | Signing, console.logs |
| `whoop-mock.ts` | **Dev A** | If biometric tuning needed |
| `Dashboard.tsx` (lines 1-250: left pane) | **Dev A** | Biometrics display, camera, orb |
| `routes/filecoin.ts` | **Dev B** | Storacha/Synapse upload |
| `routes/world-id.ts` | **Dev B** | World ID verification |
| `LockScreen.tsx` | **Dev B** | Login flow |
| `ReceiptChainCard.tsx` | **Dev B** | Receipt display |
| `Dashboard.tsx` (lines 250+: right pane) | **Dev B** | Receipt list, export panel |
| `README.md` | **Dev B** | New file, no conflict |
| `package.json` (api-server) | **Dev B** | Add synapse-sdk dependency |

---

## PHASE 1: Environment Setup (Both Devs, 30 min)

### Status: [ ] Not Started

### Pre-Conditions
- Both devs have the repo cloned
- pnpm installed globally
- PostgreSQL running (or Replit provides it)

### Tasks

#### Both Devs: Branch Setup
```bash
git checkout main
git pull origin main

# Dev A:
git checkout -b dev-a/ai-wellness

# Dev B:
git checkout -b dev-b/blockchain-id
```

#### Both Devs: Install Dependencies + Set Env Vars
```bash
pnpm install
```

Set these environment variables (in `.env` or Replit Secrets):
```
# REQUIRED — Both devs
DATABASE_URL=<your-postgres-connection-string>
PORT=3000
GEMINI_API_KEY=AIzaSyD-5Opp6HnP7zctyw4PUNXG4XkjWmh_swY

# Dev B will add these after signup:
WORLD_ID_APP_ID=<from developer.worldcoin.org>
SYNAPSE_API_KEY=<from storacha.network>
```

#### Both Devs: Verify App Runs
```bash
# Terminal 1: Backend
cd artifacts/api-server && pnpm run dev

# Terminal 2: Frontend
cd artifacts/bio-ledger && pnpm run dev
```

Open browser → verify Dashboard loads, camera activates.

### Verification Checklist
- [ ] Both devs on separate branches
- [ ] `pnpm install` succeeds
- [ ] Backend starts on port 3000
- [ ] Frontend starts on port 5173
- [ ] Camera activates in browser
- [ ] Face detection works (green indicator)

---

## PHASE 2: Dev A — AI Personality & System Prompts (2 hours)

### Status: [ ] Not Started

### Pre-Exploration
Before coding, Dev A should understand:
- Current system prompt is in `routes/aura.ts` lines 31-74
- Rule fallback is in `routes/aura.ts` lines 76-104
- Vision prompt is in `routes/aura.ts` lines 106-131
- The chat receives full bioContext (HRV, strain, APM, focus, posture, session duration, completed challenges, recent receipts)

### TASK A2.1: Rewrite `buildSystemPrompt()` — Mixed Personality
**File:** `artifacts/api-server/src/routes/aura.ts` (lines 31-74)

**Current:** Single "warm companion" personality.
**Target:** Dynamic personality that shifts based on data severity.

**Personality Rules:**
```
IF hrv < 50 OR strain > 16 OR (lateNight AND strain > 12):
  → STRICT COACH: Direct commands, urgency, specific numbers
  → Example: "HRV at 47ms. That's a red flag. Stop typing.
    Stand up. Walk to the window. 60 seconds. Now."

IF metrics are moderate (hrv 50-70, strain 8-15, focus 50-75):
  → DATA NERD: Reference numbers, trends, comparisons
  → Example: "Your HRV has dropped 12% since session start
    (72ms → 63ms). APM is holding at 56 but focus dipped to
    68/100. A 5-min break now could restore your baseline."

IF metrics are good (hrv > 70, strain < 8, focus > 75):
  → WARM FRIEND: Encouraging, celebratory, light
  → Example: "You're in a beautiful flow state right now —
    HRV 78ms, focus 89/100. Your body is loving this rhythm.
    Keep going! ✨"

ALWAYS:
  - Reference at least 2 specific biometric numbers
  - If session > 45 min, mention cumulative screen time
  - If completedChallenges > 0, praise them
  - End with ONE specific actionable suggestion
  - Max 3 sentences
```

### TASK A2.2: Rewrite `ruleFallback()` — Data-Backed Responses
**File:** `artifacts/api-server/src/routes/aura.ts` (lines 76-104)

**Current:** Basic threshold checks with generic advice.
**Target:** More specific, data-referenced, personality-shifting fallbacks.

**Add these new rules (in priority order):**
```
1. Screen time > 50 min without break → "You've been locked in
   for ${mins} minutes straight. Your blink rate is probably
   dropping. 20-20-20 rule: look 20 feet away for 20 seconds. Go."

2. APM spike (> 80) + HRV drop → "Your fingers are flying at
   ${apm} APM but your HRV just dropped to ${hrv}ms. That's
   stress-typing. Pause. Three deep breaths. Then continue."

3. Good session ending → "Session complete: ${mins} minutes of
   focused work with HRV holding at ${hrv}ms. That's a solid
   session. Your body earned this break."

4. Posture warning active → "I can see you leaning forward.
   Your neck is carrying 40+ pounds of extra force right now.
   Roll shoulders back, chin level. Better? 🧘"

5. Low APM during session (< 30) → "APM at ${apm} — are you
   stuck on something? Sometimes stepping away for 2 minutes
   unlocks the solution your subconscious is processing."
```

### TASK A2.3: Improve `buildVisionSystemPrompt()` — Stricter Verification
**File:** `artifacts/api-server/src/routes/aura.ts` (lines 106-131)

**Add to each challenge context:**
```
hydration: Also mention: "Check if they seem hydrated —
  dry lips or tired eyes might mean they need more water,
  not just a sip."

posture: Also mention: "Compare their current posture to
  ideal: shoulders back, spine neutral, screen at eye level.
  Give specific feedback on what to adjust."

movement: Also mention: "If they're in a different location
  or standing, give them a quick 30-second stretch suggestion
  for their next movement break."
```

### Verification Checklist — Phase 2
- [ ] Chat returns personality-shifting responses based on biometric data
- [ ] Strict coach mode triggers when HRV < 50
- [ ] Data nerd mode triggers for moderate metrics
- [ ] Warm friend mode triggers for good metrics
- [ ] Responses reference specific numbers from bioContext
- [ ] Vision challenges give specific, personalized feedback
- [ ] Fallback responses are data-aware (not generic)

---

## PHASE 3: Dev A — Demo-Friendly Wellness Timers (2 hours)

### Status: [ ] Not Started

### LIMITATION: Current timers are way too long for demo
```
Current:
  hydration:    30 min  ← Can't wait 30 min in a 3-min video
  eye-break:    40 min
  typing-break: 60 min of high APM
  movement:     90 min
  posture:      3 min of bad posture
  breath:       10% HRV drop
```

### TASK A3.1: Add Demo Mode Timers
**File:** `artifacts/bio-ledger/src/hooks/use-wellness-coach.ts`

**Strategy:** Don't change production timers. Add a `demoMode` parameter that uses shorter timers.

**Add to hook input:**
```typescript
interface WellnessCoachInput {
  // ... existing fields
  demoMode?: boolean;  // When true, use demo-friendly timers
}
```

**Demo timers (for 3-5 min video):**
```
hydration:    45 seconds   (triggers ~45s into session)
posture:      15 seconds   (triggers after 15s bad posture)
eye-break:    90 seconds   (triggers ~90s into session)
typing-break: 30 seconds   (of high APM)
breath:       5% HRV drop  (easier to trigger)
movement:     120 seconds  (triggers ~2min into session)
```

**Demo cooldowns:**
```
All cooldowns: 30 seconds (allows multiple challenges in one demo)
```

### TASK A3.2: Wire Demo Mode from Dashboard
**File:** `artifacts/bio-ledger/src/pages/Dashboard.tsx`

- Pass `demoMode={isDemoMode}` to `useWellnessCoach()`
- The existing "DEMO MODE" button already sets `isDemoMode=true`
- Ensure that when demo starts, wellness timers use short intervals

### TASK A3.3: Ensure Nudges Appear Visually
**File:** `artifacts/bio-ledger/src/pages/Dashboard.tsx`

Verify these work in sequence during demo:
1. Start demo session → timer begins counting
2. ~15s: If posture is bad → posture nudge appears in chat
3. ~45s: Hydration challenge → nudge in chat with "Show AURA" button
4. User shows water bottle → Gemini verifies → "+30 XP" in chat
5. ~90s: Eye-break nudge → user looks away → behavioral auto-verify
6. Session ends → receipt generated → chain card appears

### TASK A3.4: Add Screen Time Counter to UI
**File:** `artifacts/bio-ledger/src/pages/Dashboard.tsx`

Add a visible "SCREEN TIME: XX:XX" counter near the timer so:
- AURA can reference it in nudges ("You've been staring for 2 minutes")
- The demo video shows continuous tracking
- It resets when user takes a break (face not detected)

### Verification Checklist — Phase 3
- [ ] Demo mode uses shortened timers (45s hydration, 15s posture, etc.)
- [ ] Hydration challenge triggers within 1 minute of demo start
- [ ] Posture challenge triggers within 20 seconds of bad posture
- [ ] Eye-break triggers at 90 seconds
- [ ] Challenges appear as chat messages in AuraChat
- [ ] Vision verification works (show water bottle → Gemini responds)
- [ ] Behavioral verification works (look away → auto-complete)
- [ ] Screen time counter visible in UI
- [ ] Multiple challenges can fire in a 3-minute demo

---

## PHASE 2B: Dev B — Storacha/Filecoin Integration (2 hours)

### Status: [ ] Not Started

### LIMITATION: Current State
- `routes/filecoin.ts` uses raw `fetch()` to `https://api.web3.storage/upload`
- No `@filoz/synapse-sdk` package imported (judges look for this)
- Without `SYNAPSE_API_KEY`, returns `{status: "pending"}` — data not lost but not stored
- CID status is never updated in database after upload

### TASK B2.1: Sign Up for Storacha (GitHub)
1. Go to https://storacha.network
2. Sign up with GitHub account (no credit card)
3. Create a "space" for bio-ledger
4. Get the API token/DID
5. Set `SYNAPSE_API_KEY` in environment

### TASK B2.2: Install `@filoz/synapse-sdk`
**File:** `artifacts/api-server/package.json`

```bash
cd artifacts/api-server
pnpm add @filoz/synapse-sdk
```

**CRITICAL:** Even if Storacha upload uses a different method, this import must exist in `filecoin.ts` for judges:
```typescript
import { /* something */ } from '@filoz/synapse-sdk';
```

### TASK B2.3: Update Filecoin Upload Route
**File:** `artifacts/api-server/src/routes/filecoin.ts`

**Strategy:**
1. Import `@filoz/synapse-sdk` at top (judges check imports)
2. Keep existing web3.storage upload as primary working method
3. Add Storacha upload as the preferred path when token is available
4. Add console.log for judges: `console.log("🔒 Committing Bio-Ledger to Filecoin via Synapse: CID", cid)`
5. Return real CID and gateway URL

**Code pattern:**
```typescript
import { /* client or types */ } from '@filoz/synapse-sdk';

// ... existing code ...

// Inside POST handler, after successful upload:
console.log(`🔒 Committing Bio-Ledger to Filecoin via Synapse: CID ${cid}`);
console.log(`📦 Receipt permanently stored: https://w3s.link/ipfs/${cid}`);
```

### TASK B2.4: Add `agent_signature` Field to Receipt
**File:** `artifacts/bio-ledger/src/lib/companion-agent.ts`

info.md says: *"Ensure your generated JSON receipt actually includes a field called `agent_signature`"*

Add `agent_signature` as an alias for `companionSignature` in the receipt payload:
```typescript
return {
  // ... existing fields
  companionSignature,
  agent_signature: companionSignature,  // ERC-8004 naming for judges
};
```

### Verification Checklist — Phase 2B
- [ ] `@filoz/synapse-sdk` appears in package.json dependencies
- [ ] `import` from `@filoz/synapse-sdk` exists in filecoin.ts
- [ ] Storacha token set in environment
- [ ] POST /api/filecoin/upload returns real CID (starts with `bafy...`)
- [ ] Console shows `🔒 Committing Bio-Ledger to Filecoin via Synapse: CID [bafy...]`
- [ ] Gateway URL is clickable and shows the receipt JSON
- [ ] `agent_signature` field exists in receipt payload

---

## PHASE 3B: Dev B — World ID Integration (1 hour)

### Status: [ ] Not Started

### LIMITATION: Current State
- `LockScreen.tsx` has simulated ZK animation (fake 5-step sequence)
- When `WORLD_ID_APP_ID` is not set, it runs simulation mode
- When set, it should open real IDKit popup
- `routes/world-id.ts` has real Worldcoin API verification code

### TASK B3.1: Sign Up for World ID Developer Portal
1. Go to https://developer.worldcoin.org
2. Create account
3. Create a new app → get `app_id` (format: `app_xxxxx`)
4. Set action to `bio-ledger-verify`
5. Set environment variable: `WORLD_ID_APP_ID=app_xxxxx`

### TASK B3.2: Verify IDKit Widget Opens
**File:** `artifacts/bio-ledger/src/pages/LockScreen.tsx`

- With `WORLD_ID_APP_ID` set, the IDKit widget should open on login
- Test: click "VERIFY IDENTITY" → World ID popup appears
- If popup doesn't appear, check the API call to `/api/world-id/config`
- Add console.log: `console.log("🌍 World ID ZK proof verified: nullifier", hash)`

### TASK B3.3: Test Full Login Flow
1. Open app → LockScreen appears
2. Click login → World ID IDKit opens
3. Verify (or use simulator if no Orb) → nullifier returned
4. Redirect to Dashboard with verified identity
5. Nullifier appears in vault badge on Dashboard

**Note:** World ID "device" verification works without an Orb (phone-based). Judges may not have an Orb, so device-level is fine.

### Verification Checklist — Phase 3B
- [ ] `WORLD_ID_APP_ID` set in environment
- [ ] Login click opens real IDKit popup (not simulation)
- [ ] Verification succeeds (device level)
- [ ] Nullifier hash displayed in Dashboard vault badge
- [ ] Console shows `🌍 World ID ZK proof verified`
- [ ] `/api/world-id/config` returns `{configured: true}`

---

## PHASE 4B: Dev B — README & Judge-Facing Docs (1 hour)

### Status: [ ] Not Started

### TASK B4.1: Create README.md
**File:** `README.md` (new file at project root)

**Structure (from info.md):**

```markdown
# AURA — Sovereign Wellness & Productivity Companion

> Verifiable Proofs of Wellness. Powered by AI. Stored on Filecoin. Gated by World ID.

## Bounty Architecture Matrix

| Bounty / Track | How AURA Uses It | File Reference |
|---|---|---|
| Protocol Labs: Secure Systems | Synapse SDK pins HRV, APM, session data to Filecoin Onchain Cloud | `artifacts/api-server/src/routes/filecoin.ts` |
| Agents with Receipts (ERC-8004) | AURA Agent validates physical wellness actions and signs ERC-8004 receipts | `artifacts/bio-ledger/src/lib/companion-agent.ts` |
| World ID (Digital Human Rights) | IDKit gates the Sovereign Vault — only verified humans generate bio-ledgers | `artifacts/bio-ledger/src/pages/LockScreen.tsx` |
| AI & Autonomous Infra | Local MediaPipe + Gemini Vision: edge-compute privacy + cloud verification | `artifacts/api-server/src/routes/aura.ts` |

## How It Works

1. **Sovereign Login** — World ID ZK proof (anti-sybil)
2. **Engage Flow** — 25-min Pomodoro with APM + face tracking
3. **Proactive Coaching** — AURA monitors biometrics, nudges breaks
4. **Opt-In Oracle** — Show water bottle → Gemini Vision verifies → XP
5. **Agentic Receipt** — AI signs session data → stored on Filecoin

## Tech Stack

- React 19 + Vite 7 + TypeScript 5.9
- Express 5 + PostgreSQL + Drizzle ORM
- Google Gemini 2.0 Flash (chat + vision)
- MediaPipe Face Landmarker (on-device)
- World ID (@worldcoin/idkit)
- Filecoin via Synapse SDK (@filoz/synapse-sdk)
- ERC-8004 Agentic Receipts

## Run Locally

\`\`\`bash
pnpm install
# Set env vars: DATABASE_URL, PORT, GEMINI_API_KEY, WORLD_ID_APP_ID, SYNAPSE_API_KEY
pnpm run build
pnpm run dev
\`\`\`

## Demo Video

[Link to demo video]

## Team

- [Your names]
```

### TASK B4.2: Add Console Logs Throughout
**Files:** Multiple (Dev B's owned files only)

Add to `routes/filecoin.ts`:
```typescript
console.log("🔒 Committing Bio-Ledger to Filecoin via Synapse: CID", cid);
```

Add to `routes/world-id.ts`:
```typescript
console.log("🌍 World ID ZK proof verified — nullifier:", nullifier_hash);
```

Add to `routes/receipts.ts`:
```typescript
console.log("📝 ERC-8004 Receipt created — ID:", inserted.id, "Type:", receiptType);
```

### Verification Checklist — Phase 4B
- [ ] README.md exists at project root
- [ ] Bounty Architecture Matrix is the first visible section
- [ ] File references point to actual files
- [ ] Console logs appear during demo flow
- [ ] README mentions all 4 bounty tracks

---

## PHASE 4A: Dev A — Console Logs & Chat Polish (1 hour)

### Status: [ ] Not Started

### TASK A4.1: Add Console Logs (Dev A's files)
**File:** `artifacts/api-server/src/routes/aura.ts`

```typescript
// In POST /aura/chat handler, before Gemini call:
console.log(`🧠 AURA analyzing biometrics: HRV ${bio.hrv}ms, Strain ${bio.strain}/21, Focus ${bio.focusScore}/100`);

// After Gemini response:
console.log(`💬 AURA response generated (fallback: ${isFallback})`);

// In POST /aura/vision handler:
console.log(`👁️ AURA Vision: Verifying "${challengeType}" challenge via Gemini 2.0 Flash`);
console.log(`✅ Challenge verified — ${xpAwarded} XP awarded`);
```

**File:** `artifacts/bio-ledger/src/lib/companion-agent.ts`
```typescript
console.log(`🤖 AURA Agent signing ERC-8004 receipt: type=${receiptType}`);
console.log(`📊 Focus Fidelity Score: ${focusFidelity}/100`);
```

### TASK A4.2: Verify Chat → Nudge → Vision Flow
1. Start session → type for 45s (triggers hydration in demo mode)
2. Nudge appears in AuraChat: "💧 Show me your water bottle..."
3. Click camera button in chat → frame captured
4. Gemini Vision analyzes → "+30 XP" response appears
5. Challenge marked complete, XP counter updates

### TASK A4.3: Test Voice Input/Output
- Click mic button → speak → transcript sent to AURA
- AURA response read aloud via TTS
- This is impressive for demo video if it works

### Verification Checklist — Phase 4A
- [ ] Console logs appear for biometric analysis
- [ ] Console logs appear for vision verification
- [ ] Console logs appear for receipt signing
- [ ] Chat → nudge → vision flow works end-to-end
- [ ] Voice input works (or gracefully hidden if not)

---

## PHASE 5: Joint Integration & Full Test (2 hours)

### Status: [ ] Not Started

### TASK J5.1: Merge Branches
```bash
# Dev B merges first (fewer conflicts):
git checkout main
git merge dev-b/blockchain-id

# Dev A merges second:
git merge dev-a/ai-wellness

# If conflicts in Dashboard.tsx — resolve by keeping both changes
# Dev A's changes are in left pane (lines 1-250)
# Dev B's changes are in right pane (lines 250+)
```

### TASK J5.2: Full End-to-End Test
Run through the complete demo flow:

```
Step 1: Open app → LockScreen
  Expected: World ID IDKit popup opens (or simulation if no app_id)

Step 2: Verify → Dashboard loads
  Expected: Nullifier in vault badge, camera activates

Step 3: Click "DEMO MODE" (60s session)
  Expected: Timer starts, APM tracking begins, face detection active

Step 4: Wait 15s with bad posture
  Expected: Posture nudge appears in AuraChat

Step 5: Wait 45s total
  Expected: Hydration challenge nudge in chat

Step 6: Click camera button → show water bottle
  Expected: Gemini Vision verifies, "+30 XP" in chat

Step 7: Continue to 60s → session ends
  Expected:
    - "SAVING TO FILECOIN..." overlay
    - Receipt signed (console: 🤖 AURA Agent signing...)
    - Filecoin upload (console: 🔒 Committing Bio-Ledger...)
    - Receipt chain card appears with 4 green checkmarks

Step 8: Click receipt → see details
  Expected: CID link, signature, biometric snapshot

Step 9: Open Sovereign Export panel
  Expected: Download agent.json, agent_log.json, receipts.json

Step 10: Chat with AURA about the session
  Expected: Data-backed response referencing your HRV, strain, session
```

### TASK J5.3: Fix Any Issues Found
- Prioritize: anything visible in the demo video
- Skip: anything not visible (backend-only issues)

### Verification Checklist — Phase 5
- [ ] Branches merged without breaking changes
- [ ] Full demo flow works: Login → Session → Nudge → Challenge → Receipt → Filecoin
- [ ] Console logs appear in correct order
- [ ] Receipt chain card shows all 4 steps
- [ ] AURA chat gives personalized, data-backed responses
- [ ] At least one vision challenge verified successfully

---

## PHASE 6: Record Demo Video (2 hours)

### Status: [ ] Not Started

### Script (from info.md)

**0:00 - 0:30 — The Hook + World ID**
- "Meet AURA — a Sovereign Wellness & Productivity Companion"
- Show World ID login flow
- "We use World ID to ensure only verified humans create wellness receipts"
- Show nullifier appearing in vault badge

**0:30 - 1:30 — Local AI Monitoring**
- Show Dashboard with camera feed active
- Point out: blink counter, head stability, APM tracking
- "All camera processing happens locally via MediaPipe — zero frames leave your device"
- Show posture warning trigger
- "AURA monitors your biometrics in real-time and shifts between coach, friend, and data analyst"

**1:30 - 2:15 — The Opt-In Oracle**
- Show hydration nudge in chat
- Click camera → show water bottle
- "AURA's Gemini Vision verifies real-world wellness actions"
- Show XP awarded, challenge complete
- Chat with AURA: ask "How am I doing?" → show data-backed response

**2:15 - 3:00 — The Killshot: Synapse + ERC-8004**
- End session → show receipt signing animation
- "AURA bundles your biometrics, signs an ERC-8004 receipt..."
- Show Filecoin upload with real CID
- "...and permanently secures it on Filecoin via Synapse SDK"
- Show receipt chain card with all green checkmarks
- Show Sovereign Export panel
- **Mic drop:** "Your health data is now a sovereign, verifiable asset"

### Recording Tips
- Use OBS or screen recorder with webcam overlay
- Keep browser DevTools console visible (shows the console.logs)
- Practice the flow 2-3 times before recording
- If something fails, show the code instead — "Even if testnet hiccups, the real integration is here"

---

## PHASE 7: Devpost Submission (1 hour)

### Status: [ ] Not Started

### Submission Checklist
- [ ] GitHub repo is public
- [ ] README.md has Bounty Architecture Matrix
- [ ] Demo video uploaded (YouTube/Loom)
- [ ] Devpost fields filled:
  - Title: "AURA — Sovereign Wellness & Productivity Companion"
  - Tagline: "Verifiable Proofs of Wellness on Filecoin, gated by World ID"
  - Description: Use the Flow-to-Bounty Pipeline from info.md
  - Tech stack listed
  - Bounty tracks selected
  - Team members added
  - GitHub link
  - Demo video link
  - Live demo link (Replit URL)

---

## FINAL MERGE CHECKLIST

### Before Merging to Main — Dev A Must Have:
- [ ] `buildSystemPrompt()` rewritten with mixed personality
- [ ] `ruleFallback()` updated with data-backed responses
- [ ] `buildVisionSystemPrompt()` improved for each challenge type
- [ ] Demo mode timers added to `use-wellness-coach.ts`
- [ ] Console.logs in aura.ts and companion-agent.ts
- [ ] Chat → Nudge → Vision flow tested end-to-end
- [ ] At least 3 different challenge types trigger in demo mode

### Before Merging to Main — Dev B Must Have:
- [ ] `@filoz/synapse-sdk` in package.json + imported in filecoin.ts
- [ ] Storacha upload working OR graceful pending fallback
- [ ] World ID app_id set + IDKit popup working OR simulation fallback
- [ ] `agent_signature` field in receipt payload
- [ ] README.md with Bounty Architecture Matrix
- [ ] Console.logs in filecoin.ts, world-id.ts, receipts.ts
- [ ] Receipt chain card shows all 4 steps

### After Merge — Joint Verification:
- [ ] `pnpm install` succeeds
- [ ] `pnpm run build` succeeds with no TypeScript errors
- [ ] Full demo flow runs without errors
- [ ] Console shows all expected logs in order
- [ ] Demo video recorded and uploaded
- [ ] Devpost submitted before March 31 deadline

---

## TIMELINE (24 Hours)

```
Hour 0-1:    Phase 1 — Both: Environment setup, branch creation
Hour 1-3:    Phase 2 — Dev A: AI prompts | Phase 2B — Dev B: Storacha
Hour 3-5:    Phase 3 — Dev A: Demo timers | Phase 3B — Dev B: World ID
Hour 5-6:    Phase 4A — Dev A: Polish | Phase 4B — Dev B: README
Hour 6-8:    Phase 5 — Both: Merge + full integration test
Hour 8-10:   Phase 6 — Both: Record demo video (practice + final take)
Hour 10-11:  Phase 7 — Both: Devpost submission
Hour 11-12:  Buffer for unexpected issues
```

---

*Last updated: March 30, 2026*
*Status: Plan created, not yet started*
