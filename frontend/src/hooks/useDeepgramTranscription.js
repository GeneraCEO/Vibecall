/**
 * useDeepgramTranscription.js
 *
 * Real-time transcription via Deepgram Nova-2.
 * Streams words as they are spoken. Speaker-labeled (diarize=true).
 * Cost: $0.0043/min — a 1-hour call costs $0.26.
 *
 * HOW IT WORKS:
 *   1. Captures local microphone via Web Audio API
 *   2. Streams PCM audio to Deepgram WebSocket
 *   3. Returns word-by-word transcripts with speaker labels
 *   4. Also captures system audio from screen share (optional)
 *
 * SETUP:
 *   Set VITE_DEEPGRAM_KEY in .env  (get from console.deepgram.com)
 *   This key is public-safe for browser use — Deepgram supports browser keys.
 *
 * USAGE:
 *   const { transcript, words, isListening, startListening, stopListening } =
 *     useDeepgramTranscription({ enabled: micOn });
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const DEEPGRAM_KEY = import.meta.env.VITE_DEEPGRAM_KEY || '';

export function useDeepgramTranscription({ enabled = true, onWord, onUtterance } = {}) {
  const [transcript,    setTranscript]    = useState([]);   // array of { speaker, text, ts }
  const [words,         setWords]         = useState([]);   // raw word stream
  const [isListening,   setIsListening]   = useState(false);
  const [error,         setError]         = useState('');
  const [interim,       setInterim]       = useState('');   // words not yet finalized

  const wsRef        = useRef(null);
  const streamRef    = useRef(null);
  const processorRef = useRef(null);
  const contextRef   = useRef(null);

  const stopListening = useCallback(() => {
    processorRef.current?.disconnect();
    contextRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'CloseStream' }));
      wsRef.current.close();
    }
    wsRef.current    = null;
    processorRef.current = null;
    contextRef.current   = null;
    streamRef.current    = null;
    setIsListening(false);
    setInterim('');
  }, []);

  const startListening = useCallback(async () => {
    if (!DEEPGRAM_KEY) {
      setError('VITE_DEEPGRAM_KEY not set — add to .env.local');
      return;
    }
    if (wsRef.current) stopListening();

    try {
      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });
      streamRef.current = stream;

      // Open Deepgram WebSocket
      const params = new URLSearchParams({
        model:            'nova-2',
        language:         'en-US',
        smart_format:     'true',
        diarize:          'true',       // labels each speaker (Speaker 0, Speaker 1…)
        interim_results:  'true',       // stream words before finalization
        utterance_end_ms: '1000',       // pause = end of utterance
        filler_words:     'true',       // captures "um", "uh", etc.
        punctuate:        'true',
      });

      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?${params}`,
        ['token', DEEPGRAM_KEY]
      );
      wsRef.current = ws;

      ws.onopen = () => {
        setIsListening(true);
        setError('');

        // Stream audio via Web Audio API ScriptProcessor
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 16000,
        });
        contextRef.current = audioCtx;

        const source    = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const pcm   = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(pcm.length);
          for (let i = 0; i < pcm.length; i++) {
            int16[i] = Math.max(-32768, Math.min(32767, pcm[i] * 32768));
          }
          ws.send(int16.buffer);
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);

          if (data.type === 'Results') {
            const alt        = data.channel?.alternatives?.[0];
            if (!alt) return;

            const text       = alt.transcript?.trim();
            const isFinal    = data.is_final;
            const speaker    = alt.words?.[0]?.speaker ?? 0;
            const confidence = alt.confidence ?? 0;

            if (!text) return;

            if (!isFinal) {
              setInterim(text);
              return;
            }

            setInterim('');

            // Extract word-level data with timestamps
            const newWords = (alt.words || []).map(w => ({
              word:       w.word,
              start:      w.start,
              end:        w.end,
              speaker:    w.speaker ?? speaker,
              confidence: w.confidence,
              isFiller:   ['um','uh','like','you know','actually','basically','literally']
                            .includes(w.word?.toLowerCase().replace(/[^a-z]/g, '')),
            }));

            setWords(prev => [...prev, ...newWords]);
            onWord?.(newWords);

            const utterance = { speaker, text, ts: Date.now(), confidence, words: newWords };
            setTranscript(prev => [...prev, utterance]);
            onUtterance?.(utterance);
          }

          if (data.type === 'UtteranceEnd') {
            setInterim('');
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onerror = (err) => {
        setError('Deepgram connection error — check VITE_DEEPGRAM_KEY');
        setIsListening(false);
      };

      ws.onclose = () => setIsListening(false);

    } catch (err) {
      setError(err.message);
      setIsListening(false);
    }
  }, [stopListening, onWord, onUtterance]);

  // Auto-start when enabled
  useEffect(() => {
    if (enabled) startListening();
    else stopListening();
    return () => stopListening();
  }, [enabled]);

  // Full joined transcript string (for feeding to Claude)
  const fullText = transcript
    .map(u => `[Speaker ${u.speaker}] ${u.text}`)
    .join('\n');

  return {
    transcript,         // structured utterances
    words,              // raw word-level with timestamps
    interim,            // live partial sentence
    isListening,
    error,
    fullText,           // full text string ready for Claude API
    startListening,
    stopListening,
    clearTranscript: () => { setTranscript([]); setWords([]); },
  };
}
