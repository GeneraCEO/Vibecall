/**
 * SEOMeta.jsx — Complete SEO layer for VibeCall
 * Covers: title, description, canonical, OG, Twitter, JSON-LD, mobile meta
 * Usage: <SEOMeta page="home" /> or <SEOMeta title="..." description="..." />
 */
import { Helmet } from 'react-helmet-async';

const SITE  = 'https://vibecall.io';
const BRAND = 'VibeCall';
const OG_IMG = `${SITE}/og-image.png`;

const PAGES = {
  home: {
    title:    'VibeCall — Encrypted Video Calls. No account. $40/year.',
    desc:     'AES-256-GCM end-to-end encrypted video calls. No Google account for guests. Virtual backgrounds, AI meeting notes, HIPAA compliant. 73% cheaper than Zoom.',
    canonical:`${SITE}/`,
    keywords: 'encrypted video calls, secure video calling, HIPAA video call, zoom alternative, google meet alternative, private video conferencing, end to end encrypted meeting, no account video call',
    schema: {
      '@context':'https://schema.org',
      '@type':'SoftwareApplication',
      name: BRAND,
      applicationCategory:'VideoCommunication',
      operatingSystem:'Web, iOS, Android',
      url: `${SITE}/`,
      offers: { '@type':'Offer', price:'40.00', priceCurrency:'USD', description:'VibeCall PRO annual' },
      aggregateRating: { '@type':'AggregateRating', ratingValue:'4.9', reviewCount:'312', bestRating:'5' },
    },
    faq: true,
  },
  pricing: {
    title:    'Pricing — VibeCall. $40/year PRO. Free guest joining.',
    desc:     '$40/year gets you unlimited calls, AI notes, recording, virtual bg. No time limits. HIPAA at $249/seat/yr. Compare vs Zoom $149.90/yr.',
    canonical:`${SITE}/pricing`,
    keywords: 'vibecall pricing, video call cost, zoom alternative price, hipaa video pricing',
  },
  'vs-zoom': {
    title:    'VibeCall vs Zoom — Encrypted, Cheaper, No Install (2025)',
    desc:     "VibeCall vs Zoom: real E2E encryption, no 40-min limit, no app install, $40/yr vs $149.90/yr. Better HIPAA, cleaner UI. Switch today.",
    canonical:`${SITE}/vs/zoom`,
    keywords: 'vibecall vs zoom, zoom alternative 2025, zoom privacy issues, zoom too expensive',
  },
  'vs-google-meet': {
    title:    'VibeCall vs Google Meet — No Google Account. Real Encryption.',
    desc:     "Guests never need a Google account. No 60-min limit. True E2E encryption. No data harvesting. $40/yr vs Google Workspace $72+/yr.",
    canonical:`${SITE}/vs/google-meet`,
    keywords: 'google meet alternative, no google account video call, google meet privacy',
  },
  hipaa: {
    title:    'HIPAA Video Calls — VibeCall for Healthcare & Therapy',
    desc:     'HIPAA-compliant video calling with BAA. AES-256-GCM encrypted. Waiting room, audit logs, no PHI stored. $249/seat/yr for clinicians.',
    canonical:`${SITE}/hipaa-video-call`,
    keywords: 'HIPAA video call, HIPAA telehealth, HIPAA compliant video, BAA video calling, telehealth platform',
  },
  login:    { title:`Sign in — ${BRAND}`,          desc:'Sign in to your VibeCall account.',                    canonical:`${SITE}/login`,     noindex:true },
  signup:   { title:`Create account — ${BRAND}`,   desc:'Start your free 3-day VibeCall trial. No credit card.', canonical:`${SITE}/signup` },
  dashboard:{ title:`Dashboard — ${BRAND}`,         desc:'Start or join encrypted video calls.',                 canonical:`${SITE}/dashboard`, noindex:true },
};

const FAQ_SCHEMA = {
  '@context':'https://schema.org',
  '@type':'FAQPage',
  mainEntity:[
    { '@type':'Question', name:'Do guests need an account to join?',
      acceptedAnswer:{ '@type':'Answer', text:'No. Guests join with just a name and room code. No Google account, no app install, zero friction.' }},
    { '@type':'Question', name:'Is VibeCall really end-to-end encrypted?',
      acceptedAnswer:{ '@type':'Answer', text:'Yes — AES-256-GCM always on. Unlike Zoom, we cannot access your video or audio.' }},
    { '@type':'Question', name:'Is there a time limit?',
      acceptedAnswer:{ '@type':'Answer', text:'No. VibeCall has zero time limits at any paid tier. Zoom cuts free calls at 40 minutes.' }},
    { '@type':'Question', name:'Is VibeCall HIPAA compliant?',
      acceptedAnswer:{ '@type':'Answer', text:'Yes. We offer a Business Associate Agreement, waiting rooms, and audit logs for healthcare at $249/seat/year.' }},
    { '@type':'Question', name:'How much does VibeCall cost?',
      acceptedAnswer:{ '@type':'Answer', text:'VibeCall PRO is $40/year — 73% cheaper than Zoom Pro at $149.90/year.' }},
  ],
};

const ORG_SCHEMA = {
  '@context':'https://schema.org',
  '@type':'Organization',
  name: BRAND,
  url: SITE,
  logo:`${SITE}/logo.png`,
  sameAs:['https://twitter.com/vibecall','https://linkedin.com/company/vibecall'],
  contactPoint:{ '@type':'ContactPoint', contactType:'customer support', email:'support@vibecall.io' },
};

export default function SEOMeta({ page, title, description, canonical, keywords, noindex, extraSchema }) {
  const p    = PAGES[page] || {};
  const t    = title       || p.title       || `${BRAND} — Encrypted Video Calls`;
  const desc = description || p.desc        || 'End-to-end encrypted video calls. No Google account required.';
  const can  = canonical   || p.canonical   || SITE;
  const kw   = keywords    || p.keywords    || '';
  const idx  = noindex     || p.noindex     || false;

  const schemas = [ORG_SCHEMA];
  if (p.schema)          schemas.push(p.schema);
  if (p.faq)             schemas.push(FAQ_SCHEMA);
  if (extraSchema)       schemas.push(extraSchema);

  return (
    <Helmet>
      <title>{t}</title>
      <meta name="description"   content={desc} />
      {kw && <meta name="keywords" content={kw} />}
      <link rel="canonical"      href={can} />
      {idx && <meta name="robots" content="noindex,nofollow" />}

      <meta property="og:type"        content="website" />
      <meta property="og:url"         content={can} />
      <meta property="og:title"       content={t} />
      <meta property="og:description" content={desc} />
      <meta property="og:image"       content={OG_IMG} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height"content="630" />
      <meta property="og:site_name"   content={BRAND} />

      <meta name="twitter:card"        content="summary_large_image" />
      <meta name="twitter:site"        content="@vibecall" />
      <meta name="twitter:title"       content={t} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image"       content={OG_IMG} />

      <meta name="theme-color"                    content="#1A73E8" />
      <meta name="mobile-web-app-capable"         content="yes" />
      <meta name="apple-mobile-web-app-capable"   content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title"     content={BRAND} />
      <link rel="manifest"    href="/manifest.json" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(s)}</script>
      ))}
    </Helmet>
  );
}
