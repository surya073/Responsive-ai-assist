import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Landmark, Volume2, VolumeX, X } from 'lucide-react';

import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import VoiceOrb from './VoiceOrb';
import QuickOptions from './QuickOptions';
import ProgressIndicator from './ProgressIndicator';
import StepFieldCard from './StepFieldCard';
import ApplicationSummary from './ApplicationSummary';
import Button from '../common/Button';

import useChat from '../../hooks/useChat';
import useApplicationSession, {
  SESSION_STAGE,
} from '../../hooks/useApplicationSession';
import useVoiceInput from '../../hooks/useVoiceInput';

import { FIELD_TYPES } from '../../config/applicationSteps';
import { submitApplicationToAWS } from '../../services/awsService';
import { speak, cancelSpeech, primeVoices } from '../../services/voiceService';
import { interpretUserSpeech } from '../../services/geminiService';

// --- Fixed, known-in-advance copy -----------------------------------
// These never depend on runtime state — same for every user, every time —
// so they're hardcoded instead of fetched or computed.
const WELCOME_GREETING =
  "Hi! I'm here to help you complete your loan application. We can do this together, step by step. You can type your answer, or tap the mic to speak.";

const SUBMITTED_THANKS =
  "Thanks — we've received your details. One of our lending specialists will be in touch shortly to discuss your options.";

// Default closing message used if the AI doesn't supply its own spokenReply
// for a decline. Kept here so the UI never has to fall back to something
// generic-sounding.
const DEFAULT_DECLINE_MESSAGE =
  "Okay, thank you for letting us know. If you need any assistance in the future, please feel free to contact us.";

// --- Local, free, instant casual-phrase detection -----------------------
// Handled entirely without AI so common greetings/thanks/bye don't cost a
// network round-trip. Anything not caught here falls through to the AI
// classifier for genuine natural-language understanding.
const CASUAL_RESPONSES = {
  greeting: [
    "Hi there! Great to hear from you.",
    "Hey! Good to have you here.",
    "Hello! Hope you're doing well.",
  ],
  howAreYou: [
    "I'm doing great, thanks for asking!",
    "I'm good, thank you! Ready to help.",
  ],
  thanks: [
    "You're very welcome!",
    "No problem at all!",
    "Happy to help!",
  ],
  bye: [
    "Take care! We can pick this up anytime.",
    "Bye for now — I'll be here when you're ready.",
  ],
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function detectCasualIntent(text) {
  const t = text.trim().toLowerCase();

  if (/^(hi|hello|hey)\b/.test(t)) return pick(CASUAL_RESPONSES.greeting);
  if (/how are you|how's it going|how you doing/.test(t)) return pick(CASUAL_RESPONSES.howAreYou);
  if (/^(thanks|thank you|cheers)\b/.test(t)) return pick(CASUAL_RESPONSES.thanks);
  if (/^(bye|goodbye|see you|that's all for now)\b/.test(t)) return pick(CASUAL_RESPONSES.bye);

  return null;
}

// Word-boundary substring match instead of raw .includes() — this stops
// short option words (e.g. "self" in "Self Employed") from false-matching
// inside unrelated words (e.g. "myself"). Escapes regex special chars in
// case an option label ever contains them.
function wordBoundaryIncludes(haystack, needle) {
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`).test(haystack);
}

export default function AssistantPanel({ onClose }) {
  const { messages, addBotMessage, addUserMessage } = useChat();
  const session = useApplicationSession();

  const bodyRef = useRef(null);
  const lastPromptedStepId = useRef(null);
  const summaryAnnounced = useRef(false);
  const handleFreeTextRef = useRef(null);

  // Hooks — must live inside the component, not at module scope.
  const autoGreeted = useRef(false);
  const submittedAnnounced = useRef(false);
  const prevSpeakingRef = useRef(false);

  const [submitting, setSubmitting] = useState(false);

  // Voice mode now starts OFF and is only ever turned on by an explicit
  // user gesture — the header toggle or the mic button in ChatInput.
  const [voiceMode, setVoiceMode] = useState(false);
  const voiceModeRef = useRef(false);

  const [speaking, setSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);

  // True once the user has declined / opted out of the application (e.g.
  // "I'm not interested"). Once set, the predefined flow stops advancing
  // and further free-text input is ignored.
  const [conversationEnded, setConversationEnded] = useState(false);

  // Speech queue: tracks which bot messages have already been spoken, and
  // a FIFO queue of ones still pending. This is what allows a two-message
  // reply (acknowledge + re-prompt) to be spoken in full, in order, instead
  // of only the last message in a batch being spoken.
  const spokenMessageIds = useRef(new Set());
  const speechQueueRef = useRef([]);
  const isProcessingQueueRef = useRef(false);

  const {
    stage,
    currentStep,
    currentIndex,
    currentStepNumber,
    totalSteps,
    answers,
    visibleSteps,
    fieldError,
    start,
    submitAnswer,
    goToPrevious,
    editStep,
    markSubmitted,
  } = session;

  const isInProgress = stage === SESSION_STAGE.IN_PROGRESS;
  const isSummary = stage === SESSION_STAGE.SUMMARY;
  const isWelcome = stage === SESSION_STAGE.WELCOME;
  const isSubmitted = stage === SESSION_STAGE.SUBMITTED;

  const isChoice = currentStep?.type === FIELD_TYPES.CHOICE;
  const isFieldCard = [FIELD_TYPES.CURRENCY, FIELD_TYPES.NAME].includes(
    currentStep?.type
  );
  const hasPrevious = currentIndex > 0;

  const handleVoiceResult = useCallback((text) => {
    if (voiceModeRef.current) stopVoiceRef.current?.();
    handleFreeTextRef.current?.(text);
  }, []);

  const {
    supported: voiceSupported,
    listening,
    interimTranscript,
    error: voiceError,
    start: startVoice,
    stop: stopVoice,
  } = useVoiceInput({
    onResult: handleVoiceResult,
    continuous: voiceMode,
    autoRestart: voiceMode,
  });

  const startVoiceRef = useRef(startVoice);
  const stopVoiceRef = useRef(stopVoice);
  useEffect(() => {
    startVoiceRef.current = startVoice;
    stopVoiceRef.current = stopVoice;
  }, [startVoice, stopVoice]);

  // --- Greet on open, text-only. Voice is never started automatically —
  // the user must explicitly tap the mic (ChatInput) or the header voice
  // toggle before any listening/speaking happens.
  useEffect(() => {
    if (!isWelcome || autoGreeted.current) return;
    autoGreeted.current = true;

    addBotMessage(WELCOME_GREETING);
  }, [isWelcome, addBotMessage]);

  useEffect(() => {
    if (!isInProgress || !currentStep?.id || conversationEnded) return;
    if (lastPromptedStepId.current === currentStep.id) return;

    lastPromptedStepId.current = currentStep.id;
    addBotMessage(currentStep.assistantPrompt);
  }, [isInProgress, currentStep, addBotMessage, conversationEnded]);

  useEffect(() => {
    if (isSummary && !summaryAnnounced.current) {
      summaryAnnounced.current = true;
      addBotMessage(
        "That's everything I need — here's a summary to check over."
      );
    }

    if (isInProgress) summaryAnnounced.current = false;
  }, [isSummary, isInProgress, addBotMessage]);

  // --- Auto thanks-you: speak the closing message once submitted.
  useEffect(() => {
    if (isSubmitted && !submittedAnnounced.current) {
      submittedAnnounced.current = true;
      addBotMessage(SUBMITTED_THANKS);
    }
  }, [isSubmitted, addBotMessage]);

  useEffect(() => {
    if (bodyRef.current)
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, stage]);

  // Pulls the next queued bot message and speaks it; when it finishes,
  // recursively processes the next one. Only once the queue is fully
  // drained does listening resume — this is what lets a two-part reply
  // (acknowledge + re-prompt) play back-to-back correctly.
  const processSpeechQueue = useCallback(() => {
    if (isProcessingQueueRef.current) return;

    const next = speechQueueRef.current.shift();

    if (!next) {
      if (voiceModeRef.current) startVoiceRef.current?.();
      return;
    }

    isProcessingQueueRef.current = true;
    stopVoiceRef.current?.();
    setThinking(false);
    setSpeaking(true);

    speak(next.text, {
      onEnd: () => {
        isProcessingQueueRef.current = false;
        setSpeaking(false);
        processSpeechQueue();
      },
      onError: () => {
        isProcessingQueueRef.current = false;
        setSpeaking(false);
        processSpeechQueue();
      },
    });
  }, []);

  useEffect(() => {
    if (!voiceMode) return;

    const newMessages = messages.filter(
      (m) => m.sender === 'bot' && !spokenMessageIds.current.has(m.id)
    );

    if (newMessages.length === 0) return;

    newMessages.forEach((m) => {
      spokenMessageIds.current.add(m.id);
      speechQueueRef.current.push(m);
    });

    processSpeechQueue();
  }, [messages, voiceMode, processSpeechQueue]);

  useEffect(() => {
    return () => cancelSpeech();
  }, []);

  // --- Auto-close voice mode once the thanks message finishes speaking.
  // Watches for the speaking:true -> false transition on the submitted
  // screen and turns voice mode off exactly once.
  useEffect(() => {
    if (isSubmitted && voiceMode && prevSpeakingRef.current && !speaking) {
      handleVoiceModeToggle();
    }
    prevSpeakingRef.current = speaking;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speaking, isSubmitted, voiceMode]);

  // --- Auto-close voice mode once the decline message finishes speaking,
  // mirroring the submitted-screen behavior above.
  useEffect(() => {
    if (conversationEnded && voiceMode && prevSpeakingRef.current && !speaking) {
      handleVoiceModeToggle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speaking, conversationEnded, voiceMode]);

  const commitAnswer = (value, label) => {
    addUserMessage(label);

    const result = submitAnswer(value);
    if (!result.valid) addBotMessage(result.error);
  };

  const handleQuickOptionSelect = (value) => {
    if (conversationEnded) return;
    const option = currentStep?.options?.find((o) => o.value === value);
    commitAnswer(value, option?.label ?? value);
  };

  const handleFieldCardSubmit = (value) => {
    if (conversationEnded) return;

    const label =
      currentStep.type === FIELD_TYPES.CURRENCY
        ? `$${value}`
        : `${value.firstName ?? ''} ${value.lastName ?? ''}`.trim();

    commitAnswer(value, label || '(no answer)');
  };

  // Re-asks the current step's question, e.g. after a small-talk detour —
  // this is queued and spoken like any other bot message.
  const rePromptCurrentStep = () => {
    if (isInProgress && currentStep && !conversationEnded) {
      addBotMessage(currentStep.assistantPrompt);
    }
  };

  // Unified AI fallback used across every field type once the fast
  // deterministic path fails (or for field types with no fast path at
  // all). Only ever proposes a value or a control signal — submitAnswer()
  // (via onAnswer) remains the sole thing that writes application state.
  const resolveWithAI = async (text, { onAnswer } = {}) => {
    setThinking(true);

    // Snapshot which step this call belongs to. If the user has moved on
    // by the time Gemini responds, the resolved answer is stale and must
    // not be written into whatever step is current now.
    const stepIdAtCallTime = currentStep.id;

    try {
      const context = {
        currentStepId: currentStep.id,
        stepType: currentStep.type,
        options: currentStep.options?.map((o) => ({
          label: o.label,
          value: o.value,
        })),
        stage,
        answers,
      };

      const result = await interpretUserSpeech(text, context);
      console.log('[AI] responseType:', result?.responseType, '| value:', result?.value);

      // Bail silently if the step has changed underneath us — the user has
      // already moved on, so this response no longer applies to anything
      // on screen.
      if (currentStep?.id !== stepIdAtCallTime) {
        console.warn('[AI] Discarding stale AI response for step', stepIdAtCallTime);
        return;
      }

      // The user has indicated they want to stop — e.g. "I'm not
      // interested in taking a loan". Acknowledge politely and stop
      // advancing through the predefined questions entirely.
      if (result?.responseType === 'decline') {
        addBotMessage(result.spokenReply || DEFAULT_DECLINE_MESSAGE);
        setConversationEnded(true);
        return;
      }

      if (result?.responseType === 'answer') {
        onAnswer?.(result.value);
        if (result.spokenReply) addBotMessage(result.spokenReply);
        return;
      }

      if (result?.responseType === 'small_talk' || result?.responseType === 'off_topic') {
        addBotMessage(result.spokenReply || 'Got it!');
        rePromptCurrentStep();
        return;
      }

      addBotMessage(
        result?.spokenReply ||
          "Sorry, I didn't quite catch that — could you try rephrasing?"
      );
    } catch (err) {
      console.error('[AI] Request failed:', err);
      if (currentStep?.id === stepIdAtCallTime) {
        addBotMessage(
          "Sorry, I'm having a little trouble understanding right now — please try again."
        );
      }
    } finally {
      if (currentStep?.id === stepIdAtCallTime) setThinking(false);
    }
  };

  const handleFreeText = (text) => {
    // Once the user has opted out, ignore further input entirely — the
    // predefined flow has ended and the UI reflects that (see render).
    if (conversationEnded) return;

    // Welcome stage: any typed or spoken input starts the application.
    // No separate "must click the button" gate — the button is just an
    // alternative for users who'd rather click than speak/type.
    if (isWelcome) {
      addUserMessage(text);
      start();
      return;
    }

    if (!currentStep) return;

    const casualReply = detectCasualIntent(text);
    if (casualReply) {
      addUserMessage(text);
      addBotMessage(casualReply);
      rePromptCurrentStep();
      return;
    }

    if (currentStep.type === FIELD_TYPES.CHOICE) {
      const normalized = text.trim().toLowerCase();

      const match = currentStep.options.find(({ label, value }) => {
        const optionLabel = label.toLowerCase();
        const optionValue = value.toLowerCase();
        const firstWord = optionLabel.split(' ')[0];

        return (
          optionLabel === normalized ||
          optionValue === normalized ||
          wordBoundaryIncludes(normalized, optionLabel) ||
          wordBoundaryIncludes(normalized, firstWord)
        );
      });

      addUserMessage(text);

      if (!match) {
        // No deterministic match — let the AI classify intent. This is
        // also where an unexpected/negative/irrelevant response (e.g.
        // "I'm not interested") gets routed to the "decline" branch
        // inside resolveWithAI, instead of silently failing validation.
        resolveWithAI(text, {
          onAnswer: (value) => {
            const option = currentStep.options?.find((o) => o.value === value);
            if (option) {
              const submitResult = submitAnswer(option.value);
              if (!submitResult.valid) addBotMessage(submitResult.error);
            } else {
              addBotMessage(
                "Sorry, I didn't quite catch that — please choose one of the options above, or try rephrasing."
              );
            }
          },
        });
        return;
      }

      const result = submitAnswer(match.value);
      if (!result.valid) addBotMessage(result.error);
      return;
    }

    if (currentStep.type === FIELD_TYPES.NAME) {
      const parts = text.trim().split(/\s+/);

      if (parts.length >= 2) {
        const [firstName, ...lastName] = parts;
        commitAnswer({ firstName, lastName: lastName.join(' ') }, text);
        return;
      }

      addUserMessage(text);
      resolveWithAI(text, {
        onAnswer: (value) => {
          if (value?.firstName && value?.lastName) {
            const result = submitAnswer(value);
            if (!result.valid) addBotMessage(result.error);
          } else {
            addBotMessage('Could you give me both your first and last name?');
          }
        },
      });
      return;
    }

    if (currentStep.type === FIELD_TYPES.CURRENCY) {
      // Fast path: plain digits (e.g. typed "40000" or "$40,000").
      const digitsOnly = text.replace(/[^0-9.]/g, '');

      if (digitsOnly && /^\d+(\.\d+)?$/.test(digitsOnly)) {
        commitAnswer(digitsOnly, `$${digitsOnly}`);
        return;
      }

      // Otherwise, spoken word-form ("forty thousand dollars") needs AI
      // to convert to a number — this also covers a plain-text reply like
      // "I don't want a loan" being classified as a decline instead of
      // failing currency validation.
      addUserMessage(text);
      resolveWithAI(text, {
        onAnswer: (value) => {
          const numeric = typeof value === 'number' ? value : Number(value);
          if (!Number.isNaN(numeric) && numeric > 0) {
            const result = submitAnswer(String(numeric));
            if (!result.valid) addBotMessage(result.error);
          } else {
            addBotMessage(
              "Sorry, could you tell me the amount in numbers, like 'forty thousand'?"
            );
          }
        },
      });
      return;
    }

    // Any other field type — route through the AI classifier instead of
    // blindly recording the raw text as the answer. This is what lets an
    // unexpected/negative/irrelevant reply on ANY field surface as
    // small_talk, off_topic, clarify, or decline rather than being
    // silently written into the application.
    addUserMessage(text);
    resolveWithAI(text, {
      onAnswer: (value) => {
        const result = submitAnswer(value ?? text);
        if (!result.valid) addBotMessage(result.error);
      },
    });
  };

  handleFreeTextRef.current = handleFreeText;

  const handleSubmitApplication = async () => {
    setSubmitting(true);

    try {
      await submitApplicationToAWS(answers);
      markSubmitted();
    } catch (err) {
      console.error('[Submit] Application submission failed:', err);
      addBotMessage(
        `I'm having trouble submitting right now (${err?.message || 'unknown error'}). You can try again, or continue using the form manually.`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoiceStart = () => {
    if (!voiceSupported || conversationEnded) return;

    // First manual voice interaction primes the speech synthesis voice
    // list — previously done on mount, now deferred to an explicit
    // user gesture.
    primeVoices();

    if (speaking) {
      cancelSpeech();
      speechQueueRef.current = [];
      isProcessingQueueRef.current = false;
      setSpeaking(false);
      startVoice();
      return;
    }

    listening ? stopVoice() : startVoice();
  };

  const handleVoiceModeToggle = () => {
    setVoiceMode((prev) => {
      const next = !prev;
      voiceModeRef.current = next;

      if (next) {
        primeVoices();
        // Mark everything except the newest bot message as already
        // spoken, so only that one gets queued — it doubles as the
        // greeting, reading aloud whatever's currently on screen.
        const botMessages = messages.filter((m) => m.sender === 'bot');
        spokenMessageIds.current = new Set(botMessages.slice(0, -1).map((m) => m.id));
        speechQueueRef.current = [];
      } else {
        cancelSpeech();
        stopVoice();
        speechQueueRef.current = [];
        isProcessingQueueRef.current = false;
        setSpeaking(false);
        setThinking(false);
      }

      return next;
    });
  };

  const handleClose = () => {
    cancelSpeech();
    stopVoice();
    onClose?.();
  };

  const assistantState = voiceError
    ? 'error'
    : thinking
      ? 'thinking'
      : speaking
        ? 'speaking'
        : listening
          ? 'listening'
          : 'idle';

  const voiceStatusLabel = {
    listening: 'Listening…',
    thinking: 'Thinking…',
    speaking: 'Speaking…',
    error: voiceError || 'Something went wrong',
    idle: 'Voice mode on',
  }[assistantState];

  return (
    <div
      className="rl-panel"
      role="dialog"
      aria-label="Responsive Lending AI Loan Assistant"
      aria-modal="false"
    >
      <header className="rl-panel__header">
        <div className="rl-panel__header-left">
          <span className="rl-panel__avatar" aria-hidden="true">
            <Landmark size={18} strokeWidth={2.3} />
          </span>

          <div className="rl-panel__titles">
            <div className="rl-panel__title">Responsive Lending</div>
            <div className="rl-panel__subtitle">AI Loan Assistant</div>
          </div>
        </div>

        <div className="rl-panel__header-right">
          <button
            type="button"
            className={`rl-panel__voice-toggle ${
              voiceMode ? 'rl-panel__voice-toggle--active' : ''
            }`}
            onClick={handleVoiceModeToggle}
            disabled={!voiceSupported || conversationEnded}
            aria-pressed={voiceMode}
            aria-label={voiceMode ? 'Turn off voice mode' : 'Turn on voice mode'}
            title={
              voiceSupported
                ? voiceMode
                  ? 'Voice mode on — tap to turn off'
                  : 'Turn on hands-free voice mode'
                : 'Voice not supported in this browser'
            }
          >
            {voiceMode ? (
              <Volume2 size={16} strokeWidth={2.3} />
            ) : (
              <VolumeX size={16} strokeWidth={2.3} />
            )}
          </button>

          <button
            type="button"
            className="rl-panel__close"
            onClick={handleClose}
            aria-label="Close chat"
          >
            <X size={16} strokeWidth={2.4} />
          </button>
        </div>
      </header>

      {voiceMode && <VoiceOrb state={assistantState} />}

      {voiceMode && (
        <div
          className={`rl-voice-status rl-voice-status--${assistantState}`}
          aria-live="polite"
        >
          <span className="rl-voice-status__indicator" aria-hidden="true">
            {assistantState === 'listening' && (
              <span className="rl-waveform">
                <span /><span /><span /><span /><span />
              </span>
            )}
            {assistantState === 'thinking' && (
              <span className="rl-thinking-dots">
                <span /><span /><span />
              </span>
            )}
            {assistantState === 'speaking' && (
              <Volume2 size={14} strokeWidth={2.3} />
            )}
            {assistantState === 'error' && (
              <AlertCircle size={14} strokeWidth={2.3} />
            )}
          </span>

          <span className="rl-voice-status__text">
            {assistantState === 'listening' && interimTranscript
              ? `"${interimTranscript}"`
              : voiceStatusLabel}
          </span>
        </div>
      )}

      {isInProgress && !conversationEnded && (
        <ProgressIndicator
          current={currentStepNumber}
          total={totalSteps}
        />
      )}

      <div
        className="rl-panel__body"
        ref={bodyRef}
        aria-live="polite"
      >
        {isWelcome && (
          <div className="rl-welcome">
            <div className="rl-welcome__header">
              <span className="rl-welcome__avatar" aria-hidden="true">
                <Landmark size={16} strokeWidth={2.3} />
              </span>

              <span className="rl-welcome__name">
                Responsive Lending Assistant
              </span>
            </div>

            <Button variant="primary" block onClick={start}>
              Start Application
            </Button>
          </div>
        )}

        {messages.map(({ id, sender, text }) => (
          <ChatMessage key={id} sender={sender} text={text} />
        ))}

        {isInProgress && isChoice && !conversationEnded && (
          <>
            <QuickOptions
              options={currentStep.options}
              onSelect={handleQuickOptionSelect}
              disabled={thinking}
            />

            {hasPrevious && (
              <div
                className="rl-quick-options"
                style={{ paddingLeft: 34 }}
              >
                <button
                  type="button"
                  className="rl-summary__edit-link"
                  onClick={goToPrevious}
                  disabled={thinking}
                >
                  ← Previous question
                </button>
              </div>
            )}
          </>
        )}

        {isInProgress && isFieldCard && !conversationEnded && (
          <StepFieldCard
            step={currentStep}
            error={fieldError}
            onSubmit={handleFieldCardSubmit}
            onBack={goToPrevious}
            showBack={hasPrevious}
            disabled={thinking}
          />
        )}

        {isSummary && (
          <ApplicationSummary
            steps={visibleSteps}
            answers={answers}
            onEdit={editStep}
            onContinue={handleSubmitApplication}
          />
        )}

        {isSubmitted && (
          <div className="rl-submitted">
            <div className="rl-submitted__icon" aria-hidden="true">
              ✓
            </div>

            <h3 className="rl-submitted__title">
              Application submitted
            </h3>
          </div>
        )}

        {conversationEnded && (
          <div className="rl-submitted">
            <div className="rl-submitted__icon" aria-hidden="true">
              👋
            </div>

            <h3 className="rl-submitted__title">
              We&apos;ll be here when you&apos;re ready
            </h3>
          </div>
        )}

        {submitting && (
          <div className="rl-system-note">
            Submitting your application…
          </div>
        )}
      </div>

      {(isWelcome || isInProgress) && !conversationEnded && (
        <ChatInput
          onSend={handleFreeText}
          onVoiceStart={handleVoiceStart}
          voiceSupported={voiceSupported}
          listening={listening}
          voiceState={assistantState}
          interimTranscript={interimTranscript}
          voiceError={voiceError}
          disabled={submitting}
          placeholder={
            listening
              ? 'Listening…'
              : isWelcome
                ? 'Type your answer, or tap the mic to speak…'
                : 'Type your answer…'
          }
        />
      )}
    </div>
  );
}