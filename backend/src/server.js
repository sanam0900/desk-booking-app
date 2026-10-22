import { createDb } from './db.js';
import { createApp } from './app.js';
import { hashPassword } from './bookingRules.js';

const PORT = process.env.PORT ?? 3001;

const db = createDb();
seed(db);

const app = createApp(db);
app.listen(PORT, () => {
  console.log(`Desk Booking API listening on http://localhost:${PORT}`);
});

/**
 * Seed a default admin and a few desks on first run, so the app is usable
 * immediately. Idempotent: does nothing if users already exist.
 */
function seed(db) {
  const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (userCount > 0) return;

  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(
    'admin',
    hashPassword('admin123'),
    'admin',
  );
  const insertDesk = db.prepare('INSERT INTO desks (name) VALUES (?)');
  for (const name of ['Desk A1', 'Desk A2', 'Desk B1']) insertDesk.run(name);
  console.log('Seeded default admin (admin / admin123) and 3 desks.');
}
