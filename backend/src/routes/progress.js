import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole('student'));

/**
 * GET /progress — current student's progress across all skills/levels
 */
router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT skill, level, exercises_completed, exercises_correct, avg_score, last_activity_at
     FROM progress_snapshots
     WHERE student_id = $1 AND school_id = $2
     ORDER BY level, skill`,
    [req.user.id, req.school.id]
  );
  res.json({ progress: rows });
});

/**
 * GET /progress/resume — last-touched content for "continue where you left off"
 */
router.get('/resume', async (req, res) => {
  const { rows } = await query(
    `SELECT ps.skill, ps.level, ps.last_activity_at,
            ci.id AS content_item_id, ci.title, ci.type
     FROM progress_snapshots ps
     LEFT JOIN LATERAL (
       SELECT id, title, type FROM content_items
       WHERE (school_id = $2 OR school_id IS NULL)
         AND skill = ps.skill AND level = ps.level AND is_active = true
       ORDER BY created_at DESC LIMIT 1
     ) ci ON true
     WHERE ps.student_id = $1 AND ps.school_id = $2
     ORDER BY ps.last_activity_at DESC NULLS LAST
     LIMIT 1`,
    [req.user.id, req.school.id]
  );
  res.json({ resume: rows[0] || null });
});

export default router;
