import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { generateAssignment } from '../ai/generate.js';
import { upsertProgress } from './speaking.js';

const router = Router();
router.use(requireAuth);

// ──────────────────────────────────────────────
// TEACHER: generate + manage assignments
// ──────────────────────────────────────────────

/**
 * POST /assignments/generate
 * Teacher requests AI-generated draft. Returns draft for editing — not saved yet.
 */
router.post('/generate', requireRole('admin', 'teacher'), async (req, res) => {
  const { type, level, skill, topic, question_types, question_count = 10 } = req.body;

  if (!type || !level || !skill || !topic || !question_types?.length) {
    return res.status(400).json({ error: 'type, level, skill, topic, question_types required' });
  }

  // Fetch sample content items from school's bank for style reference
  const { rows: samples } = await query(
    `SELECT body, type FROM content_items
     WHERE (school_id = $1 OR school_id IS NULL) AND level = $2 AND skill = $3 AND is_active = true
     ORDER BY RANDOM() LIMIT 3`,
    [req.school.id, level, skill]
  );

  try {
    const generated = await generateAssignment({
      type, level, skill, topic,
      questionTypes: question_types,
      questionCount: parseInt(question_count),
      sampleItems: samples,
    });
    res.json({ draft: generated });
  } catch (err) {
    console.error('[assignments/generate]', err);
    res.status(502).json({ error: 'Content generation failed. Please try again.' });
  }
});

/**
 * POST /assignments
 * Teacher saves (and optionally publishes) an assignment after reviewing the draft.
 */
router.post('/', requireRole('admin', 'teacher'), async (req, res) => {
  const { type, level, skill, title, generated_content, due_date,
          class_id, student_ids, is_published = false } = req.body;

  if (!type || !level || !skill || !title || !generated_content) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const { rows } = await query(
    `INSERT INTO assignments
       (id, school_id, teacher_id, type, level, skill, title, generated_content,
        due_date, class_id, student_ids, is_published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id, title, type, level, skill, due_date, is_published, created_at`,
    [
      uuidv4(), req.school.id, req.user.id, type, level, skill, title,
      JSON.stringify(generated_content), due_date || null,
      class_id || null, student_ids || [], is_published
    ]
  );
  res.status(201).json({ assignment: rows[0] });
});

/**
 * GET /assignments — teacher sees their assignments; students see assigned-to-them
 */
router.get('/', async (req, res) => {
  if (req.user.role === 'student') {
    // Student: assignments assigned to their class or specifically to them
    const { rows: studentRow } = await query(
      `SELECT class_id FROM users WHERE id = $1`, [req.user.id]
    );
    const classId = studentRow[0]?.class_id;

    const { rows } = await query(
      `SELECT a.id, a.title, a.type, a.level, a.skill, a.due_date, a.is_published,
              asub.submitted_at, asub.score
       FROM assignments a
       LEFT JOIN assignment_submissions asub ON asub.assignment_id = a.id AND asub.student_id = $1
       WHERE a.school_id = $2 AND a.is_published = true
         AND ($3::uuid IS NULL OR a.class_id = $3 OR $1 = ANY(a.student_ids))
       ORDER BY a.due_date ASC NULLS LAST`,
      [req.user.id, req.school.id, classId]
    );
    return res.json({ assignments: rows });
  }

  // Teacher/Admin
  const { rows } = await query(
    `SELECT a.id, a.title, a.type, a.level, a.skill, a.due_date, a.is_published, a.created_at,
            COUNT(asub.id) AS submission_count
     FROM assignments a
     LEFT JOIN assignment_submissions asub ON asub.assignment_id = a.id
     WHERE a.school_id = $1 AND ($2::uuid IS NULL OR a.teacher_id = $2)
     GROUP BY a.id
     ORDER BY a.created_at DESC`,
    [req.school.id, req.user.role === 'teacher' ? req.user.id : null]
  );
  res.json({ assignments: rows });
});

/**
 * GET /assignments/:id — full assignment (includes questions for students)
 */
router.get('/:id', async (req, res) => {
  const { rows } = await query(
    `SELECT a.*, u.display_name AS teacher_name
     FROM assignments a
     JOIN users u ON u.id = a.teacher_id
     WHERE a.id = $1 AND a.school_id = $2`,
    [req.params.id, req.school.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });

  const assignment = rows[0];

  // Students: strip answer key
  if (req.user.role === 'student') {
    const content = { ...assignment.generated_content };
    delete content.answer_key;
    assignment.generated_content = content;
  }

  // Check if student already submitted
  if (req.user.role === 'student') {
    const { rows: sub } = await query(
      `SELECT id, score, submitted_at FROM assignment_submissions
       WHERE assignment_id = $1 AND student_id = $2`,
      [req.params.id, req.user.id]
    );
    assignment.my_submission = sub[0] || null;
  }

  res.json({ assignment });
});

/**
 * PATCH /assignments/:id — publish, update due date, etc.
 */
router.patch('/:id', requireRole('admin', 'teacher'), async (req, res) => {
  const { is_published, due_date, title } = req.body;
  const { rows } = await query(
    `UPDATE assignments SET
       is_published = COALESCE($1, is_published),
       due_date = COALESCE($2, due_date),
       title = COALESCE($3, title)
     WHERE id = $4 AND school_id = $5 AND teacher_id = $6
     RETURNING id, title, is_published, due_date`,
    [is_published, due_date, title, req.params.id, req.school.id, req.user.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });
  res.json({ assignment: rows[0] });
});

// ──────────────────────────────────────────────
// STUDENT: submit assignment
// ──────────────────────────────────────────────

/**
 * POST /assignments/:id/submit
 * Body: { answers: { question_id: student_answer, ... } }
 */
router.post('/:id/submit', requireRole('student'), async (req, res) => {
  const { answers } = req.body;
  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ error: 'answers object required' });
  }

  const { rows: assignment } = await query(
    `SELECT * FROM assignments WHERE id = $1 AND school_id = $2 AND is_published = true`,
    [req.params.id, req.school.id]
  );
  if (assignment.length === 0) return res.status(404).json({ error: 'Assignment not found' });

  // Check not already submitted
  const { rows: existing } = await query(
    `SELECT id FROM assignment_submissions WHERE assignment_id = $1 AND student_id = $2`,
    [req.params.id, req.user.id]
  );
  if (existing.length > 0) return res.status(409).json({ error: 'Already submitted' });

  // Auto-grade
  const score = autoGrade(answers, assignment[0].generated_content?.answer_key || {});

  const { rows } = await query(
    `INSERT INTO assignment_submissions (id, school_id, assignment_id, student_id, answers, score)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, score, submitted_at`,
    [uuidv4(), req.school.id, req.params.id, req.user.id, JSON.stringify(answers), score]
  );

  // Update progress
  await upsertProgress(req.user.id, req.school.id, assignment[0].skill, assignment[0].level, score);

  res.status(201).json({ submission: rows[0] });
});

/**
 * GET /assignments/:id/results — teacher views all submissions
 */
router.get('/:id/results', requireRole('admin', 'teacher'), async (req, res) => {
  const { rows } = await query(
    `SELECT asub.id, asub.score, asub.submitted_at, asub.answers,
            u.display_name, u.username
     FROM assignment_submissions asub
     JOIN users u ON u.id = asub.student_id
     WHERE asub.assignment_id = $1 AND asub.school_id = $2
     ORDER BY u.display_name`,
    [req.params.id, req.school.id]
  );
  res.json({ results: rows });
});

// ──────────────────────────────────────────────
// Auto-grader
// ──────────────────────────────────────────────
function autoGrade(answers, answerKey) {
  if (!answerKey || Object.keys(answerKey).length === 0) return null;

  let correct = 0;
  let total = 0;

  for (const [qid, correctAnswer] of Object.entries(answerKey)) {
    total++;
    const studentAnswer = answers[qid];
    if (studentAnswer === undefined) continue;

    const sa = String(studentAnswer).trim().toLowerCase();
    const ca = String(correctAnswer).trim().toLowerCase();
    if (sa === ca) correct++;
  }

  return total > 0 ? Math.round((correct / total) * 100) : null;
}

export default router;
