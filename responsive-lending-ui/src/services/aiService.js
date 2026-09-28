// PHASE 1 STUB.
// In a later phase this will call a Catalyst Function (never the AI API
// directly from the browser) which in turn calls the AI provider and
// returns a structured { message, field, value, confidence,
// needsClarification } payload as described in the build spec.
//
// For now it just resolves so the rest of the app can be wired against
// a stable interface.

export async function interpretUserMessage({ currentStep }) {
  return {
    message: '',
    field: currentStep?.id ?? null,
    value: null,
    confidence: 0,
    needsClarification: false,
    _mock: true,
  };
}

export default { interpretUserMessage };
