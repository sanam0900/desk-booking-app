import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// --- Password hashing (no external dependency; explainable in the defence) ---

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password, stored) {
  const [salt, derived] = stored.split(':');
  if (!salt || !derived) return false;
  const check = scryptSync(password, salt, 64);
  const expected = Buffer.from(derived, 'hex');
  return check.length === expected.length && timingSafeEqual(check, expected);
}

// --- Time helpers ---

/** Parse an ISO-ish datetime string into epoch ms, or NaN if invalid. */
export function parseTime(value) {
  if (typeof value !== 'string' || value.trim() === '') return NaN;
  return Date.parse(value);
}

// --- Booking rules (AC1-AC8) ---

/**
 * Validate a requested time slot in isolation (no DB needed).
 * Covers AC4 (past booking) and AC7 (start >= end).
 *
 * @returns {{ok: true, start: number, end: number} | {ok: false, error: string}}
 */
export function validateSlot(startRaw, endRaw, now = Date.now()) {
  const start = parseTime(startRaw);
  const end = parseTime(endRaw);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return { ok: false, error: 'Invalid start or end time.' };
  }
  // AC7: start must be strictly before end.
  if (start >= end) {
    return { ok: false, error: 'Start time must be before end time.' };
  }
  // AC4: cannot book a slot that starts in the past.
  if (start < now) {
    return { ok: false, error: 'Cannot book a time slot in the past.' };
  }
  return { ok: true, start, end };
}

/**
 * Decide whether two intervals overlap.
 *
 * Back-to-back bookings are allowed (AC3): if one ends exactly when the other
 * starts, they do NOT overlap. Overlap requires a strictly positive intersection.
 */
export function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Check whether a desk is free for [start, end), given existing bookings.
 * Implements AC2 (reject overlap) and AC3 (allow back-to-back).
 *
 * @param {Array<{start_time: string, end_time: string}>} existing
 * @returns {boolean} true if the slot is free
 */
export function isDeskFree(existing, start, end) {
  return !existing.some((b) =>
    intervalsOverlap(start, end, parseTime(b.start_time), parseTime(b.end_time)),
  );
}
