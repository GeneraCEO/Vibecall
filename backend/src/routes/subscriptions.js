/**
 * routes/subscriptions.js — Adapty.io subscription routes
 * Stripe has been completely removed.
 */
"use strict";

const express = require("express");
const router  = express.Router();
const { authenticate } = require("../middleware/auth");
const adapty  = require("../services/adaptyService");
const prisma  = require("../config/db");
const logger  = require("../config/logger");

// ── GET /api/subscriptions/status ─────────────────────────────────────────────
// Returns the current user's subscription tier + trial info
router.get("/status", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.user.id },
      select: {
        subscriptionTier:   true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
        trialEndsAt:        true,
        trialUsed:          true,
        adaptyProfileId:    true,
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    // Check if trial has expired
    const now = new Date();
    if (
      user.subscriptionStatus === "TRIALING" &&
      user.trialEndsAt &&
      user.trialEndsAt < now
    ) {
      // Trial expired — downgrade
      await adapty.revokeAccess(req.user.id);
      user.subscriptionTier   = "FREE";
      user.subscriptionStatus = "CANCELED";
    }

    const isPro     = user.subscriptionTier === "PRO";
    const isTrial   = user.subscriptionStatus === "TRIALING";
    const daysLeft  = user.trialEndsAt
      ? Math.max(0, Math.ceil((new Date(user.trialEndsAt) - now) / (1000 * 60 * 60 * 24)))
      : 0;

    res.json({
      tier:     user.subscriptionTier,
      status:   user.subscriptionStatus,
      isPro,
      isTrial,
      daysLeft,
      expiresAt:   user.subscriptionEndsAt,
      trialEndsAt: user.trialEndsAt,
      trialUsed:   user.trialUsed,
    });
  } catch (err) {
    logger.error("[Subscriptions] Status check failed", { error: err.message });
    res.status(500).json({ error: "Could not fetch subscription status" });
  }
});

// ── POST /api/subscriptions/verify ────────────────────────────────────────────
// Called by mobile app after purchase — syncs Adapty profile to DB
router.post("/verify", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Create Adapty profile if it doesn't exist yet
    let profileId = user.adaptyProfileId;
    if (!profileId) {
      profileId = await adapty.createProfile(user.id, user.email, user.name);
    }

    // Fetch live status from Adapty
    const status = await adapty.getSubscriptionStatus(profileId);

    if (status.isPro) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          subscriptionTier:   "PRO",
          subscriptionStatus: status.isTrialing ? "TRIALING" : "ACTIVE",
          subscriptionEndsAt: status.expiresAt,
        },
      });
    }

    res.json({
      verified: true,
      isPro:    status.isPro,
      isTrial:  status.isTrialing,
      expiresAt: status.expiresAt,
    });
  } catch (err) {
    logger.error("[Subscriptions] Verify failed", { error: err.message });
    res.status(500).json({ error: "Verification failed" });
  }
});

// ── POST /api/adapty/webhook ───────────────────────────────────────────────────
// Receives Adapty server-to-server webhook events
// Configure at: app.adapty.io → Integrations → Webhooks → Add endpoint
// URL: https://your-backend.railway.app/api/adapty/webhook
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["adapty-signature"] || req.headers["x-adapty-signature"];

  // Verify signature
  const valid = adapty.verifyWebhookSignature(req.body, sig);
  if (!valid) {
    logger.warn("[Adapty] Invalid webhook signature");
    return res.status(401).json({ error: "Invalid signature" });
  }

  let event;
  try {
    event = JSON.parse(req.body.toString());
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  // Respond immediately (Adapty expects 200 within 5s)
  res.status(200).json({ received: true });

  // Process async — don't block the response
  adapty.processWebhookEvent(event).catch((err) => {
    logger.error("[Adapty] Webhook processing error", { error: err.message });
  });
});

// ── GET /api/subscriptions/paywall ────────────────────────────────────────────
// Returns the paywall config for the mobile app
// The Adapty SDK handles the actual paywall UI — this is just metadata
router.get("/paywall", authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where:  { id: req.user.id },
    select: { subscriptionTier: true, trialUsed: true },
  });

  res.json({
    price:       "$30",
    period:      "per year",
    trialDays:   3,
    trialAvailable: !user?.trialUsed,
    features: [
      "Unlimited participants per call",
      "Cloud recording (up to 10 hours/month)",
      "Custom room names",
      "Screen sharing",
      "AI meeting summaries",
      "End-to-end encryption",
      "Priority TURN relay (global 6-region)",
    ],
    adaptyPlacementId: "vibecall_premium_paywall",   // Set this in Adapty dashboard
  });
});

module.exports = router;
