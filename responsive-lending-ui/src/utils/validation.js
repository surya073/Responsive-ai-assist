import { FIELD_TYPES } from '../config/applicationSteps';

// Every validator returns { valid: boolean, error?: string, value? }
// so the engine can both reject bad input and normalise good input
// (e.g. strip commas from a loan amount) in one pass.

export function validateChoice(step, rawValue) {
  const match = step.options.find((opt) => opt.value === rawValue);
  if (!match) {
    return { valid: false, error: 'Please choose one of the options shown.' };
  }
  return { valid: true, value: match.value };
}

export function validateCurrency(step, rawValue) {
  const cleaned = String(rawValue ?? '').replace(/[,$\s]/g, '');
  if (cleaned === '' || Number.isNaN(Number(cleaned))) {
    return { valid: false, error: 'Please enter a whole number, e.g. 20000.' };
  }
  const amount = Number(cleaned);
  if (!Number.isInteger(amount)) {
    return { valid: false, error: 'Please enter a whole dollar amount.' };
  }
  if (step.min && amount < step.min) {
    return { valid: false, error: `The minimum amount is $${step.min.toLocaleString()}.` };
  }
  if (step.max && amount > step.max) {
    return { valid: false, error: `The maximum amount is $${step.max.toLocaleString()}.` };
  }
  return { valid: true, value: amount };
}

export function validateName(step, rawValue) {
  const firstName = (rawValue?.firstName ?? '').trim();
  const lastName = (rawValue?.lastName ?? '').trim();
  if (!firstName || !lastName) {
    return { valid: false, error: 'Please enter both your first and last name.' };
  }
  return { valid: true, value: { firstName, lastName } };
}

export function validateStepValue(step, rawValue) {
  switch (step.type) {
    case FIELD_TYPES.CHOICE:
      return validateChoice(step, rawValue);
    case FIELD_TYPES.CURRENCY:
      return validateCurrency(step, rawValue);
    case FIELD_TYPES.NAME:
      return validateName(step, rawValue);
    default:
      return { valid: false, error: 'Unsupported field type.' };
  }
}
