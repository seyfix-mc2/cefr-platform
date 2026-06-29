import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_EXPIRES = '24h';

/**
 * Sign a JWT for a user. Scoped to school_id for tenant isolation.
 */
export function signToken(user, schoolId) {
  return jwt.sign(
    {
      sub: user.id,
      school_id: schoolId,
      role: user.role,
      display_name: user.display_name,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

/**
 * Middleware: verify JWT and attach req.user.
 * Must run AFTER resolveTenant so req.school is available.
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);

    // Critical: token must belong to this tenant
    if (payload.school_id !== req.school.id) {
      return res.status(403).json({ error: 'Token not valid for this school' });
    }

    req.user = {
      id: payload.sub,
      school_id: payload.school_id,
      role: payload.role,
      display_name: payload.display_name,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired, please log in again' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Role guard factory.
 * Usage: requireRole('admin') or requireRole(['admin','teacher'])
 */
export function requireRole(...roles) {
  const allowed = roles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: `Access restricted to: ${allowed.join(', ')}` });
    }
    next();
  };
}
