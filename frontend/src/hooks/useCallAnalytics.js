/**
 * useCallAnalytics.js
 *
 * Computes in real-time:
 *   - Talk time per speaker (seconds)
 *   - Sentiment arc (positive / neutral / negative per utterance)
 *   - Filler word count per speaker ("um", "uh", "like", "you know"…)
 *   - Engagement score (0–100, based on talk balance + response speed)
 *   - Topic detection (simple keyword clusters)
 *   - Chapter markers (when topic shifts)
 *
 * All runs in the browser — no API calls for analytics.
 * Sentiment uses a lightweight AFINN-style word list (no model needed).
 */

import { useState, useCallback, useRef } from 'react';

// Lightweight sentiment word list (AFINN-111 subset)
const POSITIVE = new Set(['great','good','excellent','perfect','love','amazing','wonderful',
  'fantastic','brilliant','awesome','agree','yes','absolutely','definitely','happy','glad',
  'excited','impressive','right','correct','exactly','sure','best','clear','easy','smooth']);

const NEGATIVE = new Set(['bad','terrible','awful','wrong','no','never','problem','issue',
  'difficult','hard','confused','unclear','disagree','concern','worried','stuck','broken',
  'failed','error','bug','slow','expensive','complicated','unfortunately','sorry','miss']);

// Topic keyword clusters — expand these for your use case
const TOPIC_CLUSTERS = {
  'budget & finance':   ['budget','cost','price','revenue','expense','money','financial','forecast','invest','spend','roi'],
  'product & roadmap':  ['feature','roadmap','product','build','ship','release','sprint','design','ux','api','integration'],
  'sales & pipeline':   ['deal','close','prospect','lead','customer','client','contract','proposal','demo','trial','onboard'],
  'hiring & team':      ['hire','team','candidate','interview','headcount','role','engineer','manager','culture','onboarding'],
  'technical & infra':  ['deploy','server','database','bug','performance','security','infrastructure','cloud','scaling','latency'],
  'strategy & goals':   ['goal','okr','kpi','strategy','quarter','q1','q2','q3','q4','target','metric','objective'],
};

function getSentiment(text) {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
  let score = 0;
  for (const w of words) {
    if (POSITIVE.has(w)) score++;
    if (NEGATIVE.has(w)) score--;
  }
  if (score > 0)  return 'positive';
  if (score < 0)  return 'negative';
  return 'neutral';
}

function detectTopics(text) {
  const lower = text.toLowerCase();
  const found = [];
  for (const [topic, keywords] of Object.entries(TOPIC_CLUSTERS)) {
    if (keywords.some(kw => lower.includes(kw))) found.push(topic);
  }
  return found;
}

export function useCallAnalytics() {
  const [speakerStats, setSpeakerStats] = useState({});
  // { 0: { talkTime: 420, fillerCount: 8, sentiments: ['positive','neutral'], utteranceCount: 14 } }

  const [sentimentArc,  setSentimentArc]  = useState([]);  // [{ ts, sentiment, speaker }]
  const [chapters,      setChapters]      = useState([]);  // [{ ts, title, startIndex }]
  const [topicHistory,  setTopicHistory]  = useState([]);  // [{ ts, topics }]
  const [engagementScore, setEngagementScore] = useState(100);

  const lastTopicsRef     = useRef([]);
  const utteranceCountRef = useRef(0);

  // Called for every finalized utterance from Deepgram
  const processUtterance = useCallback((utterance) => {
    const { speaker, text, ts, words = [] } = utterance;
    utteranceCountRef.current++;

    // Calculate talk time from word timestamps
    const talkSeconds = words.length > 0
      ? (words[words.length - 1].end - words[0].start)
      : (text.split(' ').length * 0.4); // estimate if no timestamps

    const fillers = words.filter(w => w.isFiller).length;
    const sentiment = getSentiment(text);
    const topics    = detectTopics(text);

    // Update speaker stats
    setSpeakerStats(prev => {
      const existing = prev[speaker] || { talkTime: 0, fillerCount: 0, sentiments: [], utteranceCount: 0, name: `Speaker ${speaker}` };
      return {
        ...prev,
        [speaker]: {
          ...existing,
          talkTime:       existing.talkTime + talkSeconds,
          fillerCount:    existing.fillerCount + fillers,
          sentiments:     [...existing.sentiments, sentiment],
          utteranceCount: existing.utteranceCount + 1,
        },
      };
    });

    // Sentiment arc
    setSentimentArc(prev => [...prev, { ts, sentiment, speaker, text: text.slice(0, 60) }]);

    // Chapter detection — topic shift = new chapter
    if (topics.length > 0) {
      const newTopics = topics.filter(t => !lastTopicsRef.current.includes(t));
      if (newTopics.length > 0) {
        const topicName = newTopics[0];
        setChapters(prev => {
          const last = prev[prev.length - 1];
          if (!last || last.title !== topicName) {
            return [...prev, {
              ts,
              title:       topicName,
              startIndex:  utteranceCountRef.current - 1,
            }];
          }
          return prev;
        });
        lastTopicsRef.current = topics;
      }
    }

    // Track topics
    if (topics.length > 0) {
      setTopicHistory(prev => [...prev, { ts, topics }]);
    }

    // Engagement score = how balanced talk time is (0=one person talks, 100=equal)
    setSpeakerStats(stats => {
      const times = Object.values(stats).map(s => s.talkTime + talkSeconds);
      if (times.length < 2) return stats;
      const total = times.reduce((a, b) => a + b, 0);
      const ideal = total / times.length;
      const variance = times.reduce((a, t) => a + Math.pow(t - ideal, 2), 0) / times.length;
      const imbalance = Math.sqrt(variance) / (ideal || 1);
      setEngagementScore(Math.max(10, Math.round(100 - imbalance * 50)));
      return stats;
    });

  }, []);

  // Compute derived stats
  const getReport = useCallback(() => {
    const speakers = Object.entries(speakerStats);
    const totalTime = speakers.reduce((a, [, s]) => a + s.talkTime, 0);

    return {
      speakers: speakers.map(([id, s]) => ({
        id:           Number(id),
        name:         s.name,
        talkTime:     Math.round(s.talkTime),
        talkPercent:  totalTime > 0 ? Math.round((s.talkTime / totalTime) * 100) : 0,
        fillerCount:  s.fillerCount,
        fillerRate:   s.utteranceCount > 0 ? +(s.fillerCount / s.utteranceCount).toFixed(1) : 0,
        sentiment:    computeOverallSentiment(s.sentiments),
        utterances:   s.utteranceCount,
      })),
      totalDuration:  Math.round(totalTime),
      engagementScore,
      chapters,
      sentimentArc,
      dominantSentiment: computeOverallSentiment(sentimentArc.map(s => s.sentiment)),
    };
  }, [speakerStats, engagementScore, chapters, sentimentArc]);

  return {
    speakerStats,
    sentimentArc,
    chapters,
    topicHistory,
    engagementScore,
    processUtterance,
    getReport,
    reset: () => {
      setSpeakerStats({});
      setSentimentArc([]);
      setChapters([]);
      setTopicHistory([]);
      setEngagementScore(100);
      utteranceCountRef.current = 0;
      lastTopicsRef.current = [];
    },
  };
}

function computeOverallSentiment(sentiments) {
  if (!sentiments?.length) return 'neutral';
  const counts = { positive: 0, neutral: 0, negative: 0 };
  sentiments.forEach(s => { if (counts[s] !== undefined) counts[s]++; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}
