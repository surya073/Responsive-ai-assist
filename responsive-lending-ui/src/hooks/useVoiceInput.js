import { useCallback, useEffect, useRef, useState } from 'react';
import { transcribeAudio } from '../services/voiceService';

const SILENCE_THRESHOLD = 0.02; // RMS amplitude below this counts as silence
const SILENCE_MS_TO_STOP = 1200; // how long silence has to persist before we auto-stop
const MAX_UTTERANCE_MS = 15000; // hard cap so a stuck mic doesn't record forever

function pickMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return candidates.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || '';
}

export default function useVoiceInput({ onResult, continuous = false, autoRestart = false } = {}) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const maxTimerRef = useRef(null);
  const stoppedManuallyRef = useRef(false);
  const autoRestartRef = useRef(autoRestart);
  autoRestartRef.current = autoRestart;

  const supported =
    typeof window !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window.MediaRecorder !== 'undefined';

  const clearTimers = () => {
    clearTimeout(silenceTimerRef.current);
    clearTimeout(maxTimerRef.current);
  };

  const teardownStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  };

  const finishRecording = useCallback(() => {
    clearTimers();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  }, []);

  const start = useCallback(async () => {
    if (!supported || listening) return;

    stoppedManuallyRef.current = false;
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        teardownStream();
        setListening(false);

        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        chunksRef.current = [];

        if (blob.size < 500) return; // too short to be real speech, skip round-trip

        try {
          const transcript = await transcribeAudio(blob);
          if (transcript.trim()) onResult?.(transcript.trim());
        } catch (err) {
          console.error('[useVoiceInput] transcribe failed:', err);
          setError('Could not understand audio — please try again.');
        } finally {
          if (autoRestartRef.current && !stoppedManuallyRef.current) start();
        }
      };

      // --- Silence detection via RMS on the raw waveform ---
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const data = new Float32Array(analyser.fftSize);

      const checkSilence = () => {
        if (!recorderRef.current || recorderRef.current.state !== 'recording') return;
        analyser.getFloatTimeDomainData(data);
        const rms = Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);

        if (rms < SILENCE_THRESHOLD) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(finishRecording, SILENCE_MS_TO_STOP);
          }
        } else {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        if (recorderRef.current?.state === 'recording') {
          requestAnimationFrame(checkSilence);
        }
      };

      recorder.start();
      setListening(true);
      requestAnimationFrame(checkSilence);
      maxTimerRef.current = setTimeout(finishRecording, MAX_UTTERANCE_MS);
    } catch (err) {
      console.error('[useVoiceInput] mic access failed:', err);
      setError('Microphone access denied or unavailable.');
      setListening(false);
    }
  }, [supported, listening, onResult, finishRecording]);

  const stop = useCallback(() => {
    stoppedManuallyRef.current = true;
    finishRecording();
  }, [finishRecording]);

  useEffect(() => () => {
    clearTimers();
    teardownStream();
  }, []);

  return {
    supported,
    listening,
    interimTranscript: '', // Sarvam STT here is batch, not streaming — no interim text to show
    error,
    start,
    stop,
  };
}