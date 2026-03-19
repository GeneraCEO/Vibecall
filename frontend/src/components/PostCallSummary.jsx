/**
 * PostCallSummary.jsx
 *
 * Shown immediately after a call ends.
 * Sends full transcript to Claude API via backend.
 * Returns: summary, action items, decisions, next steps, key moments.
 * Emails summary to all participants via Resend.
 * Saves to meeting history in DB.
 */

import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

const SPEAKER_COLORS = ['#1A73E8','#34A853','#EA4335','#FBBC04','#9334E6'];
const SENTIMENT_COLOR = { positive: '#34A853', neutral: '#80868B', negative: '#EA4335' };

export default function PostCallSummary({ roomCode, fullText, analyticsReport, onDone }) {
  const [summary,   setSummary]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');

  useEffect(() => {
    if (!fullText) { setLoading(false); return; }
    generateSummary();
  }, []);

  async function generateSummary() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai/summary`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode,
          transcript: fullText,
          duration:   analyticsReport?.totalDuration,
        }),
      });

      if (!res.ok) throw new Error('Summary generation failed');
      const data = await res.json();
      setSummary(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function sendEmail() {
    try {
      await fetch(`${API_BASE}/api/ai/email-summary`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode, summary, analyticsReport }),
      });
      setEmailSent(true);
    } catch { /* non-critical */ }
  }

  const report = analyticsReport;
  const duration = report?.totalDuration ? `${Math.floor(report.totalDuration / 60)}m ${report.totalDuration % 60}s` : '--';

  const tabs = ['summary', 'analytics', 'transcript'];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8F9FA', fontFamily: "'Google Sans', 'Roboto', sans-serif", padding: 20 }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 14, padding: '20px 24px', marginBottom: 16, border: '1px solid #E8EAED', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#1A73E8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📹</div>
              <span style={{ fontSize: 18, fontWeight: 500, color: '#202124' }}>Meeting complete</span>
            </div>
            <div style={{ fontSize: 13, color: '#80868B' }}>
              Room: <code style={{ backgroundColor: '#F1F3F4', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>{roomCode}</code>
              &nbsp;· Duration: {duration}
              &nbsp;· {report?.speakers?.length || 0} participants
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={sendEmail}
              disabled={emailSent}
              style={{ padding: '9px 18px', borderRadius: 20, border: '1px solid #E8EAED', backgroundColor: '#FFFFFF', color: emailSent ? '#34A853' : '#1A73E8', fontSize: 13, fontWeight: 500, cursor: emailSent ? 'default' : 'pointer' }}
            >
              {emailSent ? '✓ Sent' : '📧 Email summary'}
            </button>
            <button
              onClick={onDone}
              style={{ padding: '9px 18px', borderRadius: 20, border: 'none', backgroundColor: '#1A73E8', color: '#FFFFFF', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            >
              Done
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, backgroundColor: '#FFFFFF', borderRadius: '10px 10px 0 0', border: '1px solid #E8EAED', borderBottom: 'none', overflow: 'hidden' }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              flex: 1, padding: '12px 0', background: 'none', border: 'none',
              borderBottom: `2px solid ${activeTab === t ? '#1A73E8' : 'transparent'}`,
              color: activeTab === t ? '#1A73E8' : '#5F6368',
              fontSize: 13, fontWeight: activeTab === t ? 500 : 400,
              cursor: 'pointer', textTransform: 'capitalize',
            }}>{t}</button>
          ))}
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '0 0 14px 14px', border: '1px solid #E8EAED', padding: '20px 24px', minHeight: 400 }}>

          {/* ── Summary tab ─────────────────────────────────────── */}
          {activeTab === 'summary' && (
            loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: 13, color: '#80868B' }}>🤖 Claude is writing your meeting summary…</div>
              </div>
            ) : error ? (
              <div style={{ color: '#EA4335', fontSize: 13, padding: '20px 0' }}>⚠ {error}</div>
            ) : summary ? (
              <div>
                <div style={{ fontSize: 15, color: '#202124', lineHeight: 1.7, marginBottom: 20 }}>{summary.overview}</div>

                {summary.actionItems?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#9AA0A6', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Action items</div>
                    {summary.actionItems.map((item, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 12px', backgroundColor: '#E6F4EA', borderRadius: 8, marginBottom: 6, borderLeft: '3px solid #34A853' }}>
                        <span style={{ fontSize: 13, color: '#137333', fontWeight: 500, flexShrink: 0 }}>✓</span>
                        <span style={{ fontSize: 13, color: '#137333', lineHeight: 1.5 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                )}

                {summary.decisions?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#9AA0A6', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Decisions made</div>
                    {summary.decisions.map((d, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 12px', backgroundColor: '#E8F0FE', borderRadius: 8, marginBottom: 6, borderLeft: '3px solid #1A73E8' }}>
                        <span style={{ fontSize: 13, color: '#1557B0' }}>💡</span>
                        <span style={{ fontSize: 13, color: '#1557B0', lineHeight: 1.5 }}>{d}</span>
                      </div>
                    ))}
                  </div>
                )}

                {summary.nextSteps?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#9AA0A6', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Next steps</div>
                    {summary.nextSteps.map((s, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 12px', backgroundColor: '#FEF7E0', borderRadius: 8, marginBottom: 6, borderLeft: '3px solid #FBBC04' }}>
                        <span style={{ fontSize: 13, color: '#B06000' }}>→</span>
                        <span style={{ fontSize: 13, color: '#B06000', lineHeight: 1.5 }}>{s}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9AA0A6', fontSize: 13 }}>No transcript to summarize.</div>
            )
          )}

          {/* ── Analytics tab ────────────────────────────────── */}
          {activeTab === 'analytics' && report && (
            <div>
              {/* Stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 20 }}>
                {[
                  { label: 'Duration',    value: duration },
                  { label: 'Speakers',    value: report.speakers?.length || 0 },
                  { label: 'Engagement',  value: `${report.engagementScore}/100` },
                  { label: 'Sentiment',   value: report.dominantSentiment },
                  { label: 'Chapters',    value: report.chapters?.length || 0 },
                ].map(s => (
                  <div key={s.label} style={{ backgroundColor: '#F8F9FA', borderRadius: 8, padding: '12px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 500, color: '#202124' }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: '#80868B', marginTop: 3 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Speaker breakdown */}
              {report.speakers?.map((s, i) => (
                <div key={s.id} style={{ backgroundColor: '#F8F9FA', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: SPEAKER_COLORS[i % SPEAKER_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 500 }}>
                        {String(s.id)}
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#202124' }}>{s.name}</span>
                    </div>
                    <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, backgroundColor: SENTIMENT_COLOR[s.sentiment] + '22', color: SENTIMENT_COLOR[s.sentiment] }}>
                      {s.sentiment}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                    {[
                      { label: 'Talk time', value: `${Math.floor(s.talkTime/60)}m ${s.talkTime%60}s` },
                      { label: 'Talk %',    value: `${s.talkPercent}%` },
                      { label: 'Fillers',   value: s.fillerCount },
                      { label: 'Turns',     value: s.utterances },
                    ].map(m => (
                      <div key={m.label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 15, fontWeight: 500, color: '#202124' }}>{m.value}</div>
                        <div style={{ fontSize: 10, color: '#80868B' }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Chapters */}
              {report.chapters?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#9AA0A6', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Topics covered</div>
                  {report.chapters.map((ch, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F1F3F4' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#1A73E8' }}/>
                      <span style={{ fontSize: 13, color: '#202124', textTransform: 'capitalize', flex: 1 }}>{ch.title}</span>
                      <span style={{ fontSize: 11, color: '#80868B' }}>{new Date(ch.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Transcript tab ───────────────────────────────── */}
          {activeTab === 'transcript' && (
            <div>
              {fullText ? (
                <pre style={{ fontSize: 13, color: '#202124', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit' }}>
                  {fullText}
                </pre>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#9AA0A6', fontSize: 13 }}>No transcript available.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
