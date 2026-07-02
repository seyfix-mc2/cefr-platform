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

  // Format 3: Markdown (has ## Exercise headings)
  if (/^##\s+Exercise/im.test(normalized)) {
    return parseFormat3(normalized, level);
  }

  // Format 4: B2 inline pipe format (has "| ANSWER:" pattern)
  if (/\|\s*ANSWER:/i.test(normalized)) {
    return parseFormat4(normalized, level);
  }

  // Format 1: has "Lesson N" headers (any style including indented or embedded)
  if (/lesson\s+\d+/i.test(normalized)) {
    return parseFormat1(normalized, level);
  }

  // Format 2: compact/inline
  return parseFormat2(normalized, level);
}

// ─────────────────────────────────────────────────────────────
// FORMAT 1: Original multi-line format with Lesson headers
// ─────────────────────────────────────────────────────────────
function parseFormat1(text, level) {
  const lines = text.split('\n');
  const lessons = [];
  let i = 0;

  // Find ALL lesson header lines first
  // Supports: "LESSON 1 —", "LESSON 1 |", "LESSON 1:", "  LESSON 1 —" (indented)
  // Also: "ENGLISH B1 — LESSON 5: ..." style
  while (i < lines.length) {
    const line = lines[i].trim();
    const isLesson = /^lesson\s+\d+/i.test(line) ||
                     /^##\s*lesson\s+\d+/i.test(line) ||
                     /^english\s+b\d.*lesson\s+\d+/i.test(line) ||
                     /^b\d\s+english.*lesson\s+\d+/i.test(line);
    if (isLesson && !/answer key|end of/i.test(line)) {
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
  // Handle multiple formats:
  // "LESSON 1 — Title", "LESSON 1 | Title", "LESSON 1: Title"
  // "ENGLISH B1 — LESSON 5: Title", "B1 ENGLISH ... LESSON 3 | Title"
  // "ENGLISH B1 — LESSON 11" (title on next line)
  const titleClean = titleLine.replace(/^##\s*/, '').trim();
  let lessonMatch = titleClean.match(/lesson\s+(\d+)\s*[–\-—:|]\s*(.+)/i);
  if (!lessonMatch) {
    lessonMatch = titleClean.match(/lesson\s+(\d+)[:\s]+(.+)/i);
  }
  if (!lessonMatch) {
    // Title might be on next line: "ENGLISH B1 — LESSON 11"
    lessonMatch = titleClean.match(/lesson\s+(\d+)\s*$/i);
    if (lessonMatch) {
      // Look ahead for title on next line(s)
      let titleFromNext = '';
      for (let k = startIdx + 1; k < Math.min(startIdx + 5, lines.length); k++) {
        const next = lines[k].trim();
        if (next && !/^[=\-─━═╔║╚]+$/.test(next) && !/^exercise/i.test(next)) {
          titleFromNext = next;
          break;
        }
      }
      lessonMatch = [null, lessonMatch[1], titleFromNext || `Lesson ${lessonMatch[1]}`];
    }
  }
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
    if (/answer key|answer\s*key/i.test(line)) { inAnswerKey = true; i++; continue; }

    if (inAnswerKey) {
      const exMatch = line.match(/^exercise\s+([A-C])/i);
      if (exMatch) { currentAnswerSection = exMatch[1].toUpperCase(); answerKey[currentAnswerSection] = []; i++; continue; }
      if (currentAnswerSection && line && /^\d+/.test(line)) answerKey[currentAnswerSection].push(line);
      i++; continue;
    }

    if (/AI CHATBOT|CHATBOT INTERACTION|LEARNING OBJECTIVES|^D\.\s*-+|^-{10,}|^LESSON \d+:/i.test(line)) { i++; continue; }

    // Skip "EXERCISE A — ANSWER KEY" lines — these are in the answer section
    if (/^exercise\s+[A-C].*answer\s*key/i.test(line)) { i++; continue; }
    const exHeaderMatch = line.match(/^exercise\s+([A-C])\s*[–\-—:|]\s*(.+)/i);
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
  if (t.includes('error correction') || t.includes('find and correct') || t.includes('correct the mistake')) return 'error_correction';
  if (t.includes('true') && t.includes('false')) return 'true_false';
  if (t.includes('sort') || t.includes('column') || t.includes('frequency scale') || t.includes('ordering')) return 'sort';
  if (t.includes('rewrite') || t.includes('transform') || t.includes('replace') || t.includes('join')) return 'rewrite';
  if (t.includes('short answer') || t.includes('completion')) return 'short_answer';
  if (t.includes('multiple choice') || t.includes('choose the correct')) return 'multiple_choice';
  if (t.includes('fill') || t.includes('blank') || t.includes('complete')) return 'fill_blank';
  if (t.includes('match') || t.includes('tap') || t.includes('correct article') || t.includes('correct demonstrative') || t.includes('correct form') || t.includes('correct conjunction')) return 'matching';
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
      const t = ansLine.trim();
      // Skip meta-notes like "(Accept: isn't / aren't)"
      if (/^\(Accept/i.test(t) || !t) continue;

      if (ex.type === 'matching') {
        // Formats: "1-c", "1–c", "1 → E", "1 — E", "1-B", "1 → B  (explanation)"
        const m = t.match(/^(\d+)\s*[–\-—→>]+\s*([a-g])/i);
        if (m) {
          const item = ex.items.find(it => it.id === parseInt(m[1]));
          if (item) item.correctOption = m[2].toLowerCase();
        }
        continue;
      }

      // All other types: extract number + answer text
      // Handles "1.answer", "1. answer", "1) answer"
      const numMatch = t.match(/^(\d+)[.)]\s*(.*)/);
      if (!numMatch) continue;
      const id = parseInt(numMatch[1]);
      const answer = numMatch[2].trim();
      const item = ex.items.find(it => it.id === id);
      if (!item) continue;

      if (ex.type === 'sentence_reorder') {
        item.answer = answer;
      } else if (ex.type === 'true_false') {
        item.answer = answer.toLowerCase().startsWith('t') ? 'true' : 'false';
      } else {
        // fill_blank, rewrite, short_answer, error_correction, sort, multiple_choice
        item.answer = answer;
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
  if (ex.type === 'fill_blank' || ex.type === 'rewrite' || ex.type === 'short_answer' || ex.type === 'error_correction') {
    return { instructions: ex.instructions, items: ex.items.map(it => ({
      id: it.id,
      prompt: (it.prompt || '').replace(/\s*[→>]\s*_+\s*$/, '').trim(),
      answer: it.answer || '',
      explanation: it.explanation || ''
    }))};
  }
  if (ex.type === 'matching') {
    return { instructions: ex.instructions, items: ex.items.map(it => ({ id: it.id, term: it.term, definition: it.definition, correct_option: it.correctOption || '' })) };
  }
  if (ex.type === 'sentence_reorder') {
    return { instructions: ex.instructions, items: ex.items.map(it => ({ id: it.id, words: it.words, answer: it.answer })) };
  }
  if (ex.type === 'multiple_choice') {
    return { instructions: ex.instructions, items: ex.items.map(it => ({ id: it.id, prompt: it.prompt || '', options: it.options || [], correct: it.correct ?? 0, answer: it.answer || '' })) };
  }
  if (ex.type === 'sort') {
    return { instructions: ex.instructions, items: ex.items.map(it => ({ id: it.id, term: it.term || it.prompt || '', answer: it.answer || '' })) };
  }
  if (ex.type === 'true_false') {
    return { instructions: ex.instructions, items: ex.items.map(it => ({ id: it.id, prompt: it.prompt || '', answer: it.answer || '' })) };
  }
  return { instructions: ex.instructions, items: ex.items };
}


// ─────────────────────────────────────────────────────────────
// FORMAT 3: Markdown format
// # Title
// ## Exercise A: Type
// 1. item
// | table rows for matching |
// ## Answer Key
// **Exercise A:** 1. answer 2. answer
// 1-B, 2-A for matching
// ─────────────────────────────────────────────────────────────
function parseFormat3(text, level) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && l !== '---');

  // Extract title from # heading
  const titleLine = lines.find(l => l.startsWith('# '));
  const rawTitle = titleLine ? titleLine.replace(/^#\s*/, '').replace(/^[A-B][12]\s*Unit\s*\d+\s*[:\-–]\s*/i, '').trim() : 'Lesson';
  const lessonNumber = 1;
  const lessonTitle = rawTitle;

  // Split into sections by ## headings
  const sections = [];
  let current = null;
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current) sections.push(current);
      current = { header: line.replace(/^##\s*/, ''), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);

  // Separate answer key section from exercise sections
  const answerKeySection = sections.find(s => /answer key/i.test(s.header));
  const exerciseSections = sections.filter(s => /exercise\s+[A-C]/i.test(s.header));

  // Parse answer key
  const answerKey = {};
  if (answerKeySection) {
    let currentLetter = null;
    for (const line of answerKeySection.lines) {
      // Match "**Exercise A:**" or "Exercise A:" — strip any * characters first
      const cleaned = line.replace(/\*/g, '').trim();
      const exHeader = cleaned.match(/^Exercise\s+([A-C])\s*:?/i);
      if (exHeader) {
        currentLetter = exHeader[1].toUpperCase();
        answerKey[currentLetter] = '';
        continue;
      }
      if (currentLetter && line) {
        answerKey[currentLetter] += ' ' + line;
      }
    }
  }

  // Parse each exercise
  const exercises = [];
  for (const section of exerciseSections) {
    const exMatch = section.header.match(/exercise\s+([A-C])\s*[:\-–]\s*(.+)/i);
    if (!exMatch) continue;
    const letter = exMatch[1].toUpperCase();
    const typeHint = exMatch[2].trim();
    const type = detectExerciseType(typeHint);

    const instructions = section.lines.find(l => !/^\d+\.|\|/.test(l) && l.length > 10) || getInstructions(type);
    const rawAnswers = answerKey[letter] || '';
    const answers = parseMarkdownAnswers(rawAnswers, type);
    const items = parseMarkdownItems(section.lines, type, answers);

    if (items.length > 0) {
      exercises.push({ letter, title: typeHint, type, instructions, items });
    }
  }

  const contentItems = exercises.map(ex => toContentItem(ex, level, lessonNumber, lessonTitle));
  if (contentItems.length === 0) return [];
  return [{ lessonNumber, lessonTitle, contentItems, _nextLine: 9999 }];
}

function parseMarkdownAnswers(text, type) {
  const answers = {};
  if (!text) return answers;

  if (type === 'matching') {
    // "1-B, 2-A, 3-D" — note uppercase letters
    const matches = text.matchAll(/(\d+)\s*[-–]\s*([A-G])/gi);
    for (const m of matches) answers[parseInt(m[1])] = m[2].toLowerCase();
  } else if (type === 'sentence_reorder') {
    // "1. Sentence one. 2. Sentence two."
    const matches = text.matchAll(/(\d+)\.\s*([^0-9]+?)(?=\d+\.|$)/g);
    for (const m of matches) answers[parseInt(m[1])] = m[2].trim();
  } else {
    // fill_blank: "1. had already left 2. had finished"
    const matches = text.matchAll(/(\d+)\.\s*([^0-9]+?)(?=\d+\.|$)/g);
    for (const m of matches) answers[parseInt(m[1])] = m[2].trim();
  }
  return answers;
}

function parseMarkdownItems(lines, type, answers) {
  const items = [];

  if (type === 'matching') {
    // Parse markdown table rows: | 1. Term | A. Definition |
    for (const line of lines) {
      if (!line.startsWith('|')) continue;
      const cells = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length < 2) continue;
      // Skip header rows
      if (/starter|ending|:---/i.test(cells[0])) continue;

      const termMatch = cells[0].match(/^(\d+)\.\s*(.+)/);
      if (!termMatch) continue;
      const id = parseInt(termMatch[1]);
      const term = termMatch[2].trim();

      // Definition cell: "A. text" — strip the letter prefix
      const defMatch = cells[1].match(/^[A-G]\.\s*(.+)/i);
      const definition = defMatch ? defMatch[1].trim() : cells[1].trim();

      items.push({ id, term, definition, correctOption: answers[id] || '' });
    }
  } else if (type === 'sentence_reorder') {
    // "1. (word / word / word)" or "1. word / word / word"
    for (const line of lines) {
      const m = line.match(/^(\d+)\.\s*[\(]?(.+?)[\)]?$/);
      if (!m) continue;
      const id = parseInt(m[1]);
      const content = m[2].replace(/[\(\)]/g, '').trim();
      // Words separated by / or spaces (if answer exists, shuffle the answer words)
      const words = content.split('/').map(w => w.trim()).filter(Boolean);
      // If no slashes, split by spaces
      const finalWords = words.length > 1 ? words : content.split(' ').filter(Boolean);
      items.push({ id, words: finalWords, answer: answers[id] || '' });
    }
  } else {
    // fill_blank: numbered lines with __________ as blank
    for (const line of lines) {
      const m = line.match(/^(\d+)\.\s*(.+)/);
      if (!m) continue;
      const id = parseInt(m[1]);
      // Normalize blanks: __________ → _____
      const prompt = m[2].replace(/_{3,}/g, '_____').trim();
      items.push({ id, prompt, answer: answers[id] || '', explanation: '' });
    }
  }

  return items;
}


// ─────────────────────────────────────────────────────────────
// FORMAT 4: B2 Inline pipe format
// Each item: "N. prompt | A. opt  B. opt | ANSWER: X"
// Or fill blank: "N. sentence with _____  | ANSWER: word"
// ─────────────────────────────────────────────────────────────
function parseFormat4(text, level) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  // Find lesson header
  let lessonNumber = 1;
  let lessonTitle = '';
  const exercises = [];
  let currentExercise = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Lesson header: "Lesson N – Title" or "Lesson N"
    const lessonM = line.match(/^Lesson\s+(\d+)\s*[–\-—|:]?\s*(.*)/i);
    if (lessonM && !/exercise/i.test(line)) {
      lessonNumber = parseInt(lessonM[1]);
      lessonTitle = lessonM[2].trim() || '';
      // If title is on next line
      if (!lessonTitle && lines[i+1] && !/^exercise/i.test(lines[i+1])) {
        lessonTitle = lines[i+1].trim();
      }
      continue;
    }

    // Exercise header: "Exercise N – Type" or "Exercise N"
    const exM = line.match(/^Exercise\s+(\d+)\s*[–\-—|:]?\s*(.*)/i);
    if (exM) {
      if (currentExercise) exercises.push(currentExercise);
      const exNum = parseInt(exM[1]);
      const exTitle = exM[2].trim();
      const letter = String.fromCharCode(64 + exNum); // 1→A, 2→B, etc.
      currentExercise = {
        letter,
        number: exNum,
        title: exTitle,
        type: detectB2ExerciseType(exTitle, exNum),
        instructions: '',
        items: [],
      };
      continue;
    }

    if (!currentExercise) continue;

    // Instructions line (no number, no pipe)
    if (!/^\d+\./.test(line) && !line.includes('|') && currentExercise.items.length === 0) {
      if (line && !/^word bank/i.test(line) && !/^[A-Z]\)/.test(line)) {
        currentExercise.instructions = line;
      }
      continue;
    }

    // Numbered item with pipe: "1. prompt | A. x  B. y | ANSWER: z"
    const itemM = line.match(/^(\d+)\.\s*(.+)/);
    if (itemM) {
      const id = parseInt(itemM[1]);
      const rest = itemM[2];
      const parts = rest.split('|').map(p => p.trim());
      
      const prompt = parts[0].trim();
      const answerPart = parts.find(p => /^ANSWER:/i.test(p));
      const answer = answerPart ? answerPart.replace(/^ANSWER:\s*/i, '').trim() : '';
      const optionsPart = parts.find(p => /^[A-D][.)]/i.test(p));

      if (optionsPart) {
        // Multiple choice or cloze: has A. B. C. D. options
        const options = [];
        const optMatches = optionsPart.matchAll(/([A-D])[.)\s]+([^A-D]+?)(?=[A-D][.)]|$)/gi);
        for (const m of optMatches) options.push(m[2].trim());
        
        // Find correct index
        const correctLetter = answer.replace(/[^A-D]/gi, '').toUpperCase();
        const correctIdx = correctLetter ? correctLetter.charCodeAt(0) - 65 : 0;

        currentExercise.items.push({
          id, prompt,
          options: options.length ? options : [answer],
          correct: correctIdx,
          answer: correctLetter || answer,
        });
      } else if (prompt.includes('/') && currentExercise.type === 'multiple_choice') {
        // Exercise 4 style: "sentence with opt1 / opt2"
        currentExercise.items.push({
          id, prompt, answer,
          options: [],
          correct: 0,
        });
      } else {
        // Fill in blank
        currentExercise.items.push({ id, prompt, answer, explanation: '' });
      }
    }
  }

  if (currentExercise) exercises.push(currentExercise);

  const contentItems = exercises
    .filter(ex => ex.items.length > 0)
    .map(ex => ({
      level,
      skill: 'grammar',
      type: ex.type,
      title: `Lesson ${lessonNumber}: ${lessonTitle} — Exercise ${ex.letter}`,
      tags: [`lesson_${lessonNumber}`, 'grammar', level.toLowerCase(), `exercise_${ex.number}`],
      body: buildBodyB2(ex),
      lesson_number: lessonNumber,
      exercise_letter: ex.letter,
    }));

  return [{ lessonNumber, lessonTitle, contentItems, _nextLine: 9999 }];
}

function detectB2ExerciseType(title, num) {
  const t = (title || '').toLowerCase();
  if (num === 1) return 'multiple_choice';
  if (num === 2) return 'fill_blank';
  if (num === 3) return 'multiple_choice'; // cloze
  if (num === 4) return 'multiple_choice'; // choose correct
  if (t.includes('fill') || t.includes('blank')) return 'fill_blank';
  if (t.includes('cloze') || t.includes('use of english')) return 'multiple_choice';
  return 'multiple_choice';
}

function buildBodyB2(ex) {
  if (ex.type === 'fill_blank') {
    return {
      instructions: ex.instructions || 'Fill in the blanks with the correct form.',
      items: ex.items.map(it => ({
        id: it.id, prompt: it.prompt, answer: it.answer || '', explanation: ''
      }))
    };
  }
  return {
    instructions: ex.instructions || 'Choose the correct option.',
    items: ex.items.map(it => ({
      id: it.id,
      prompt: it.prompt,
      options: it.options || [],
      correct: it.correct || 0,
      answer: it.answer || '',
    }))
  };
}

