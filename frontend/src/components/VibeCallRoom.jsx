/**
 * VibeCallRoom.jsx — VibeCall with full AI layer
 *
 * Integrates:
 *   - LiveKit VideoConference (video grid + controls)
 *   - Deepgram real-time transcription (live captions)
 *   - AI co-pilot panel (Claude surfaces insights mid-call)
 *   - Talk-time + sentiment analytics (live)
 *   - Chapter auto-detection (topic shifts)
 *   - IP geo tracking (participant countries)
 *   - Post-call AI summary + email (via Claude + Resend)
 *   - Krisp noise cancellation (loaded from CDN)
 *   - Full mobile-responsive layout
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  formatChatMessageLinks,
  PreJoin,
} from '@livekit/components-react';
import '@livekit/components-styles';

import { useDeepgramTranscription } from '../hooks/useDeepgramTranscription';
import { useCallAnalytics }         from '../hooks/useCallAnalytics';
import { useAICopilot }             from '../hooks/useAICopilot';
import { useGeoTracking }           from '../hooks/useGeoTracking';
import { useSubscription }          from '../hooks/useSubscription';
import AICopilotPanel               from './AICopilotPanel';
import PostCallSummary              from './PostCallSummary';
import UpgradeModal                 from './UpgradeModal';

const LK_SERVER_URL = 'wss://vibecall-xizkbpz8.livekit.cloud';
const API_BASE      = import.meta.env.VITE_API_URL || '';

async function fetchToken(roomCode, participantName) {
  const res = await fetch(`${API_BASE}/api/livekit/token`, {
    method:      'POST',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify({ roomCode, participantName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Token error (${res.status})`);
  }
  const { token } = await res.json();
  return token;
}

// ── Lobby ─────────────────────────────────────────────────────────────────────
function Lobby({ roomCode, userName, onJoin }) {
  return (
    <div style={S.lobbyWrap}>
      <div style={S.lobbyCard}>
        <div style={S.logoRow}>
          <div style={S.logoIcon}>📹</div>
          <span style={S.logoText}>Vibe<span style={{ color:'#1A73E8', fontWeight:600 }}>Call</span></span>
        </div>
        <p style={S.lobbyRoom}>Room · <code style={S.codeChip}>{roomCode}</code></p>
        <PreJoin
          defaults={{ username: userName, videoEnabled: true, audioEnabled: true }}
          onSubmit={onJoin}
          onError={console.error}
          style={{ width: '100%' }}
        />
        <div style={S.encNote}>🔒 AES-256-GCM encrypted · VibeCall cannot access your calls</div>
      </div>
    </div>
  );
}

// ── AI control bar ────────────────────────────────────────────────────────────
function AIBar({ isListening, showCopilot, onToggleCopilot, onToggleCaptions, showCaptions, engagementScore, isThinking, isPro }) {
  return (
    <div style={S.aiBar}>
      <div style={S.aiBarLeft}>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          {isListening
            ? <><span style={S.liveDot}/><span style={{ fontSize:11, color:'#34A853' }}>AI live</span></>
            : isPro
              ? <span style={{ fontSize:11, color:'rgba(255,255,255,.4)' }}>AI ready</span>
              : <span style={{ fontSize:11, color:'#FBBC04' }}>🔒 PRO feature</span>
          }
        </div>
        {engagementScore > 0 && isPro && (
          <div style={S.engageBadge}>
            <span style={{ fontSize:10, color: engagementScore > 60 ? '#34A853' : '#FBBC04' }}>
              Engagement {engagementScore}
            </span>
          </div>
        )}
      </div>
      <div style={S.aiBarRight}>
        <button onClick={onToggleCaptions} style={{ ...S.aiBtn, ...(showCaptions && isPro ? S.aiBtnActive : {}) }}>
          {isPro ? (showCaptions ? '📝 Captions on' : '📝 Captions') : '🔒 Captions'}
        </button>
        <button onClick={onToggleCopilot} style={{ ...S.aiBtn, ...(showCopilot && isPro ? S.aiBtnActive : {}), position:'relative' }}>
          {isPro ? '🤖 Co-pilot' : '🔒 Co-pilot'}
          {isThinking && isPro && <span style={S.thinkDot}/>}
        </button>
      </div>
    </div>
  );
}

// ── Live caption bar ──────────────────────────────────────────────────────────
function CaptionBar({ interim, lastUtterance }) {
  const text = interim || lastUtterance?.text || '';
  if (!text) return null;
  return (
    <div style={S.captionBar}>
      <span style={S.captionText}>{text}{interim ? '…' : ''}</span>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function VibeCallRoom({ roomCode, userName, onLeave }) {
  const [stage,      setStage]      = useState('lobby');
  const [token,      setToken]      = useState('');
  const [error,      setError]      = useState('');
  const [userOpts,   setUserOpts]   = useState(null);
  const [showCopilot,  setShowCopilot]  = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const [callEnded,    setCallEnded]    = useState(false);

  const { isPro, requirePlan, showModal, upsellFor, closeModal } = useSubscription();

  // Only run AI hooks when user is PRO — saves API cost on free users
  const aiEnabled = stage === 'room' && isPro;
  const { processUtterance: processAnalytics, speakerStats, sentimentArc, chapters, engagementScore, getReport, reset: resetAnalytics } = useCallAnalytics();

  const { insights, isThinking, lastUpdate, onUtterance: onCopilotUtterance, tick: tickCopilot, clearInsights } = useAICopilot({ enabled: aiEnabled });

  const onUtterance = useCallback((u) => {
    processAnalytics(u);
    onCopilotUtterance(u);
  }, [processAnalytics, onCopilotUtterance]);

  const { transcript, words, interim, isListening, error: dgError, fullText, startListening, stopListening, clearTranscript } = useDeepgramTranscription({
    enabled: aiEnabled,  // only starts when PRO
    onUtterance,
  });

  const { myLocation, topCountries, registerParticipant, removeParticipant } = useGeoTracking({
    roomCode,
    participantName: userName,
    enabled: stage === 'room',
  });

  // Tick co-pilot every 30s
  useEffect(() => {
    if (stage !== 'room') return;
    const id = setInterval(tickCopilot, 30000);
    return () => clearInterval(id);
  }, [stage, tickCopilot]);

  const handlePreJoin = useCallback(async (choices) => {
    setStage('connecting');
    setUserOpts(choices);
    try {
      const t = await fetchToken(roomCode, choices.username || userName);
      setToken(t);
      setStage('room');
    } catch (err) {
      setError(err.message);
      setStage('error');
    }
  }, [roomCode, userName]);

  const handleDisconnect = useCallback(() => {
    stopListening();
    setCallEnded(true);
    setStage('summary');
  }, [stopListening]);

  // ── Stages ────────────────────────────────────────────────────────────────
  if (stage === 'error') return (
    <div style={S.errorWrap}>
      <div style={S.errorCard}>
        <div style={{ fontSize:28, marginBottom:12 }}>⚠️</div>
        <p style={S.errorTitle}>Could not connect</p>
        <p style={S.errorMsg}>{error}</p>
        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
          <button onClick={() => { setStage('lobby'); setError(''); }} style={S.btnSec}>Try again</button>
          <button onClick={onLeave} style={S.btnPri}>← Leave</button>
        </div>
      </div>
    </div>
  );

  if (stage === 'connecting') return (
    <div style={S.loadWrap}>
      <div style={S.spinner}/>
      <p style={{ color:'rgba(255,255,255,.6)', fontSize:14, marginTop:16 }}>Joining {roomCode}…</p>
    </div>
  );

  if (stage === 'lobby') return (
    <Lobby roomCode={roomCode} userName={userName} onJoin={handlePreJoin}/>
  );

  if (stage === 'summary') return (
    <PostCallSummary
      roomCode={roomCode}
      fullText={fullText}
      analyticsReport={getReport()}
      onDone={() => { resetAnalytics(); clearTranscript(); clearInsights(); onLeave(); }}
    />
  );

  // ── Live room ─────────────────────────────────────────────────────────────
  const lastUtterance = transcript[transcript.length - 1];

  return (
    <div style={S.roomShell}>
      <LiveKitRoom
        token={token}
        serverUrl={LK_SERVER_URL}
        options={{
          audioCaptureDefaults: { echoCancellation:true, noiseSuppression:true, autoGainControl:true },
          videoCaptureDefaults: { resolution:{ width:1280, height:720, frameRate:30 } },
          adaptiveStream: true,
          dynacast:       true,
        }}
        audio={userOpts?.audioEnabled ?? true}
        video={userOpts?.videoEnabled ?? true}
        onDisconnected={handleDisconnect}
        style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', height:'100vh' }}
      >
        <RoomAudioRenderer/>

        {/* AI bar — buttons gated: FREE users see lock, clicking shows upsell */}
        <AIBar
          isListening={isListening && isPro}
          showCopilot={showCopilot}
          showCaptions={showCaptions}
          isPro={isPro}
          onToggleCopilot={() => requirePlan('PRO', () => setShowCopilot(v => !v))}
          onToggleCaptions={() => requirePlan('PRO', () => setShowCaptions(v => !v))}
          engagementScore={engagementScore}
          isThinking={isThinking}
        />

        {/* Video grid */}
        <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
          <VideoConference chatMessageFormatter={formatChatMessageLinks}/>

          {/* Live captions overlay */}
          {showCaptions && <CaptionBar interim={interim} lastUtterance={lastUtterance}/>}
        </div>
      </LiveKitRoom>

      {/* AI co-pilot sidebar */}
      {showCopilot && isPro && (
        <AICopilotPanel
          transcript={transcript}
          interim={interim}
          isListening={isListening}
          insights={insights}
          isThinking={isThinking}
          lastUpdate={lastUpdate}
          speakerStats={speakerStats}
          sentimentArc={sentimentArc}
          chapters={chapters}
          engagementScore={engagementScore}
          topCountries={topCountries}
          myLocation={myLocation}
          onClose={() => setShowCopilot(false)}
        />
      )}

      {/* Upgrade modal — shown when FREE user clicks a gated feature */}
      {showModal && <UpgradeModal planKey={upsellFor} onClose={closeModal}/>}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  roomShell:   { display:'flex', height:'100vh', width:'100vw', background:'#202124', overflow:'hidden' },
  aiBar:       { height:36, background:'rgba(0,0,0,.4)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 12px', flexShrink:0 },
  aiBarLeft:   { display:'flex', alignItems:'center', gap:12 },
  aiBarRight:  { display:'flex', alignItems:'center', gap:8 },
  aiBtn:       { padding:'4px 10px', borderRadius:14, border:'1px solid rgba(255,255,255,.18)', background:'rgba(255,255,255,.06)', color:'rgba(255,255,255,.7)', fontSize:11, cursor:'pointer', position:'relative', transition:'all .15s' },
  aiBtnActive: { background:'rgba(26,115,232,.25)', borderColor:'#1A73E8', color:'#90CAF9' },
  liveDot:     { width:6, height:6, borderRadius:'50%', background:'#34A853', display:'inline-block', animation:'pulse 1.4s infinite' },
  thinkDot:    { position:'absolute', top:-3, right:-3, width:7, height:7, borderRadius:'50%', background:'#FBBC04', animation:'pulse 1s infinite' },
  engageBadge: { padding:'2px 8px', borderRadius:10, background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)' },
  captionBar:  { position:'absolute', bottom:90, left:'50%', transform:'translateX(-50%)', maxWidth:'80%', background:'rgba(0,0,0,.75)', padding:'8px 16px', borderRadius:8, zIndex:10, pointerEvents:'none' },
  captionText: { fontSize:14, color:'#FFFFFF', lineHeight:1.5, display:'block', textAlign:'center' },
  lobbyWrap:   { minHeight:'100vh', background:'#F8F9FA', display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:"'Google Sans','Roboto',sans-serif" },
  lobbyCard:   { background:'#FFFFFF', borderRadius:16, padding:'clamp(24px,5vw,44px)', width:'100%', maxWidth:520, boxShadow:'0 2px 12px rgba(0,0,0,.08)' },
  logoRow:     { display:'flex', alignItems:'center', gap:10, marginBottom:8 },
  logoIcon:    { width:36, height:36, borderRadius:9, background:'#1A73E8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 },
  logoText:    { fontSize:22, fontWeight:400, color:'#3C4043' },
  lobbyRoom:   { fontSize:14, color:'#80868B', marginBottom:24, marginTop:2 },
  codeChip:    { fontFamily:'monospace', fontSize:13, background:'#F1F3F4', padding:'2px 7px', borderRadius:5, color:'#202124' },
  encNote:     { marginTop:18, padding:'10px 14px', background:'#E8F0FE', borderRadius:8, fontSize:12, color:'#1A73E8', lineHeight:1.6 },
  loadWrap:    { height:'100vh', background:'#202124', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' },
  spinner:     { width:32, height:32, borderRadius:'50%', border:'3px solid rgba(255,255,255,.12)', borderTopColor:'#1A73E8', animation:'spin .8s linear infinite' },
  errorWrap:   { height:'100vh', background:'#202124', display:'flex', alignItems:'center', justifyContent:'center', padding:24 },
  errorCard:   { background:'rgba(234,67,53,.1)', border:'1px solid rgba(234,67,53,.3)', borderRadius:14, padding:32, maxWidth:460, textAlign:'center' },
  errorTitle:  { color:'#FFFFFF', fontSize:17, fontWeight:500, margin:'0 0 8px' },
  errorMsg:    { color:'rgba(255,255,255,.55)', fontSize:13, margin:'0 0 20px', lineHeight:1.6 },
  btnPri:      { padding:'10px 22px', borderRadius:24, border:'none', background:'#1A73E8', color:'#FFFFFF', fontSize:14, fontWeight:500, cursor:'pointer' },
  btnSec:      { padding:'10px 22px', borderRadius:24, border:'1px solid rgba(255,255,255,.2)', background:'transparent', color:'#FFFFFF', fontSize:14, cursor:'pointer' },
};

// Inject keyframes
const kf = document.createElement('style');
kf.textContent = `
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.3} }
`;
document.head.appendChild(kf);
