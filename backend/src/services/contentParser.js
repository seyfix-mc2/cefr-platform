/**
 * CEFR Content Parser — supports two formats:
 *
 * FORMAT 1 (original):
 *   Lesson 1 – Title
 *   Exercise A – Fill in the blanks (7 questions)
 *   1. Sentence with ___
 *   ...
 *   Answer Key – Lesson 1
 *   Exercise A
 *   1. answer
 *
 * FORMAT 2 (inline/compact):
 *   A1 – Title  (or just a title line before Exercise A)
 *   Exercise A – Fill in the blanks 1. Sentence ___  2. Sentence ___
 *   Answers: 1. answer 2. answer
 *   Exercise B – Matching 1. term  a. def  2. term  b. def
 *   Answers: 1-a 2-b
 *   Exercise C – Sentence Unjumble 1. word / word 2. word / word
 *   Answers: 1. Full sentence. 2. Full sentence.
 */

export function parseContentFile(text, level) {
  // Normalize line endings and collapse wrapped lines
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // Try Format 1 first (has "Lesson N" headers)
  if (/lesson\s+\d+/i.test(normalized)) {
    return parseFormat1(normalized, level);
  }

  // Otherwise use Format 2 (compact/inline)
  return parseFormat2(normalized, level);
}

// ─────────────────────────────────────────────────────────────
// FORMAT 1: Original multi-line format with Lesson headers
// ─────────────────────────────────────────────────────────────
function parseFormat1(text, level) {
  const lines = text.split('\n');
  const lessons = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (/^lesson\s+\d+/i.test(line) && !/answer key/i.test(line)) {
      const lesson = parseFormat1Lesson(lines, i, level);
      if (lesson) {
        lessons.push(lesson);
        i = lesson._nextLine;
        continue;
      }
    }
    i++;
  }
  return lessons;
}

function parseFormat1Lesson(lines, startIdx, level) {
  const titleLine = lines[startIdx].trim();
  const lessonMatch = titleLine.match(/lesson\s+(\d+)\s*[–\-:]\s*(.+)/i);
  if (!lessonMatch) return null;

  const lessonNumber = parseInt(lessonMatch[1]);
  const lessonTitle = lessonMatch[2].trim();

  const exercises = [];
  const answerKey = {};
  let i = startIdx + 1;
  let currentExercise = null;
  let inAnswerKey = false;
  let currentAnswerSection = null;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (/^lesson\s+\d+/i.test(line) && !/answer key/i.test(line) && i > startIdx + 1) break;
    if (/answer key/i.test(line)) { inAnswerKey = true; i++; continue; }

    if (inAnswerKey) {
      const exMatch = line.match(/^exercise\s+([A-C])/i);
      if (exMatch) { currentAnswerSection = exMatch[1].toUpperCase(); answerKey[currentAnswerSection] = []; i++; continue; }
      if (currentAnswerSection && line && /^\d+/.test(line)) answerKey[currentAnswerSection].push(line);
      i++; continue;
    }

    if (/AI CHATBOT|CHATBOT INTERACTION|LEARNING OBJECTIVES|^D\.\s*-+|^-{10,}|^LESSON \d+:/i.test(line)) { i++; continue; }

    const exHeaderMatch = line.match(/^exercise\s+([A-C])\s*[–\-:]\s*(.+)/i);
    if (exHeaderMatch) {
      if (currentExercise) exercises.push(currentExercise);
      currentExercise = {
        letter: exHeaderMatch[1].toUpperCase(),
        title: exHeaderMatch[2].trim(),
        type: detectExerciseType(exHeaderMatch[2]),
        instructions: '',
        items: [],
      };
      i++; continue;
    }

    if (!currentExercise) { i++; continue; }
    if (currentExercise.items.length === 0 && line && !/^\d+[\.\)]/.test(line) && !/subject\s+verb/i.test(line)) {
      if (line) currentExercise.instructions = line;
      i++; continue;
    }
    if (/^subject\s+verb/i.test(line)) { i++; continue; }

    const itemMatch = line.match(/^(\d+)[\.\)]\s*(.+)/);
    if (itemMatch) {
      const num = parseInt(itemMatch[1]);
      const content = itemMatch[2].trim();
      currentExercise.items.push(parseItem(currentExercise.type, num, content));
    }
    i++;
  }

  if (currentExercise) exercises.push(currentExercise);
  mergeAnswerKey(exercises, answerKey);

  const contentItems = exercises.filter(ex => ex.items.length > 0).map(ex => toContentItem(ex, level, lessonNumber, lessonTitle));
  return { lessonNumber, lessonTitle, contentItems, _nextLine: i };
}

// ─────────────────────────────────────────────────────────────
// FORMAT 2: Compact/inline format
// e.g. "A1 – Title" then inline exercise blocks
// ─────────────────────────────────────────────────────────────
function parseFormat2(text, level) {
  // Collapse the whole file into one string for regex parsing
  // (items are wrapped across lines, so we need to rejoin)
  const flat = text.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();

  // Extract title: everything before first "Exercise"
  const titleMatch = flat.match(/^(.+?)(?=Exercise\s+[A-C]\s*[–\-])/i);
  const rawTitle = titleMatch ? titleMatch[1].trim().replace(/^[A-B][12]\s*[–\-]\s*/i, '') : 'Lesson';
  const lessonTitle = rawTitle.replace(/\s+/g, ' ').trim();
  const lessonNumber = 1; // Format 2 files are typically single lessons

  // Split into exercise blocks: split on "Exercise A/B/C –"
  const exerciseBlocks = flat.split(/(?=Exercise\s+[A-C]\s*[–\-])/i).filter(b => /^Exercise\s+[A-C]/i.test(b.trim()));

  const exercises = [];

  for (const block of exerciseBlocks) {
    // Extract exercise header
    const headerMatch = block.match(/^Exercise\s+([A-C])\s*[–\-]\s*([^1-9]+)/i);
    if (!headerMatch) continue;

    const letter = headerMatch[1].toUpperCase();
    const headerText = headerMatch[2].trim();
    const type = detectExerciseType(headerText);

    // Split off answers
    const answerSplit = block.split(/Answers?\s*:/i);
    const itemsText = answerSplit[0];
    const answersText = answerSplit[1] || '';

    // Parse answers first
    const answers = parseInlineAnswers(answersText, type);

    // Parse items
    const items = parseInlineItems(itemsText, type, answers);

    if (items.length > 0) {
      exercises.push({
        letter,
        title: headerText.replace(/\(\d+\s*questions?\)/i, '').trim(),
        type,
        instructions: getInstructions(type),
        items,
      });
    }
  }

  const contentItems = exercises.map(ex => toContentItem(ex, level, lessonNumber, lessonTitle));
  if (contentItems.length === 0) return [];

  return [{ lessonNumber, lessonTitle, contentItems, _nextLine: 9999 }];
}

function parseInlineAnswers(text, type) {
  const answers = {};
  if (!text) return answers;

  if (type === 'matching') {
    // "1-c 2-g 3-e" or "1-c, 2-g"
    const matches = text.matchAll(/(\d+)\s*[-–]\s*([a-g])/gi);
    for (const m of matches) answers[parseInt(m[1])] = m[2].toLowerCase();
  } else if (type === 'sentence_reorder') {
    // "1. I am not hungry. 2. Are you busy?"
    const matches = text.matchAll(/(\d+)\.\s*([^0-9]+?)(?=\d+\.|$)/g);
    for (const m of matches) answers[parseInt(m[1])] = m[2].trim();
  } else {
    // fill_blank: "1. isn't 2. Are 3. aren't"
    const matches = text.matchAll(/(\d+)\.\s*([^\d\.]+?)(?=\d+\.|$)/g);
    for (const m of matches) answers[parseInt(m[1])] = m[2].trim();
  }
  return answers;
}

function parseInlineItems(text, type, answers) {
  const items = [];

  if (type === 'matching') {
    // "1. Question text  a. Answer text  2. Question  b. Answer..."
    // Split on numbered items
    const chunks = text.split(/(?=\d+\.\s)/).filter(c => /^\d+\./.test(c.trim()));
    for (const chunk of chunks) {
      const numMatch = chunk.match(/^(\d+)\.\s*(.+)/);
      if (!numMatch) continue;
      const id = parseInt(numMatch[1]);
      const content = numMatch[2].trim();

      // Split on lettered definition: "a. something"
      const defMatch = content.match(/^(.*?)\s+([a-g])\.\s*(.+)/i);
      if (defMatch) {
        items.push({
          id,
          term: defMatch[1].trim(),
          definition: defMatch[3].trim(),
          correctOption: answers[id] || defMatch[2].toLowerCase(),
        });
      } else {
        items.push({ id, term: content, definition: '', correctOption: answers[id] || '' });
      }
    }
  } else if (type === 'sentence_reorder') {
    // "1. word / word / word 2. word / word"
    const chunks = text.split(/(?=\d+\.\s)/).filter(c => /^\d+\./.test(c.trim()));
    for (const chunk of chunks) {
      const numMatch = chunk.match(/^(\d+)\.\s*(.+)/);
      if (!numMatch) continue;
      const id = parseInt(numMatch[1]);
      const content = numMatch[2].trim().replace(/\s+/g, ' ');
      const words = content.split('/').map(w => w.trim()).filter(Boolean);
      items.push({ id, words, answer: answers[id] || '' });
    }
  } else {
    // fill_blank: "1. She _____ a doctor. (negative) 2. ..."
    const chunks = text.split(/(?=\d+\.\s)/).filter(c => /^\d+\./.test(c.trim()));
    for (const chunk of chunks) {
      const numMatch = chunk.match(/^(\d+)\.\s*(.+)/);
      if (!numMatch) continue;
      const id = parseInt(numMatch[1]);
      const prompt = numMatch[2].trim().replace(/\(negative\)/gi, '').replace(/\s+/g, ' ').trim();
      items.push({ id, prompt, answer: answers[id] || '', explanation: '' });
    }
  }

  return items;
}

function getInstructions(type) {
  if (type === 'fill_blank') return 'Fill in the blanks with the correct form.';
  if (type === 'matching') return 'Match each question with the correct response.';
  if (type === 'sentence_reorder') return 'Put the words in the correct order to make a sentence.';
  return 'Complete the exercise.';
}

// ─────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────

function detectExerciseType(title) {
  const t = title.toLowerCase();
  if (t.includes('fill') || t.includes('blank')) return 'fill_blank';
  if (t.includes('match') || t.includes('tap')) return 'matching';
  if (t.includes('unjumble') || t.includes('order') || t.includes('reorder')) return 'sentence_reorder';
  return 'fill_blank';
}

function parseItem(type, id, content) {
  if (type === 'matching') {
    const parts = content.split(/\t+/);
    if (parts.length >= 2) {
      const defMatch = parts[1].trim().match(/^([a-g])\.\s*(.+)/i);
      return { id, term: parts[0].trim(), definition: defMatch ? defMatch[2].trim() : parts[1].trim(), correctOption: defMatch ? defMatch[1].toLowerCase() : '' };
    }
    return { id, term: content, definition: '', correctOption: '' };
  }
  if (type === 'sentence_reorder') {
    return { id, words: content.split('/').map(w => w.trim()).filter(Boolean), answer: '' };
  }
  return { id, prompt: content, answer: '', explanation: '' };
}

function mergeAnswerKey(exercises, answerKey) {
  for (const ex of exercises) {
    const answers = answerKey[ex.letter] || [];
    for (const ansLine of answers) {
      if (ex.type === 'fill_blank') {
        const m = ansLine.match(/^(\d+)[\.\)]\s*(.+)/);
        if (m) { const item = ex.items.find(it => it.id === parseInt(m[1])); if (item) item.answer = m[2].trim(); }
      } else if (ex.type === 'matching') {
        const m = ansLine.match(/^(\d+)[–\-]([a-g])/i);
        if (m) { const item = ex.items.find(it => it.id === parseInt(m[1])); if (item) item.correctOption = m[2].toLowerCase(); }
      } else if (ex.type === 'sentence_reorder') {
        const m = ansLine.match(/^(\d+)[\.\)]\s*(.+)/);
        if (m) { const item = ex.items.find(it => it.id === parseInt(m[1])); if (item) item.answer = m[2].trim(); }
      }
    }
  }
}

function toContentItem(ex, level, lessonNumber, lessonTitle) {
  return {
    level,
    skill: 'grammar',
    type: ex.type,
    title: `Lesson ${lessonNumber}: ${lessonTitle} — Exercise ${ex.letter}`,
    tags: [`lesson_${lessonNumber}`, 'grammar', level.toLowerCase()],
    body: buildBody(ex),
    lesson_number: lessonNumber,
    exercise_letter: ex.letter,
  };
}

function buildBody(ex) {
  if (ex.type === 'fill_blank') {
    return { instructions: ex.instructions, items: ex.items.map(it => ({ id: it.id, prompt: it.prompt, answer: it.answer, explanation: it.explanation || '' })) };
  }
  if (ex.type === 'matching') {
    return { instructions: ex.instructions, items: ex.items.map(it => ({ id: it.id, term: it.term, definition: it.definition, correct_option: it.correctOption || '' })) };
  }
  if (ex.type === 'sentence_reorder') {
    return { instructions: ex.instructions, items: ex.items.map(it => ({ id: it.id, words: it.words, answer: it.answer })) };
  }
  return { instructions: ex.instructions, items: ex.items };
}
