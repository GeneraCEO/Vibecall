/**
 * src/routes/ai.js
 * ALL endpoints gated behind proper subscription tiers.
 *
 * POST /api/ai/copilot        → PRO+ only
 * POST /api/ai/summary        → PRO+ only
 * POST /api/ai/email-summary  → PRO+ only
 * POST /api/analytics/geo     → all users (free feature)
 * GET  /api/analytics/geo/:roomCode → PRO+ only
 */

'use strict';

const express   = require('express');
const router    = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { Resend } = require('resend');

const { requireAuth }    = require('../middleware/auth');
const { requireFeature } = require('../middleware/subscriptionGate');
const prisma             = require('../config/db');
const logger             = require('../config/logger');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend    = new Resend(process.env.RESEND_API_KEY);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/copilot — PRO+ ONLY
// ─────────────────────────────────────────────────────────────────────────────
router.post('/copilot',
  requireAuth,
  requireFeature('aiCopilot'),   // 403 with upsell JSON if not PRO
  async (req, res) => {
    try {
      const { messages } = req.body;
      if (!messages?.length) return res.json({ content: [{ text: '[]' }] });

      const response = await anthropic.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages,
      });

      logger.info('AI copilot used', { userId: req.user.id, tier: req.user.subscriptionTier });
      res.json(response);
    } catch (err) {
      logger.error('AI copilot error', { error: err.message });
      res.status(500).json({ error: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/summary — PRO+ ONLY
// ─────────────────────────────────────────────────────────────────────────────
router.post('/summary',
  requireAuth,
  requireFeature('postCallSummary'),
  async (req, res) => {
    try {
      const { roomCode, transcript, duration } = req.body;
      if (!transcript) return res.json({ overview: 'No transcript available.' });

      const durationStr = duration
        ? `${Math.floor(duration / 60)} minutes`
        : 'unknown length';

      const response = await anthropic.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 1500,
        system: `You are a meeting assistant. Analyze the transcript and return ONLY valid JSON:
{"overview":"2-3 sentence summary","actionItems":["..."],"decisions":["..."],"nextSteps":["..."],"keyMoments":["..."]}`,
        messages: [{
          role:    'user',
          content: `Meeting (${durationStr}):\n\n${transcript}\n\nReturn JSON only.`,
        }],
      });

      const text = response.content[0]?.text || '{}';
      let summary;
      try {
        summary = JSON.parse(text.replace(/```json\n?/g,'').replace(/```/g,'').trim());
      } catch {
        summary = { overview: text, actionItems:[], decisions:[], nextSteps:[] };
      }

      // Persist
      try {
        const room = await prisma.room.findFirst({ where: { code: roomCode } });
        if (room) {
          await prisma.meetingSummary.upsert({
            where:  { roomId: room.id },
            update: { summary: JSON.stringify(summary), transcript, updatedAt: new Date() },
            create: { roomId: room.id, summary: JSON.stringify(summary), transcript, generatedAt: new Date() },
          }).catch(() => {});
        }
      } catch { /* non-critical */ }

      logger.info('AI summary generated', { userId: req.user.id, roomCode });
      res.json(summary);
    } catch (err) {
      logger.error('AI summary error', { error: err.message });
      res.status(500).json({ error: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/email-summary — PRO+ ONLY
// ─────────────────────────────────────────────────────────────────────────────
router.post('/email-summary',
  requireAuth,
  requireFeature('emailSummary'),
  async (req, res) => {
    try {
      const { roomCode, summary, analyticsReport } = req.body;
      const user = req.user;

      if (!process.env.RESEND_API_KEY) {
        return res.status(400).json({ error: 'Email not configured — set RESEND_API_KEY' });
      }

      const duration = analyticsReport?.totalDuration
        ? `${Math.floor(analyticsReport.totalDuration/60)}m ${analyticsReport.totalDuration%60}s`
        : '--';

      const rows = (arr, color, icon) => (arr||[])
        .map(a=>`<li style="margin-bottom:6px;color:${color}">${icon} ${a}</li>`)
        .join('');

      const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#202124">
        <div style="background:#1A73E8;padding:20px;border-radius:10px 10px 0 0">
          <h1 style="color:#fff;font-size:18px;font-weight:400;margin:0">📹 VibeCall Meeting Summary</h1>
          <p style="color:rgba(255,255,255,.7);font-size:12px;margin:5px 0 0">${roomCode} · ${duration}</p>
        </div>
        <div style="border:1px solid #E8EAED;border-top:none;padding:20px;border-radius:0 0 10px 10px">
          <p style="font-size:14px;color:#5F6368;line-height:1.7">${summary?.overview||''}</p>
          ${rows(summary?.actionItems,'#137333','✓')?`<h3 style="font-size:14px;color:#137333">Action items</h3><ul>${rows(summary?.actionItems,'#137333','✓')}</ul>`:''}
          ${rows(summary?.decisions,'#1557B0','💡')?`<h3 style="font-size:14px;color:#1557B0">Decisions</h3><ul>${rows(summary?.decisions,'#1557B0','💡')}</ul>`:''}
          ${rows(summary?.nextSteps,'#B06000','→')?`<h3 style="font-size:14px;color:#B06000">Next steps</h3><ul>${rows(summary?.nextSteps,'#B06000','→')}</ul>`:''}
          <p style="font-size:11px;color:#9AA0A6;text-align:center;margin-top:20px">🔒 Generated by VibeCall AI · End-to-end encrypted call</p>
        </div></body></html>`;

      await resend.emails.send({
        from:    'VibeCall <meetings@vibecall.io>',
        to:      [user.email],
        subject: `Meeting summary: ${roomCode}`,
        html,
      });

      logger.info('Summary email sent', { userId: user.id, roomCode });
      res.json({ success: true });
    } catch (err) {
      logger.error('Email summary error', { error: err.message });
      res.status(500).json({ error: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/analytics/geo — free (all users, non-critical)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/geo', requireAuth, async (req, res) => {
  try {
    const { roomCode, country, countryCode, city, region, timezone, isp, lat, lng, ts } = req.body;
    const ip = (req.headers['x-forwarded-for']?.split(',')[0]?.trim()
             || req.headers['x-real-ip']
             || req.socket?.remoteAddress
             || 'unknown').slice(0, 45);

    await prisma.participantGeo.create({
      data: {
        userId: req.user.id, roomCode,
        country: country||'Unknown', countryCode: countryCode||'XX',
        city: city||'', region: region||'', timezone: timezone||'',
        isp: isp||'', lat: lat?parseFloat(lat):null, lng: lng?parseFloat(lng):null,
        ip, joinedAt: new Date(ts||Date.now()),
      },
    }).catch(()=>{});

    res.json({ recorded: true });
  } catch (err) {
    res.json({ recorded: false }); // always 200 — analytics must never break a call join
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/geo/:roomCode — PRO+ ONLY (your own data)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/geo/:roomCode',
  requireAuth,
  requireFeature('sentimentAnalytics'),
  async (req, res) => {
    try {
      const records = await prisma.participantGeo.findMany({
        where:   { roomCode: req.params.roomCode },
        orderBy: { joinedAt: 'desc' },
      }).catch(()=>[]);

      const byCountry = {};
      for (const r of records) byCountry[r.country] = (byCountry[r.country]||0)+1;
      const topCountries = Object.entries(byCountry)
        .sort((a,b)=>b[1]-a[1]).map(([country,count])=>({country,count}));

      res.json({ records, topCountries, total: records.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
