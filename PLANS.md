# Implementation Plans — Final Sprint

> Three parallel tracks. Zero file conflicts between them. Can run in separate terminals.

---

## Plan 1: Storacha Real Upload

**Goal:** Replace demo CID with real Filecoin upload when credentials are provided
**File:** `artifacts/api-server/src/routes/filecoin.ts`
**Dependency:** Waiting on Miro's 3 env vars (KEY, PROOF, SPACE_DID)
**Time:** 20 min

### Deliverables
- [ ] New upload path using `@storacha/client` SDK properly (create client → add space → upload)
- [ ] Env vars: `STORACHA_KEY`, `STORACHA_PROOF`, `STORACHA_SPACE_DID`
- [ ] Keep existing demo fallback when env vars missing
- [ ] Keep existing `web3.storage` HTTP fallback as secondary path
- [ ] Console log: real CID + gateway URL on success
- [ ] Rebuild API server + test with curl

### What Changes
```
filecoin.ts:
  - Add Storacha SDK client initialization (Signer + StoreMemory + Proof)
  - New upload function using client.uploadDirectory()
  - Priority: SDK upload → HTTP upload → demo fallback

.env:
  - Add STORACHA_KEY, STORACHA_PROOF, STORACHA_SPACE_DID
```

### What Does NOT Change
- No frontend changes
- No Dashboard changes
- No other backend files

---

## Plan 2: Neurotech — Guided Breathing with Neural Feedback

**Goal:** Add a "Mindful Breathing" mode that uses camera biometrics as a non-invasive neural feedback loop — directly targeting the Neurotech bounty
**Files:** New `BreathingExercise.tsx` component + wire into Dashboard
**Dependency:** None — uses existing hooks
**Time:** 30 min

### The Neurotech Angle
Camera + biometrics = non-invasive BCI proxy. During guided breathing:
- **HRV change** = autonomic nervous system response (parasympathetic activation)
- **Blink rate drop** = increased calm/focus state
- **Head stability increase** = physical stillness = meditative state
- **Face presence** = sustained attention

AURA measures these BEFORE and AFTER the exercise and shows the user their "neural response" — making the biometric feedback loop visible.

### Deliverables
- [ ] `BreathingExercise.tsx` — Full-screen guided breathing overlay
  - 4-4-4-4 box breathing animation (inhale → hold → exhale → hold)
  - 4 cycles = ~64 seconds total
  - Shows live HRV, blink rate, head stability during exercise
  - Before/after comparison at end ("HRV improved 8%, blink rate dropped 20%")
- [ ] Wire as a new challenge type response — when AURA says "breathe", user can open this
- [ ] Add "Start Breathing Exercise" button in chat when breath challenge is active
- [ ] On completion: award XP + show neural feedback summary
- [ ] Console log: `🧠 Neurotech: Breathing exercise — HRV delta +X%, blink rate delta -Y%`

### What Changes
```
New file: artifacts/bio-ledger/src/components/BreathingExercise.tsx
  - Animated circle (grows on inhale, shrinks on exhale)
  - Timer for each phase (4s each)
  - Live biometric readout from existing hooks
  - Before/after comparison panel

Dashboard.tsx:
  - Add state: breathingExerciseOpen
  - Add <BreathingExercise> overlay (similar to session grade overlay)
  - Wire to breath challenge completion

AuraChat.tsx (optional):
  - When breath challenge active, show "Start Breathing Exercise" button
```

### What Does NOT Change
- No backend changes
- No new API endpoints
- No new dependencies

---

## Plan 3: Gesture Detection — Arms Raised Stretch

**Goal:** Detect when user raises arms above head using existing Face Landmarker — verify stretch challenge physically
**Files:** New `use-stretch-detection.ts` hook + wire into Dashboard
**Dependency:** None — uses existing `camera.faceDetected` + face landmark positions
**Time:** 25 min

### How Detection Works
When you raise arms above your head:
1. Your face **drops lower** in the camera frame (Y position increases)
2. Your face **gets smaller** (you lean back slightly)
3. This is held for **5 seconds**
4. Then face returns to normal position = stretch complete

We detect this using the existing Face Landmarker's nose tip Y-coordinate — no new ML model needed.

### Deliverables
- [ ] `use-stretch-detection.ts` hook
  - Tracks baseline face Y-position during normal sitting
  - Detects significant Y-drop (face moves down >15% of frame height)
  - Requires hold for 5 seconds
  - Returns: `{ stretchDetected: boolean, holdProgress: number (0-100), isHolding: boolean }`
- [ ] Wire into posture/movement challenge verification
  - When stretch challenge active + stretch detected for 5s → auto-complete
  - This replaces "show me on camera" with actual physical detection
- [ ] Stretch progress indicator in UI
  - Small ring/bar showing "hold for 5s" progress
  - Appears when stretch is detected, fills up as user holds
- [ ] On completion: "+40 XP — Stretch verified by AURA!" toast
- [ ] Console log: `💪 Stretch detected: face Y-delta ${delta}%, held ${seconds}s`

### What Changes
```
New file: artifacts/bio-ledger/src/hooks/use-stretch-detection.ts
  - useStretchDetection(faceY: number | null, isActive: boolean)
  - Returns stretchDetected, holdProgress, isHolding

use-camera.ts:
  - Export faceY (nose tip Y coordinate) — check if already exposed

Dashboard.tsx:
  - Wire useStretchDetection to camera face data
  - Auto-complete stretch challenges when detected
  - Show hold progress indicator during active stretch challenge
```

### What Does NOT Change
- No backend changes
- No new ML models
- No new dependencies

---

## File Conflict Matrix

| File | Plan 1 | Plan 2 | Plan 3 |
|------|--------|--------|--------|
| `filecoin.ts` | ✏️ | — | — |
| `.env` | ✏️ | — | — |
| `BreathingExercise.tsx` | — | ✏️ NEW | — |
| `use-stretch-detection.ts` | — | — | ✏️ NEW |
| `use-camera.ts` | — | — | ✏️ (export faceY) |
| `Dashboard.tsx` | — | ✏️ (breathing state + overlay) | ✏️ (stretch state + progress) |
| `AuraChat.tsx` | — | ✏️ (breathing button) | — |

> **Note:** Plans 2 and 3 both touch Dashboard.tsx but in different sections (breathing overlay vs stretch progress). Merge carefully if running in parallel.

---

*Created: April 1, 2026*
