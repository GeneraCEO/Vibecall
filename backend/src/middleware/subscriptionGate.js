/**
 * middleware/subscriptionGate.js
 *
 * Hard enforcement of subscription tiers for every AI + premium feature.
 * Import and use in any route that requires a paid plan.
 *
 * TIER HIERARCHY (lowest → highest access):
 *   FREE < PRO < EDUCATION < HEALTHCARE < ENTERPRISE
 *
 * PLANS & PRICING (enforced here, configured in Adapty dashboard):
 *   FREE         $0            forever  — basic video, 2 participants, no AI
 *   PRO          $49.99/month  3-day trial — all AI features, 100 participants
 *   EDUCATION    $200/year     no trial — classroom features, 200 participants
 *   HEALTHCARE   $200/year     no trial — HIPAA, waiting room, BAA, 50 seats
 *   ENTERPRISE   $200/year     no trial — white-label, unlimited, SLA
 *
 * FEATURE MAP:
 *   AI co-pilot          → PRO+
 *   Live transcription   → PRO+
 *   Post-call summaries  → PRO+
 *   Sentiment analytics  → PRO+
 *   Virtual backgrounds  → PRO+
 *   Recording            → PRO+
 *   Waiting room         → HEALTHCARE+
 *   BAA / HIPAA mode     → HEALTHCARE+
 *   Breakout rooms       → EDUCATION+
 *   White-label          → ENTERPRISE
 *   Unlimited seats      → ENTERPRISE
 */

'use strict';

const prisma  = require('../config/db');
const logger  = require('../config/logger');

// ── Tier ordering ─────────────────────────────────────────────────────────────
const TIER_ORDER = {
  FREE:        0,
  PRO:         1,
  EDUCATION:   2,
  HEALTHCARE:  3,
  ENTERPRISE:  4,
};

// ── AI feature access map ─────────────────────────────────────────────────────
const FEATURE_TIERS = {
  // AI features — all gated at PRO
  aiCopilot:            'PRO',
  transcription:        'PRO',
  postCallSummary:      'PRO',
  emailSummary:         'PRO',
  sentimentAnalytics:   'PRO',
  chapterSearch:        'PRO',
  virtualBackground:    'PRO',
  recording:            'PRO',
  cloudStorage:         'PRO',

  // Healthcare — gated at HEALTHCARE
  waitingRoom:          'HEALTHCARE',
  hipaaMode:            'HEALTHCARE',
  auditLogs:            'HEALTHCARE',
  phiRecording:         'HEALTHCARE',

  // Education — gated at EDUCATION
  breakoutRooms:        'EDUCATION',
  classroomMode:        'EDUCATION',
  studentAttendance:    'EDUCATION',
  livePollQuiz:         'EDUCATION',

  // Enterprise only
  whiteLabelEmbed:      'ENTERPRISE',
  customDomain:         'ENTERPRISE',
  unlimitedSeats:       'ENTERPRISE',
  sla:                  'ENTERPRISE',
};

// ── Participant limits per tier ───────────────────────────────────────────────
const PARTICIPANT_LIMITS = {
  FREE:        2,     // 2-person calls only on free
  PRO:         100,
  EDUCATION:   200,
  HEALTHCARE:  50,
  ENTERPRISE:  1000,
};

// ── Verify subscription is live (not expired/cancelled) ───────────────────────
async function getActiveTier(userId) {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: {
      subscriptionTier:   true,
      subscriptionStatus: true,
      subscriptionEndsAt: true,
      trialEndsAt:        true,
    },
  });

  if (!user) return 'FREE';

  const now = new Date();

  // Trial active
  if (user.subscriptionStatus === 'TRIALING' && user.trialEndsAt && user.trialEndsAt > now) {
    return user.subscriptionTier;
  }

  // Trial expired → downgrade silently
  if (user.subscriptionStatus === 'TRIALING' && user.trialEndsAt && user.trialEndsAt <= now) {
    await prisma.user.update({
      where: { id: userId },
      data:  { subscriptionTier: 'FREE', subscriptionStatus: 'CANCELED' },
    }).catch(() => {});
    return 'FREE';
  }

  // Paid subscription active
  if (user.subscriptionStatus === 'ACTIVE' || user.subscriptionStatus === 'LIFETIME') {
    // Check expiry for annual plans
    if (user.subscriptionEndsAt && user.subscriptionEndsAt <= now) {
      await prisma.user.update({
        where: { id: userId },
        data:  { subscriptionTier: 'FREE', subscriptionStatus: 'CANCELED' },
      }).catch(() => {});
      return 'FREE';
    }
    return user.subscriptionTier;
  }

  return 'FREE';
}

// ── requirePlan(tier) — middleware ────────────────────────────────────────────
// Use in route definitions:
//   router.post('/ai/copilot', requireAuth, requirePlan('PRO'), handler)
const requirePlan = (minTier) => async (req, res, next) => {
  try {
    // Re-fetch from DB to get live status — JWT may be stale
    const activeTier = await getActiveTier(req.user.id);
    const userLevel  = TIER_ORDER[activeTier] ?? 0;
    const minLevel   = TIER_ORDER[minTier]    ?? 0;

    if (userLevel >= minLevel) return next();

    logger.info('Feature gated — tier insufficient', {
      userId:     req.user.id,
      userTier:   activeTier,
      minTier,
    });

    return res.status(403).json({
      error:      `This feature requires ${minTier} plan or higher.`,
      yourTier:   activeTier,
      needsTier:  minTier,
      upgradeUrl: '/pricing',
      // Tell the frontend what plan to show in the upsell modal
      upsell:     getUpsellCopy(minTier),
    });
  } catch (err) {
    logger.error('requirePlan middleware error', { error: err.message });
    return res.status(500).json({ error: 'Subscription check failed' });
  }
};

// ── requireFeature(featureName) — middleware ──────────────────────────────────
// Cleaner API: requireFeature('aiCopilot') instead of requirePlan('PRO')
const requireFeature = (feature) => {
  const minTier = FEATURE_TIERS[feature];
  if (!minTier) throw new Error(`Unknown feature: ${feature}`);
  return requirePlan(minTier);
};

// ── checkParticipantLimit — middleware ────────────────────────────────────────
// Gate joins by participant count
const checkParticipantLimit = async (req, res, next) => {
  try {
    const activeTier = await getActiveTier(req.user.id);
    req.user.subscriptionTier = activeTier;
    req.user.participantLimit = PARTICIPANT_LIMITS[activeTier] ?? 2;
    next();
  } catch (err) {
    next(); // non-blocking — let livekit.js handle the count check
  }
};

// ── Upsell copy per tier ──────────────────────────────────────────────────────
function getUpsellCopy(tier) {
  const copy = {
    PRO: {
      headline:   'Unlock AI-powered meetings',
      body:       'AI co-pilot, live transcription, sentiment analytics, virtual backgrounds, recording — $49.99/month with 3-day free trial.',
      cta:        'Start 3-day trial',
      price:      '$49.99/month',
      trialDays:  3,
    },
    HEALTHCARE: {
      headline:   'HIPAA-compliant video for healthcare',
      body:       'Waiting room, signed BAA, PHI-safe recording, audit logs. Everything you need for telehealth compliance.',
      cta:        'Upgrade to Healthcare',
      price:      '$200/year per seat',
      trialDays:  0,
    },
    EDUCATION: {
      headline:   'Classroom mode for educators',
      body:       'Breakout rooms, live polls, attendance tracking, AI study notes. Up to 200 students per call.',
      cta:        'Upgrade to Education',
      price:      '$200/year per teacher',
      trialDays:  0,
    },
    ENTERPRISE: {
      headline:   'White-label VibeCall for your platform',
      body:       'Embed video in your product with your branding. Unlimited seats, custom domain, SLA support.',
      cta:        'Contact sales',
      price:      '$200/year — contact us',
      trialDays:  0,
    },
  };
  return copy[tier] || copy.PRO;
}

module.exports = {
  requirePlan,
  requireFeature,
  checkParticipantLimit,
  getActiveTier,
  TIER_ORDER,
  FEATURE_TIERS,
  PARTICIPANT_LIMITS,
};
