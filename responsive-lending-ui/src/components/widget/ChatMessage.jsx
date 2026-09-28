import { Landmark, User } from 'lucide-react';

export default function ChatMessage({ sender, text }) {
  const isBot = sender === 'bot';
  return (
    <div className={`rl-message rl-message--${sender}`}>
      {isBot && (
        <span className="rl-message__avatar" aria-hidden="true">
          <Landmark size={13} strokeWidth={2.4} />
        </span>
      )}
      <div className="rl-message__bubble" role={isBot ? 'status' : undefined}>
        {text}
      </div>
      {!isBot && (
        <span className="rl-message__avatar" aria-hidden="true">
          <User size={13} strokeWidth={2.4} />
        </span>
      )}
    </div>
  );
}
