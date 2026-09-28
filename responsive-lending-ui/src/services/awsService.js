// This was Phase 1's AWS stub. The client's application-submission target
// is now Zoho Catalyst's Data Store, handled by the SAME voice-assistant-
// function that geminiService.js already calls for transcript interpretation
// (routed server-side by payload shape: {answers} vs {transcript}) — not a
// separate submit-application-function, and not AWS. The filename/export
// are left as-is deliberately, matching the original file's own comment:
// this is the single abstraction point, so nothing upstream (AssistantPanel,
// the voice engine, etc.) needs to change when the backend target changes.
// If you'd rather rename this file to catalystService.js later, just update
// the one import line in AssistantPanel.jsx accordingly.

// Deliberately the SAME env var geminiService.js uses to call this function
// — one URL, one place to update on redeploy, no risk of the two services
// drifting apart. Set this in your frontend .env, e.g.:
// REACT_APP_VOICE_ASSISTANT_URL=https://<project-domain>.zohocatalyst.com/server/voice-assistant-function
const SUBMIT_ENDPOINT = process.env.REACT_APP_VOICE_ASSISTANT_URL;

export async function submitApplicationToAWS(applicationData) {
  if (!SUBMIT_ENDPOINT) {
    // eslint-disable-next-line no-console
    console.error(
      '[awsService] REACT_APP_VOICE_ASSISTANT_URL is not set — cannot submit application.'
    );
    throw new Error('Submission endpoint is not configured.');
  }

  // The function only routes submissions on the /ai-assist path (it
  // dispatches on payload shape server-side: {answers} vs {transcript}).
  // Posting to the bare base URL has no matching route and 404s.
  const response = await fetch(`${SUBMIT_ENDPOINT}/ai-assist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: applicationData }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || errBody.message || `Application submission failed: ${response.status}`);
  }

  const data = await response.json();

  // Keep the same return shape the rest of the app already expects
  // (ok / referenceId), just backed by the real Catalyst ROWID now
  // instead of a MOCK-<timestamp> string.
  //
  // The server returns { success, message, application: insertedRow },
  // not an `applicationId` field — the row's identifier lives on
  // insertedRow.ROWID.
  return {
    ok: data.success === true,
    mock: false,
    referenceId: data.application?.ROWID,
  };
}

export default { submitApplicationToAWS };