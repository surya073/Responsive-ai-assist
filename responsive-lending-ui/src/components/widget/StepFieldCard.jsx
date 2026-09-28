import { useState } from 'react';
import Button from '../common/Button';

export default function StepFieldCard({ step, error, onSubmit, onBack, showBack }) {
  const [amount, setAmount] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (step.type === 'currency') {
      onSubmit(amount);
    } else if (step.type === 'name') {
      onSubmit({ firstName, lastName });
    }
  };

  return (
    <form className="rl-field-card" onSubmit={handleSubmit}>
      {step.type === 'currency' && (
        <div className="rl-field-card__input-wrap">
          <span className="rl-field-card__prefix">$</span>
          <input
            type="text"
            inputMode="numeric"
            className="rl-has-prefix"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={step.placeholder}
            aria-label="Loan amount in dollars"
            autoFocus
          />
        </div>
      )}

      {step.type === 'name' && (
        <>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Your First Name"
            aria-label="First name"
            autoFocus
          />
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Your Last Name"
            aria-label="Last name"
          />
        </>
      )}

      {error && (
        <div className="rl-field-card__error" role="alert">
          {error}
        </div>
      )}

      <div className="rl-field-card__actions">
        {showBack && (
          <Button type="button" variant="secondary" onClick={onBack}>
            Previous
          </Button>
        )}
        <Button type="submit" variant="primary" block={!showBack}>
          Next
        </Button>
      </div>
    </form>
  );
}
