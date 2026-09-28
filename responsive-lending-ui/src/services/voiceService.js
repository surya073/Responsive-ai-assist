'use strict';

const ASSISTANT_FUNCTION_URL = process.env.REACT_APP_VOICE_ASSISTANT_URL;

function buildUrl(path) {
  const base = (ASSISTANT_FUNCTION_URL || '').replace(/\/+$/, '');
  return `${base}${path}`;
}

export const VOICE_PROFILE = {
  languageCode: 'en-IN',
};

export function isSpeechRecognitionSupported() {
  return (
    typeof window !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window.MediaRecorder !== 'undefined'
  );
}

export function isSpeechSynthesisSupported() {
  return typeof window !== 'undefined' && typeof Audio !== 'undefined';
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function transcribeAudio(blob) {
  if (!ASSISTANT_FUNCTION_URL) throw new Error('Assistant function URL is not configured.');

  const audio = await blobToBase64(blob);
  const ext = (blob.type.split('/')[1] || 'webm').split(';')[0];

  const response = await fetch(buildUrl('/stt'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio, fileName: `recording.${ext}` }),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    console.error('[STT] Function returned non-OK status:', response.status, bodyText);
    throw new Error(`STT function error: ${response.status}`);
  }

  const data = await response.json();
  return data.transcript || '';
}

let currentAudio = null;

export async function speak(text, { languageCode = VOICE_PROFILE.languageCode, onStart, onEnd, onError } = {}) {
  if (!text || !ASSISTANT_FUNCTION_URL) {
    onError?.('unsupported');
    return null;
  }

  cancelSpeech();

  try {
    const response = await fetch(buildUrl('/tts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, languageCode }),
    });

    if (!response.ok) {
      throw new Error(`TTS function error: ${response.status}`);
    }

    const data = await response.json();
    const audioBase64 = data?.audios?.[0];
    if (!data.success || !audioBase64) {
      throw new Error('TTS function returned no audio');
    }

    const byteChars = atob(audioBase64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    currentAudio = audio;
    onStart?.();

    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      onEnd?.();
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      onError?.('playback_error');
    };

    await audio.play();
    return audio;
  } catch (err) {
    console.error('[TTS] speak error:', err.message || err);
    onError?.(err.message || 'tts_error');
    return null;
  }
}

export function cancelSpeech() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

export function primeVoices() {}

export default {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  transcribeAudio,
  speak,
  cancelSpeech,
  primeVoices,
  VOICE_PROFILE,
};