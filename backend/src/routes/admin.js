import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

// ──────────────────────────────────────────────
// TEACHER MANAGEMENT
// ──────────────────────────────────────────────

/** GET /admin/teachers — list all teachers */
router.get('/teachers', async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.username, u.display_name, u.is_active, u.last_login_at,
            u.created_at,
            COUNT(DISTINCT c.id) AS class_count,
            COUNT(DISTINCT s.id) AS student_count
     FROM users u
     LEFT JOIN classes c ON c.teacher_id = u.id AND c.is_active = true
     LEFT JOIN users s ON s.created_by = u.id AND s.role = 'student'
     WHERE u.school_id = $1 AND u.role = 'teacher'
     GROUP BY u.id
     ORDER BY u.display_name`,
    [req.school.id]
  );
  res.json({ teachers: rows });
});

/** POST /admin/teachers — create a teacher account */
router.post('/teachers', async (req, res) => {
  const { username, password, display_name } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  // Check seat limit
  const { rows: counts } = await query(
    `SELECT COUNT(*) AS n FROM users WHERE school_id = $1 AND role = 'teacher' AND is_active = true`,
    [req.school.id]
  );
  if (parseInt(counts[0].n) >= req.school.seats_teachers) {
    return res.status(409).json({ error: 'Teacher seat limit reached for your license' });
  }

  const hash = await bcrypt.hash(password, 12);
  try {
    const { rows } = await query(
      `INSERT INTO users (id, school_id, role, username, password_hash, display_name, created_by)
       VALUES ($1, $2, 'teacher', $3, $4, $5, $6)
       RETURNING id, username, display_name, is_active, created_at`,
      [uuidv4(), req.school.id, username.trim().toLowerCase(), hash, display_name || username, req.user.id]
    );
    res.status(201).json({ teacher: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already taken' });
    }
    throw err;
  }
});

/** PATCH /admin/teachers/:id — deactivate / reactivate / update */
router.patch('/teachers/:id', async (req, res) => {
  const { is_active, display_name, password } = req.body;
  const updates = [];
  const values = [req.params.id, req.school.id];

  if (is_active !== undefined) {
    updates.push(`is_active = $${values.length + 1}`);
    values.push(is_active);
  }
  if (display_name) {
    updates.push(`display_name = $${values.length + 1}`);
    values.push(display_name);
  }
  if (password) {
    updates.push(`password_hash = $${values.length + 1}`);
    values.push(await bcrypt.hash(password, 12));
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  const { rows } = await query(
    `UPDATE users SET ${updates.join(', ')}
     WHERE id = $1 AND school_id = $2 AND role = 'teacher'
     RETURNING id, username, display_name, is_active`,
    values
  );

  if (rows.length === 0) return res.status(404).json({ error: 'Teacher not found' });
  res.json({ teacher: rows[0] });
});

// ──────────────────────────────────────────────
// LICENSE & SCHOOL INFO
// ──────────────────────────────────────────────

/** GET /admin/license */
router.get('/license', async (req, res) => {
  const { rows: teacherCounts } = await query(
    `SELECT COUNT(*) AS n FROM users WHERE school_id = $1 AND role = 'teacher' AND is_active = true`,
    [req.school.id]
  );
  const { rows: studentCounts } = await query(
    `SELECT COUNT(*) AS n FROM users WHERE school_id = $1 AND role = 'student' AND is_active = true`,
    [req.school.id]
  );

  res.json({
    license: {
      expiry: req.school.license_expiry,
      seats_teachers: { used: parseInt(teacherCounts[0].n), total: req.school.seats_teachers },
      seats_students: { used: parseInt(studentCounts[0].n), total: req.school.seats_students },
      unlocked_modules: req.school.unlocked_modules,
    }
  });
});

// ──────────────────────────────────────────────
// BRANDING
// ──────────────────────────────────────────────

/** PATCH /admin/branding */
router.patch('/branding', async (req, res) => {
  const { logo_url, primary_color, school_display_name } = req.body;
  const { rows } = await query(
    `UPDATE schools SET logo_url = COALESCE($1, logo_url),
                        primary_color = COALESCE($2, primary_color),
                        school_display_name = COALESCE($3, school_display_name)
     WHERE id = $4
     RETURNING logo_url, primary_color, school_display_name`,
    [logo_url, primary_color, school_display_name, req.school.id]
  );
  res.json({ branding: rows[0] });
});

// ──────────────────────────────────────────────
// SCHOOL-WIDE PROGRESS ROLLUP
// ──────────────────────────────────────────────

/** GET /admin/progress — aggregate across all classes */
router.get('/progress', async (req, res) => {
  const { rows } = await query(
    `SELECT ps.skill, ps.level,
            COUNT(DISTINCT ps.student_id) AS students,
            ROUND(AVG(ps.avg_score), 1) AS avg_score,
            SUM(ps.exercises_completed) AS total_exercises
     FROM progress_snapshots ps
     WHERE ps.school_id = $1
     GROUP BY ps.skill, ps.level
     ORDER BY ps.level, ps.skill`,
    [req.school.id]
  );
  res.json({ progress: rows });
});

export default router;
