# Desk Booking App

A web application for reserving desks in a shared office space. Users view desk
availability, book time slots, and manage their own reservations. The system
prevents double bookings and enforces booking rules.

This is the homework assignment for **AI Assisted Software Development** (BME).
See [`SPEC.md`](./SPEC.md) for the approved specification and acceptance criteria.

## Tech stack

- **Backend:** Node.js + Express, SQLite storage, username/password auth with
  session tokens.
- **Frontend:** React (Vite).

## Project structure

```
backend/    Express REST API + SQLite (business rules live here)
frontend/   React single-page app
docs/        AI decision log and supporting docs
SPEC.md      Approved specification and acceptance criteria (AC1–AC8)
AGENTS.md    Guidance for AI coding tools
```

## Setup

Requires Node.js 20+ and npm.

### Backend

```bash
cd backend
npm install
npm run dev        # starts the API (default http://localhost:3001)
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # starts the SPA (default http://localhost:5173)
```

## Running tests

```bash
cd backend
npm test
```

Tests are mapped to the acceptance criteria in `SPEC.md` (test names reference
AC1–AC8).

## AI-assisted development

AI tools were used across requirements analysis, implementation, and testing.
Specific decisions and how they were verified are documented in
[`docs/AI-DECISIONS.md`](./docs/AI-DECISIONS.md). Guidance given to AI tools is in
[`AGENTS.md`](./AGENTS.md).

## Status

Milestone 2 (first working version) — in progress.
