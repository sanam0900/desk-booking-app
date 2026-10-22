# AI Decision Log

This log records substantive decisions made while developing the Desk Booking App
with AI assistance, in the structure required by the assignment: **problem**,
**tool**, **relevant context and key instruction**, **essence of the AI's
suggestion**, **decision and reasons**, and **verification evidence**.

> Note to self (review before submission): rewrite the "Decision & reasons" and
> "Verification" lines in your own words — you must explain these live in the
> defence without AI. The facts below are accurate; make the voice yours.

## AI tools used across phases (requirement: at least three phases)

- **Requirements analysis** — Claude Code was used to turn the approved topic into
  numbered, testable acceptance criteria (AC1–AC8 in `SPEC.md`) and to identify the
  back-to-back-vs-overlap edge case before any code was written.
- **Implementation** — Claude Code (primary tool) generated the backend rules,
  Express API, and React frontend.
- **Testing** — Claude Code generated the `node:test` suite in
  `backend/test/api.test.js`, with one test per acceptance criterion.

Repository support for AI-assisted development: `AGENTS.md` documents the
architecture, conventions, and guardrails that AI tools must follow (e.g. "do not
introduce OAuth", "keep business rules in the backend", "back-to-back bookings are
allowed"). It was used to keep generated code aligned with the approved spec.

## Feature implemented twice with two AI tools (MSc requirement) — TO BE COMPLETED

Planned: re-implement the booking **overlap check** (`isDeskFree` /
`intervalsOverlap`, `backend/src/bookingRules.js`) with a second tool (Gemini) and
compare the two implementations and their test results against the same AC2/AC3
tests. _Not yet done — placeholder so it is not forgotten._

---

## Decision Case 1 — Overlap rule: strict vs. inclusive comparison (AC2/AC3)

- **Phase:** Requirements analysis + implementation.
- **Problem:** A desk must reject *overlapping* bookings (AC2) but allow
  *back-to-back* bookings where one ends exactly when the next starts (AC3). The
  correctness of the whole app hinges on getting the boundary condition right.
- **Tool:** Claude Code.
- **Context & key instruction:** Given AC2 and AC3 from `SPEC.md`, asked for an
  interval-overlap check where touching intervals (end == start) do **not** count
  as an overlap.
- **AI suggestion:** Use a half-open comparison —
  `aStart < bEnd && bStart < aEnd` (strict `<`, not `<=`), so two intervals
  overlap only when they share a strictly positive span. See
  `backend/src/bookingRules.js:58` (`intervalsOverlap`) and `:69` (`isDeskFree`).
- **Decision & reasons:** Accepted. Strict `<` is exactly what AC3 requires: when
  booking B starts at the instant A ends, `bStart == aEnd`, so `bStart < aEnd` is
  false and the two are treated as non-overlapping. An inclusive `<=` would wrongly
  reject the back-to-back case.
- **Verification evidence:** Two tests pin the boundary from both sides —
  `AC2_overlap_rejected` (`backend/test/api.test.js:83`) expects HTTP 409 for an
  overlapping slot, and `AC3_back_to_back_allowed` (`:96`) expects HTTP 201 when the
  second booking starts exactly when the first ends. Both pass. The behaviour was
  also confirmed end-to-end against the running server (overlap → 409,
  back-to-back → 201).

## Decision Case 2 — Password storage without an external dependency

- **Phase:** Implementation (authentication).
- **Problem:** The spec fixes auth as username/password with session tokens. We
  need to store passwords securely, but adding a heavy native dependency (e.g.
  `bcrypt`) complicates setup on a lab machine for the defence.
- **Tool:** Claude Code.
- **Context & key instruction:** Asked for salted, secure password hashing using
  only the Node standard library, so the project has no extra crypto dependency to
  install or explain.
- **AI suggestion:** Use Node's built-in `node:crypto` — a per-password random
  salt via `randomBytes`, key derivation with `scryptSync`, and a constant-time
  comparison with `timingSafeEqual` on verify. See
  `backend/src/bookingRules.js:1,6,7,14,16`.
- **Decision & reasons:** Accepted. `scrypt` is a recognised password-hashing KDF,
  the salt is unique per user, and `timingSafeEqual` avoids timing side-channels on
  comparison. It needs no third-party package, which keeps `npm install` simple and
  the code fully explainable in the defence.
- **Verification evidence:** A round-trip check confirmed a correct password
  verifies `true` and a wrong password verifies `false`; the stored value is
  `salt:hash`, never the plaintext. The login flow is exercised by the API tests
  (admin login issues a token used throughout `backend/test/api.test.js`).
- **Limitation (honest note):** `scryptSync` is synchronous and blocks the event
  loop; acceptable at this scale but not what I would use under high concurrency.

## Decision Case 3 — A defect AI missed, caught by running the real app

- **Phase:** Implementation + verification.
- **Problem:** All 9 unit tests passed, but the first real launch of the backend
  crashed with `Cannot open database because the directory does not exist`.
- **Tool:** Claude Code.
- **Context & key instruction:** The original `createDb` only created the `data/`
  directory when an explicit filename was passed; the default-path branch (used by
  the real server) skipped `mkdirSync`. The in-memory tests used `:memory:`, so they
  never exercised the failing path.
- **AI suggestion / fix:** Resolve the target path first, then always `mkdirSync`
  the parent directory for any non-`:memory:` database before opening it.
- **Decision & reasons:** Accepted the fix, but the real lesson is about
  verification method: **green unit tests were not sufficient** because they did not
  cover the production code path. Running the actual server surfaced the defect.
  Committed separately as `3c6d232` ("Fix: ensure data directory exists…") so the
  defect and its fix are traceable in history.
- **Verification evidence:** After the fix, a fresh launch (with `data/` deleted)
  seeded the admin + desks and served requests; the full end-to-end flow then ran
  correctly (register → book → overlap 409 → back-to-back 201 → list → admin 403).
  All 9 tests continue to pass.
- **Limitation (honest note):** This shows a general limitation of AI-generated
  tests — they can pass while missing an untested path. A follow-up improvement is a
  smoke test that boots the real server, not only the in-memory app.
