/**
 * AI Speaking Feedback
 *
 * Single-request, single-response pattern.
 * No conversation history. The system prompt explicitly prohibits
 * the model from asking follow-up questions or opening a dialogue.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are an expert CEFR language teacher scoring a student's speaking exercise.
Your task is to give clear, constructive feedback on the student's response.

IMPORTANT RULES:
- Provide ONE response only. Do not ask follow-up questions. Do not invite the student to try again.
- Your response must be a valid JSON object with this exact structure:
  {
    "score": <number 0-100>,
    "feedback": "<2-4 sentence feedback explaining the score, specific errors, and what to improve>",
    "strengths": ["<strength 1>", "<strength 2>"],
    "improvements": ["<area 1>", "<area 2>"]
  }
- Score rubric: 90-100 = excellent, 75-89 = good with minor errors, 60-74 = acceptable but notable issues, 40-59 = significant errors affecting communication, 0-39 = major comprehension problems
- Feedback must be encouraging but honest. Be specific about errors.
- Do not add any text outside the JSON object.`;

/**
 * Score a speaking attempt using Claude.
 *
 * @param {object} opts
 * @param {'dictation'|'read_aloud'|'picture_description'} opts.type
 * @param {object} opts.contentItem - the ContentItem row
 * @param {string} [opts.textResponse] - student's typed/transcribed answer
 * @param {string} [opts.audioUrl] - URL to audio (for future STT pipeline)
 * @returns {{ score: number, feedback: string, raw: object }}
 */
export async function scoreSpeakingAttempt({ type, contentItem, textResponse, audioUrl }) {
  const userPrompt = buildUserPrompt({ type, contentItem, textResponse, audioUrl });

  const body = {
    model: MODEL,
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  };

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const rawText = data.content?.[0]?.text || '';

  let parsed;
  try {
    // Strip any accidental markdown fences
    const clean = rawText.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(clean);
  } catch {
    console.error('[ai/speaking] Failed to parse AI response:', rawText);
    // Fallback so the submission isn't lost
    parsed = {
      score: 50,
      feedback: 'Feedback is temporarily unavailable. Your response has been saved.',
      strengths: [],
      improvements: [],
    };
  }

  return {
    score: Math.min(100, Math.max(0, parsed.score ?? 50)),
    feedback: parsed.feedback || '',
    strengths: parsed.strengths || [],
    improvements: parsed.improvements || [],
    raw: parsed,
  };
}

function buildUserPrompt({ type, contentItem, textResponse, audioUrl }) {
  const body = contentItem.body;

  switch (type) {
    case 'dictation': {
      const targetSentences = body.sentences?.map(s => s.text).join('\n') || '';
      return `EXERCISE TYPE: Dictation
CEFR LEVEL: ${contentItem.level}
TARGET SENTENCE(S):
${targetSentences}

STUDENT'S TYPED ANSWER:
${textResponse || '(no response)'}

Score the student's transcription accuracy. Check spelling, punctuation, and word choice.`;
    }

    case 'read_aloud': {
      return `EXERCISE TYPE: Read Aloud
CEFR LEVEL: ${contentItem.level}
PASSAGE THE STUDENT READ:
${body.passage || ''}

FOCUS WORDS: ${(body.focus_words || []).join(', ')}
${audioUrl ? `AUDIO RECORDING: ${audioUrl}` : ''}
${textResponse ? `TRANSCRIPTION OF STUDENT SPEECH:\n${textResponse}` : ''}

Score for fluency, pronunciation accuracy (especially focus words), and natural delivery.
If only transcription is available (no audio), score based on word accuracy.`;
    }

    case 'picture_description': {
      return `EXERCISE TYPE: Picture Description
CEFR LEVEL: ${contentItem.level}
PICTURE CONTEXT: ${body.picture_description || body.alt_text || 'A scene the student must describe'}
EXPECTED VOCABULARY RANGE: ${(body.expected_vocabulary || []).join(', ') || 'age-appropriate A2 vocabulary'}

STUDENT'S DESCRIPTION:
${textResponse || '(no response)'}

Score for: (1) vocabulary range and appropriateness, (2) grammar accuracy, (3) relevance to the image.`;
    }

    default:
      return `Student response: ${textResponse || audioUrl || '(empty)'}`;
  }
}
