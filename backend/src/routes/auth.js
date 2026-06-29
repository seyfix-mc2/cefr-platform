import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * POST /auth/login
 * Body: { username, password }
 * Returns: { token, user }
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const result = await query(
      `SELECT id, school_id, role, username, password_hash, display_name, is_active,
              class_id, cefr_level
       FROM users
       WHERE school_id = $1 AND username = $2`,
      [req.school.id, username.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      // Constant-time response to prevent username enumeration
      await bcrypt.compare(password, '$2a$12$invalid.hash.padding.to.prevent.timing');
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Update last_login
    await query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    const token = signToken(user, req.school.id);

    res.json({
      token,
      user: {
        id: user.id,
        role: user.role,
        username: user.username,
        display_name: user.display_name,
        class_id: user.class_id,
        cefr_level: user.cefr_level,
      },
      school: {
        id: req.school.id,
        name: req.school.school_display_name || req.school.name,
        slug: req.school.slug,
        primary_color: req.school.primary_color,
        logo_url: req.school.logo_url,
      }
    });
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /auth/me — verify token + return current user
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, role, username, display_name, class_id, cefr_level, last_login_at
       FROM users WHERE id = $1 AND school_id = $2`,
      [req.user.id, req.school.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0], school: req.school });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
