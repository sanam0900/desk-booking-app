// Two-tool comparison (AI decision log): the booking overlap check was
// implemented independently by Claude Code and by Gemini. This file runs BOTH
// implementations against the same edge cases so the comparison is backed by a
// reproducible result, not just inspection.
//
// Run: node --test test/overlap-comparison.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';

// --- Claude Code's implementation (as shipped in src/bookingRules.js) ---
function claudeIntervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}
function claudeIsDeskFree(existing, start, end) {
  const parse = (v) => Date.parse(v);
  return !existing.some((b) =>
    claudeIntervalsOverlap(start, end, parse(b.start_time), parse(b.end_time)),
  );
}

// --- Gemini's implementation (pasted verbatim from Gemini's reply) ---
function geminiIntervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}
function geminiIsDeskFree(existing, start, end) {
  return !existing.some((booking) => {
    const existingStart = new Date(booking.start_time).getTime();
    const existingEnd = new Date(booking.end_time).getTime();
    return geminiIntervalsOverlap(start, end, existingStart, existingEnd);
  });
}

const t = (s) => Date.parse(s);
const existing = [{ start_time: '2026-06-01T12:00:00', end_time: '2026-06-01T13:00:00' }];

// Each case: [name, requestedStart, requestedEnd, expectedFree]
const cases = [
  ['AC2 overlap (12:30-13:30)', '2026-06-01T12:30:00', '2026-06-01T13:30:00', false],
  ['AC3 back-to-back after (13:00-14:00)', '2026-06-01T13:00:00', '2026-06-01T14:00:00', true],
  ['AC3 back-to-back before (11:00-12:00)', '2026-06-01T11:00:00', '2026-06-01T12:00:00', true],
  ['contained (12:15-12:45)', '2026-06-01T12:15:00', '2026-06-01T12:45:00', false],
  ['identical (12:00-13:00)', '2026-06-01T12:00:00', '2026-06-01T13:00:00', false],
];

for (const [name, start, end, expected] of cases) {
  test(`Claude: ${name}`, () => {
    assert.equal(claudeIsDeskFree(existing, t(start), t(end)), expected);
  });
  test(`Gemini: ${name}`, () => {
    assert.equal(geminiIsDeskFree(existing, t(start), t(end)), expected);
  });
}
