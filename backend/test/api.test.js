import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/bookingRules.js';

// Spin up the app on an ephemeral port and return a tiny fetch helper.
let server;
let base;
let db;

function futureSlot(hoursFromNow, durationHours = 1) {
  const start = new Date(Date.now() + hoursFromNow * 3600_000);
  const end = new Date(start.getTime() + durationHours * 3600_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function api(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

before(async () => {
  db = createDb(':memory:');
  // Seed one admin and one desk directly.
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(
    'admin',
    hashPassword('admin123'),
    'admin',
  );
  db.prepare('INSERT INTO desks (name) VALUES (?)').run('Desk 1');
  const app = createApp(db);
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      base = `http://localhost:${server.address().port}`;
      resolve();
    });
  });
});

// Fresh regular user + token for each test, and clear bookings between tests.
let userToken;
let adminToken;
let deskId;

beforeEach(async () => {
  db.prepare('DELETE FROM bookings').run();
  db.prepare("DELETE FROM users WHERE role = 'user'").run();
  const reg = await api('/api/register', {
    method: 'POST',
    body: { username: `u_${Math.random().toString(36).slice(2)}`, password: 'pw12345' },
  });
  userToken = reg.data.token;
  const login = await api('/api/login', {
    method: 'POST',
    body: { username: 'admin', password: 'admin123' },
  });
  adminToken = login.data.token;
  deskId = db.prepare('SELECT id FROM desks LIMIT 1').get().id;
});

// --- AC1: successful booking ---
test('AC1_successful_booking', async () => {
  const { start, end } = futureSlot(24);
  const res = await api('/api/bookings', {
    token: userToken,
    method: 'POST',
    body: { deskId, start, end },
  });
  assert.equal(res.status, 201);
  assert.equal(res.data.deskId, deskId);
});

// --- AC2: overlapping booking rejected ---
test('AC2_overlap_rejected', async () => {
  const { start, end } = futureSlot(24, 2); // 24h..26h
  await api('/api/bookings', { token: userToken, method: 'POST', body: { deskId, start, end } });
  const overlap = futureSlot(25, 2); // 25h..27h overlaps
  const res = await api('/api/bookings', {
    token: userToken,
    method: 'POST',
    body: { deskId, start: overlap.start, end: overlap.end },
  });
  assert.equal(res.status, 409);
});

// --- AC3: back-to-back bookings allowed ---
test('AC3_back_to_back_allowed', async () => {
  const first = futureSlot(24, 1); // 24h..25h
  await api('/api/bookings', {
    token: userToken,
    method: 'POST',
    body: { deskId, start: first.start, end: first.end },
  });
  // Second starts exactly when the first ends.
  const second = { start: first.end, end: new Date(Date.parse(first.end) + 3600_000).toISOString() };
  const res = await api('/api/bookings', {
    token: userToken,
    method: 'POST',
    body: { deskId, start: second.start, end: second.end },
  });
  assert.equal(res.status, 201);
});

// --- AC4: past booking rejected ---
test('AC4_past_booking_rejected', async () => {
  const start = new Date(Date.now() - 3600_000).toISOString();
  const end = new Date(Date.now() + 3600_000).toISOString();
  const res = await api('/api/bookings', {
    token: userToken,
    method: 'POST',
    body: { deskId, start, end },
  });
  assert.equal(res.status, 400);
});

// --- AC5: own booking cancellation frees the desk ---
test('AC5_own_cancellation_frees_desk', async () => {
  const { start, end } = futureSlot(24);
  const created = await api('/api/bookings', {
    token: userToken,
    method: 'POST',
    body: { deskId, start, end },
  });
  const del = await api(`/api/bookings/${created.data.id}`, { token: userToken, method: 'DELETE' });
  assert.equal(del.status, 200);
  // Same slot can now be rebooked.
  const rebook = await api('/api/bookings', {
    token: userToken,
    method: 'POST',
    body: { deskId, start, end },
  });
  assert.equal(rebook.status, 201);
});

// --- AC6: cannot cancel another user's booking; admin can ---
test('AC6_unauthorized_cancellation_blocked', async () => {
  const { start, end } = futureSlot(24);
  const created = await api('/api/bookings', {
    token: userToken,
    method: 'POST',
    body: { deskId, start, end },
  });
  // A second regular user tries to cancel it.
  const other = await api('/api/register', {
    method: 'POST',
    body: { username: `o_${Math.random().toString(36).slice(2)}`, password: 'pw12345' },
  });
  const blocked = await api(`/api/bookings/${created.data.id}`, {
    token: other.data.token,
    method: 'DELETE',
  });
  assert.equal(blocked.status, 403);
  // Admin can cancel any booking.
  const adminDel = await api(`/api/bookings/${created.data.id}`, {
    token: adminToken,
    method: 'DELETE',
  });
  assert.equal(adminDel.status, 200);
});

// --- AC7: invalid input (start >= end) rejected ---
test('AC7_invalid_input_rejected', async () => {
  const t = new Date(Date.now() + 24 * 3600_000).toISOString();
  const res = await api('/api/bookings', {
    token: userToken,
    method: 'POST',
    body: { deskId, start: t, end: t }, // start == end
  });
  assert.equal(res.status, 400);
});

// --- AC8: booking list shows only own bookings, chronologically ---
test('AC8_booking_list_accuracy', async () => {
  const later = futureSlot(48);
  const earlier = futureSlot(24);
  await api('/api/bookings', {
    token: userToken,
    method: 'POST',
    body: { deskId, start: later.start, end: later.end },
  });
  await api('/api/bookings', {
    token: userToken,
    method: 'POST',
    body: { deskId, start: earlier.start, end: earlier.end },
  });
  // Another user's booking must not appear.
  const other = await api('/api/register', {
    method: 'POST',
    body: { username: `x_${Math.random().toString(36).slice(2)}`, password: 'pw12345' },
  });
  const otherSlot = futureSlot(72);
  await api('/api/bookings', {
    token: other.data.token,
    method: 'POST',
    body: { deskId, start: otherSlot.start, end: otherSlot.end },
  });

  const list = await api('/api/bookings', { token: userToken });
  assert.equal(list.data.length, 2);
  assert.ok(list.data[0].start < list.data[1].start, 'should be chronological');
});

// --- auth guard: unauthenticated cannot book ---
test('auth_required_to_book', async () => {
  const { start, end } = futureSlot(24);
  const res = await api('/api/bookings', { method: 'POST', body: { deskId, start, end } });
  assert.equal(res.status, 401);
});

test.after(() => {
  server?.close();
});
