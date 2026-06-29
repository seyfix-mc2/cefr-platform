/**
 * AI Content Generation — Teacher-facing only.
 *
 * Teacher selects: level, skill, topic, question types, length
 * → Claude generates a draft → teacher reviews/edits → assigns to students
 *
 * AI output NEVER reaches students without teacher review first.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

/**
 * Generate assignment content.
 *
 * @param {object} opts
 * @param {string} opts.type - 'quiz' | 'homework' | 'exam'
 * @param {string} opts.level - A1 | A2 | B1 | B2
 * @param {string} opts.skill - grammar | vocabulary | speaking
 * @param {string} opts.topic - teacher-provided topic/keywords
 * @param {string[]} opts.questionTypes - ['multiple_choice','fill_blank','matching','sentence_reorder']
 * @param {number} opts.questionCount - total questions
 * @param {object[]} opts.sampleItems - existing content items for style reference
 * @returns {object} generated assignment content (JSON)
 */
export async function generateAssignment({
  type,
  level,
  skill,
  topic,
  questionTypes,
  questionCount,
  sampleItems = [],
}) {
  const systemPrompt = buildSystemPrompt(level, sampleItems);
  const userPrompt = buildGenerationPrompt({ type, level, skill, topic, questionTypes, questionCount });

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${err}`);
  }

  const data = await response.json();
  const rawText = data.content?.[0]?.text || '';

  const clean = rawText.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);

  return {
    title: parsed.title,
    instructions: parsed.instructions,
    questions: parsed.questions,
    answer_key: parsed.answer_key,
    generated_at: new Date().toISOString(),
    model: MODEL,
  };
}

function buildSystemPrompt(level, sampleItems) {
  const examples = sampleItems.slice(0, 3).map(item =>
    `Example (${item.type}): ${JSON.stringify(item.body).slice(0, 400)}`
  ).join('\n\n');

  return `You are an expert CEFR language curriculum designer creating exercises for ${level} level learners.
Match the difficulty, vocabulary, and grammar complexity appropriate for ${level}.

${examples.length ? `Reference these existing content examples for style and difficulty:\n${examples}` : ''}

IMPORTANT: Respond with a valid JSON object only. No text outside the JSON. Structure:
{
  "title": "<descriptive title>",
  "instructions": "<clear student-facing instructions>",
  "questions": [
    // Array of question objects matching the type
  ],
  "answer_key": {
    "<question_id>": "<correct answer or explanation>"
  }
}

Question object formats by type:

multiple_choice: { "id": 1, "prompt": "...", "options": ["A","B","C","D"], "correct": 0 }
fill_blank: { "id": 1, "prompt": "Text with _____ blank", "answer": "word", "explanation": "..." }
matching: { "id": 1, "pairs": [{"term":"...","definition":"..."}] }
sentence_reorder: { "id": 1, "words": ["word1","word2",...], "answer": "Correct sentence." }`;
}

function buildGenerationPrompt({ type, level, skill, topic, questionTypes, questionCount }) {
  const qtList = questionTypes.join(', ');
  const perType = Math.ceil(questionCount / questionTypes.length);

  return `Create a ${type} for CEFR ${level} learners.

SKILL FOCUS: ${skill}
TOPIC / KEYWORDS: ${topic}
QUESTION TYPES: ${qtList}
TOTAL QUESTIONS: ${questionCount} (approximately ${perType} of each type)

Generate realistic, contextually appropriate questions.
Vocabulary and grammar must be pitched exactly at ${level} — not easier, not harder.
Questions should feel cohesive around the topic "${topic}".`;
}
