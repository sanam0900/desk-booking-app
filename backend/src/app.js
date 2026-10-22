import express from 'express';
import cors from 'cors';
import { hashPassword, verifyPassword, validateSlot, isDeskFree } from './bookingRules.js';
import {
  createSession,
  deleteSession,
  authMiddleware,
  requireAuth,
  requireAdmin,
} from './auth.js';

/**
 * Build the Express app around an open database handle.
 * Taking the db as an argument lets tests pass an in-memory database.
 */
export function createApp(db) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(authMiddleware(db));

  // --- Auth ---

  app.post('/api/register', (req, res) => {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }
    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (exists) return res.status(409).json({ error: 'Username already taken.' });

    const info = db
      .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
      .run(username, hashPassword(password));
    const token = createSession(db, info.lastInsertRowid);
    res.status(201).json({ token, user: { id: info.lastInsertRowid, username, role: 'user' } });
  });

  app.post('/api/login', (req, res) => {
    const { username, password } = req.body ?? {};
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username ?? '');
    if (!user || !verifyPassword(password ?? '', user.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    const token = createSession(db, user.id);
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  });

  app.post('/api/logout', requireAuth, (req, res) => {
    const token = (req.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    deleteSession(db, token);
    res.json({ ok: true });
  });

  app.get('/api/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  // --- Desks ---

  app.get('/api/desks', requireAuth, (_req, res) => {
    res.json(db.prepare('SELECT id, name FROM desks ORDER BY name').all());
  });

  // AC4 (admin): add a desk.
  app.post('/api/desks', requireAdmin, (req, res) => {
    const { name } = req.body ?? {};
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Desk name is required.' });
    }
    const exists = db.prepare('SELECT id FROM desks WHERE name = ?').get(name.trim());
    if (exists) return res.status(409).json({ error: 'Desk name already exists.' });
    const info = db.prepare('INSERT INTO desks (name) VALUES (?)').run(name.trim());
    res.status(201).json({ id: info.lastInsertRowid, name: name.trim() });
  });

  app.delete('/api/desks/:id', requireAdmin, (req, res) => {
    const info = db.prepare('DELETE FROM desks WHERE id = ?').run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'Desk not found.' });
    res.json({ ok: true });
  });

  // --- Bookings ---

  // AC1/AC2/AC3/AC4/AC7: create a booking.
  app.post('/api/bookings', requireAuth, (req, res) => {
    const { deskId, start, end } = req.body ?? {};
    const desk = db.prepare('SELECT id FROM desks WHERE id = ?').get(deskId);
    if (!desk) return res.status(404).json({ error: 'Desk not found.' });

    // AC4 + AC7: slot validity in isolation.
    const slot = validateSlot(start, end);
    if (!slot.ok) return res.status(400).json({ error: slot.error });

    // AC2 + AC3: overlap check against this desk's existing bookings.
    const existing = db
      .prepare('SELECT start_time, end_time FROM bookings WHERE desk_id = ?')
      .all(deskId);
    if (!isDeskFree(existing, slot.start, slot.end)) {
      return res.status(409).json({ error: 'Desk is already booked for an overlapping slot.' });
    }

    const info = db
      .prepare(
        'INSERT INTO bookings (desk_id, user_id, start_time, end_time) VALUES (?, ?, ?, ?)',
      )
      .run(deskId, req.user.id, start, end);
    res.status(201).json({ id: info.lastInsertRowid, deskId, start, end, userId: req.user.id });
  });

  // AC8: a user sees only their own bookings, in chronological order.
  app.get('/api/bookings', requireAuth, (req, res) => {
    const rows = db
      .prepare(
        `SELECT b.id, b.desk_id AS deskId, d.name AS deskName,
                b.start_time AS start, b.end_time AS end
           FROM bookings b JOIN desks d ON d.id = b.desk_id
          WHERE b.user_id = ?
          ORDER BY b.start_time ASC`,
      )
      .all(req.user.id);
    res.json(rows);
  });

  // AC5 (own cancel) + AC6 (unauthorized cancel blocked, admin can cancel any).
  app.delete('/api/bookings/:id', requireAuth, (req, res) => {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You can only cancel your own bookings.' });
    }
    db.prepare('DELETE FROM bookings WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  return app;
}
