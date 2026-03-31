# AURA Bio-Ledger — Sovereign Wellness & Productivity Companion

> Verifiable Proofs of Sustainable Work. AI-Attested. Stored on Filecoin. Gated by World ID. Signed on Flow EVM.

## Bounty Architecture Matrix

| Bounty / Track | How AURA Bio-Ledger Uses It | File Reference |
|---|---|---|
| Protocol Labs: Secure Systems | Synapse SDK pins HRV, APM, session data to Filecoin warm storage | `artifacts/api-server/src/routes/filecoin.ts` |
| Agents with Receipts (ERC-8004) | AURA Companion Agent validates wellness actions and signs ERC-8004 receipts with HMAC-SHA256 | `artifacts/bio-ledger/src/lib/companion-agent.ts` |
| World ID (Digital Human Rights) | IDKit v4 gates the Sovereign Vault — only verified humans generate bio-ledgers via ZK proofs | `artifacts/bio-ledger/src/pages/LockScreen.tsx` |
| AI & Autonomous Infra | Local MediaPipe Face Landmarker + Gemini Vision: edge-compute privacy + cloud verification | `artifacts/api-server/src/routes/aura.ts` |

## How It Works

1. **Sovereign Login** — World ID ZK proof verifies humanity (anti-sybil), Privy creates embedded wallet on Flow EVM Testnet
2. **Connect Wearable** — Apple Watch or WHOOP for certified biometric data (HRV, strain, activity)
3. **Engage Flow** — 25-min Pomodoro with real-time APM tracking + MediaPipe face detection (blink rate, head stability, posture)
4. **Proactive Coaching** — AURA AI monitors biometrics, shifts personality (strict coach / data nerd / warm friend), nudges breaks
5. **Opt-In Oracle** — Show water bottle to camera → Gemini Vision verifies → XP awarded
6. **Triple-Signed Receipt** — AURA signs ERC-8004 receipt (HMAC) + wallet signature (Flow EVM) + World ID nullifier → stored on Filecoin

## Triple-Signed Receipt Stack

Every work session produces a receipt with 3 layers of verifiability:

| Layer | Provider | Purpose |
|---|---|---|
| Identity | World ID (ZK proof) | Proves a unique human completed the session |
| Agent Attestation | AURA Companion (HMAC-SHA256) | AI agent certifies biometric data integrity |
| Wallet Signature | Privy (Flow EVM Testnet) | Cryptographic on-chain signature |

## Tech Stack

- **Frontend**: React 19 + Vite 7 + TypeScript 5.9 + Tailwind CSS 4
- **Backend**: Express 5 + PostgreSQL + Drizzle ORM
- **AI**: Google Gemini 2.0 Flash (chat + vision) + rule-based fallback
- **Vision**: MediaPipe Face Landmarker (on-device, zero frames leave your device)
- **Identity**: World ID (@worldcoin/idkit v4) — ZK proof of humanity
- **Wallet**: Privy (@privy-io/react-auth) — embedded wallet on Flow EVM Testnet (chain 545)
- **Storage**: Filecoin via Storacha/Synapse SDK — decentralized warm storage
- **Receipts**: ERC-8004 Agentic Receipts — HMAC-SHA256 signed
- **PWA**: vite-plugin-pwa — installable, offline-capable

## Run Locally

```bash
pnpm install

# Set environment variables
VITE_PRIVY_APP_ID=<from privy.io>
WORLD_ID_APP_ID=<from developer.worldcoin.org>
GEMINI_API_KEY=<from ai.google.dev>
SYNAPSE_API_KEY=<from storacha.network>
DATABASE_URL=<postgres connection string>
PORT=3000

# Start
cd artifacts/api-server && pnpm run dev   # Backend
cd artifacts/bio-ledger && pnpm run dev   # Frontend
```

## Architecture

```
User → World ID (ZK Proof) → Privy (Flow EVM Wallet) → Wearable (Health Data)
  ↓
Dashboard: MediaPipe Vision + APM + HRV/Strain + Pomodoro Timer
  ↓
AURA AI Companion: Gemini Chat + Vision Challenges + Wellness Coaching
  ↓
ERC-8004 Receipt: HMAC Signature + Wallet Signature + Nullifier
  ↓
Filecoin: Permanent decentralized storage via Synapse SDK
```

## Demo Video

[Link to demo video]

## Hackathon

**PL Genesis: Frontiers of Collaboration** — March 2026
- Track: Fresh Code
- Frontiers: Web3 & Digital Human Rights, AI/AGI, Neurotechnology
