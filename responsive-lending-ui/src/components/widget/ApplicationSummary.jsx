import Button from '../common/Button';
import { formatAnswerForSummary } from '../../utils/formatters';

export default function ApplicationSummary({ steps, answers, onEdit, onContinue }) {
  return (
    <div className="rl-summary">
      <h3 className="rl-summary__title">Review your application</h3>
      <p className="rl-summary__subtitle">
        Please check everything below is correct before you continue.
      </p>

      {steps.map((step) => (
        <div className="rl-summary__row" key={step.id}>
          <div className="rl-summary__row-text">
            <div className="rl-summary__label">{step.title}</div>
            <div className="rl-summary__value">
              {formatAnswerForSummary(step, answers[step.id])}
            </div>
          </div>
          <button
            type="button"
            className="rl-summary__edit-link"
            onClick={() => onEdit(step.id)}
          >
            Edit
          </button>
        </div>
      ))}

      <div className="rl-summary__actions">
        <Button variant="secondary" onClick={() => onEdit(steps[0]?.id)}>
          Edit Answers
        </Button>
        <Button variant="primary" onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
