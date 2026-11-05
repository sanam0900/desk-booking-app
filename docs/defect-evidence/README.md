# Deliberate Defect Test — Evidence

This document satisfies the assignment's testing requirement:

> "For at least one test, retain both the faulty and corrected versions, together
> with the results of both test runs. … you may use a clearly labelled version with
> a deliberately introduced fault. … Do not present this as a defect that actually
> occurred during development."

**This fault was introduced deliberately for this exercise. It is NOT a bug that
occurred during real development.**

## The test that catches it

`AC3_back_to_back_allowed` in `backend/test/api.test.js`. It books a desk for one
slot, then books the **same desk** for a second slot that starts **exactly when the
first ends**, and asserts the second booking succeeds (HTTP 201). This is acceptance
criterion AC3: back-to-back bookings with no gap are allowed.

## The defect

File: `backend/src/bookingRules.js`, function `intervalsOverlap`.

| Version | Code | Behaviour |
|---|---|---|
| **Correct** | `return aStart < bEnd && bStart < aEnd;` | Touching intervals (one ends when the next starts) do **not** overlap → back-to-back allowed. |
| **Faulty (deliberate)** | `return aStart <= bEnd && bStart < aEnd;` | Changing the first `<` to `<=` makes a booking whose start equals an existing booking's end count as an overlap → back-to-back wrongly **rejected**. |

### Why this is the right boundary term

The overlap check is called as
`intervalsOverlap(newStart, newEnd, existingStart, existingEnd)`, so `a` = the new
booking and `b` = the existing one. The AC3 test places `newStart == existingEnd`
(the new slot starts exactly when the existing one ends). That boundary is governed
by the term `aStart < bEnd` (i.e. `newStart < existingEnd`): with strict `<` it is
`false` (no overlap, correct); with `<=` it becomes `true` (false overlap, bug).

## Expected vs. actual

- **Expected (correct code):** second booking returns HTTP 201; test passes.
- **Actual (faulty code):** the API returns HTTP 409 ("already booked for an
  overlapping slot") for a back-to-back booking, so the test's
  `assert.equal(res.status, 201)` fails.

## Test-run results (retained)

- `run-1-faulty-FAIL.txt` — with the deliberate fault: **18 pass, 1 fail**
  (`not ok 3 - AC3_back_to_back_allowed`).
- `run-2-fixed-PASS.txt` — after restoring the fix: **19 pass, 0 fail**.

The source file in the repository is kept in its **corrected** state; the faulty
version exists only as the documented one-character change above and in the retained
failing-run log.

## Note worth mentioning in the defence

While building this, an earlier attempt mutated the *other* term (`bStart <= aEnd`)
and **no test failed** — because the AC3 test only exercises one side of the
touching boundary (new-after-existing), not both. That is a genuine coverage gap:
the test suite should also cover the mirror case (new booking ending exactly when an
existing one starts). The comparison tests in `overlap-comparison.test.js` do cover
both sides, but against their own copies of the function, so they cannot catch a bug
in `src/bookingRules.js`. This is a concrete, honest example of a test passing while
a real code path is wrong.
