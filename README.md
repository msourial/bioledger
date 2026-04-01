# AURA Bio-Ledger

### Be Productive. Stay Healthy. Prove It.

> Your AI coach and shadow for sustainable work — monitoring, coaching, and rewarding you for working smarter and healthier. Every healthy action is verified by camera, signed on-chain, and stored on Filecoin.

You can be productive AND healthy — they fuel each other. AURA Bio-Ledger is the coach that proves it. It monitors your biometrics, typing patterns, and posture in real time, coaches you through healthy work habits, verifies your movements through AI-powered camera analysis, and generates cryptographically signed blockchain receipts proving you work sustainably.

**The core belief:** Taking care of your body IS the most productive thing you can do. A hydrated, rested, stretched worker produces 10x better work than a burnt-out one grinding through pain.

---

## Bounty Architecture Matrix

| Bounty / Track | Integration | Key File |
|---|---|---|
| **ERC-8004: Agents with Receipts** | AURA agent signs ERC-8004 receipts (HMAC-SHA256 + `agent_signature`), manifest at `/api/aura/manifest`, execution logs at `/api/aura/logs` | `companion-agent.ts` |
| **ERC-8004: Let the Agent Cook** | Autonomous wellness coaching with Gemini 2.5 Flash, vision-verified movement challenges, 3 personality modes, proactive RSI nudges | `aura.ts` |
| **AI & Robotics Track** | Real-time MediaPipe Face + Pose Landmarker (on-device), Gemini chat + vision, RSIGuard risk engine, 10 wellness challenge types | `use-camera.ts` |
| **Infrastructure & Digital Rights** | World ID ZK proofs (anti-sybil), Privy embedded wallet (Flow EVM), data sovereignty, nullifier-based identity | `LockScreen.tsx` |
| **Neurotech Track** | RSIGuard neuromuscular strain prevention, keystroke/mouse/posture monitoring, repetitive strain injury detection, forced wellness breaks | `use-rsi-risk.ts` |
| **Filecoin: Autonomous Agent Infra** | Storacha SDK uploads signed receipts to Filecoin warm storage, real CIDs, IPFS gateway URLs | `filecoin.ts` |
| **Storacha: Decentralized Storage** | `@storacha/client` SDK integration, receipt JSON permanently stored | `filecoin.ts` |

---

## How It Works

### 3-Step Secure Login

```
Step 1: WORLD ID          Step 2: PRIVY WALLET        Step 3: WEARABLE
ZK proof of humanity  -->  Embedded wallet on     -->  Fitbit or WHOOP
No PII shared              Flow EVM Testnet            health data sync
Nullifier hash bound       Chain 545                   OAuth 2.0 login
```

### Dashboard: Real-Time Monitoring

Once logged in, the Sovereign Vault dashboard runs continuously:

- **Sovereign Lens** -- MediaPipe Face Landmarker + Pose Landmarker detect blink rate, head stability, posture, wrist position, and certified human presence. Zero frames leave your device.
- **Biometrics** -- HRV (heart rate variability) and Strain tracking from connected wearable (or simulated data in demo mode).
- **RSIGuard** -- Real-time Repetitive Strain Injury prevention engine tracking keystrokes, mouse clicks, mouse distance (in meters), time since break, compliance rate, and break streak. Risk score 0-100 with color-coded levels (low/moderate/high/critical).
- **APM Tracking** -- Actions per minute from keyboard and mouse activity, rolling 60-second window.
- **Focus Timer** -- 25-minute Pomodoro sessions with 60-second demo mode for quick demonstrations.

### AI Health Coaching (AURA)

AURA is a certified health & productivity coach powered by Gemini 2.5 Flash with three dynamic personality modes:

| Mode | Triggers When | Style |
|---|---|---|
| **Strict Coach** | HRV <50, Strain >16, late-night + high strain | Direct, urgent, imperative |
| **Data Nerd** | Moderate metrics (HRV 50-70, Strain 8-15) | Numbers, trends, comparisons |
| **Warm Friend** | Good metrics (HRV >70, low strain) | Encouraging, celebratory |

AURA responds to what you actually say. Tell it "I've been working all night and drank some coke" and it will tell you to hydrate with water, not recite your HRV number.

### Movement Challenges (Camera-Verified)

When RSIGuard detects elevated risk, a movement challenge popup appears with an **animated SVG exercise diagram**:

| Movement | Animation | XP | Camera Verification |
|---|---|---|---|
| Thumbs Up | Bouncing thumb | 30 | Gemini Vision detects gesture |
| Wave Hello | Rotating hand | 30 | Gemini Vision detects wave |
| Stretch Arms Up | Stick figure arms rising | 40 | Gemini Vision detects raised arms |
| Shoulder Roll | Rotation arrows on shoulders | 40 | Gemini Vision detects posture |
| Stand Up & Stretch | Figure rising from chair | 50 | Gemini Vision detects standing |

Flow: RSIGuard triggers popup --> user does movement --> clicks "Verify" --> camera captures frame --> Gemini Vision analyzes --> XP awarded --> signed wellness receipt stored on Filecoin.

### 10 Wellness Challenge Types

| Challenge | Trigger | XP | Verification |
|---|---|---|---|
| Hydration | 30 min session (45s demo) | 30 | Vision: show water bottle |
| Posture Reset | 3 min bad posture (15s demo) | 30 | Behavioral: sit up straight |
| Eye Break (20-20-20) | 40 min session (90s demo) | 35 | Behavioral: look away 20s |
| Typing Break | 60 min high APM (30s demo) | 25 | Behavioral: APM drops |
| Mindful Breathing | HRV drops 10% (5% demo) | 40 | Manual confirmation |
| Movement Break | 90 min session (120s demo) | 50 | Behavioral: stand up |
| Wrist Stretch | 15 min typing (45s demo) | 40 | Vision: show stretch |
| Neck Roll | 20 min no break (60s demo) | 35 | Vision: show neck movement |
| Eye Relief | 25 min screen time (90s demo) | 30 | Vision: look away |
| Standing Break | RSI risk >60 (2 min demo) | 50 | Behavioral: stand up |

### Triple-Signed ERC-8004 Receipts

Every completed session, exercise, or wellness challenge produces a receipt with 3 layers of verifiability:

```
Layer 1: WORLD ID NULLIFIER    -- Proves a unique human completed this
Layer 2: HMAC-SHA256 SIGNATURE  -- AURA agent attests biometric integrity
Layer 3: FLOW EVM WALLET        -- Cryptographic on-chain signature (Privy)
```

Receipt payload (ERC-8004 compliant):
```json
{
  "agent_id": "AURA-AGENT-V1",
  "duration": 1500,
  "hrv_avg": 72,
  "strain_delta": 2.1,
  "apm_score": 65,
  "certified_human_presence": true,
  "focus_fidelity_score": 84,
  "avg_blink_rate": 17.2,
  "head_stability": 91,
  "agent_signature": "a3f2c1..."
}
```

Receipts are permanently stored on Filecoin via Storacha SDK with IPFS gateway URLs.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 19, Vite 7, TypeScript 5.9, Tailwind CSS 4 | PWA with aurora-themed UI |
| **Backend** | Express 5, Drizzle ORM, Pino logging | API server with in-memory DB fallback |
| **AI Chat** | Google Gemini 2.5 Flash | Health coaching with 3 personality modes |
| **AI Vision** | Google Gemini 2.5 Flash (multimodal) | Camera-based exercise verification |
| **Face Detection** | MediaPipe Face Landmarker | Blink rate, head stability, presence |
| **Pose Detection** | MediaPipe Pose Landmarker | Wrist/shoulder tracking, stretch detection |
| **Identity** | World ID (IDKit v4) | ZK proof of humanity, anti-sybil |
| **Wallet** | Privy (@privy-io/react-auth) | Embedded wallet on Flow EVM Testnet (chain 545) |
| **Storage** | Storacha / web3.storage | Filecoin warm storage for signed receipts |
| **Receipts** | ERC-8004 draft | HMAC-SHA256 signed agentic work receipts |
| **PWA** | vite-plugin-pwa | Installable, offline-capable |
| **Animation** | Framer Motion | Smooth UI transitions and exercise diagrams |
| **Charts** | Recharts | Biometric data visualization |

---

## Architecture

```
                    +------------------+
                    |    World ID      |
                    |  ZK Proof Gate   |
                    +--------+---------+
                             |
                    +--------v---------+
                    |   Privy Wallet   |
                    | Flow EVM Testnet |
                    +--------+---------+
                             |
              +--------------v--------------+
              |     Wearable Login          |
              |  Fitbit (OAuth) | WHOOP     |
              +--------------+--------------+
                             |
        +--------------------v--------------------+
        |           SOVEREIGN VAULT               |
        |                                         |
        |  +------------+  +------------------+   |
        |  | MediaPipe   |  | RSIGuard Engine  |   |
        |  | Face + Pose |  | Keys/Mouse/Risk  |   |
        |  +------+------+  +--------+---------+   |
        |         |                  |              |
        |  +------v------------------v---------+   |
        |  |        AURA AI Companion          |   |
        |  |  Gemini 2.5 Flash (Chat+Vision)   |   |
        |  |  3 Personality Modes              |   |
        |  |  10 Wellness Challenges           |   |
        |  |  5 Movement Challenges (Camera)   |   |
        |  +------+---------------------------+   |
        |         |                               |
        |  +------v---------+                     |
        |  | ERC-8004 Receipt|                    |
        |  | HMAC + Wallet   |                    |
        |  | + Nullifier     |                    |
        |  +------+----------+                    |
        |         |                               |
        +---------v-------------------------------+
                  |
         +--------v---------+
         |    Filecoin       |
         |  Storacha SDK     |
         |  IPFS Gateway     |
         +-------------------+
```

---

## Run Locally

```bash
# Clone and install
git clone <repo-url>
cd Bio-Ledger
pnpm install

# Configure environment (artifacts/api-server/.env)
PORT=3000
WORLD_ID_APP_ID=app_xxxx              # from developer.worldcoin.org
WORLD_ID_ACTION=bio-ledger-verify
WORLD_ID_SIGNING_KEY=0x...            # generated during World ID setup
GEMINI_API_KEY=AIza...                # from ai.google.dev
SYNAPSE_API_KEY=did:key:z4MX...       # from storacha.network

# Configure frontend (artifacts/bio-ledger/.env)
VITE_PRIVY_APP_ID=cm...               # from privy.io

# Start backend
cd artifacts/api-server && pnpm run dev

# Start frontend (new terminal)
cd artifacts/bio-ledger && pnpm run dev
```

Open `http://localhost:5173` in a browser with camera access.

### Demo Flow (for video recording)

1. **Login** (30s): World ID verification --> Privy wallet creation --> Fitbit sign-in
2. **Dashboard** (10s): Camera activates, biometrics stream, RSIGuard starts tracking
3. **Start Demo Session** (60s timer): Click demo mode, watch RSIGuard climb
4. **Movement Challenge** (~8s in): Popup appears with animated exercise diagram --> do the movement --> click Verify --> camera captures --> AI verifies --> +XP
5. **Chat with AURA**: "I've been working all night and drank some coke" --> health coaching response
6. **Session Complete**: Receipt signed (HMAC + wallet), stored on Filecoin, chain card appears in ledger
7. **Sovereign Export**: Download agent.json, agent_log.json, receipts.json

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/healthz` | Server health check |
| GET | `/api/world-id/config` | World ID configuration status |
| GET | `/api/world-id/rp-context` | Signed RP context for IDKit widget |
| POST | `/api/verify-world-id` | Verify ZK proof against Worldcoin API |
| GET | `/api/receipts?nullifier=...` | List work receipts for user |
| POST | `/api/receipts` | Store signed work receipt |
| POST | `/api/filecoin/upload` | Upload receipt to Filecoin via Storacha |
| POST | `/api/aura/chat` | Chat with AURA companion (Gemini 2.5 Flash) |
| POST | `/api/aura/vision` | Vision challenge verification (Gemini multimodal) |
| GET | `/api/aura/manifest` | ERC-8004 agent capability manifest |
| GET | `/api/aura/logs?nullifier=...` | Agent execution logs |
| GET | `/api/auth/fitbit` | Fitbit OAuth 2.0 connection |
| GET | `/api/auth/whoop` | WHOOP API v2 connection |

---

## ERC-8004 Agent Manifest

Available at `GET /api/aura/manifest`:

```json
{
  "agent_id": "AURA-AGENT-V1",
  "spec_version": "erc-8004-draft",
  "supported_tools": [
    "filecoin-upload",
    "world-id-verify",
    "hmac-sign",
    "gemini-chat",
    "gemini-vision",
    "mediapipe-vision"
  ],
  "task_categories": [
    "biometric-analysis",
    "work-receipt",
    "health-coaching",
    "sovereign-data"
  ],
  "capabilities": [
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
    "focus-tracking"
  ]
}
```

---

## Privacy Model

- **Zero-knowledge identity**: World ID nullifier hash -- no name, email, or photo stored
- **On-device vision**: MediaPipe Face + Pose Landmarker run entirely in-browser. No video frames are sent to any server.
- **Camera frames for challenges only**: When the user explicitly clicks "Verify Movement", a single JPEG frame is sent to Gemini Vision. This is opt-in per challenge.
- **Nullifier-scoped data**: All receipts and chat logs are keyed to the World ID nullifier, not to any personal identifier.
- **Session-based auth**: Closing the browser clears the session. Nullifier persists in localStorage for re-verification convenience only.

---

## Project Structure

```
Bio-Ledger/
  artifacts/
    api-server/           Express 5 API
      src/routes/
        aura.ts           AURA AI chat + vision + manifest
        auth.ts           Fitbit/WHOOP OAuth endpoints
        filecoin.ts       Storacha/Filecoin upload
        receipts.ts       ERC-8004 receipt CRUD
        world-id.ts       World ID ZK verification
    bio-ledger/           React PWA frontend
      src/
        pages/
          LockScreen.tsx  3-step login (World ID + Privy + Wearable)
          Dashboard.tsx   Sovereign Vault dashboard
        components/
          AuraChat.tsx    AI wellness companion chat
          CameraLens.tsx  MediaPipe camera HUD
          MovementChallenge.tsx  Camera-verified exercise popup
          ReceiptChainCard.tsx   Receipt chain visualization
          PixelUI.tsx     Design system components
        hooks/
          use-camera.ts   MediaPipe Face + Pose detection
          use-rsi-risk.ts RSIGuard risk scoring engine
          use-wellness-coach.ts  10 wellness challenge types
          use-apm.ts      Actions per minute tracking
          use-motion-lock.ts  Accelerometer interruption
        lib/
          companion-agent.ts  ERC-8004 receipt signing
          chains.ts       Flow EVM Testnet chain definition
        providers/
          PrivyProviderWrapper.tsx  Privy wallet context
  lib/
    api-spec/             OpenAPI 3.1 specification
    api-client-react/     Generated React Query hooks
    api-zod/              Generated Zod validation schemas
    db/                   Drizzle ORM schema + connection
```

---

## Hackathon

**PL Genesis: Frontiers of Collaboration** -- March 2026

- **Track**: Fresh Code
- **Frontiers**: Web3 & Digital Human Rights, AI/AGI, Neurotech
- **Team**: Hackers
