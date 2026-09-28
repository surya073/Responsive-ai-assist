export default function ProgressIndicator({ current, total }) {
  if (!total) return null;

  return (
    <div className="rl-progress">
      <div className="rl-progress__label">
        Step {current} of {total}
      </div>
      <div
        className="rl-progress__track"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-label={`Application progress: step ${current} of ${total}`}
      >
        {Array.from({ length: total }).map((_, i) => {
          const stepNumber = i + 1;
          let state = '';
          if (stepNumber < current) state = 'rl-progress__segment--complete';
          else if (stepNumber === current) state = 'rl-progress__segment--current';
          return (
            <div key={stepNumber} className={`rl-progress__segment ${state}`}>
              <div className="rl-progress__segment-fill" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
