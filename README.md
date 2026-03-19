# VibeCall — Encrypted Video Calling with Live AI

> AES-256-GCM end-to-end encrypted video calls · Live AI co-pilot · Real-time transcription · HIPAA compliant · $49.99/month

[![Deploy Frontend](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/GeneraCEO/vibecall)

---

## What is VibeCall?

VibeCall is a full-stack video calling application that competes directly with Zoom and Google Meet by offering:

- **True E2E encryption** (AES-256-GCM via LiveKit) — unlike Zoom, we cannot access your calls
- **Live AI co-pilot** — Claude API surfaces insights, action items, and context mid-call
- **Real-time transcription** — Deepgram Nova-2 at 97% accuracy, speaker-labeled
- **Post-call AI summaries** — automatic overview, action items, decisions, next steps emailed via Resend
- **Sentiment & talk-time analytics** — who spoke how much, filler words, engagement score
- **Virtual backgrounds** — MediaPipe selfie segmentation via `@livekit/track-processors`
- **HIPAA compliance** — waiting room, BAA support, audit logs
- **No account required for guests** — just a room code

---

## Pricing

| Plan | Price | Trial | Key Features |
|------|-------|-------|--------------|
| Free | $0 | — | 2 participants, basic video |
| PRO Monthly | $49.99/mo | 3-day free | All AI features, 100 participants |
| PRO Annual | $200/yr | None | All PRO features, annual commitment |
| Healthcare | $200/seat/yr | None | HIPAA BAA, waiting room, audit logs |
| Education | $200/teacher/yr | None | Breakout rooms, polls, 200 students |
| Enterprise | $200/yr | None | White-label SDK, unlimited seats |

---

## Tech Stack

### Frontend (`/frontend`)
- React 18 + Vite 5
- LiveKit components-react 2.9 + track-processors 0.7
- Deepgram SDK 5 (real-time transcription)
- Zustand (auth state)
- react-helmet-async (SEO)

### Backend (`/backend`)
- Node.js + Express 4
- Prisma 5 + PostgreSQL
- LiveKit Server SDK 2.5
- Anthropic SDK 0.79 (Claude)
- Resend 6 (transactional email)
- Adapty.io (subscription billing)

### Infrastructure
- **Frontend**: Vercel
- **Backend**: Railway + PostgreSQL
- **WebRTC**: LiveKit Cloud
- **STT**: Deepgram
- **LLM**: Claude API (Anthropic)
- **Billing**: Adapty.io
- **Email**: Resend

---

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database (Railway provides this)
- Accounts: LiveKit Cloud, Deepgram, Anthropic, Adapty.io, Resend

### 1. Clone the repo

```bash
git clone https://github.com/GeneraCEO/vibecall.git
cd vibecall
```

### 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env
# Fill in all values in .env
npx prisma migrate dev --name init
npm run dev
```

### 3. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env.local
# Set VITE_API_URL=http://localhost:4000
npm run dev
```

### 4. Environment variables

**Backend** (`backend/.env`):
```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-min-32-chars
LIVEKIT_API_KEY=APIpYn9E7HHDhwA
LIVEKIT_API_SECRET=your-secret
LIVEKIT_HOST=wss://vibecall-xizkbpz8.livekit.cloud
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...
ADAPTY_SECRET_KEY=...
ADAPTY_WEBHOOK_SECRET=...
CLIENT_URL=https://your-vercel-app.vercel.app
```

**Frontend** (`frontend/.env.local`):
```
VITE_API_URL=https://your-backend.up.railway.app
VITE_DEEPGRAM_KEY=...
VITE_ADAPTY_PAYWALL_URL=https://pay.adapty.io/your-paywall
```

---

## Deployment

### Backend → Railway

```bash
cd backend
railway login
railway init
railway add  # add PostgreSQL
railway up
railway run npx prisma migrate deploy
```

### Frontend → Vercel

```bash
cd frontend
vercel --prod
# Set env vars in Vercel dashboard
```

---

## Adapty Subscription Setup

Create these 5 products in [app.adapty.io](https://app.adapty.io):

| Product ID | Price | Trial |
|-----------|-------|-------|
| `vibecall_pro_m` | $49.99/month | 3 days |
| `vibecall_pro_y` | $200/year | None |
| `vibecall_health` | $200/year | None |
| `vibecall_edu` | $200/year | None |
| `vibecall_ent` | $200/year | None |

Webhook URL: `https://your-backend.up.railway.app/api/subscriptions/webhook`

---

## Feature Gating

All AI features are enforced server-side in `backend/src/middleware/subscriptionGate.js`:

```
FREE        → basic video, 2 participants
PRO         → AI co-pilot, transcription, summaries, analytics, recording
HEALTHCARE  → PRO + HIPAA BAA, waiting room, audit logs
EDUCATION   → PRO + breakout rooms, polls, 200 students
ENTERPRISE  → all features + white-label SDK
```

---

## Project Structure

```
vibecall/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── VibeCallRoom.jsx      # Main call room (LiveKit + AI)
│   │   │   ├── AICopilotPanel.jsx    # Live AI sidebar
│   │   │   ├── PostCallSummary.jsx   # Post-call dashboard
│   │   │   └── UpgradeModal.jsx      # Subscription upsell
│   │   ├── hooks/
│   │   │   ├── useDeepgramTranscription.js
│   │   │   ├── useCallAnalytics.js
│   │   │   ├── useAICopilot.js
│   │   │   ├── useGeoTracking.js
│   │   │   └── useSubscription.js
│   │   └── pages/
│   │       ├── Home.jsx
│   │       ├── Dashboard.jsx
│   │       ├── Login.jsx
│   │       └── Signup.jsx
│   └── package.json
└── backend/
    ├── src/
    │   ├── routes/
    │   │   ├── ai.js                 # AI endpoints (gated)
    │   │   ├── livekit.js            # LiveKit tokens
    │   │   ├── auth.js               # JWT auth
    │   │   ├── rooms.js              # Room management
    │   │   └── subscriptions.js      # Adapty webhooks
    │   ├── middleware/
    │   │   ├── auth.js               # JWT middleware
    │   │   └── subscriptionGate.js   # Tier enforcement
    │   └── services/
    │       ├── adaptyService.js      # Adapty integration
    │       └── livekitService.js     # LiveKit integration
    ├── prisma/
    │   └── schema.prisma
    └── server.js
```

---

## License

MIT — see [LICENSE](LICENSE)

---

## Author

Built by [GeneraCEO](https://github.com/GeneraCEO)
