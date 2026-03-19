/**
 * useAICopilot.js
 *
 * AI co-pilot that watches the live transcript and surfaces:
 *   - Contextual insights as topics are mentioned
 *   - Action items as they emerge
 *   - Document/data suggestions ("they mentioned Q3 budget → show forecast")
 *   - Real-time conversation coaching
 *
 * Calls Claude API (via your backend proxy) with rolling context window.
 * Throttled to once per 20 seconds max to control API cost.
 *
 * COST: ~$0.003 per 1K input tokens. Full 1hr call ≈ $0.08 for co-pilot.
 */

import { useState, useRef, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

// How many recent utterances to send to Claude for context
const CONTEXT_WINDOW = 15;

// Minimum seconds between Claude calls (rate limiting)
const MIN_INTERVAL_MS = 20000;

// Triggers that cause an immediate co-pilot update
const TRIGGER_KEYWORDS = [
  'budget','forecast','revenue','q1','q2','q3','q4','quarter',
  'problem','issue','stuck','confused','help',
  'decide','decision','should we','what do you think',
  'action item','follow up','next step','who will',
  'price','cost','expensive','discount','deal',
  'deadline','by when','timeline','date',
  'risk','concern','worried','challenge',
];

export function useAICopilot({ enabled = true } = {}) {
  const [insights,   setInsights]   = useState([]);  // [{type, text, ts, icon}]
  const [isThinking, setIsThinking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const lastCallRef    = useRef(0);
  const transcriptRef  = useRef([]);
  const pendingRef     = useRef(false);

  // Check if latest utterance contains trigger keywords
  const hasTrigger = useCallback((text) => {
    const lower = text.toLowerCase();
    return TRIGGER_KEYWORDS.some(kw => lower.includes(kw));
  }, []);

  // Call Claude API via your backend (keeps API key server-side)
  const callClaude = useCallback(async (recentUtterances) => {
    if (pendingRef.current) return;
    const now = Date.now();
    if (now - lastCallRef.current < MIN_INTERVAL_MS) return;

    pendingRef.current = true;
    lastCallRef.current = now;
    setIsThinking(true);

    try {
      const context = recentUtterances
        .map(u => `[Speaker ${u.speaker}]: ${u.text}`)
        .join('\n');

      const res = await fetch(`${API_BASE}/api/ai/copilot`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are a live meeting co-pilot. Analyze this conversation excerpt and return ONLY a JSON array of 1-3 insights. Each insight: { "type": "action"|"insight"|"question"|"data"|"risk", "icon": emoji, "text": "brief helpful note under 20 words" }. Be concise and specific. Focus on what's most useful RIGHT NOW.`,
            },
            {
              role: 'user',
              content: `Recent conversation:\n${context}\n\nReturn JSON array only, no other text.`,
            },
          ],
        }),
      });

      if (!res.ok) throw new Error('Co-pilot API failed');
      const data = await res.json();

      // Parse Claude's JSON response
      let parsed = [];
      try {
        const text = data.content?.[0]?.text || data.text || '';
        parsed = JSON.parse(text.replace(/```json\n?/g, '').replace(/```/g, '').trim());
      } catch {
        parsed = [{ type: 'insight', icon: '💡', text: 'Analyzing conversation context…' }];
      }

      const newInsights = parsed.map(i => ({ ...i, ts: Date.now() }));
      setInsights(prev => [...newInsights, ...prev].slice(0, 12));
      setLastUpdate(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

    } catch (err) {
      console.warn('[AI Co-pilot]', err.message);
    } finally {
      setIsThinking(false);
      pendingRef.current = false;
    }
  }, []);

  // Called with each new utterance from Deepgram
  const onUtterance = useCallback((utterance) => {
    if (!enabled) return;

    transcriptRef.current = [...transcriptRef.current, utterance].slice(-50);
    const recent = transcriptRef.current.slice(-CONTEXT_WINDOW);

    // Trigger immediately on important keywords
    if (hasTrigger(utterance.text)) {
      callClaude(recent);
    }
  }, [enabled, hasTrigger, callClaude]);

  // Periodic refresh every 30s even without triggers
  const tick = useCallback(() => {
    if (!enabled || transcriptRef.current.length < 3) return;
    const recent = transcriptRef.current.slice(-CONTEXT_WINDOW);
    callClaude(recent);
  }, [enabled, callClaude]);

  const clearInsights = useCallback(() => setInsights([]), []);

  return {
    insights,
    isThinking,
    lastUpdate,
    onUtterance,
    tick,          // call this on a 30s interval from the parent component
    clearInsights,
  };
}

// Type → color mapping for the UI
export const INSIGHT_COLORS = {
  action:  { bg: '#E6F4EA', text: '#137333', border: '#34A853' },
  insight: { bg: '#E8F0FE', text: '#1557B0', border: '#1A73E8' },
  question:{ bg: '#FEF7E0', text: '#B06000', border: '#FBBC04' },
  data:    { bg: '#F3E8FD', text: '#6B3E99', border: '#9334E6' },
  risk:    { bg: '#FCE8E6', text: '#B31412', border: '#EA4335' },
};
