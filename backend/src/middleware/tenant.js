import { query } from '../db/pool.js';

/**
 * Resolve the tenant from the request subdomain.
 * Attaches req.school = { id, slug, name, ... } to every request.
 *
 * For local dev, set X-School-Slug header to bypass DNS:
 *   X-School-Slug: demo
 */
export async function resolveTenant(req, res, next) {
  try {
    let slug;

    // Accept X-School-Slug header in all environments — needed for
    // single-domain hosts like Render where subdomain routing isn't set up
    if (req.headers['x-school-slug']) {
      slug = req.headers['x-school-slug'];
    } else {
      // Parse from Host header: demo.yourplatform.com → 'demo'
      const host = req.headers.host || '';
      const baseDomain = process.env.BASE_DOMAIN || 'yourplatform.com';
      if (host.endsWith(`.${baseDomain}`)) {
        slug = host.slice(0, host.length - baseDomain.length - 1);
      }
    }

    if (!slug) {
      return res.status(400).json({ error: 'Invalid request: no tenant identified' });
    }

    const result = await query(
      `SELECT id, name, slug, license_expiry, seats_teachers, seats_students,
              unlocked_modules, logo_url, primary_color, school_display_name
       FROM schools WHERE slug = $1`,
      [slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }

    const school = result.rows[0];

    // License check
    if (new Date(school.license_expiry) < new Date()) {
      return res.status(402).json({ error: 'School license has expired' });
    }

    req.school = school;
    next();
  } catch (err) {
    console.error('[tenant]', err);
    res.status(500).json({ error: 'Internal error resolving tenant' });
  }
}
