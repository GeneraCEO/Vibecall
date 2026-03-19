/**
 * AICopilotPanel.jsx
 *
 * Sidebar panel that shows:
 *   - Live transcript (word-by-word as people speak)
 *   - AI insights surfaced from conversation
 *   - Speaker talk-time bars
 *   - Sentiment arc (live visual)
 *   - Chapter markers (auto-detected topic shifts)
 *   - Active participant countries
 */

import { useState, useEffect, useRef } from 'react';
import { INSIGHT_COLORS } from '../hooks/useAICopilot';

const SENTIMENT_COLOR = {
  positive: '#34A853',
  neutral:  '#80868B',
  negative: '#EA4335',
};

const SPEAKER_COLORS = ['#1A73E8','#34A853','#EA4335','#FBBC04','#9334E6','#00ACC1'];

function SpeakerBar({ name, talkTime, talkPercent, fillerCount, sentiment, color }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#202124' }}>{name}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {fillerCount > 0 && (
            <span style={{ fontSize: 10, color: '#80868B' }}>{fillerCount} fillers</span>
          )}
          <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 999, backgroundColor: SENTIMENT_COLOR[sentiment] + '22', color: SENTIMENT_COLOR[sentiment] }}>
            {sentiment}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1, height: 6, backgroundColor: '#F1F3F4', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${talkPercent}%`, height: '100%', backgroundColor: color, borderRadius: 3, transition: 'width .5s ease' }}/>
        </div>
        <span style={{ fontSize: 11, color: '#5F6368', minWidth: 36 }}>{talkPercent}%</span>
      </div>
      <span style={{ fontSize: 10, color: '#9AA0A6' }}>
        {Math.floor(talkTime / 60)}m {talkTime % 60}s
      </span>
    </div>
  );
}

function InsightCard({ insight }) {
  const colors = INSIGHT_COLORS[insight.type] || INSIGHT_COLORS.insight;
  return (
    <div style={{
      backgroundColor: colors.bg,
      border:          `1px solid ${colors.border}30`,
      borderLeft:      `3px solid ${colors.border}`,
      borderRadius:    8,
      padding:         '9px 12px',
      marginBottom:    6,
      animation:       'slideIn .3s ease',
    }}>
      <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>{insight.icon}</span>
        <span style={{ fontSize: 12, color: colors.text, lineHeight: 1.5 }}>{insight.text}</span>
      </div>
    </div>
  );
}

function ChapterMarker({ chapter, index }) {
  const time = new Date(chapter.ts);
  const label = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#1A73E8', flexShrink: 0 }}/>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#202124', textTransform: 'capitalize' }}>{chapter.title}</span>
        <span style={{ fontSize: 11, color: '#80868B', marginLeft: 6 }}>{label}</span>
      </div>
    </div>
  );
}

export default function AICopilotPanel({
  transcript,
  interim,
  isListening,
  insights,
  isThinking,
  lastUpdate,
  speakerStats,
  sentimentArc,
  chapters,
  engagementScore,
  topCountries,
  myLocation,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState('copilot');
  const transcriptRef = useRef(null);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript, interim]);

  const speakerList = Object.entries(speakerStats || {}).map(([id, s]) => ({
    id: Number(id),
    name: s.name || `Speaker ${id}`,
    talkTime: Math.round(s.talkTime || 0),
    talkPercent: 0,
    fillerCount: s.fillerCount || 0,
    sentiment: computeSentiment(s.sentiments || []),
  }));
  const totalTime = speakerList.reduce((a, s) => a + s.talkTime, 0);
  speakerList.forEach(s => { s.talkPercent = totalTime > 0 ? Math.round((s.talkTime / totalTime) * 100) : 0; });

  const tabs = [
    { id: 'copilot',    label: 'Co-pilot' },
    { id: 'transcript', label: 'Live transcript' },
    { id: 'analytics',  label: 'Analytics' },
    { id: 'geo',        label: 'Participants' },
  ];

  return (
    <div style={{
      width:           340,
      height:          '100vh',
      backgroundColor: '#FFFFFF',
      borderLeft:      '1px solid #E8EAED',
      display:         'flex',
      flexDirection:   'column',
      fontFamily:      "'Google Sans', 'Roboto', sans-serif",
      flexShrink:       0,
    }}>
      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
      `}</style>

      {/* Header */}
      <div style={{ padding: '12px 14px 0', borderBottom: '1px solid #E8EAED' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 16 }}>🤖</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#202124' }}>AI Co-pilot</span>
            {isListening && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#34A853', animation: 'pulse 1.4s infinite' }}/>
                <span style={{ fontSize: 10, color: '#34A853' }}>Live</span>
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#80868B', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding:         '7px 10px',
              background:      'none',
              border:          'none',
              borderBottom:    `2px solid ${activeTab === t.id ? '#1A73E8' : 'transparent'}`,
              color:           activeTab === t.id ? '#1A73E8' : '#5F6368',
              fontSize:        12,
              fontWeight:      activeTab === t.id ? 500 : 400,
              cursor:          'pointer',
              whiteSpace:      'nowrap',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* ── Co-pilot tab ───────────────────────────────────────────── */}
        {activeTab === 'copilot' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
            {isThinking && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12, color: '#1A73E8', fontSize: 12 }}>
                <span style={{ animation: 'pulse 1s infinite' }}>⚡</span> Analyzing conversation…
              </div>
            )}

            {lastUpdate && (
              <div style={{ fontSize: 10, color: '#9AA0A6', marginBottom: 8 }}>Updated {lastUpdate}</div>
            )}

            {insights.length === 0 && !isThinking && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#9AA0A6' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🎙</div>
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>AI insights will appear here as your conversation develops.</div>
              </div>
            )}

            {insights.map((ins, i) => <InsightCard key={i} insight={ins}/>)}

            {/* Engagement score */}
            {speakerList.length > 1 && (
              <div style={{ marginTop: 16, padding: '10px 12px', backgroundColor: '#F8F9FA', borderRadius: 8, border: '1px solid #E8EAED' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#5F6368' }}>Engagement score</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: engagementScore > 60 ? '#34A853' : '#EA4335' }}>{engagementScore}</span>
                </div>
                <div style={{ height: 4, backgroundColor: '#E8EAED', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${engagementScore}%`, height: '100%', backgroundColor: engagementScore > 60 ? '#34A853' : '#FBBC04', borderRadius: 2, transition: 'width 1s ease' }}/>
                </div>
                <div style={{ fontSize: 10, color: '#9AA0A6', marginTop: 4 }}>
                  {engagementScore > 70 ? 'Balanced conversation' : engagementScore > 40 ? 'One person dominating' : 'Very unbalanced'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Transcript tab ─────────────────────────────────────────── */}
        {activeTab === 'transcript' && (
          <div ref={transcriptRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
            {transcript.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#9AA0A6' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📝</div>
                <div style={{ fontSize: 12 }}>{isListening ? 'Listening…' : 'Transcription not active'}</div>
              </div>
            )}

            {chapters.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 500, color: '#9AA0A6', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Chapters</div>
                {chapters.map((ch, i) => <ChapterMarker key={i} chapter={ch} index={i}/>)}
                <div style={{ height: 1, backgroundColor: '#E8EAED', margin: '10px 0' }}/>
              </div>
            )}

            {transcript.map((u, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: SPEAKER_COLORS[u.speaker % SPEAKER_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 500 }}>
                    {u.speaker}
                  </div>
                  <span style={{ fontSize: 11, color: '#80868B' }}>Speaker {u.speaker}</span>
                </div>
                <div style={{ fontSize: 13, color: '#202124', lineHeight: 1.55, paddingLeft: 26 }}>
                  {u.text}
                </div>
              </div>
            ))}

            {interim && (
              <div style={{ padding: '6px 8px 6px 26px', backgroundColor: '#F8F9FA', borderRadius: 6, border: '1px dashed #DADCE0' }}>
                <span style={{ fontSize: 12, color: '#80868B', fontStyle: 'italic' }}>{interim}…</span>
              </div>
            )}
          </div>
        )}

        {/* ── Analytics tab ──────────────────────────────────────────── */}
        {activeTab === 'analytics' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
            {speakerList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#9AA0A6' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
                <div style={{ fontSize: 12 }}>Analytics will appear as people speak.</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#9AA0A6', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Talk time</div>
                {speakerList.map((s, i) => (
                  <SpeakerBar key={s.id} {...s} color={SPEAKER_COLORS[i % SPEAKER_COLORS.length]}/>
                ))}

                {/* Sentiment arc */}
                {sentimentArc.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 500, color: '#9AA0A6', textTransform: 'uppercase', letterSpacing: '.06em', margin: '14px 0 8px' }}>Sentiment arc</div>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      {sentimentArc.slice(-30).map((s, i) => (
                        <div key={i} title={s.text} style={{
                          width: 10, height: 10, borderRadius: 2,
                          backgroundColor: SENTIMENT_COLOR[s.sentiment],
                          opacity: 0.6 + (i / 30) * 0.4,
                          cursor: 'default',
                        }}/>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                      {['positive','neutral','negative'].map(s => (
                        <span key={s} style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 3, color: '#5F6368' }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: SENTIMENT_COLOR[s], display: 'inline-block' }}/>
                          {s}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Geo tab ────────────────────────────────────────────────── */}
        {activeTab === 'geo' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
            {myLocation && (
              <div style={{ padding: '10px 12px', backgroundColor: '#E8F0FE', borderRadius: 8, border: '1px solid #1A73E830', marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#1557B0', marginBottom: 4 }}>You</div>
                <div style={{ fontSize: 13, color: '#202124' }}>📍 {myLocation.city}, {myLocation.country}</div>
                <div style={{ fontSize: 11, color: '#5F6368', marginTop: 3 }}>{myLocation.timezone}</div>
              </div>
            )}

            {topCountries.length > 0 ? (
              <>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#9AA0A6', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Participants by country</div>
                {topCountries.map(({ country, count }) => (
                  <div key={country} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F3F4' }}>
                    <span style={{ fontSize: 13, color: '#202124' }}>🌍 {country}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#1A73E8' }}>{count}</span>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#9AA0A6' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🌍</div>
                <div style={{ fontSize: 12 }}>Location data will appear when participants join.</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function computeSentiment(sentiments) {
  if (!sentiments?.length) return 'neutral';
  const counts = { positive: 0, neutral: 0, negative: 0 };
  sentiments.forEach(s => { if (counts[s] !== undefined) counts[s]++; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}
