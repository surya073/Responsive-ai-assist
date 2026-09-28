import { Sparkles } from 'lucide-react';

export default function AssistantLauncher({ onOpen }) {
  return (
    <button
      type="button"
      className="rl-launcher"
      onClick={onOpen}
      aria-label="Open the Responsive Lending AI Loan Assistant"
    >
      <span className="rl-launcher__glow" aria-hidden="true" />

      <span className="rl-launcher__icon-wrap" aria-hidden="true">
        <Sparkles size={18} strokeWidth={2.3} />
      </span>

      <span className="rl-launcher__label">Loan Assist</span>
    </button>
  );
}