# AGENTS.md — AI-Assisted Development Guide

This file orients AI coding tools (Claude Code, Gemini, Copilot, etc.) working in
this repository. It documents the architecture, conventions, and verification
workflow so AI suggestions stay consistent with the approved specification.

## Project

**Desk Booking App** — a web application for reserving desks in a shared office.
See `SPEC.md` for the approved specification and the 8 numbered acceptance
criteria (AC1–AC8). All work must trace back to those criteria.

## Architecture

- `backend/` — Express REST API, SQLite storage, username/password auth with
  session tokens (no OAuth — this was fixed in the approved spec).
- `frontend/` — React (Vite) single-page app that consumes the API.
- Times are stored and compared in the local server timezone (UTC+1). No
  multi-timezone support (fixed in spec).
- Each desk is single-occupancy (capacity 1).

## Conventions

- Keep business rules (overlap check, past-time check, ownership check) in the
  backend, not the frontend. The frontend must never be the only thing enforcing
  a rule — the grader tests rules via the API.
- Every acceptance criterion maps to at least one automated test. Name tests so
  the mapping is obvious (e.g. `AC2_overlap_rejected`).
- Prefer small, reviewable commits with messages that explain *why*.

## Verification workflow (how we use AI responsibly)

1. AI proposes code or tests.
2. A human (the student) reviews it and must be able to explain it in the defence
   — AI may not be used during the defence explanation.
3. Rules are verified by automated tests before a feature is considered done.
4. Substantive AI decisions are logged in `docs/AI-DECISIONS.md` (problem, tool,
   context/prompt, suggestion, decision + reason, verifying test/result).

## Build / test commands

- Backend: `cd backend && npm install && npm run dev` (dev), `npm test` (tests).
- Frontend: `cd frontend && npm install && npm run dev`.
- Full setup instructions live in `README.md`.

## Guardrails for AI tools

- Do not introduce OAuth, external auth providers, or multi-timezone logic — they
  are explicitly out of scope in the approved spec.
- Do not add a second person per desk; capacity is 1.
- Do not weaken the overlap rule: overlapping bookings are rejected, but
  back-to-back bookings (B starts exactly when A ends) are allowed (AC3).
