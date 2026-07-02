import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { parseContentFile } from '../services/contentParser.js';
import { aiParseContent } from '../services/aiParser.js';

const router = Router();
router.use(requireAuth, requireRole('admin', 'teacher'));

/**
 * POST /upload/content
 * Body: { text: <file contents>, level: 'A1'|'A2'|'B1'|'B2', replace: bool }
 *
 * Parses the .txt file and inserts content items into the database.
 */
router.post('/content', async (req, res) => {
  const { text, level, replace = false } = req.body;

  if (!text || !level) {
    return res.status(400).json({ error: 'text and level are required' });
  }

  const validLevels = ['A1', 'A2', 'B1', 'B2'];
  if (!validLevels.includes(level)) {
    return res.status(400).json({ error: `level must be one of: ${validLevels.join(', ')}` });
  }

  // Parse the file — try rule-based first, fall back to AI parser
  let lessons;
  try {
    lessons = parseContentFile(text, level);
    // If rule-based parser found the lesson but got no exercises, use AI
    const hasExercises = lessons.some(l => l.contentItems?.length > 0);
    if ((!lessons || lessons.length === 0 || !hasExercises) && process.env.ANTHROPIC_API_KEY) {
      console.log('[upload] Rule-based parser found no exercises, trying AI parser...');
      lessons = await aiParseContent(text, level, process.env.ANTHROPIC_API_KEY);
    }
  } catch (err) {
    console.error('[upload/parse]', err);
    // Last resort: try AI parser
    try {
      if (process.env.ANTHROPIC_API_KEY) {
        lessons = await aiParseContent(text, level, process.env.ANTHROPIC_API_KEY);
      }
    } catch (aiErr) {
      return res.status(400).json({ error: `Failed to parse file: ${err.message}` });
    }
  }

  if (!lessons || lessons.length === 0) {
    return res.status(400).json({ error: 'No lessons found in file. Check the format.' });
  }

  const allItems = lessons.flatMap(l => l.contentItems);

  if (allItems.length === 0) {
    return res.status(400).json({ error: 'No exercises could be parsed from the file.' });
  }

  // If replace=true, delete existing content for this school+level+skill
  if (replace) {
    await query(
      `DELETE FROM content_items WHERE school_id = $1 AND level = $2 AND skill = 'grammar'`,
      [req.school.id, level]
    );
  }

  // Insert all parsed items
  let inserted = 0;
  const errors = [];

  for (const item of allItems) {
    try {
      await query(
        `INSERT INTO content_items (id, school_id, level, skill, type, title, tags, body)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          uuidv4(),
          req.school.id,
          item.level,
          item.skill,
          item.type,
          item.title,
          item.tags,
          JSON.stringify(item.body),
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
      exercises: l.contentItems.length,
    })),
    errors,
  });
});

/**
 * GET /upload/content/preview
 * Preview parsed content without saving — useful for checking before committing
 * Body: { text, level }
 */
router.post('/content/preview', async (req, res) => {
  const { text, level } = req.body;
  if (!text || !level) return res.status(400).json({ error: 'text and level required' });

  try {
    const lessons = parseContentFile(text, level);
    res.json({
      lessons: lessons.map(l => ({
        number: l.lessonNumber,
        title: l.lessonTitle,
        exercises: l.contentItems.map(c => ({
          title: c.title,
          type: c.type,
          item_count: c.body.items?.length || 0,
          sample: c.body.items?.[0] || null,
        })),
      })),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /upload/content/list — list uploaded content by level
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
 * DELETE /upload/content — delete all content for a level
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

export default router;

/**
 * POST /upload/bulk
 * Direct insert of pre-parsed content items (used by bulk upload scripts).
 * Body: { items: [{ level, skill, type, title, tags, body }], replace_level? }
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
      await query(
        `INSERT INTO content_items (id, school_id, level, skill, type, title, tags, body)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          (await import('uuid')).v4(),
          req.school.id,
          item.level, item.skill, item.type, item.title,
          item.tags || [],
          JSON.stringify(item.body),
        ]
      );
      inserted++;
    } catch (err) {
      errors.push({ title: item.title, error: err.message });
    }
  }

  res.status(201).json({
    success: true,
    inserted,
    errors: errors.length,
    error_details: errors,
  });
});

/**
 * DELETE /upload/level
 * Wipe all content for a specific level + skill.
 * Used for cleanup before re-uploading.
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
