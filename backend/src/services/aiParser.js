/**
 * AI-assisted content parser for complex B1+ exercise files.
 * Used when the rule-based parser returns 0 exercises.
 * Makes a single Claude API call to extract structured exercise data.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are a language exercise data extractor. 
Extract exercises from the given text and return ONLY a valid JSON object.
No explanation, no markdown, no code blocks — just raw JSON.

Return this exact structure:
{
  "lesson_number": <number>,
  "lesson_title": "<title>",
  "exercises": [
    {
      "letter": "A",
      "type": "<one of: fill_blank|matching|multiple_choice|sentence_reorder|rewrite|short_answer|error_correction|sort|true_false>",
      "instructions": "<instructions text>",
      "items": [
        <format depends on type — see below>
      ]
    }
  ]
}

Item formats by type:
- fill_blank: {"id":1,"prompt":"sentence with _____","answer":"word"}
- multiple_choice: {"id":1,"prompt":"question","options":["a","b","c","d"],"correct":0,"answer":"correct option text"}
- matching: {"id":1,"term":"left side","definition":"right side","correct_option":"a"}
- sentence_reorder: {"id":1,"words":["word1","word2"],"answer":"Full correct sentence."}
- rewrite: {"id":1,"prompt":"original sentence","answer":"rewritten sentence"}
- short_answer: {"id":1,"prompt":"question","answer":"model answer"}
- error_correction: {"id":1,"prompt":"sentence with error","answer":"corrected sentence"}
- sort: {"id":1,"term":"item to sort","answer":"category it belongs to"}
- true_false: {"id":1,"prompt":"statement","answer":"true or false"}

Rules:
- Extract ALL exercises (A, B, C) — never skip one
- Use answers from the Answer Key section at the bottom of the file
- For matching exercises, match items with their correct answers from the key
- Keep prompts clean — remove blank lines (_____, __________) from prompts for rewrite/short_answer types
- For fill_blank: keep the _____ in the prompt
- Maximum 10 items per exercise (take first 10 if more)
- lesson_number must be an integer`;

/**
 * Parse a content file using Claude AI when rule-based parser fails.
 */
export async function aiParseContent(text, level, apiKey) {
  const userPrompt = `Extract the exercises from this ${level} level English grammar file:\n\n${text.slice(0, 6000)}`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI parser API error ${response.status}`);
  }

  const data = await response.json();
  const raw = data.content?.[0]?.text || '';
  const clean = raw.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);

  // Convert to ContentItem format
  return [{
    lessonNumber: parsed.lesson_number,
    lessonTitle: parsed.lesson_title,
    contentItems: parsed.exercises
      .filter(ex => ex.items?.length > 0)
      .map(ex => ({
        level,
        skill: 'grammar',
        type: ex.type,
        title: `Lesson ${parsed.lesson_number}: ${parsed.lesson_title} — Exercise ${ex.letter}`,
        tags: [`lesson_${parsed.lesson_number}`, 'grammar', level.toLowerCase()],
        body: { instructions: ex.instructions, items: ex.items },
        lesson_number: parsed.lesson_number,
        exercise_letter: ex.letter,
      })),
    _nextLine: 9999,
  }];
}
