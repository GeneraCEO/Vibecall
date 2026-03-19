/**
 * services/adaptyService.js — all 4 billing plans wired
 *
 * PLANS IN ADAPTY DASHBOARD (create with EXACT these product IDs):
 *   vibecall_pro_m  → $49.99/month  · 3-day trial  → tier: PRO
 *   vibecall_pro_y  → $200/year     · no trial      → tier: PRO
 *   vibecall_health → $200/year     · no trial      → tier: HEALTHCARE
 *   vibecall_edu    → $200/year     · no trial      → tier: EDUCATION
 *   vibecall_ent    → $200/year     · no trial      → tier: ENTERPRISE
 *
 * WEBHOOK SETUP:
 *   app.adapty.io → Integrations → Webhooks → URL:
 *   https://your-app.up.railway.app/api/subscriptions/webhook
 */
'use strict';

const crypto = require('crypto');
const https  = require('https');
const prisma = require('../config/db');
const logger = require('../config/logger');

const ADAPTY_SECRET      = process.env.ADAPTY_SECRET_KEY     || '';
const ADAPTY_WEBHOOK_SIG = process.env.ADAPTY_WEBHOOK_SECRET || '';

const PRODUCT_TO_TIER = {
  'vibecall_pro_m':  { tier: 'PRO',        hasTrial: true,  trialDays: 3 },
  'vibecall_pro_y':  { tier: 'PRO',        hasTrial: false, trialDays: 0 },
  'vibecall_health': { tier: 'HEALTHCARE', hasTrial: false, trialDays: 0 },
  'vibecall_edu':    { tier: 'EDUCATION',  hasTrial: false, trialDays: 0 },
  'vibecall_ent':    { tier: 'ENTERPRISE', hasTrial: false, trialDays: 0 },
};

function adaptyRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      method,
      hostname: 'api.adapty.io',
      path:     `/api/v2${path}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Api-Key ${ADAPTY_SECRET}`,
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function createProfile(userId, email, name) {
  if (!ADAPTY_SECRET) return null;
  try {
    const res = await adaptyRequest('POST', '/profiles/', {
      customer_user_id: userId, email,
      first_name: name?.split(' ')[0] || '',
      last_name:  name?.split(' ').slice(1).join(' ') || '',
    });
    const profileId = res.body?.data?.attributes?.profile_id;
    if (profileId) {
      await prisma.user.update({ where: { id: userId }, data: { adaptyProfileId: profileId } });
    }
    return profileId;
  } catch (err) {
    logger.warn('[Adapty] createProfile failed', { error: err.message });
    return null;
  }
}

async function grantAccess(userId, tier, durationDays = 365) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionTier:   tier,
      subscriptionStatus: 'ACTIVE',
      subscriptionEndsAt: new Date(Date.now() + durationDays * 86400000),
    },
  });
}

async function revokeAccess(userId) {
  await prisma.user.update({
    where: { id: userId },
    data:  { subscriptionTier: 'FREE', subscriptionStatus: 'CANCELED', subscriptionEndsAt: null },
  });
}

function verifyWebhookSignature(rawBody, sig) {
  if (!ADAPTY_WEBHOOK_SIG) return true;
  const expected = crypto.createHmac('sha256', ADAPTY_WEBHOOK_SIG).update(rawBody).digest('hex');
  return sig === expected || sig === `sha256=${expected}`;
}

async function processWebhookEvent(event) {
  const { event_type, profiles = [] } = event;
  logger.info('[Adapty] Webhook', { event_type });

  for (const profile of profiles) {
    const userId = profile.customer_user_id;
    if (!userId) continue;

    const purchases     = profile.subscriptions || [];
    const activePurchase = purchases.find(p => p.is_active && !p.is_expired);

    switch (event_type) {

      case 'subscription_started':
      case 'subscription_renewed':
      case 'subscription_activated': {
        if (!activePurchase) break;
        const productId = activePurchase.vendor_product_id || activePurchase.product_id || '';
        const config    = PRODUCT_TO_TIER[productId] || { tier: 'PRO' };
        const expiresAt = activePurchase.expires_at
          ? new Date(activePurchase.expires_at)
          : new Date(Date.now() + 365 * 86400000);

        await prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionTier:   config.tier,
            subscriptionStatus: 'ACTIVE',
            subscriptionEndsAt: expiresAt,
            trialEndsAt:        null,
            adaptyProfileId:    profile.profile_id || undefined,
          },
        });
        logger.info('[Adapty] Activated', { userId, tier: config.tier });
        break;
      }

      case 'subscription_trial_started': {
        const productId = (purchases[0])?.vendor_product_id || 'vibecall_pro_m';
        const config    = PRODUCT_TO_TIER[productId] || { tier: 'PRO', trialDays: 3 };
        const trialEnd  = new Date(Date.now() + (config.trialDays || 3) * 86400000);

        await prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionTier:   config.tier,
            subscriptionStatus: 'TRIALING',
            trialEndsAt:        trialEnd,
            trialUsed:          true,
            adaptyProfileId:    profile.profile_id || undefined,
          },
        });
        logger.info('[Adapty] Trial started', { userId, trialEnd });
        break;
      }

      case 'subscription_expired':
      case 'subscription_canceled': {
        await prisma.user.update({
          where: { id: userId },
          data:  { subscriptionTier: 'FREE', subscriptionStatus: 'CANCELED', subscriptionEndsAt: new Date() },
        });
        break;
      }
    }
  }
}

module.exports = { createProfile, grantAccess, revokeAccess, verifyWebhookSignature, processWebhookEvent, PRODUCT_TO_TIER };
