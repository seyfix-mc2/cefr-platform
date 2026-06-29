/**
 * Parser for CEFR content .txt files
 *
 * Expected format:
 *   Lesson N – Title
 *   Exercise A – Fill in the blanks
 *   1. sentence with ___ blank
 *   ...
 *   Exercise B – Tap & Match
 *   1. Term   a. definition
 *   ...
 *   Exercise C – Sentence Unjumble
 *   1. word / word / word
 *   ...
 *   Answer Key – Lesson N
 *   Exercise A
 *   1. answer
 *   Exercise B
 *   1–c (...)
 *   Exercise C
 *   1. Full sentence answer.
 */

export function parseContentFile(text, level) {
  // Normalize line endings
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  const lessons = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Detect lesson header: "Lesson 1 – ..." or "Lesson 1: ..."
    if (/^lesson\s+\d+/i.test(line) && !line.toUpperCase().includes('ANSWER KEY')) {
      const lesson = parseLessonBlock(lines, i, level);
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

function parseLessonBlock(lines, startIdx, level) {
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

    // Stop at next lesson
    if (/^lesson\s+\d+/i.test(line) && !line.toUpperCase().includes('ANSWER KEY') && i > startIdx + 1) {
      break;
    }

    // Detect answer key section
    if (/answer key/i.test(line)) {
      inAnswerKey = true;
      i++;
      continue;
    }

    if (inAnswerKey) {
      // Detect which exercise's answers we're reading
      const exMatch = line.match(/^exercise\s+([A-C])/i);
      if (exMatch) {
        currentAnswerSection = exMatch[1].toUpperCase();
        answerKey[currentAnswerSection] = [];
        i++;
        continue;
      }
      // Collect answer lines
      if (currentAnswerSection && line && /^\d+/.test(line)) {
        answerKey[currentAnswerSection].push(line);
      }
      i++;
      continue;
    }

    // Skip AI chatbot / interactive sections entirely
    if (/AI CHATBOT|CHATBOT INTERACTION|LEARNING OBJECTIVES|── EXERCISE 1A/i.test(line) ||
        /^D\.\s*-+/.test(line) ||
        /^-{10,}/.test(line) ||
        /^LESSON \d+:/i.test(line)) {
      // Skip until next real Exercise A/B/C or end
      i++;
      continue;
    }

    // Detect exercise header: "Exercise A – ..."
    const exHeaderMatch = line.match(/^exercise\s+([A-C])\s*[–\-:]\s*(.+)/i);
    if (exHeaderMatch) {
      if (currentExercise) exercises.push(currentExercise);
      const exLetter = exHeaderMatch[1].toUpperCase();
      const exTitle = exHeaderMatch[2].trim();
      currentExercise = {
        letter: exLetter,
        title: exTitle,
        type: detectExerciseType(exTitle),
        instructions: '',
        items: [],
      };
      i++;
      continue;
    }

    if (!currentExercise) { i++; continue; }

    // Instructions line (before numbered items)
    if (currentExercise.items.length === 0 && line && !/^\d+[\.\)]/.test(line) && !/subject\s+verb/i.test(line)) {
      if (line) currentExercise.instructions = line;
      i++;
      continue;
    }

    // Skip table headers like "Subject  Verb"
    if (/^subject\s+verb/i.test(line)) { i++; continue; }

    // Parse numbered items
    const itemMatch = line.match(/^(\d+)[\.\)]\s*(.+)/);
    if (itemMatch) {
      const num = parseInt(itemMatch[1]);
      const content = itemMatch[2].trim();

      if (currentExercise.type === 'matching') {
        // Format: "1. I   a. is"
        const matchParts = content.split(/\t+/);
        if (matchParts.length >= 2) {
          const term = matchParts[0].trim();
          const defPart = matchParts[1].trim();
          const defMatch = defPart.match(/^[a-g]\.\s*(.+)/i);
          currentExercise.items.push({
            id: num,
            term: term,
            definition: defMatch ? defMatch[1].trim() : defPart,
            optionLetter: defPart[0].toLowerCase(),
          });
        } else {
          currentExercise.items.push({ id: num, term: content, definition: '' });
        }
      } else if (currentExercise.type === 'sentence_reorder') {
        // Format: "1. I / am / very happy / today"
        const words = content.split('/').map(w => w.trim()).filter(Boolean);
        currentExercise.items.push({ id: num, words, answer: '' });
      } else {
        // fill_blank: "1. I ___ a teacher"
        currentExercise.items.push({ id: num, prompt: content, answer: '' });
      }
      i++;
      continue;
    }

    i++;
  }

  if (currentExercise) exercises.push(currentExercise);

  // Merge answer key into exercises
  for (const ex of exercises) {
    const answers = answerKey[ex.letter] || [];
    for (const ansLine of answers) {
      if (ex.type === 'fill_blank') {
        const m = ansLine.match(/^(\d+)[\.\)]\s*(.+)/);
        if (m) {
          const item = ex.items.find(it => it.id === parseInt(m[1]));
          if (item) item.answer = m[2].trim();
        }
      } else if (ex.type === 'matching') {
        // "1–c (I → am)" — map answer letter back to definition
        const m = ansLine.match(/^(\d+)[–\-]([a-g])/i);
        if (m) {
          const item = ex.items.find(it => it.id === parseInt(m[1]));
          if (item) item.correctOption = m[2].toLowerCase();
        }
      } else if (ex.type === 'sentence_reorder') {
        const m = ansLine.match(/^(\d+)[\.\)]\s*(.+)/);
        if (m) {
          const item = ex.items.find(it => it.id === parseInt(m[1]));
          if (item) item.answer = m[2].trim();
        }
      }
    }
  }

  // Convert to ContentItem format
  const contentItems = exercises
    .filter(ex => ex.items.length > 0)
    .map(ex => ({
      level,
      skill: 'grammar',
      type: ex.type,
      title: `Lesson ${lessonNumber}: ${lessonTitle} — Exercise ${ex.letter}`,
      tags: [`lesson_${lessonNumber}`, 'grammar', level.toLowerCase()],
      body: buildBody(ex),
      lesson_number: lessonNumber,
      exercise_letter: ex.letter,
    }));

  return { lessonNumber, lessonTitle, contentItems, _nextLine: i };
}

function detectExerciseType(title) {
  const t = title.toLowerCase();
  if (t.includes('fill') || t.includes('blank')) return 'fill_blank';
  if (t.includes('match') || t.includes('tap')) return 'matching';
  if (t.includes('unjumble') || t.includes('order') || t.includes('reorder')) return 'sentence_reorder';
  return 'fill_blank';
}

function buildBody(ex) {
  if (ex.type === 'fill_blank') {
    return {
      instructions: ex.instructions || 'Fill in the blanks.',
      items: ex.items.map(it => ({
        id: it.id,
        prompt: it.prompt,
        answer: it.answer,
        explanation: '',
      })),
    };
  }
  if (ex.type === 'matching') {
    return {
      instructions: ex.instructions || 'Match each item with the correct answer.',
      items: ex.items.map(it => ({
        id: it.id,
        term: it.term,
        definition: it.definition,
        correct_option: it.correctOption || '',
      })),
    };
  }
  if (ex.type === 'sentence_reorder') {
    return {
      instructions: ex.instructions || 'Put the words in the correct order.',
      items: ex.items.map(it => ({
        id: it.id,
        words: it.words,
        answer: it.answer,
      })),
    };
  }
  return { instructions: ex.instructions, items: ex.items };
}
