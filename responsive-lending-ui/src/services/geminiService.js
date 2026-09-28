const ASSISTANT_FUNCTION_URL = process.env.REACT_APP_VOICE_ASSISTANT_URL;

function buildUrl(path) {
  const base = (ASSISTANT_FUNCTION_URL || '').replace(/\/+$/, '');
  return `${base}${path}`;
}

export async function interpretUserSpeech(transcript, context) {
  console.log('[AI] interpretUserSpeech called');
  console.log('[AI] transcript:', transcript);
  console.log('[AI] context:', context);

  if (!ASSISTANT_FUNCTION_URL) {
    console.error('[AI] REACT_APP_VOICE_ASSISTANT_URL is not set at build time.');
    throw new Error('Assistant function URL is not configured.');
  }

  const url = buildUrl('/ai-assist');
  console.log('[AI] Calling Catalyst function:', url);

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript, context }),
    });
  } catch (networkErr) {
    console.error('[AI] Network-level fetch failure (often CORS):', networkErr);
    throw networkErr;
  }

  console.log('[AI] Response status:', response.status);

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '(could not read body)');
    console.error('[AI] Function returned non-OK status. Body:', bodyText);
    throw new Error(`Assistant function error: ${response.status}`);
  }

  const data = await response.json();
  console.log('[AI] Parsed response from function:', data);

  // The server wraps the actual AI result under `response`:
  // { success, response: { responseType, value, spokenReply } }.
  // AssistantPanel.jsx expects the { responseType, value, spokenReply }
  // shape directly — returning the outer envelope made every field on it
  // undefined, so it always fell through to the generic fallback message.
  if (!data?.success || !data?.response) {
    console.error('[AI] Unexpected response shape from function:', data);
    throw new Error(data?.error || 'Assistant returned an unexpected response.');
  }

  return data.response;
}

export default { interpretUserSpeech };