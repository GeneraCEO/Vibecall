#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  VIBECALL — COMPLETE DEPLOY SCRIPT
#  Run this from the root of your project
#  Deploys: Backend → Railway | Frontend → Vercel
#  Time to live: ~15 minutes
# ═══════════════════════════════════════════════════════════════════════════════

set -e  # exit on any error

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║           VIBECALL — GOING LIVE 🚀                   ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Install CLI tools (run once on your machine)
# ─────────────────────────────────────────────────────────────────────────────
echo "▶ STEP 1: Installing deploy CLIs..."

# Install Railway CLI
npm install -g @railway/cli

# Install Vercel CLI
npm install -g vercel

echo "✅ CLIs installed"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — BACKEND on Railway
# ─────────────────────────────────────────────────────────────────────────────
echo "▶ STEP 2: Deploying BACKEND to Railway..."

cd vibecall-backend

# Login to Railway (opens browser)
railway login

# Create new Railway project (or link to existing)
railway init

# Add PostgreSQL database to the project
# Railway dashboard: Project → + New → Database → PostgreSQL
# The DATABASE_URL is auto-injected into your service

# Deploy the backend
railway up --detach

echo ""
echo "✅ Backend deploying..."
echo "   → Open Railway dashboard to get your backend URL"
echo "   → It looks like: https://vibecall-backend-production.up.railway.app"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — Set Railway environment variables
# ─────────────────────────────────────────────────────────────────────────────
echo "▶ STEP 3: Setting Railway env vars..."

# Generate a strong JWT secret
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

railway variables set NODE_ENV=production
railway variables set PORT=4000
railway variables set JWT_SECRET="$JWT_SECRET"
railway variables set JWT_EXPIRES_IN=7d
railway variables set COOKIE_SECURE=true
railway variables set LIVEKIT_API_KEY=APIpYn9E7HHDhwA
railway variables set LIVEKIT_API_SECRET=neNxvKn9WtiD7FNBmV8gmmKjrYU3C9cdDef7mWm1gttB
railway variables set LIVEKIT_HOST=wss://vibecall-xizkbpz8.livekit.cloud
railway variables set TURN_HOST_US=openrelay.metered.ca
railway variables set TURN_PORT=80
railway variables set TURN_USERNAME=c975adebb62761d65ddcb2b8
railway variables set TURN_CREDENTIAL=HOrsTABhHqDjt3PE
railway variables set LOG_LEVEL=info

echo ""
echo "✅ Railway env vars set"
echo "   → Still need to add manually in Railway dashboard:"
echo "      CLIENT_URL=https://YOUR-VERCEL-URL.vercel.app  (set after Vercel deploy)"
echo "      DATABASE_URL=auto-injected by Railway PostgreSQL plugin"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — Run Prisma migration on production DB
# ─────────────────────────────────────────────────────────────────────────────
echo "▶ STEP 4: Running database migration..."

# Get DATABASE_URL from Railway
RAILWAY_DB_URL=$(railway variables get DATABASE_URL 2>/dev/null || echo "")

if [ -n "$RAILWAY_DB_URL" ]; then
  DATABASE_URL="$RAILWAY_DB_URL" npx prisma migrate deploy
  echo "✅ Database migrated"
else
  echo "⚠️  DATABASE_URL not found. After adding PostgreSQL to Railway:"
  echo "   Run: DATABASE_URL=\$(railway variables get DATABASE_URL) npx prisma migrate deploy"
fi
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 — FRONTEND on Vercel
# ─────────────────────────────────────────────────────────────────────────────
cd ../vibecall-frontend

echo "▶ STEP 5: Installing frontend dependencies..."

npm install

echo "✅ Dependencies installed (livekit-client included)"
echo ""

echo "▶ STEP 6: Deploying FRONTEND to Vercel..."

# Login to Vercel (opens browser)
vercel login

# Deploy to Vercel (follow prompts: project name → vibecall, root dir → .)
# When asked framework: Vite
vercel --prod

echo ""
echo "✅ Frontend deployed!"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# FINAL STEPS (manual — 2 minutes)
# ─────────────────────────────────────────────────────────────────────────────
echo "════════════════════════════════════════════════════════"
echo "  FINAL MANUAL STEPS (2 minutes)"
echo "════════════════════════════════════════════════════════"
echo ""
echo "1. Get your Vercel URL from the output above"
echo "   → e.g. https://vibecall.vercel.app"
echo ""
echo "2. Set it in Railway dashboard:"
echo "   Railway → Your Project → Variables → Add:"
echo "   CLIENT_URL = https://vibecall.vercel.app"
echo ""
echo "3. Set VITE_API_URL in Vercel dashboard:"
echo "   Vercel → vibecall → Settings → Environment Variables:"
echo "   VITE_API_URL = https://your-backend.up.railway.app"
echo "   (then redeploy: vercel --prod)"
echo ""
echo "4. Test it:"
echo "   → Open https://vibecall.vercel.app"
echo "   → Sign up for an account"
echo "   → Click 'New meeting'"
echo "   → Open same URL in another tab / another browser"
echo "   → Enter the same room code"
echo "   → You should see LIVE video ✅"
echo ""
echo "════════════════════════════════════════════════════════"
echo "  LIVE CHECK URLS"
echo "════════════════════════════════════════════════════════"
echo ""
echo "  Health:  https://your-backend.up.railway.app/health"
echo "  API:     https://your-backend.up.railway.app/api/auth/me"
echo "  LiveKit: https://cloud.livekit.io/projects  (wss active)"
echo ""
echo "🎉 VibeCall is LIVE!"
