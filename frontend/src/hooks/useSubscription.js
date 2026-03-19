/**
 * hooks/useSubscription.js
 *
 * Frontend subscription state + gating utilities.
 * Fetches live status from /api/subscriptions/status on mount.
 * Provides isPro(), requirePro(), and upsell helpers.
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react';

const API = import.meta.env.VITE_API_URL || '';

const TIER_ORDER = { FREE: 0, PRO: 1, EDUCATION: 2, HEALTHCARE: 3, ENTERPRISE: 4 };

// Plan details shown in upsell modal
export const PLAN_DETAILS = {
  PRO: {
    name:      'VibeCall PRO',
    price:     '$49.99',
    period:    '/month',
    tagline:   '3-day free trial — cancel anytime',
    hasTrial:  true,
    trialDays: 3,
    color:     '#1A73E8',
    features: [
      '🤖 Live AI co-pilot panel',
      '📝 Real-time Deepgram transcription',
      '📊 Sentiment & talk-time analytics',
      '🎬 Post-call AI summaries + email',
      '🎨 Virtual backgrounds',
      '☁️ Cloud recording',
      '👥 Up to 100 participants',
      '🔒 HIPAA compatible',
    ],
    adaptyProductId: 'vibecall_pro_m',
  },
  PRO_ANNUAL: {
    name:      'VibeCall PRO (Annual)',
    price:     '$200',
    period:    '/year',
    tagline:   'Save $400 vs monthly — no trial',
    hasTrial:  false,
    color:     '#1A73E8',
    features:  ['Everything in PRO monthly', 'Annual commitment — best value'],
    adaptyProductId: 'vibecall_pro_y',
  },
  HEALTHCARE: {
    name:      'VibeCall Healthcare',
    price:     '$200',
    period:    '/seat/year',
    tagline:   'HIPAA compliant — no trial',
    hasTrial:  false,
    color:     '#34A853',
    features: [
      '✅ Everything in PRO',
      '🏥 Signed BAA (Business Associate Agreement)',
      '🚪 Patient waiting room',
      '📋 Audit logs',
      '🔒 PHI-safe recording',
      '📞 Telehealth-optimised UI',
    ],
    adaptyProductId: 'vibecall_health',
  },
  EDUCATION: {
    name:      'VibeCall Education',
    price:     '$200',
    period:    '/teacher/year',
    tagline:   'Built for classrooms — no trial',
    hasTrial:  false,
    color:     '#9334E6',
    features: [
      '✅ Everything in PRO',
      '📚 Classroom mode',
      '🔀 Breakout rooms (auto-assign)',
      '📊 Student attendance tracking',
      '📝 Live polls + quizzes',
      '👩‍🎓 200 student capacity',
    ],
    adaptyProductId: 'vibecall_edu',
  },
  ENTERPRISE: {
    name:      'VibeCall Enterprise',
    price:     '$200',
    period:    '/year',
    tagline:   'White-label + unlimited seats — no trial',
    hasTrial:  false,
    color:     '#202124',
    features: [
      '✅ Everything in PRO + Healthcare',
      '🏢 White-label embed SDK',
      '🌐 Custom domain',
      '♾️ Unlimited seats',
      '📞 Dedicated SLA support',
      '🔑 API access (per-minute billing)',
    ],
    adaptyProductId: 'vibecall_ent',
  },
};

export function useSubscription() {
  const [tier,      setTier]      = useState('FREE');
  const [status,    setStatus]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [upsellFor, setUpsellFor] = useState('PRO');

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res  = await fetch(`${API}/api/subscriptions/status`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        setTier(data.tier || 'FREE');
        setStatus(data);
      } catch { /* offline or not logged in */ }
      finally { setLoading(false); }
    }
    fetchStatus();
  }, []);

  const hasAccess = useCallback((minTier) => {
    return (TIER_ORDER[tier] ?? 0) >= (TIER_ORDER[minTier] ?? 0);
  }, [tier]);

  const isPro         = hasAccess('PRO');
  const isHealthcare  = hasAccess('HEALTHCARE');
  const isEducation   = hasAccess('EDUCATION');
  const isEnterprise  = hasAccess('ENTERPRISE');
  const isTrial       = status?.isTrial || false;
  const trialDaysLeft = status?.daysLeft || 0;

  // Gate a feature — shows upsell modal if not subscribed
  const requirePlan = useCallback((minTier, callback) => {
    if (hasAccess(minTier)) {
      callback?.();
      return true;
    }
    setUpsellFor(minTier);
    setShowModal(true);
    return false;
  }, [hasAccess]);

  return {
    tier,
    status,
    loading,
    isPro,
    isHealthcare,
    isEducation,
    isEnterprise,
    isTrial,
    trialDaysLeft,
    hasAccess,
    requirePlan,
    showUpsell:  (planKey = 'PRO') => { setUpsellFor(planKey); setShowModal(true); },
    closeModal:  () => setShowModal(false),
    showModal,
    upsellFor,
  };
}
