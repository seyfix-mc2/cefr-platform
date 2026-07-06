import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { parseContentFile } from '../services/contentParser.js';

const router = Router();
router.use(requireAuth, requireRole('admin', 'teacher'));

/**
 * POST /upload/content
 * Body: { text, level, replace? }
 */
router.post('/content', async (req, res) => {
  let { text, level, skill = 'grammar', replace = false } = req.body;
  // Normalize line endings — Windows files send \r\n which breaks regex matching
  if (text) text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  if (!text || !level) {
    return res.status(400).json({ error: 'text and level are required' });
  }

  const validLevels = ['A1', 'A2', 'B1', 'B2'];
  if (!validLevels.includes(level)) {
    return res.status(400).json({ error: `level must be one of: ${validLevels.join(', ')}` });
  }

  let lessons;
  try {
    lessons = parseContentFile(text, level, skill);
  } catch (err) {
    console.error('[upload/parse]', err);
    return res.status(400).json({ error: `Failed to parse file: ${err.message}` });
  }

  console.log('[upload] parsed', lessons?.length, 'lessons, level:', level, 'skill:', skill, 'text length:', text?.length);
  lessons?.forEach(l => console.log(`  L${l.lessonNumber}: ${l.lessonTitle} — ${l.contentItems?.length || 0} exercises`));
  // Log first 200 chars and key line detection
  const lines = text?.split('\n') || [];
  console.log('[upload] line count:', lines.length);
  console.log('[upload] first line:', JSON.stringify(lines[0]));
  console.log('[upload] has Exercise A:', lines.some(l => /^Exercise\s+A/i.test(l.trim())));
  console.log('[upload] has Answer Key:', lines.some(l => /answer key/i.test(l.trim())));
  console.log('[upload] exercise lines:', lines.filter(l => /^Exercise\s+[A-D]/i.test(l.trim())).map(l => l.trim().slice(0,50)));

  if (!lessons || lessons.length === 0) {
    return res.status(400).json({ error: 'No lessons found in file. Check the format.' });
  }

  const allItems = lessons.flatMap(l => l.contentItems || []);

  console.log('[upload] total items:', allItems.length);

  if (allItems.length === 0) {
    // Check which parser version is running
    const { parseContentFile: _pcf } = await import('../services/contentParser.js');
    const parserVersion = _pcf.toString().includes('isStandaloneAK') ? 'v2.1' : 'v1.0';
    return res.status(400).json({ 
      error: 'No exercises could be parsed from the file.',
      debug: { 
        lessons_found: lessons.length, 
        lesson_titles: lessons.map(l => l.lessonTitle),
        parser_version: parserVersion,
        first_100_chars: text.slice(0, 100)
      }
    });
  }

  if (replace) {
    await query(
      `DELETE FROM content_items WHERE school_id = $1 AND level = $2 AND skill = $3`,
      [req.school.id, level, skill]
    );
  } else {
    // Delete specific lesson numbers before inserting to prevent duplicates
    const lessonNums = lessons.map(l => l.lessonNumber).filter(Boolean);
    if (lessonNums.length > 0) {
      for (const num of lessonNums) {
        const { rowCount } = await query(
          `DELETE FROM content_items 
           WHERE school_id = $1 AND level = $2
           AND title ~ $3`,
          [req.school.id, level, `Lesson\s+${num}[^0-9]`]
        );
        console.log(`[upload] deleted ${rowCount} items for Lesson ${num}`);
      }
    }
  }

  let inserted = 0;
  const errors = [];

  for (const item of allItems) {
    try {
      await query(
        `INSERT INTO content_items (id, school_id, level, skill, type, title, tags, body)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          uuidv4(), req.school.id,
          item.level, item.skill, item.type, item.title,
          item.tags || [], JSON.stringify(item.body),
        ]
      );
      inserted++;
    } catch (err) {
      errors.push({ title: item.title, error: err.message });
    }
  }

  res.status(201).json({
    success: true,
    summary: {
      lessons_found: lessons.length,
      exercises_inserted: inserted,
      errors: errors.length,
    },
    lessons: lessons.map(l => ({
      number: l.lessonNumber,
      title: l.lessonTitle,
      exercises: l.contentItems?.length || 0,
    })),
    errors,
  });
});

/**
 * POST /upload/content/preview
 */
router.post('/content/preview', async (req, res) => {
  let { text, level } = req.body;
  if (!text || !level) return res.status(400).json({ error: 'text and level required' });
  if (text) text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  try {
    const lessons = parseContentFile(text, level);
    res.json({
      lessons: lessons.map(l => ({
        number: l.lessonNumber,
        title: l.lessonTitle,
        exercises: l.contentItems?.map(c => ({
          title: c.title,
          type: c.type,
          item_count: c.body?.items?.length || 0,
          sample: c.body?.items?.[0] || null,
        })) || [],
      })),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /upload/content/list
 */
router.get('/content/list', async (req, res) => {
  const { level } = req.query;
  const params = [req.school.id];
  let levelFilter = '';
  if (level) {
    params.push(level);
    levelFilter = `AND level = $${params.length}`;
  }

  const { rows } = await query(
    `SELECT level, skill, type, COUNT(*) as count
     FROM content_items
     WHERE school_id = $1 ${levelFilter}
     GROUP BY level, skill, type
     ORDER BY level, skill, type`,
    params
  );
  res.json({ content: rows });
});

/**
 * DELETE /upload/content
 */
router.delete('/content', async (req, res) => {
  const { level, skill = 'grammar' } = req.body;
  if (!level) return res.status(400).json({ error: 'level required' });

  const { rowCount } = await query(
    `DELETE FROM content_items WHERE school_id = $1 AND level = $2 AND skill = $3`,
    [req.school.id, level, skill]
  );
  res.json({ deleted: rowCount });
});

/**
 * GET /upload/lessons
 */
router.get('/lessons', async (req, res) => {
  const { level, skill = 'grammar' } = req.query;
  if (!level) return res.status(400).json({ error: 'level required' });

  const { rows } = await query(
    `SELECT DISTINCT
       CAST(REGEXP_REPLACE(title, '.*Lesson\\s+(\\d+).*', '\\1') AS INTEGER) AS lesson_number,
       COUNT(*) AS exercise_count
     FROM content_items
     WHERE school_id = $1
       AND level = $2
       AND skill = $3
       AND title ~ 'Lesson\\s+\\d+'
       AND is_active = true
     GROUP BY lesson_number
     ORDER BY lesson_number`,
    [req.school.id, level, skill]
  );

  res.json({
    level, skill,
    uploaded_lessons: rows.map(r => ({
      lesson_number: r.lesson_number,
      exercise_count: parseInt(r.exercise_count)
    }))
  });
});

/**
 * POST /upload/bulk
 */
router.post('/bulk', async (req, res) => {
  const { items, replace_level } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array required' });
  }

  if (replace_level) {
    await query(
      `DELETE FROM content_items WHERE school_id = $1 AND level = $2 AND skill = 'grammar'`,
      [req.school.id, replace_level]
    );
  }

  let inserted = 0;
  const errors = [];

  for (const item of items) {
    try {
      const { v4 } = await import('uuid');
      await query(
        `INSERT INTO content_items (id, school_id, level, skill, type, title, tags, body)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [v4(), req.school.id, item.level, item.skill, item.type, item.title, item.tags || [], JSON.stringify(item.body)]
      );
      inserted++;
    } catch (err) {
      errors.push({ title: item.title, error: err.message });
    }
  }

  res.status(201).json({ success: true, inserted, errors: errors.length, error_details: errors });
});

/**
 * DELETE /upload/level
 */
router.delete('/level', async (req, res) => {
  const { level, skill = 'grammar' } = req.body;
  if (!level) return res.status(400).json({ error: 'level required' });

  const { rowCount } = await query(
    `DELETE FROM content_items WHERE school_id = $1 AND level = $2 AND skill = $3`,
    [req.school.id, level, skill]
  );
  res.json({ deleted: rowCount, level, skill });
});

export default router;

/**
 * POST /upload/debug — test parser without saving (temporary debug endpoint)
 */
router.post('/debug', async (req, res) => {
  const { text, level } = req.body;
  if (!text || !level) return res.status(400).json({ error: 'text and level required' });
  try {
    const { parseContentFile } = await import('../services/contentParser.js');
    const lessons = parseContentFile(text, level);
    res.json({
      lessons_found: lessons.length,
      lessons: lessons.map(l => ({
        number: l.lessonNumber,
        title: l.lessonTitle,
        exercises: l.contentItems?.length || 0,
        exercise_detail: l.contentItems?.map(ci => `${ci.exercise_letter}:${ci.type}(${ci.body?.items?.length})`)
      }))
    });
  } catch (err) {
    res.status(400).json({ error: err.message, stack: err.stack?.split('\n').slice(0,5) });
  }
});
