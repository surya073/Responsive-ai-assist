// Deterministic application step configuration.
//
// This file is the single source of truth for what the assistant asks,
// in what order, and under what conditions. The application "engine"
// (see hooks/useApplicationSession.js) reads this config to decide the
// current step, the next step, and whether a step should be skipped —
// the UI and the AI (added in a later phase) never decide this themselves.
//
// Adding a new question later = add an entry here. No engine rewrite.

export const FIELD_TYPES = {
  CHOICE: 'choice',
  CURRENCY: 'currency',
  NAME: 'name',
};

export const applicationSteps = [
  {
    id: 'finance_type',
    type: FIELD_TYPES.CHOICE,
    title: 'What would you like to finance?',
    assistantPrompt: "Let's get started. What would you like to finance today?",
    options: [
      { value: 'car', label: 'Car' },
      { value: 'motorbike', label: 'Motorbike' },
      { value: 'commercial', label: 'Commercial Loan' },
      { value: 'personal', label: 'Personal Loan' },
      { value: 'caravan', label: 'Caravan Loan' },
    ],
  },
  {
    id: 'loan_amount',
    type: FIELD_TYPES.CURRENCY,
    title: 'How much do you want to borrow?',
    assistantPrompt: 'Great choice. How much are you looking to borrow?',
    min: 2000,
    max: 200000,
    placeholder: 'e.g. 20,000',
  },
  {
    id: 'employment_status',
    type: FIELD_TYPES.CHOICE,
    title: 'Employment status',
    assistantPrompt: 'Thanks! What best describes your current employment?',
    options: [
      { value: 'full_time', label: 'Full Time Employed' },
      { value: 'part_time', label: 'Part Time Employed' },
      { value: 'casual', label: 'Casually Employed' },
      { value: 'self_employed', label: 'Self Employed' },
      { value: 'subcontractor', label: 'Subcontractor' },
      { value: 'pension', label: 'Pension / Centrelink Benefits' },
    ],
  },
  {
    id: 'credit_history',
    type: FIELD_TYPES.CHOICE,
    title: 'Credit history',
    assistantPrompt: "No worries — how would you describe your credit history?",
    options: [
      { value: 'excellent', label: 'Excellent (No Issues)' },
      { value: 'average', label: 'Average (Small Utility Default)' },
      { value: 'poor', label: 'Poor (Financial Defaults)' },
      { value: 'discharged_bankrupt', label: 'Discharged Bankrupt' },
      { value: 'part_9', label: 'Current Part 9' },
      { value: 'current_bankrupt', label: 'Current Bankrupt' },
    ],
  },
  {
    id: 'residential_status',
    type: FIELD_TYPES.CHOICE,
    title: 'Residential status',
    assistantPrompt: "Got it. What's your current residential status?",
    options: [
      { value: 'renting', label: 'Renting' },
      { value: 'boarding', label: 'Boarding' },
      { value: 'mortgage', label: 'Mortgage' },
      { value: 'own_outright', label: 'Own Outright' },
    ],
  },
  {
    id: 'citizenship_status',
    type: FIELD_TYPES.CHOICE,
    title: 'Citizenship / residency',
    assistantPrompt: 'Almost there. Which of these applies to you?',
    options: [
      { value: 'citizen', label: 'Citizen of Australia or New Zealand' },
      { value: 'permanent_resident', label: 'Permanent Resident of Australia' },
      { value: 'visa', label: 'I am on a Visa' },
    ],
  },
  {
    id: 'personal_details',
    type: FIELD_TYPES.NAME,
    title: 'Almost done, who are we speaking to?',
    assistantPrompt: 'Almost done — who am I speaking with?',
  },
  {
    id: 'visa_type',
    type: FIELD_TYPES.CHOICE,
    title: 'Visa type',
    assistantPrompt: 'What type of visa are you on?',
    options: [
      { value: 'bridging', label: 'Bridging Visa' },
      { value: 'student', label: 'Student Visa' },
      { value: 'other', label: 'Other (e.g. working, spousal)' },
    ],
    // Only relevant when citizenship_status === 'visa'
    condition: (answers) => answers.citizenship_status === 'visa',
  },
  {
    id: 'visa_expiry',
    type: FIELD_TYPES.CHOICE,
    title: 'Visa expiry',
    assistantPrompt: 'And how long is left on your visa?',
    options: [
      { value: 'over_two_years', label: 'Over two years' },
      { value: 'under_two_years', label: 'Under two years' },
    ],
    condition: (answers) => answers.citizenship_status === 'visa',
  },
];

export const getStepIndexById = (id) =>
  applicationSteps.findIndex((step) => step.id === id);

export default applicationSteps;
