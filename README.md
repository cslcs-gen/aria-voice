# ARIA — Autonomous Resolution & IT Agent
### Agentic Voice IT Support PoC

A full-stack proof-of-concept demonstrating an AI agent that handles real-world IT support scenarios via natural voice conversation.

---

## Features

- **Voice-first** — Web Speech API for microphone input and text-to-speech output
- **Agentic loop** — Claude with function calling autonomously chains tools across multi-step tasks
- **3 live use cases** — Account unlock, VPN repair, Software provisioning
- **Real-time console** — Developer-style terminal showing the agent's internal monologue
- **Live ticket board** — CRM table updated in real-time as cases are resolved
- **Cyber-IT dark UI** — Pulsing voice aura, status indicators, monospace aesthetic

---

## Quick Start

```bash
# 1. Clone and install
git clone <your-repo>
cd aria-voice-it-support
npm install

# 2. Add your Anthropic API key
cp .env.example .env.local
# Edit .env.local and paste your key

# 3. Run locally
npm run dev
# → Open http://localhost:3000
```

---

## File Structure

```
aria-voice-it-support/
├── app/
│   ├── api/agent/route.ts   ← Agentic brain (Claude + function calling)
│   ├── page.tsx             ← Main dashboard UI
│   ├── layout.tsx
│   └── globals.css
├── hooks/
│   └── useVoiceAgent.ts     ← Voice orchestration hook
├── lib/
│   └── it-systems.ts        ← Mock IT backend (employees, VPN, licenses)
├── .env.example
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## The 3 IT Scenarios

| Scenario | Trigger phrase | Tools called |
|---|---|---|
| Account Lockout | "My account is locked, EMP001" | `verify_user` → `unlock_account` → `log_to_crm` |
| VPN Issue | "I can't connect to VPN, EMP002" | `verify_user` → `fix_vpn_connection` → `log_to_crm` |
| Software Request | "I need Figma, EMP003" | `verify_user` → `request_software` → `log_to_crm` |

**Test employees:** EMP001 (Sarah Chen, locked), EMP002 (Marcus Webb, VPN expired), EMP003 (Priya Nair, active), EMP004 (Jordan Blake, locked + VPN expired), EMP005 (Alex Rivera, active).

---

## Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set your env var in Vercel dashboard:
# ANTHROPIC_API_KEY = sk-ant-...
```

Or connect your GitHub repo to Vercel and add `ANTHROPIC_API_KEY` in Project Settings → Environment Variables.

---

## Architecture

```
Browser
  │
  ├── Web Speech API (mic) ──► useVoiceAgent.ts
  │                                  │
  │                          POST /api/agent
  │                                  │
  │                         Claude claude-opus-4-5
  │                         (agentic loop with tools)
  │                                  │
  │                          ┌───────┴────────┐
  │                     Tool calls        Tool results
  │                          │                │
  │                    it-systems.ts      (mock DB)
  │                          │
  │                   Response + actionLog + tickets
  │                                  │
  └── speechSynthesis (TTS) ◄─ useVoiceAgent.ts
      Console logs updated
      Ticket table updated
```

---

## Browser Requirements

- Chrome / Edge (best Web Speech API support)
- Firefox partial support (SpeechSynthesis only)
- Safari partial support
- **HTTPS required in production** for microphone access

---

## Notes

- The mock backend (`lib/it-systems.ts`) resets on server restart (in-memory only). For persistence, swap with a real DB.
- Conversation history is maintained per browser session via React state.
- The agent model is `claude-opus-4-5` — swap to `claude-haiku-4-5-20251001` for lower latency/cost.
# cache bust
