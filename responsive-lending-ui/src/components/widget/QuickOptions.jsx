export default function QuickOptions({ options, onSelect, disabled = false }) {
  return (
    <div className="rl-quick-options" role="group" aria-label="Quick answer options">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className="rl-quick-options__btn"
          onClick={() => onSelect(opt.value)}
          disabled={disabled}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
