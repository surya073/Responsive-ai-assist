export function formatCurrency(amount) {
  if (amount === null || amount === undefined || amount === '') return '';
  const n = Number(amount);
  if (Number.isNaN(n)) return '';
  return `$${n.toLocaleString('en-AU')}`;
}

export function formatAnswerForSummary(step, value) {
  if (value === null || value === undefined) return '—';
  switch (step.type) {
    case 'currency':
      return formatCurrency(value);
    case 'choice': {
      const match = step.options.find((opt) => opt.value === value);
      return match ? match.label : String(value);
    }
    case 'name':
      return `${value.firstName} ${value.lastName}`;
    default:
      return String(value);
  }
}
