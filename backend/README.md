# VeridCall Backend — Setup Guide

## Prerequisites
- Node.js 20+
- PostgreSQL 15+ (local or [Railway](https://railway.app) / [Supabase](https://supabase.com))
- AWS account (for S3 recording storage — free tier works)
- Stripe account (for subscriptions)
- Metered.ca account (for TURN server — free tier: 50 GB/mo)

---

## Step 1 — Install & Configure

```bash
# Clone / create the project
cd veridcall-backend
npm install

# Copy environment template
cp .env.example .env
# Now edit .env with your actual values
```

### Required .env values to fill in:
| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Run: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `AWS_ACCESS_KEY_ID` | AWS IAM → Create access key |
| `AWS_SECRET_ACCESS_KEY` | Same as above |
| `S3_BUCKET_NAME` | AWS S3 → Create bucket (e.g. `veridcall-recordings`) |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → signing secret |
| `STRIPE_PRICE_*` | Stripe Dashboard → Products → Price IDs |
| `METERED_API_KEY` | metered.ca → Dashboard |
| `METERED_APP_NAME` | metered.ca → your app name |

---

## Step 2 — Database Setup

```bash
# Generate Prisma client from schema
npx prisma generate

# Create all tables
npx prisma migrate dev --name init

# (Optional) Open Prisma Studio to browse data
npx prisma studio
```

---

## Step 3 — AWS S3 Setup

1. Go to AWS Console → S3 → Create Bucket.
2. Name it `veridcall-recordings` (or whatever you set in `S3_BUCKET_NAME`).
3. **Block all public access** ✅ — files are served via presigned URLs only.
4. Go to IAM → Create a new user with programmatic access.
5. Attach this policy (least-privilege):
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
    "Resource": "arn:aws:s3:::veridcall-recordings/*"
  }]
}
```
6. Copy Access Key ID and Secret → paste into `.env`.

---

## Step 4 — Run Locally

```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start
```

Server starts on `http://localhost:4000`.
Health check: `curl http://localhost:4000/health`

---

## Step 5 — Stripe Webhook (local testing)

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Forward webhooks to local server
stripe listen --forward-to localhost:4000/api/subscriptions/webhook

# Copy the webhook signing secret it prints → set STRIPE_WEBHOOK_SECRET in .env
```

---

## Step 6 — Deploy to Production

### Option A — Railway.app (recommended for starters, ~$10/mo)
```bash
# Install Railway CLI
npm install -g @railway/cli

railway login
railway init
railway up

# Add PostgreSQL
railway add postgresql

# Set environment variables
railway variables set JWT_SECRET=xxx DATABASE_URL=xxx ...
```

### Option B — AWS EC2 (more control)
```bash
# On EC2 (Ubuntu 24.04, t3.medium)
sudo apt update && sudo apt install -y nodejs npm nginx certbot
git clone your-repo
cd veridcall-backend && npm install
npx prisma migrate deploy

# Use PM2 for process management
npm install -g pm2
pm2 start server.js --name veridcall
pm2 save && pm2 startup

# Nginx reverse proxy (for SSL)
# /etc/nginx/sites-available/veridcall:
# server {
#   listen 443 ssl;
#   server_name api.yourdomain.com;
#   location / { proxy_pass http://localhost:4000; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; }
# }
certbot --nginx -d api.yourdomain.com
```

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Sign in |
| POST | `/api/auth/logout` | Yes | Sign out |
| POST | `/api/auth/refresh` | Cookie | Refresh access token |
| GET | `/api/auth/me` | Yes | Current user profile |
| POST | `/api/rooms` | Yes | Create a room |
| GET | `/api/rooms` | Yes | List my rooms |
| GET | `/api/rooms/:code` | Yes | Get room by code |
| POST | `/api/rooms/:code/join` | Yes | Validate + get join token |
| POST | `/api/rooms/:id/end` | Yes (host) | End a meeting |
| POST | `/api/recordings/start` | Starter+ | Start recording |
| PATCH | `/api/recordings/:id/finalize` | Yes | Finalize recording |
| GET | `/api/recordings` | Yes | List recordings |
| GET | `/api/recordings/:id/stream` | Yes | Get playback URL |
| DELETE | `/api/recordings/:id` | Yes | Delete recording |
| GET | `/api/subscriptions/plans` | No | Get plan details |
| POST | `/api/subscriptions/checkout` | Yes | Create Stripe checkout |
| POST | `/api/subscriptions/portal` | Yes | Open billing portal |
| POST | `/api/subscriptions/webhook` | Stripe sig | Stripe webhook |
| GET | `/api/ice-servers` | Yes | Get TURN/STUN config |
| GET | `/health` | No | Health check |

## Socket.io Events

| Event (Client → Server) | Payload | Description |
|---|---|---|
| `join-room` | `{ joinToken }` | Enter a room |
| `offer` | `{ targetSocketId, sdp }` | Send WebRTC offer |
| `answer` | `{ targetSocketId, sdp }` | Send WebRTC answer |
| `ice-candidate` | `{ targetSocketId, candidate }` | Exchange ICE |
| `media-state` | `{ muted?, videoOff? }` | Broadcast media state |
| `screen-share-state` | `{ sharing }` | Broadcast screen share |
| `chat-message` | `{ text, encrypted? }` | Send a message |
| `raise-hand` | `{ raised }` | Raise/lower hand |
| `e2e-public-key` | `{ publicKey }` | Share ECDH public key |
| `e2e-public-key-reply` | `{ targetSocketId, publicKey }` | Reply with own key |

| Event (Server → Client) | Payload | Description |
|---|---|---|
| `room-peers` | `{ peers[], roomName }` | Existing peers on join |
| `peer-joined` | `{ socketId, userId, name }` | New peer joined |
| `peer-disconnected` | `{ socketId }` | Peer left |
| `offer` | `{ fromSocketId, fromName, sdp }` | Incoming offer |
| `answer` | `{ fromSocketId, sdp }` | Incoming answer |
| `ice-candidate` | `{ fromSocketId, candidate }` | Incoming ICE |
| `peer-media-state` | `{ socketId, muted, videoOff }` | Peer muted/unmuted |
| `peer-screen-share` | `{ socketId, sharing }` | Peer screen share state |
| `chat-message` | `{ id, text, user, createdAt }` | Incoming message |
| `peer-hand` | `{ socketId, raised }` | Peer raised hand |
| `error` | `{ message }` | Server error |
