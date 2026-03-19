/**
 * components/UpgradeModal.jsx
 *
 * Shown when a FREE user clicks a PRO/paid feature.
 * Links to Adapty web paywall OR deep-links to mobile app store.
 *
 * ADAPTY WEB PAYWALL:
 *   app.adapty.io → Paywalls → create paywall → copy the web URL
 *   Set VITE_ADAPTY_PAYWALL_URL=https://pay.adapty.io/your-paywall-id
 */

import { PLAN_DETAILS } from '../hooks/useSubscription';

const C = {
  white:'#FFFFFF', gray50:'#F8F9FA', gray100:'#F1F3F4', gray200:'#E8EAED',
  gray600:'#80868B', gray700:'#5F6368', gray800:'#3C4043', gray900:'#202124',
  blue:'#1A73E8', blueLt:'#E8F0FE', green:'#34A853',
};

const ADAPTY_PAYWALL = import.meta.env.VITE_ADAPTY_PAYWALL_URL || '/pricing';

export default function UpgradeModal({ planKey = 'PRO', onClose }) {
  const plan = PLAN_DETAILS[planKey] || PLAN_DETAILS.PRO;

  function handleUpgrade() {
    // On web: redirect to Adapty web paywall
    // On mobile: Adapty SDK shows native paywall (handled in React Native app)
    if (ADAPTY_PAYWALL.startsWith('http')) {
      window.open(ADAPTY_PAYWALL, '_blank');
    } else {
      window.location.href = ADAPTY_PAYWALL;
    }
  }

  return (
    // Backdrop
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position:        'fixed', inset: 0, zIndex: 999,
        background:      'rgba(0,0,0,.55)',
        display:         'flex', alignItems: 'center', justifyContent: 'center',
        padding:         16,
        fontFamily:      "'Google Sans','Roboto',sans-serif",
      }}
    >
      <div style={{
        background:   C.white, borderRadius: 18,
        width:        '100%', maxWidth: 420,
        boxShadow:    '0 20px 60px rgba(0,0,0,.25)',
        overflow:     'hidden',
        animation:    'popIn .2s ease',
      }}>
        <style>{`@keyframes popIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}`}</style>

        {/* Header */}
        <div style={{ background: plan.color, padding: '22px 24px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.7)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>
                Upgrade required
              </div>
              <div style={{ fontSize: 22, fontWeight: 400, color: C.white }}>{plan.name}</div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', color: C.white, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 32, fontWeight: 500, color: C.white }}>{plan.price}</span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>{plan.period}</span>
          </div>
          {plan.tagline && (
            <div style={{ marginTop: 5, fontSize: 12, color: 'rgba(255,255,255,.65)' }}>{plan.tagline}</div>
          )}
        </div>

        {/* Features */}
        <div style={{ padding: '18px 24px' }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: C.gray600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
            What you get
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {plan.features.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: C.gray800, lineHeight: 1.4 }}>
                <span style={{ flexShrink: 0 }}>{f.split(' ')[0]}</span>
                <span>{f.slice(f.indexOf(' ')+1)}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={handleUpgrade}
            style={{
              width: '100%', padding: '14px', borderRadius: 26, border: 'none',
              background: plan.color, color: C.white, fontSize: 15,
              fontWeight: 500, cursor: 'pointer', marginBottom: 10,
            }}
          >
            {plan.hasTrial ? `Start ${plan.trialDays}-day free trial` : `Upgrade to ${plan.name}`}
          </button>

          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '11px', borderRadius: 26,
              border: `1px solid ${C.gray200}`, background: 'none',
              color: C.gray700, fontSize: 13, cursor: 'pointer',
            }}
          >
            Maybe later
          </button>

          {plan.hasTrial && (
            <p style={{ fontSize: 11, color: C.gray600, textAlign: 'center', margin: '10px 0 0', lineHeight: 1.5 }}>
              No credit card required for trial. Cancel anytime from the app.
            </p>
          )}

          {!plan.hasTrial && (
            <p style={{ fontSize: 11, color: C.gray600, textAlign: 'center', margin: '10px 0 0' }}>
              Annual plan · No refunds after 7 days
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
