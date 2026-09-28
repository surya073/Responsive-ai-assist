// PHASE 1 STUB.
// Will eventually call Catalyst Functions (createApplicationSession /
// getApplicationSession / updateApplicationSession / submitApplication)
// backed by Catalyst Data Store. For Phase 1 the session lives purely
// in React state (see hooks/useApplicationSession.js) so this module
// just defines the shape the real calls will use.

let mockSessionCounter = 0;

export async function createApplicationSession() {
  mockSessionCounter += 1;
  return {
    sessionId: `mock-session-${mockSessionCounter}`,
    status: 'in_progress',
    createdAt: new Date().toISOString(),
  };
}

export async function updateApplicationSession(sessionId, patch) {
  return { sessionId, ...patch, updatedAt: new Date().toISOString() };
}

export async function submitApplication(sessionId, applicationData) {
  return {
    sessionId,
    status: 'submitted',
    submittedAt: new Date().toISOString(),
    applicationData,
  };
}

export default { createApplicationSession, updateApplicationSession, submitApplication };
