import { useState } from 'react';
import { Send } from 'lucide-react';
import VoiceButton from './VoiceButton';

const VOICE_ERROR_MESSAGES = {
  unsupported: "Voice input isn't supported in this browser. Try typing instead, or use Chrome.",
  'permission-denied': 'Microphone access was blocked. Please allow microphone permission and try again.',
  'no-speech': "I didn't hear anything. Try speaking again.",
  'no-mic': "I couldn't detect a microphone. Please check your device and try again.",
  network: 'Voice recognition lost its connection. Please try again.',
  unknown: 'Something went wrong with voice input. Please try again.',
};

export default function ChatInput({
  onSend,
  onVoiceStart,
  disabled = false,
  voiceSupported = false,
  listening = false,
  voiceState,
  interimTranscript = '',
  voiceError = null,
  placeholder = 'Type your answer…',
}) {
  const [value, setValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();

    const trimmed = value.trim();

    if (!trimmed || disabled) return;

    onSend(trimmed);
    setValue('');
  };

  const handleVoiceClick = () => {
    if (disabled || !voiceSupported) return;
    onVoiceStart?.();
  };

  return (
    <div>
      {voiceError && (
        <div className="rl-voice-error" role="alert">
          <span>{VOICE_ERROR_MESSAGES[voiceError] || VOICE_ERROR_MESSAGES.unknown}</span>
          <button
            type="button"
            className="rl-voice-error__retry"
            onClick={handleVoiceClick}
          >
            Try again
          </button>
        </div>
      )}

      <form className="rl-input-bar" onSubmit={handleSubmit}>
        <VoiceButton
          disabled={disabled || !voiceSupported}
          listening={listening}
          state={voiceState}
          onClick={handleVoiceClick}
        />

        <input
          type="text"
          className="rl-input-bar__field"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={
            listening
              ? interimTranscript || 'Listening…'
              : placeholder
          }
          disabled={disabled}
          aria-label="Type your answer"
        />

        <button
          type="submit"
          className="rl-input-bar__send"
          disabled={disabled || !value.trim()}
          aria-label="Send message"
        >
          <Send size={16} strokeWidth={2.3} />
        </button>
      </form>
    </div>
  );
}