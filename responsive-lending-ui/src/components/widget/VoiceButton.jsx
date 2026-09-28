import { Mic, Volume2, AlertCircle } from 'lucide-react';

export const VOICE_BUTTON_STATE = {
  IDLE: 'idle',
  LISTENING: 'listening',
  THINKING: 'thinking',
  SPEAKING: 'speaking',
  ERROR: 'error',
};

export default function VoiceButton({
  disabled = true,
  listening = false,
  state,
  onClick,
}) {
  const resolvedState =
    state ?? (listening ? VOICE_BUTTON_STATE.LISTENING : VOICE_BUTTON_STATE.IDLE);

  const stateConfig = {
    [VOICE_BUTTON_STATE.IDLE]: {
      icon: Mic,
      label: disabled ? 'Voice input — coming soon' : 'Start voice input',
      title: disabled ? 'Voice input coming soon' : 'Speak your answer',
    },
    [VOICE_BUTTON_STATE.LISTENING]: {
      icon: Mic,
      label: 'Listening — tap to stop',
      title: 'Listening…',
    },
    [VOICE_BUTTON_STATE.THINKING]: {
      icon: null,
      label: 'Thinking…',
      title: 'Thinking…',
    },
    [VOICE_BUTTON_STATE.SPEAKING]: {
      icon: Volume2,
      label: 'Speaking — tap to interrupt',
      title: 'Speaking…',
    },
    [VOICE_BUTTON_STATE.ERROR]: {
      icon: AlertCircle,
      label: 'Voice error — tap to retry',
      title: 'Something went wrong',
    },
  }[resolvedState];

  const Icon = stateConfig.icon;

  return (
    <button
      type="button"
      className={`rl-input-bar__mic rl-input-bar__mic--${resolvedState}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={stateConfig.label}
      title={stateConfig.title}
    >
      {resolvedState === VOICE_BUTTON_STATE.THINKING ? (
        <span className="rl-thinking-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      ) : (
        <Icon size={17} strokeWidth={2.2} />
      )}
    </button>
  );
}