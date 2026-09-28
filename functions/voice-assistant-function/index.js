const express = require('express');
const catalyst = require('zcatalyst-sdk-node');
const { GoogleGenAI } = require('@google/genai');

const app = express();

app.use(express.json({ limit: '15mb' }));

// -----------------------------------------------------------------------------
// CONFIG
// -----------------------------------------------------------------------------

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// NOTE: verify this is a real, currently-available model id in Google AI
// Studio / the Gemini API docs. "gemini-3.6-flash" is not a model id we
// recognize — if it doesn't exist, generateContent will 404/400 even with
// the SDK call fixed below.
const GEMINI_MODEL = 'gemini-3.6-flash';

const SARVAM_API_KEY = process.env.SARVAM_API_KEY;

const SARVAM_STT_URL = 'https://api.sarvam.ai/speech-to-text';
const SARVAM_TTS_URL = 'https://api.sarvam.ai/text-to-speech';

const SARVAM_STT_MODEL = 'saarika:v2.5';
const SARVAM_TTS_MODEL = 'bulbul:v3';

const SARVAM_TTS_SPEAKER = 'priya';
const SARVAM_LANGUAGE = 'en-IN';

const ai = GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: GEMINI_API_KEY,
    })
  : null;

// -----------------------------------------------------------------------------
// RESPONSE TYPES
// -----------------------------------------------------------------------------

const VALID_RESPONSE_TYPES = [
  'answer',
  'loan_question',
  'objection',
  'small_talk',
  'clarify',
  'off_topic',
  'decline',
];

// -----------------------------------------------------------------------------
// HEALTH CHECK
// -----------------------------------------------------------------------------

app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'Responsive Lending AI Assistant',
    status: 'running',
  });
});

// -----------------------------------------------------------------------------
// SPEECH TO TEXT
// -----------------------------------------------------------------------------

app.post('/stt', async (req, res) => {
  try {
    const { audio, fileName = 'audio.webm' } = req.body;

    if (!audio) {
      return res.status(400).json({
        success: false,
        error: 'Audio data is required',
      });
    }

    if (!SARVAM_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Sarvam API key is not configured',
      });
    }

    const audioBuffer = Buffer.from(audio, 'base64');

    const formData = new FormData();

    const blob = new Blob([audioBuffer], {
      type: 'audio/webm',
    });

    formData.append(
      'file',
      blob,
      fileName
    );

    formData.append(
      'model',
      SARVAM_STT_MODEL
    );

    const response = await fetch(SARVAM_STT_URL, {
      method: 'POST',
      headers: {
        'api-subscription-key': SARVAM_API_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error('Sarvam STT error:', errorText);

      return res.status(response.status).json({
        success: false,
        error: 'Speech recognition failed',
        details: errorText,
      });
    }

    const result = await response.json();

    const transcript =
      result.transcript ||
      result.text ||
      '';

    return res.json({
      success: true,
      transcript: transcript.trim(),
    });
  } catch (error) {
    console.error('STT error:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to process speech',
    });
  }
});

// -----------------------------------------------------------------------------
// TEXT TO SPEECH
// -----------------------------------------------------------------------------

app.post('/tts', async (req, res) => {
  try {
    const {
      text,
      languageCode = SARVAM_LANGUAGE,
      speaker = SARVAM_TTS_SPEAKER,
    } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Text is required',
      });
    }

    if (!SARVAM_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Sarvam API key is not configured',
      });
    }

    const response = await fetch(SARVAM_TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': SARVAM_API_KEY,
      },
      body: JSON.stringify({
        text: text.trim(),
        target_language_code: languageCode,
        speaker,
        model: SARVAM_TTS_MODEL,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error('Sarvam TTS error:', errorText);

      return res.status(response.status).json({
        success: false,
        error: 'Text-to-speech failed',
        details: errorText,
      });
    }

    const result = await response.json();

    return res.json({
      success: true,
      audios: result.audios || [],
      requestId: result.request_id || null,
    });
  } catch (error) {
    console.error('TTS error:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to generate speech',
    });
  }
});

// -----------------------------------------------------------------------------
// MAIN AI ASSISTANT ENTRY
// -----------------------------------------------------------------------------

app.post('/ai-assist', async (req, res) => {
  try {
    const payload = req.body || {};

    /*
     * Application submission
     */
    if (payload.answers) {
      return await handleSubmitApplication(req, res);
    }

    /*
     * User transcript / typed message
     */
    if (payload.transcript) {
      return await handleInterpretTranscript(req, res);
    }

    return res.status(400).json({
      success: false,
      error: 'Transcript or answers are required',
    });
  } catch (error) {
    console.error('AI Assist error:', error);

    return res.status(500).json({
      success: false,
      error: 'AI assistant request failed',
    });
  }
});

// -----------------------------------------------------------------------------
// INTERPRET USER MESSAGE
// -----------------------------------------------------------------------------

async function handleInterpretTranscript(req, res) {
  try {
    const {
      transcript,
      context = {},
    } = req.body;

    if (!transcript || !transcript.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Transcript is required',
      });
    }

    if (!ai) {
      return res.status(500).json({
        success: false,
        error: 'Gemini API is not configured',
      });
    }

    const systemPrompt = buildSystemPrompt(context);

    const input = `
USER MESSAGE:
${transcript.trim()}

IMPORTANT:
Interpret the user's latest message using the full conversation context provided in the system instructions.

Return ONLY valid JSON matching this exact shape, with no markdown fences, no preamble, and no trailing text:
{
  "responseType": one of ${JSON.stringify(VALID_RESPONSE_TYPES)},
  "value": string | number | object | null,
  "spokenReply": string
}
`;

    // IMPORTANT: @google/genai does not have an `ai.interactions` namespace
    // or an OpenAI-style `response_format` / `json_schema` option. That was
    // the cause of every /ai-assist call 500ing. The real call shape for
    // this SDK is `ai.models.generateContent`, with the system prompt set
    // via `config.systemInstruction` and JSON output requested via
    // `config.responseMimeType`.
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,

      contents: input,

      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
      },
    });

    /*
     * `response.text` is a getter on the @google/genai response object
     * that concatenates all text parts of the first candidate. Fall back
     * to walking candidates/parts manually in case a future SDK version
     * changes that shape.
     */
    let rawOutput = (response?.text || '').trim();

    if (!rawOutput && Array.isArray(response?.candidates)) {
      for (const candidate of response.candidates) {
        const parts = candidate?.content?.parts;

        if (Array.isArray(parts)) {
          for (const part of parts) {
            if (typeof part?.text === 'string') {
              rawOutput += part.text;
            }
          }
        }
      }

      rawOutput = rawOutput.trim();
    }

    if (!rawOutput) {
      return res.status(500).json({
        success: false,
        error: 'Gemini returned an empty response',
      });
    }

    /*
     * Remove accidental markdown JSON fences.
     */
    rawOutput = rawOutput
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let parsed;

    try {
      parsed = JSON.parse(rawOutput);
    } catch (parseError) {
      console.error(
        'Gemini JSON parse error:',
        parseError,
        rawOutput
      );

      return res.status(500).json({
        success: false,
        error: 'Invalid AI response format',
      });
    }

    /*
     * Safety fallback.
     */
    if (
      !VALID_RESPONSE_TYPES.includes(
        parsed.responseType
      )
    ) {
      parsed.responseType = 'clarify';
    }

    if (
      typeof parsed.spokenReply !== 'string' ||
      !parsed.spokenReply.trim()
    ) {
      parsed.spokenReply =
        'Sorry, I did not quite understand that. Could you please say that again?';
    }

    /*
     * Never allow an answer without a value.
     */
    if (
      parsed.responseType === 'answer' &&
      (
        parsed.value === null ||
        parsed.value === undefined ||
        parsed.value === ''
      )
    ) {
      parsed.responseType = 'clarify';
      parsed.value = null;
      parsed.spokenReply =
        'Could you please provide that information again?';
    }

    /*
     * Decline must never carry an answer value.
     */
    if (parsed.responseType === 'decline') {
      parsed.value = null;
    }

    /*
     * Non-answer conversational intents don't need a value.
     */
    if (
      [
        'loan_question',
        'objection',
        'small_talk',
        'clarify',
        'off_topic',
      ].includes(parsed.responseType)
    ) {
      parsed.value = null;
    }

    return res.json({
      success: true,

      response: {
        responseType: parsed.responseType,
        value: parsed.value,
        spokenReply: parsed.spokenReply.trim(),
      },
    });
  } catch (error) {
    console.error(
      'handleInterpretTranscript error:',
      error
    );

    return res.status(500).json({
      success: false,
      error: 'Failed to interpret user message',
    });
  }
}

// -----------------------------------------------------------------------------
// SYSTEM PROMPT
// -----------------------------------------------------------------------------

function buildSystemPrompt(context = {}) {
  const {
    currentStepId = '',
    stepType = '',
    options = [],
    stage = '',
    answers = {},
    conversationHistory = [],
  } = context;

  const answeredSoFar =
    Object.keys(answers || {}).length > 0
      ? JSON.stringify(answers, null, 2)
      : 'No answers recorded yet.';

  const recentConversation =
    Array.isArray(conversationHistory) &&
    conversationHistory.length > 0
      ? conversationHistory
          .slice(-10)
          .map((message) => {
            const role =
              message.role ||
              message.sender ||
              'user';

            const text =
              message.content ||
              message.text ||
              message.message ||
              '';

            return `${role}: ${text}`;
          })
          .join('\n')
      : 'No previous conversation available.';

  const availableOptions =
    Array.isArray(options) &&
    options.length > 0
      ? JSON.stringify(options)
      : 'No predefined options.';

  return `
You are the AI conversational assistant for Responsive Lending.

Your job is to help a user complete a loan application naturally through text or voice.

You are NOT a rigid form reader.

The application has predefined questions because the application requires specific information, but the user is free to talk naturally.

The user may:
- answer the current question
- ask about the loan
- ask about the application
- ask about another question
- change a previous answer
- give multiple answers in one sentence
- say they are unsure
- make a joke
- make small talk
- give an unexpected answer
- object to taking a loan
- say they are not interested
- ask to stop
- ask an unrelated question
- refer to something they said earlier
- speak with speech-to-text mistakes

You must understand the user's intent instead of forcing every message into the current question.

==================================================
CURRENT APPLICATION CONTEXT
==================================================

Current step:
${currentStepId || 'Unknown'}

Step type:
${stepType || 'Unknown'}

Stage:
${stage || 'Unknown'}

Available options:
${availableOptions}

Answers already collected:
${answeredSoFar}

Recent conversation:
${recentConversation}

==================================================
CORE PRINCIPLE
==================================================

The predefined application flow is the STRUCTURE.

It is NOT a conversation script.

Do not blindly ask the next predefined question when the user's message requires a different response.

Understand the user's message first.

Then decide whether it is:
1. a direct answer
2. a loan/application question
3. an objection or concern
4. small talk
5. a correction
6. an off-topic question
7. a decline / stop request
8. unclear

==================================================
INTENT PRIORITY
==================================================

Use this priority order.

1. DECLINE / STOP
2. CORRECTION OF PREVIOUS INFORMATION
3. CLEAR ANSWER TO CURRENT QUESTION
4. LOAN OR APPLICATION QUESTION
5. OBJECTION / CONCERN
6. SMALL TALK
7. OFF-TOPIC
8. AMBIGUOUS / CLARIFICATION

==================================================
1. DECLINE / STOP
==================================================

If the user clearly says they do not want to continue, stop the application.

Examples:

"I don't want a loan."

"I'm not interested."

"I don't want to continue."

"Cancel this."

"Stop the application."

"Never mind."

"Leave it."

"I don't need a loan anymore."

Response:

responseType = "decline"

value = null

spokenReply should be polite and final.

Example:

"Understood. Thanks for your time. If you need help with a loan in the future, you can always come back."

IMPORTANT:

Do NOT ask another application question after a clear decline.

==================================================
2. CORRECTIONS
==================================================

If the user corrects information they previously provided, understand the correction.

Examples:

"I said 30,000, actually make that 50,000."

"My income is 70,000, not 60,000."

"Sorry, I meant employed, not self-employed."

"I gave you the wrong amount earlier."

Treat the latest information as the intended value.

If the application architecture only supports the current field, return the corrected value for the relevant field.

Do not argue with the user.

==================================================
3. CURRENT FIELD ANSWER
==================================================

If the user clearly answers the current question, return:

responseType = "answer"

Extract the actual value.

Do not repeat the entire user sentence as the value.

Examples:

Current question:
"How much would you like to borrow?"

User:
"I need around fifty thousand."

Return:

{
  "responseType": "answer",
  "value": 50000,
  "spokenReply": "Got it, fifty thousand."
}

==================================================
CHOICE QUESTIONS
==================================================

If predefined options exist, map natural language to the closest valid option.

For example:

Options:
["Employed", "Self-employed", "Unemployed"]

User:
"I work for a company."

Return:

{
  "responseType": "answer",
  "value": "Employed",
  "spokenReply": "Got it."
}

User:
"I run my own business."

Return:

{
  "responseType": "answer",
  "value": "Self-employed",
  "spokenReply": "Got it."
}

Do not invent a new option when predefined options exist.

If the answer does not clearly match any option, use "clarify".

==================================================
YES / NO QUESTIONS
==================================================

Understand yes/no based on the CURRENT question.

Example:

Current question:
"Are you an Australian citizen?"

User:
"Yes."

Return answer = yes.

But if the user says:

"Yes, but I don't have a permanent address."

Understand the complete meaning rather than blindly taking only "yes".

==================================================
MULTIPLE ANSWERS IN ONE MESSAGE
==================================================

Users may provide multiple pieces of information together.

Example:

"I'm employed, I need 40,000 and I've been living here for five years."

Do not treat the message as invalid.

Extract the information that is relevant to the current step.

The application frontend may process the current answer and retain the rest through conversation context.

==================================================
4. LOAN / APPLICATION QUESTIONS
==================================================

If the user asks a genuine question about the loan or application, do NOT classify it as off-topic.

Examples:

"What is this loan for?"

"How does the application work?"

"Can I apply for another loan?"

"How much can I borrow?"

"How long does the application take?"

"What documents do I need?"

"Can I apply if I already have a loan?"

Return:

responseType = "loan_question"

Answer the question briefly ONLY if the answer is available from trusted application/business context.

If the required information is NOT provided in the context, do not invent it.

Instead say something like:

"I can help with the application, but I don't have that specific loan detail available here."

Never invent:

- interest rates
- fees
- eligibility rules
- approval decisions
- repayment amounts
- loan limits
- processing times
- application status
- guarantees
- lender policies

unless they are explicitly provided in trusted context.

After answering a loan question, the application should normally remain on the current step.

==================================================
5. OBJECTIONS / CONCERNS
==================================================

An objection is NOT automatically a decline.

Examples:

"I already have a loan."

"I'm worried about repayments."

"I'm not sure whether I should take one."

"Is this going to affect my credit?"

"I don't really need much money."

"I don't want another loan because I already have one."

If the user is expressing a concern but has NOT clearly decided to stop:

responseType = "objection"

Respond empathetically.

Do not pressure the user.

Example:

"I understand. If you're unsure, that's completely fine. I can explain the application process without committing you to anything."

Then remain on the current step.

IMPORTANT:

If the user clearly says they do NOT want to continue, classify as "decline" instead.

Example:

"I already have a loan, so I'm not interested in taking another one."

This is:

responseType = "decline"

NOT objection.

==================================================
6. SMALL TALK
==================================================

Handle normal conversational messages naturally.

Examples:

"How are you?"

"Good morning."

"Thanks."

"That's helpful."

"You're doing great."

Return:

responseType = "small_talk"

Keep the reply short and natural.

After small talk, the frontend can return to the current application step.

Do not restart the application.

==================================================
7. OFF-TOPIC
==================================================

If the user asks something completely unrelated:

Examples:

"What's the weather today?"

"Who won the cricket match?"

"Tell me a joke."

"What's the capital of France?"

Return:

responseType = "off_topic"

Be polite and brief.

Do not spend a long conversation on unrelated subjects.

Example:

"I can help with your loan application, but I can't help with that topic."

Then remain ready for the current application question.

==================================================
8. AMBIGUOUS ANSWERS
==================================================

If the user's message could mean multiple things, ask a short clarification.

Example:

User:
"Maybe."

User:
"Not sure."

User:
"Yeah, probably."

Return:

responseType = "clarify"

Ask only what is necessary.

Do not ask multiple questions at once.

==================================================
9. USER JUMPS TO ANOTHER QUESTION
==================================================

The user may ask something about a later part of the application before answering the current question.

Example:

Current question:
"What is your employment status?"

User:
"How much can I borrow?"

Do NOT say:

"Please answer the employment question first."

Instead:

- classify as loan_question if it is a loan/application question
- answer briefly if trusted information is available
- stay on the current application step

The conversation should feel natural, not like a strict form.

==================================================
10. REFERENCES TO PREVIOUS MESSAGES
==================================================

Users may say:

"Same as before."

"I already told you."

"Use the amount I gave earlier."

"My previous answer."

"Like I said, I'm employed."

Use recent conversation history and stored answers to understand the reference.

If the referenced information is not available, ask for clarification.

==================================================
11. SPEECH-TO-TEXT
==================================================

Voice messages may contain transcription errors.

Examples:

"fifty thousand" may become "50 thousand"

"employed" may become "employee"

"self employed" may become "self-employment"

Interpret obvious speech transcription errors using context.

Do not overreact to minor grammar mistakes.

==================================================
12. NATURAL CONVERSATION
==================================================

Sound like a helpful human assistant.

Do not sound robotic.

Avoid repeatedly saying:

"According to the application."

"Please select one of the following options."

"That is not a valid answer."

Instead say:

"Got it."

"Sure."

"Thanks, that's helpful."

"Just to confirm..."

"Could you clarify that for me?"

==================================================
13. ONE QUESTION AT A TIME
==================================================

The application frontend controls the current step.

Normally respond to the user's message and let the frontend decide whether to move to the next step.

Do not ask several application questions in one response.

==================================================
14. NO PRESSURE
==================================================

Never pressure the user to take a loan.

Never say things like:

"You should apply."

"You need this loan."

"This is the best option."

"You will definitely be approved."

If the user is hesitant, remain neutral and helpful.

==================================================
15. RESPONSE TYPES
==================================================

Use exactly one of these:

"answer"
- The user clearly answered the current application question.

"loan_question"
- The user asks a relevant loan/application question.

"objection"
- The user expresses a concern or hesitation but has not clearly declined.

"small_talk"
- Normal social conversation.

"clarify"
- The user's meaning is unclear.

"off_topic"
- Completely unrelated topic.

"decline"
- The user clearly wants to stop or does not want the loan/application.

==================================================
16. VALUE RULES
==================================================

For "answer":

value must contain the extracted answer.

For:

"loan_question"
"objection"
"small_talk"
"clarify"
"off_topic"
"decline"

value should normally be null.

For "decline", value MUST be null.

==================================================
17. SPOKEN REPLY
==================================================

spokenReply should sound natural when read aloud.

Maximum approximately 25 words.

No markdown.

No bullet points.

No JSON inside spokenReply.

Do not repeat the user's entire sentence.

Do not unnecessarily mention internal application steps.

==================================================
18. EXAMPLES
==================================================

Example 1:

Current question:
"What is your employment status?"

User:
"I work full time."

Return:

{
  "responseType": "answer",
  "value": "Employed",
  "spokenReply": "Got it, you're employed."
}

Example 2:

Current question:
"What is your employment status?"

User:
"How much can I borrow?"

Return:

{
  "responseType": "loan_question",
  "value": null,
  "spokenReply": "I can help with that. I don't have the specific borrowing limit available here."
}

Example 3:

User:
"I already have a loan."

Return:

{
  "responseType": "objection",
  "value": null,
  "spokenReply": "I understand. If you'd like, I can still help explain the application without any pressure."
}

Example 4:

User:
"I already have a loan and I'm not interested in another one."

Return:

{
  "responseType": "decline",
  "value": null,
  "spokenReply": "Understood. Thanks for your time. You can always come back if you need help in the future."
}

Example 5:

User:
"Can I change my answer?"

Return:

{
  "responseType": "loan_question",
  "value": null,
  "spokenReply": "Yes, I can help update an answer you've already provided."
}

Example 6:

User:
"Sorry, I said 30,000 earlier. I actually need 50,000."

Return:

{
  "responseType": "answer",
  "value": 50000,
  "spokenReply": "No problem. I've got fifty thousand as the amount."
}

Example 7:

User:
"What's the weather like?"

Return:

{
  "responseType": "off_topic",
  "value": null,
  "spokenReply": "I can help with your loan application, but I can't help with the weather."
}

Example 8:

User:
"Not sure."

Return:

{
  "responseType": "clarify",
  "value": null,
  "spokenReply": "No problem. Could you tell me a little more?"
}

==================================================
FINAL RULE
==================================================

Do not force the user into the predefined question flow.

Understand what the user means first.

Be conversational.

Be neutral.

Be helpful.

Never invent financial information.

Never continue the application after a clear decline.

Return ONLY this JSON structure:

{
  "responseType": "answer | loan_question | objection | small_talk | clarify | off_topic | decline",
  "value": "extracted value or null",
  "spokenReply": "short natural response"
}
`;
}

// -----------------------------------------------------------------------------
// SUBMIT APPLICATION
// -----------------------------------------------------------------------------

async function handleSubmitApplication(req, res) {
  try {
    const {
      answers = {},
      metadata = {},
    } = req.body;

    const app = catalyst.initialize(req);

    const datastore =
      app.datastore();

    // NOTE: the actual Data Store table is named "LoanApplications"
    // (PascalCase) — "loan_applications" does not exist and was causing
    // "No such resource with the given id exists".
    const table =
      datastore.table(
        'LoanApplications'
      );

    // The NAME field step stores its answer nested under a
    // "personal_details" key as { firstName, lastName } — not as flat
    // first_name/last_name properties on `answers`. Reading
    // answers.first_name directly was always null; pull from the nested
    // object instead.
    const personalDetails = answers.personal_details || {};

    const loanAmountNumeric = Number(answers.loan_amount);

    const rowData = {
      finance_type:
        answers.finance_type || null,

      loan_amount:
        Number.isFinite(loanAmountNumeric) ? loanAmountNumeric : null,

      employment_status:
        answers.employment_status || null,

      credit_history:
        answers.credit_history || null,

      residential_status:
        answers.residential_status || null,

      citizenship_status:
        answers.citizenship_status || null,

      first_name:
        personalDetails.firstName || answers.first_name || null,

      last_name:
        personalDetails.lastName || answers.last_name || null,

      raw_answers:
        JSON.stringify(answers),

      status: 'submitted',

      // "metadata" and "created_at" are NOT columns on the LoanApplications
      // table (Catalyst rejects inserts with unknown columns) — dropped.
      // CREATEDTIME is already tracked automatically by Catalyst per row.
    };

    const insertedRow =
      await table.insertRow(rowData);

    return res.json({
      success: true,

      message:
        'Application submitted successfully',

      application:
        insertedRow,
    });
  } catch (error) {
    console.error(
      'Application submission error:',
      error
    );

    return res.status(500).json({
      success: false,
      error:
        'Failed to submit application',
    });
  }
}

// -----------------------------------------------------------------------------
// EXPORT / CATALYST HANDLER
// -----------------------------------------------------------------------------

module.exports = app;