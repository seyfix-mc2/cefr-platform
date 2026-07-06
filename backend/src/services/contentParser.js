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

// CEFR Content Parser v2.2 — supports Formats 1-4, options fix, A-G exercises
// Last updated: inline Answer Key support, Exercise D, multi-lesson markdown
export function parseContentFile(text, level, skill = 'grammar') {
  // Normalize line endings and collapse wrapped lines
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Strip Private Use Area characters -- these only ever show up as leftover
    // bullet-point glyphs (e.g. U+F0B7) from pasting a Word/Docs bulleted list
    // into plain text; they're invisible in most editors but break exact-text
    // matching (e.g. an un-numbered item's text vs. its answer-key line).
    .replace(/[\u{E000}-\u{F8FF}]/gu, '');

  // Format 3: Markdown (has ## Exercise headings)
  if (/^##\s+Exercise/im.test(normalized)) {
    return parseFormat3(normalized, level, skill);
  }

  // Format 4: B2 inline pipe format 
  // Trigger if exercises use numbers (Exercise 1, 2, 3) not letters (Exercise A, B, C)
  if (/\|\s*ANSWER:/i.test(normalized) && /^Exercise\s+\d+\s*[–\-—|]/im.test(normalized)) {
    return parseFormat4(normalized, level, skill);
  }
  // Also trigger for numbered exercises with colon/dash (handles indented headers)
  if (/^\s*EXERCISE\s+\d+\s*[:\-—]/m.test(normalized)) {
    return parseFormat4(normalized, level, skill || 'grammar');
  }

  // Format 1: has "Lesson N" headers (any style including indented or embedded)
  if (/lesson\s+\d+/i.test(normalized)) {
    return parseFormat1(normalized, level, skill);
  }

  // Format 2: compact/inline
  return parseFormat2(normalized, level, skill);
}

// ─────────────────────────────────────────────────────────────
// FORMAT 1: Original multi-line format with Lesson headers
// ─────────────────────────────────────────────────────────────
function parseFormat1(text, level, skill = 'grammar') {
  const lines = text.split('\n');
  const lessons = [];
  let i = 0;

  // Find ALL lesson header lines first
  // Supports: "LESSON 1 —", "LESSON 1 |", "LESSON 1:", "  LESSON 1 —" (indented)
  // Also: "ENGLISH B1 — LESSON 5: ..." style
  while (i < lines.length) {
    const line = lines[i].trim();
    const isLesson = /^lesson\s+\d+/i.test(line) ||
                     /^vocabulary\s+lesson\s+\d+/i.test(line) ||
                     /^##\s*lesson\s+\d+/i.test(line) ||
                     /^##\s*vocabulary\s+lesson\s+\d+/i.test(line) ||
                     /^📘\s*(vocabulary\s+)?lesson\s+\d+/i.test(line) ||
                     /^english\s+b\d.*lesson\s+\d+/i.test(line) ||
                     /^b\d\s+english.*lesson\s+\d+/i.test(line);
    if (isLesson && !/answer key|end of/i.test(line)) {
      const lesson = parseFormat1Lesson(lines, i, level, skill);
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

function parseFormat1Lesson(lines, startIdx, level, skill = 'grammar') {
  const titleLine = lines[startIdx].trim();
  // Handle multiple formats:
  // "LESSON 1 — Title", "LESSON 1 | Title", "LESSON 1: Title"
  // "ENGLISH B1 — LESSON 5: Title", "B1 ENGLISH ... LESSON 3 | Title"
  // "ENGLISH B1 — LESSON 11" (title on next line)
  const titleClean = titleLine.replace(/^##\s*/, '').replace(/^📘\s*/, '').trim();
  let lessonMatch = titleClean.match(/(?:vocabulary\s+)?lesson\s+(\d+)\s*[–\-—:|]\s*(.+)/i);
  if (!lessonMatch) {
    lessonMatch = titleClean.match(/(?:vocabulary\s+)?lesson\s+(\d+)[:\s]+(.+)/i);
  }
  if (!lessonMatch) {
    // Title might be on next line: "ENGLISH B1 — LESSON 11"
    lessonMatch = titleClean.match(/(?:vocabulary\s+)?lesson\s+(\d+)\s*$/i);
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

    if ((/^lesson\s+\d+/i.test(line) || /^vocabulary\s+lesson\s+\d+/i.test(line) || /^📘\s*(vocabulary\s+)?lesson\s+\d+/i.test(line)) && !/answer key/i.test(line) && i > startIdx + 1) break;

    // Some files leave a stray informal answer summary right after an exercise's
    // questions, e.g. a bare "ANSWER KEY:" header with the condensed answers on
    // the next line(s), before the real "Answer Key – Lesson N" section further
    // down. Distinct from an inline "Answer Key: 1-d, 2-e" (content on the SAME
    // line, deliberately left alone below) -- here nothing follows the colon on
    // this line, so skip this line and the condensed-answer line(s) after it
    // without touching the global answer-key state, so it can't swallow a real
    // exercise header that happens to come after it in some other lesson file.
    if (/^answer key\s*:\s*$/i.test(line)) {
      i++;
      while (i < lines.length && lines[i].trim() &&
             !/^exercise\s+[A-G]/i.test(lines[i].trim()) &&
             !/^lesson\s+\d+/i.test(lines[i].trim()) &&
             !/^answer key/i.test(lines[i].trim())) {
        i++;
      }
      continue;
    }

    // Only enter global answer key mode for final answer key section (e.g. "Answer Key – Lesson 2")
    // NOT for inline per-exercise answer keys like "Answer Key: 1-d, 2-e" or standalone "Answer Key:"
    const isStandaloneAK = /^answer key\s*[–\-—]\s*lesson/i.test(line) ||
                            (line.trim().toLowerCase() === 'answer key') ||
                            /^answer key\s*$/i.test(line);
    if (isStandaloneAK) { inAnswerKey = true; i++; continue; }

    if (inAnswerKey) {
      const exMatch = line.match(/^exercise\s+([A-G])/i);
      if (exMatch) { currentAnswerSection = exMatch[1].toUpperCase(); answerKey[currentAnswerSection] = []; i++; continue; }
      // Not just numbered lines -- a "sort into columns" answer key uses
      // category headers ("a:") followed by plain phrase lines with no
      // number at all. Type-specific parsing in mergeAnswerKey ignores
      // whatever shape it doesn't recognize, so collecting more here is safe.
      if (currentAnswerSection && line) answerKey[currentAnswerSection].push(line);
      i++; continue;
    }

    if (/AI CHATBOT|CHATBOT INTERACTION|LEARNING OBJECTIVES|^D\.\s*-+|^-{10,}|^LESSON \d+:/i.test(line)) { i++; continue; }

    // Skip "EXERCISE A — ANSWER KEY" lines — these are in the answer section
    if (/^exercise\s+[A-G].*answer\s*key/i.test(line)) { i++; continue; }
    const exHeaderMatch = line.match(/^exercise\s+([A-G])\s*[–\-—:|\|]\s*(.+)/i);
    if (exHeaderMatch) {
      if (currentExercise) { demoteMatchingToFillBlank(currentExercise); exercises.push(currentExercise); }
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
    if (!currentExercise.instructions && currentExercise.items.length === 0 && line && !/^\d+[\.\)]/.test(line) && !/subject\s+verb/i.test(line)) {
      currentExercise.instructions = line;
      i++; continue;
    }
    if (/^subject\s+verb/i.test(line)) { i++; continue; }

    // "Sort into columns" exercises list plain phrases with no leading number
    // at all (unlike every other exercise type here) -- each remaining line
    // is its own item to categorize, auto-numbered.
    if (currentExercise.type === 'sort' && line && !/^\d+[\.\)]/.test(line)) {
      currentExercise.items.push({ id: currentExercise.items.length + 1, term: line, answer: '' });
      i++; continue;
    }

    // Collect a) b) c) d) options for multiple_choice exercises
    if (currentExercise.type === 'multiple_choice' && /^([a-d])[.)]\s*(.+)/i.test(line)) {
      const lm = line.match(/^([a-d])[.)]\s*(.+)/i);
      if (lm && currentExercise.items.length > 0) {
        const lastItem = currentExercise.items[currentExercise.items.length - 1];
        if (!lastItem.options) lastItem.options = [];
        lastItem.options.push(lm[2].trim());
      }
      i++; continue;
    }

    // Collect a. b. c. lettered definitions for matching exercises
    if (currentExercise.type === 'matching' && /^([a-g])[.)]\s*(.+)/i.test(line)) {
      const lm = line.match(/^([a-g])[.)]\s*(.+)/i);
      if (lm) {
        if (!currentExercise._defs) currentExercise._defs = {};
        currentExercise._defs[lm[1].toLowerCase()] = lm[2].trim();
      }
      i++; continue;
    }

    const itemMatch = line.match(/^(\d+)[\.\)]\s*(.+)/);
    if (itemMatch) {
      const num = parseInt(itemMatch[1]);
      const rawContent = itemMatch[2].trim();

      // Handle inline pipe format: "prompt | A. opt B. opt | ANSWER: X" or "term | ANSWER: category"
      if (rawContent.includes('| ANSWER:') || rawContent.includes('|ANSWER:')) {
        const parts = rawContent.split(/\s*\|\s*/);
        const prompt = parts[0].trim();
        const answerPart = parts.find(p => /^ANSWER:/i.test(p));
        const answer = answerPart ? answerPart.replace(/^ANSWER:\s*/i, '').split('(')[0].trim() : '';
        const optionsPart = parts.find(p => /^[A-D][.)]/i.test(p));

        if (optionsPart) {
          // Multiple choice: has A. B. C. options — split on letter+dot boundaries
          const options = optionsPart
            .split(/\s+(?=[A-D]\.)/i)
            .map(o => o.replace(/^[A-D]\.\s*/i, '').trim())
            .filter(Boolean);
          const correctLetter = answer.replace(/[^A-D]/gi, '').toUpperCase();
          const correctIdx = correctLetter ? correctLetter.charCodeAt(0) - 65 : 0;
          currentExercise.items.push({ id: num, prompt, options, correct: correctIdx, answer: correctLetter });
        } else {
          // Sort or true_false: just prompt + answer
          currentExercise.items.push({ id: num, prompt, term: prompt, answer, explanation: '' });
        }
      } else if (currentExercise.type === 'matching' && rawContent.includes('\t')) {
        // Tab-separated matching: "Term [tab] a. option"
        // The option is NOT the definition — it's one choice in the options list
        // Store it in _defs for later answer key lookup
        const tabParts = rawContent.split(/\t+/);
        const term = tabParts[0].trim();
        const defPart = tabParts[1]?.trim();
        const defMatch = defPart?.match(/^([a-g])[.)\s]+(.+)/i);
        if (defMatch) {
          if (!currentExercise._defs) currentExercise._defs = {};
          currentExercise._defs[defMatch[1].toLowerCase()] = defMatch[2].trim();
        }
        currentExercise.items.push({ id: num, term, definition: '', correctOption: '' });
      } else if (currentExercise.type === 'multiple_choice' && /\sa[.)]\s/i.test(rawContent) && /\sb[.)]\s/i.test(rawContent)) {
        // Inline lettered options on the same line as the question:
        // "1. She _____ to work. a) go b) goes c) went d) going"
        const optStart = rawContent.search(/\sa[.)]\s/i);
        const prompt = rawContent.slice(0, optStart).trim();
        const optionsText = rawContent.slice(optStart).trim();
        const options = optionsText
          .split(/\s+(?=[a-d][.)])/i)
          .map(o => o.replace(/^[a-d][.)]\s*/i, '').trim())
          .filter(Boolean);
        currentExercise.items.push({ id: num, prompt, options, correct: 0, answer: '' });
      } else {
        currentExercise.items.push(parseItem(currentExercise.type, num, rawContent));
      }
    }
    i++;
  }

  if (currentExercise) { demoteMatchingToFillBlank(currentExercise); exercises.push(currentExercise); }
  mergeAnswerKey(exercises, answerKey);

  const contentItems = exercises.filter(ex => ex.items.length > 0).map(ex => toContentItem(ex, level, lessonNumber, lessonTitle, skill));
  return { lessonNumber, lessonTitle, contentItems, _nextLine: i };
}

// Some exercise titles ("Tap the correct article", "Choose the correct form")
// are ambiguous -- they read as a matching/pairing exercise by keyword, but
// the actual content is often just single-blank sentences with one answer
// each, not term/definition pairs. A real matching exercise always produces
// lettered definitions (_defs) or per-item definition/correctOption data; if
// none of that exists, the title match was wrong -- fall back to fill_blank
// and reshape the items to match (prompt/answer instead of term/definition).
function demoteMatchingToFillBlank(ex) {
  if (ex.type !== 'matching') return;
  const hasRealMatchingData = (ex._defs && Object.keys(ex._defs).length > 0) ||
    ex.items.some(it => it.definition || it.correctOption);
  if (hasRealMatchingData) return;
  ex.type = 'fill_blank';
  ex.items = ex.items.map(it => ({ id: it.id, prompt: it.term || it.prompt || '', answer: it.answer || '', explanation: '' }));
}

// ─────────────────────────────────────────────────────────────
// FORMAT 2: Compact/inline format
// e.g. "A1 – Title" then inline exercise blocks
// ─────────────────────────────────────────────────────────────
function parseFormat2(text, level, skill = 'grammar') {
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

  const contentItems = exercises.map(ex => toContentItem(ex, level, lessonNumber, lessonTitle, skill));
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
  if (t.includes('collocation check') || t.includes('collocation swipe') || t.includes('swipe')) return 'true_false';
  if (t.includes('true') && t.includes('false')) return 'true_false';
  if (t.includes('categoris') || t.includes('categoriz') || t.includes('sort') || t.includes('column') || t.includes('frequency scale') || t.includes('ordering') || t.includes('odd one out')) return 'sort';
  if (t.includes('rewrite') || t.includes('transform') || t.includes('replace') || t.includes('join') || t.includes('combine') || t.includes('sentence combine')) return 'rewrite';
  if (t.includes('short answer') || t.includes('completion') || t.includes('form fill')) return 'short_answer';
  if (t.includes('multiple choice') || t.includes('choose the correct') || t.includes('choose the best') || t.includes('mime guess') || t.includes('choose correct') || t.includes('choose meaning') || t.includes('choose function') || t.includes('sentence choice') || t.includes('follow instructions') || t.includes('map task') || t.includes('gap fill') || t.includes('gap-fill') || t.includes('context choice') || t.includes('definition match')) return 'multiple_choice';
  if (t.includes('fill') || t.includes('blank') || t.includes('complete') || t.includes('sentence order')) return 'fill_blank';
  if (t.includes('match') || t.includes('tap') || t.includes('drag') || t.includes('emoji') || t.includes('memory') || t.includes('opposite') || t.includes('pair') || t.includes('correct article') || t.includes('correct demonstrative') || t.includes('correct form') || t.includes('correct conjunction')) return 'matching';
  if (t.includes('unjumble') || t.includes('reorder') || t.includes('reorder') || t.includes('drag path') || t.includes('sequence') || t.includes('put') && t.includes('order')) return 'sentence_reorder';
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

    // "Sort into columns" answer keys are category headers ("a:") followed by
    // plain phrase lines, not numbered lines -- handle that shape separately.
    if (ex.type === 'sort' && answers.length > 0 && !answers.some(a => /^\d+[.)]/.test(a.trim()))) {
      mergeSortCategoryAnswerKey(ex, answers);
      continue;
    }

    for (const ansLine of answers) {
      const t = ansLine.trim();
      // Skip meta-notes like "(Accept: isn't / aren't)"
      if (/^\(Accept/i.test(t) || !t) continue;

      if (ex.type === 'matching') {
        // Formats: "1-c", "1–c", "1 → E", "1 — E", "1-B"
        const m = t.match(/^(\d+)\s*[–\-—→>]+\s*([a-g])/i);
        if (m) {
          const item = ex.items.find(it => it.id === parseInt(m[1]));
          if (item) item.correctOption = m[2].toLowerCase();
        }
        continue;
      }
      if (ex.type === 'multiple_choice') {
        // Formats: "1-b" or "1. b" — set correct index from letter
        const m = t.match(/^(\d+)[\-–.\s]+([a-d])/i);
        if (m) {
          const item = ex.items.find(it => it.id === parseInt(m[1]));
          if (item) {
            const letter = m[2].toLowerCase();
            item.answer = letter.toUpperCase();
            item.correct = letter.charCodeAt(0) - 97; // a→0, b→1, c→2, d→3
          }
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

// Matches each phrase line to an item by substituting the current category
// word into that item's blank and comparing -- e.g. item.term
// "___ big office in the city" under category "a" becomes "a big office in
// the city", which is compared against the answer line of the same text.
function mergeSortCategoryAnswerKey(ex, answers) {
  let currentCategory = null;
  const normalize = s => s.toLowerCase().replace(/\s+/g, ' ').trim();
  for (const raw of answers) {
    const line = raw.trim();
    const catMatch = line.match(/^([a-z]+)\s*:\s*$/i);
    if (catMatch) { currentCategory = catMatch[1]; continue; }
    if (!currentCategory || !line) continue;
    const target = normalize(line);
    const item = ex.items.find(it => normalize((it.term || '').replace(/_{2,}/g, currentCategory)) === target);
    if (item) item.answer = currentCategory;
  }
}

function toContentItem(ex, level, lessonNumber, lessonTitle, skill = 'grammar') {
  return {
    level,
    skill,
    type: ex.type,
    title: `Lesson ${lessonNumber}: ${lessonTitle} — Exercise ${ex.letter}`,
    tags: [`lesson_${lessonNumber}`, skill, level.toLowerCase()],
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
    const defs = ex._defs || {};
    return { instructions: ex.instructions, items: ex.items.map(it => ({
      id: it.id,
      term: it.term,
      // correct_option tells us WHICH definition is correct for this term
      // definition should be the CORRECT answer (looked up via correctOption)
      definition: (it.correctOption && defs[it.correctOption]) || 
                  (it.optionLetter && defs[it.optionLetter]) || 
                  it.definition || '',
      correct_option: it.correctOption || it.optionLetter || '',
    })) };
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
// FORMAT 3: Markdown format — supports multiple lessons
// # Lesson N – Title (h1)
// ## Exercise A – Type (h2)
// ─────────────────────────────────────────────────────────────
function parseFormat3(text, level, skill = 'grammar') {
  // If multiple "# Lesson" headers exist, split and process each
  const raw = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  const lessonChunks = raw.split(/(?=^# Lesson\s+\d+)/im).filter(c => /^# Lesson\s+\d+/im.test(c));
  if (lessonChunks.length > 1) {
    const allLessons = [];
    for (const chunk of lessonChunks) {
      const result = parseFormat3Single(chunk, level, skill);
      if (result) allLessons.push(result);
    }
    return allLessons;
  }
  const single = parseFormat3Single(text, level, skill);
  return single ? [single] : [];
}

function parseFormat3Single(text, level, skill = 'grammar') {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && l !== '---');

  // Extract title from # heading: "# Lesson 17 – Nature & The Environment"
  const titleLine = lines.find(l => l.startsWith('# '));
  let lessonNumber = 1;
  let lessonTitle = 'Lesson';
  if (titleLine) {
    const lm = titleLine.replace(/^#\s*/, '').match(/(?:lesson\s+(\d+)\s*[–\-—:|]\s*)?(.+)/i);
    if (lm) {
      lessonNumber = lm[1] ? parseInt(lm[1]) : 1;
      lessonTitle = lm[2].trim();
    }
  }

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
  const exerciseSections = sections.filter(s => /exercise\s+[A-D]/i.test(s.header));

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
    const exMatch = section.header.match(/exercise\s+([A-D])\s*[:\-–—]\s*(.+)/i);
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

  const contentItems = exercises.map(ex => toContentItem(ex, level, lessonNumber, lessonTitle, skill));
  if (contentItems.length === 0) return null;
  return { lessonNumber, lessonTitle, contentItems, _nextLine: 9999 };
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
function parseFormat4(text, level, skill = 'grammar') {
  // Handle multiple lessons in one file - split on lesson headers
  const lessonChunks = text.split(/(?=^\s*Lesson\s+\d+[:\s–\-—]|^\s*LESSON\s+\d+[:\s–\-—])/im)
    .filter(c => /^\s*(?:Lesson|LESSON)\s+\d+[:\s–\-—]/im.test(c));
  
  if (lessonChunks.length > 1) {
    const allLessons = [];
    for (const chunk of lessonChunks) {
      const result = parseFormat4Single(chunk, level, skill);
      if (result && result[0]?.contentItems?.length > 0) {
        allLessons.push(...result);
      }
    }
    return allLessons;
  }
  return parseFormat4Single(text, level, skill);
}

function parseFormat4Single(text, level, skill = 'grammar') {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  // Find lesson header
  let lessonNumber = 1;
  let lessonTitle = '';
  const exercises = [];
  let currentExercise = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Lesson header: "Lesson N – Title" or "Lesson N" (handles all caps, answer key lines)
    const lessonM = line.match(/^(?:Lesson|LESSON)\s+(\d+)\s*[–\-—|:]?\s*(.*)/i);
    if (lessonM && !/exercise|answer key/i.test(line)) {
      lessonNumber = parseInt(lessonM[1]);
      lessonTitle = lessonM[2].trim()
        .replace(/\(.*?\)/g, '').trim() // remove parenthetical subtitles
        .replace(/^[–\-—:]\s*/, '').trim(); // remove leading dashes
      // If title is empty or looks like a subtitle, check next line
      if (!lessonTitle && lines[i+1] && !/^exercise/i.test(lines[i+1]) && !/^\d+\./.test(lines[i+1])) {
        lessonTitle = lines[i+1].trim();
      }
      continue;
    }

    // Exercise header: "Exercise N – Type" or "Exercise N"
    // Strip leading spaces and "--- " prefixes before matching
    const stripped = line.replace(/^[\s\-]+/, '').trim();
    const exM = stripped.match(/^Exercise\s+(\d+)\s*[–\-—|:]?\s*(.*)/i) || 
                stripped.match(/^EXERCISE\s+(\d+)\s*[:\-—|]\s*(.*)/i);
    // Skip answer key exercise headers: "--- EXERCISE 1 --- answer1, answer2"
    if (exM && /---/.test(line)) { i++; continue; }
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
        // Split on whitespace preceding the next letter marker (not on the letters
        // themselves) -- a char-class-based split would also strip any a/b/c/d
        // that appears inside the option text (e.g. "believed", "have believed").
        const options = optionsPart
          .split(/\s+(?=[A-D][.)])/i)
          .map(o => o.replace(/^[A-D][.)]\s*/i, '').trim())
          .filter(Boolean);

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
      skill,
      type: ex.type,
      title: `Lesson ${lessonNumber}: ${lessonTitle} — Exercise ${ex.letter}`,
      tags: [`lesson_${lessonNumber}`, skill, level.toLowerCase(), `exercise_${ex.number}`],
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

