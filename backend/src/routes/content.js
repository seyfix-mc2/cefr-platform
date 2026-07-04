import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /content
 * Query params: level, skill, type, limit, offset
 */
router.get('/', async (req, res) => {
  const { level, skill, type, limit = 500, offset = 0 } = req.query;
  const params = [req.school.id];
  const conditions = ['(ci.school_id = $1 OR ci.school_id IS NULL)', 'ci.is_active = true'];

  if (level) { params.push(level); conditions.push(`ci.level = $${params.length}`); }
  if (skill) { params.push(skill); conditions.push(`ci.skill = $${params.length}`); }
  if (type)  { params.push(type);  conditions.push(`ci.type = $${params.length}`); }

  params.push(parseInt(limit), parseInt(offset));

  const { rows } = await query(
    `SELECT ci.id, ci.level, ci.skill, ci.type, ci.title, ci.tags, ci.body
     FROM content_items ci
     WHERE ${conditions.join(' AND ')}
     ORDER BY ci.level, ci.skill,
       -- Sort by lesson number extracted from title
       CAST(REGEXP_REPLACE(ci.title, '.*Lesson\\s+(\\d+).*', '\\1', 'i') AS INTEGER) NULLS LAST,
       ci.title
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json({ items: rows });
});

/**
 * GET /content/:id — single item
 */
router.get('/:id', async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM content_items
     WHERE id = $1 AND (school_id = $2 OR school_id IS NULL) AND is_active = true`,
    [req.params.id, req.school.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Content not found' });
  res.json({ item: rows[0] });
});

/**
 * GET /content/games/templates
 * Returns game templates for a given level/skill, with linked content items
 */
router.get('/games/templates', async (req, res) => {
  const { level, skill } = req.query;
  const params = [req.school.id];
  const conditions = ['(gt.school_id = $1 OR gt.school_id IS NULL)'];

  if (level) { params.push(level); conditions.push(`gt.level = $${params.length}`); }
  if (skill) { params.push(skill); conditions.push(`gt.skill = $${params.length}`); }

  const { rows } = await query(
    `SELECT gt.id, gt.name, gt.mechanic_type, gt.level, gt.skill, gt.config,
            gt.linked_content_item_ids
     FROM game_templates gt
     WHERE ${conditions.join(' AND ')}
     ORDER BY gt.name`,
    params
  );
  res.json({ templates: rows });
});

export default router;
