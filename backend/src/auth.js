import { randomBytes } from 'node:crypto';

/**
 * Create a new session token for a user and persist it.
 */
export function createSession(db, userId) {
  const token = randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, userId);
  return token;
}

export function deleteSession(db, token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

/**
 * Express middleware factory: resolves the session token from the
 * Authorization: Bearer <token> header and attaches req.user.
 */
export function authMiddleware(db) {
  return (req, _res, next) => {
    const header = req.get('authorization') ?? '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    req.user = null;
    if (match) {
      const row = db
        .prepare(
          `SELECT users.id, users.username, users.role
             FROM sessions JOIN users ON users.id = sessions.user_id
            WHERE sessions.token = ?`,
        )
        .get(match[1]);
      if (row) req.user = row;
    }
    next();
  };
}

/** Guard: require an authenticated user. */
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  next();
}

/** Guard: require an admin user. */
export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });
  next();
}
