import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query, getClient } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole('admin', 'teacher'));

// Helper: assert teacher owns the class (unless admin)
async function assertOwnsClass(teacherId, classId, schoolId, role) {
  if (role === 'admin') return true;
  const { rows } = await query(
    'SELECT id FROM classes WHERE id = $1 AND teacher_id = $2 AND school_id = $3',
    [classId, teacherId, schoolId]
  );
  return rows.length > 0;
}

// ──────────────────────────────────────────────
// CLASSES
// ──────────────────────────────────────────────

router.get('/classes', async (req, res) => {
  const { rows } = await query(
    `SELECT c.id, c.name, c.cefr_level, c.is_active,
            COUNT(u.id) AS student_count
     FROM classes c
     LEFT JOIN users u ON u.class_id = c.id AND u.is_active = true
     WHERE c.school_id = $1
       AND ($2::uuid IS NULL OR c.teacher_id = $2)
     GROUP BY c.id
     ORDER BY c.name`,
    [req.school.id, req.user.role === 'teacher' ? req.user.id : null]
  );
  res.json({ classes: rows });
});

router.post('/classes', async (req, res) => {
  const { name, cefr_level } = req.body;
  if (!name) return res.status(400).json({ error: 'Class name is required' });

  const { rows } = await query(
    `INSERT INTO classes (id, school_id, teacher_id, name, cefr_level)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [uuidv4(), req.school.id, req.user.id, name, cefr_level || null]
  );
  res.status(201).json({ class: rows[0] });
});

// ──────────────────────────────────────────────
// STUDENTS
// ──────────────────────────────────────────────

/** GET /teacher/classes/:classId/students */
router.get('/classes/:classId/students', async (req, res) => {
  const ok = await assertOwnsClass(req.user.id, req.params.classId, req.school.id, req.user.role);
  if (!ok) return res.status(403).json({ error: 'Not your class' });

  const { rows } = await query(
    `SELECT u.id, u.username, u.display_name, u.cefr_level, u.is_active,
            u.last_login_at,
            ROUND(AVG(ps.avg_score), 1) AS avg_score,
            SUM(ps.exercises_completed) AS exercises_completed
     FROM users u
     LEFT JOIN progress_snapshots ps ON ps.student_id = u.id
     WHERE u.class_id = $1 AND u.school_id = $2 AND u.role = 'student'
     GROUP BY u.id
     ORDER BY u.display_name`,
    [req.params.classId, req.school.id]
  );
  res.json({ students: rows });
});

/** POST /teacher/classes/:classId/students — create single student */
router.post('/classes/:classId/students', async (req, res) => {
  const ok = await assertOwnsClass(req.user.id, req.params.classId, req.school.id, req.user.role);
  if (!ok) return res.status(403).json({ error: 'Not your class' });

  const { username, password, display_name, cefr_level } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });

  // Seat check
  const { rows: cnt } = await query(
    `SELECT COUNT(*) AS n FROM users WHERE school_id = $1 AND role = 'student' AND is_active = true`,
    [req.school.id]
  );
  if (parseInt(cnt[0].n) >= req.school.seats_students) {
    return res.status(409).json({ error: 'Student seat limit reached' });
  }

  const hash = await bcrypt.hash(password, 12);
  try {
    const { rows } = await query(
      `INSERT INTO users (id, school_id, role, username, password_hash, display_name, class_id, cefr_level, created_by)
       VALUES ($1, $2, 'student', $3, $4, $5, $6, $7, $8)
       RETURNING id, username, display_name, cefr_level, is_active`,
      [uuidv4(), req.school.id, username.trim().toLowerCase(), hash,
       display_name || username, req.params.classId, cefr_level || null, req.user.id]
    );
    res.status(201).json({ student: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username already taken' });
    throw err;
  }
});

/**
 * POST /teacher/classes/:classId/students/import
 * Bulk CSV import. Expected CSV: username,password,display_name,cefr_level
 */
router.post('/classes/:classId/students/import', async (req, res) => {
  const ok = await assertOwnsClass(req.user.id, req.params.classId, req.school.id, req.user.role);
  if (!ok) return res.status(403).json({ error: 'Not your class' });

  const { rows: csvData } = req.body; // Parsed by caller
  if (!Array.isArray(csvData) || csvData.length === 0) {
    return res.status(400).json({ error: 'No rows provided' });
  }
  if (csvData.length > 200) {
    return res.status(400).json({ error: 'Maximum 200 students per import' });
  }

  // Seat check
  const { rows: cnt } = await query(
    `SELECT COUNT(*) AS n FROM users WHERE school_id = $1 AND role = 'student' AND is_active = true`,
    [req.school.id]
  );
  const remaining = req.school.seats_students - parseInt(cnt[0].n);
  if (csvData.length > remaining) {
    return res.status(409).json({ error: `Only ${remaining} student seats remaining` });
  }

  const client = await getClient();
  const created = [];
  const failed = [];

  try {
    await client.query('BEGIN');
    for (const row of csvData) {
      const { username, password, display_name, cefr_level } = row;
      if (!username || !password) {
        failed.push({ username, error: 'Missing username or password' });
        continue;
      }
      try {
        const hash = await bcrypt.hash(password, 12);
        const r = await client.query(
          `INSERT INTO users (id, school_id, role, username, password_hash, display_name, class_id, cefr_level, created_by)
           VALUES ($1,$2,'student',$3,$4,$5,$6,$7,$8)
           RETURNING id, username, display_name`,
          [uuidv4(), req.school.id, username.trim().toLowerCase(), hash,
           display_name || username, req.params.classId, cefr_level || null, req.user.id]
        );
        created.push(r.rows[0]);
      } catch (e) {
        failed.push({ username, error: e.code === '23505' ? 'Username taken' : e.message });
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  res.status(207).json({ created, failed, summary: { created: created.length, failed: failed.length } });
});

// ──────────────────────────────────────────────
// STUDENT DETAIL / PROGRESS
// ──────────────────────────────────────────────

router.get('/students/:studentId/progress', async (req, res) => {
  // Verify student belongs to teacher's school
  const { rows: student } = await query(
    `SELECT u.id, u.display_name, u.cefr_level, u.last_login_at
     FROM users u
     WHERE u.id = $1 AND u.school_id = $2 AND u.role = 'student'`,
    [req.params.studentId, req.school.id]
  );
  if (student.length === 0) return res.status(404).json({ error: 'Student not found' });

  const { rows: progress } = await query(
    `SELECT skill, level, exercises_completed, exercises_correct, avg_score, last_activity_at
     FROM progress_snapshots WHERE student_id = $1 ORDER BY level, skill`,
    [req.params.studentId]
  );

  const { rows: speakingAttempts } = await query(
    `SELECT sa.id, sa.type, sa.ai_score, sa.ai_feedback_text, sa.created_at,
            ci.title AS content_title
     FROM speaking_attempts sa
     JOIN content_items ci ON ci.id = sa.content_item_id
     WHERE sa.student_id = $1 AND sa.school_id = $2
     ORDER BY sa.created_at DESC LIMIT 20`,
    [req.params.studentId, req.school.id]
  );

  const { rows: submissions } = await query(
    `SELECT asub.id, asub.score, asub.submitted_at,
            a.title, a.type, a.skill, a.level, a.due_date
     FROM assignment_submissions asub
     JOIN assignments a ON a.id = asub.assignment_id
     WHERE asub.student_id = $1 AND asub.school_id = $2
     ORDER BY asub.submitted_at DESC LIMIT 20`,
    [req.params.studentId, req.school.id]
  );

  res.json({ student: student[0], progress, speakingAttempts, submissions });
});

export default router;
