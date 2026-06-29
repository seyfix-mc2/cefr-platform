import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { scoreSpeakingAttempt } from '../ai/speaking.js';

const router = Router();
router.use(requireAuth);

/**
 * POST /speaking/attempts
 * Student submits a speaking attempt. AI scores it immediately.
 * Body: { content_item_id, type, text_response?, audio_url? }
 */
router.post('/attempts', requireRole('student'), async (req, res) => {
  const { content_item_id, type, text_response, audio_url } = req.body;

  if (!content_item_id || !type) {
    return res.status(400).json({ error: 'content_item_id and type are required' });
  }

  const validTypes = ['dictation', 'read_aloud', 'picture_description'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
  }

  // Fetch the content item to pass to AI
  const { rows: items } = await query(
    `SELECT * FROM content_items WHERE id = $1 AND (school_id = $2 OR school_id IS NULL)`,
    [content_item_id, req.school.id]
  );
  if (items.length === 0) return res.status(404).json({ error: 'Content item not found' });

  const contentItem = items[0];

  // Score via AI (single request → single response, no conversation)
  let aiResult;
  try {
    aiResult = await scoreSpeakingAttempt({
      type,
      contentItem,
      textResponse: text_response,
      audioUrl: audio_url,
    });
  } catch (err) {
    console.error('[speaking/ai]', err);
    return res.status(502).json({ error: 'AI scoring temporarily unavailable' });
  }

  // Audio retention: 90 days default
  const audioExpiresAt = audio_url
    ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { rows } = await query(
    `INSERT INTO speaking_attempts
       (id, school_id, student_id, content_item_id, type,
        text_response, audio_url, audio_expires_at,
        ai_score, ai_feedback_text, ai_raw_response)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id, type, ai_score, ai_feedback_text, created_at`,
    [
      uuidv4(), req.school.id, req.user.id, content_item_id, type,
      text_response || null, audio_url || null, audioExpiresAt,
      aiResult.score, aiResult.feedback, JSON.stringify(aiResult.raw)
    ]
  );

  // Update progress snapshot
  await upsertProgress(req.user.id, req.school.id, 'speaking', contentItem.level, aiResult.score);

  res.status(201).json({ attempt: rows[0] });
});

/**
 * GET /speaking/attempts — student's own attempts
 */
router.get('/attempts', async (req, res) => {
  const studentId = req.user.role === 'student'
    ? req.user.id
    : req.query.student_id;

  if (!studentId) return res.status(400).json({ error: 'student_id required' });

  const { rows } = await query(
    `SELECT sa.id, sa.type, sa.ai_score, sa.ai_feedback_text, sa.created_at,
            ci.title AS content_title, ci.level, ci.type AS content_type
     FROM speaking_attempts sa
     JOIN content_items ci ON ci.id = sa.content_item_id
     WHERE sa.student_id = $1 AND sa.school_id = $2
     ORDER BY sa.created_at DESC
     LIMIT 50`,
    [studentId, req.school.id]
  );
  res.json({ attempts: rows });
});

// ────────────────────────────────────────────────────────────
// Progress snapshot upsert helper
// ────────────────────────────────────────────────────────────
async function upsertProgress(studentId, schoolId, skill, level, score) {
  await query(
    `INSERT INTO progress_snapshots
       (id, school_id, student_id, skill, level, exercises_completed, exercises_correct, avg_score, last_activity_at)
     VALUES ($1, $2, $3, $4, $5, 1, CASE WHEN $6 >= 60 THEN 1 ELSE 0 END, $6, NOW())
     ON CONFLICT (student_id, skill, level) DO UPDATE SET
       exercises_completed = progress_snapshots.exercises_completed + 1,
       exercises_correct = progress_snapshots.exercises_correct + CASE WHEN $6 >= 60 THEN 1 ELSE 0 END,
       avg_score = ROUND(
         (progress_snapshots.avg_score * progress_snapshots.exercises_completed + $6)
         / (progress_snapshots.exercises_completed + 1), 2
       ),
       last_activity_at = NOW(),
       updated_at = NOW()`,
    [uuidv4(), schoolId, studentId, skill, level, score]
  );
}

export { upsertProgress };
export default router;
