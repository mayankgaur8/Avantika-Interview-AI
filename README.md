# InterviewAI — Adaptive AI Interview Platform

A production-ready, full-stack platform that conducts structured technical interviews, adapts question difficulty in real-time, evaluates answers automatically (MCQ, code execution, AI rubric scoring), monitors integrity signals, and generates comprehensive recruiter reports.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Quick Start (Docker)](#quick-start-docker)
5. [Quick Start (Local Dev)](#quick-start-local-dev)
6. [Environment Variables](#environment-variables)
7. [API Reference](#api-reference)
8. [Key Features](#key-features)
9. [MVP Roadmap](#mvp-roadmap)
10. [Contributing](#contributing)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Browser (Candidate / Recruiter)            │
│                     Next.js 15  ·  Tailwind  ·  Zustand             │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTPS REST + polling
┌───────────────────────────▼─────────────────────────────────────────┐
│                    NestJS API  (:3001)                               │
│  Auth (JWT)  ·  Interviews  ·  Integrity  ·  Reports  ·  Swagger    │
└──────┬──────────────┬────────────────────┬───────────────────────────┘
       │              │                    │
  ┌────▼────┐   ┌─────▼──────┐     ┌──────▼──────────────────────┐
  │Postgres │   │   Redis 7  │     │    BullMQ Queues             │
  │  :5432  │   │   :6379    │     │  ┌──────────┐ ┌──────────┐  │
  └─────────┘   └────────────┘     │  │evaluation│ │ reports  │  │
                                   │  └────┬─────┘ └────┬─────┘  │
                                   └───────┼─────────────┼────────┘
                                           │             │
                              ┌────────────▼──┐   ┌──────▼──────────────┐
                              │  Eval Worker  │   │  Report Worker       │
                              │  ┌──────────┐ │   │  · Section rollup   │
                              │  │  Judge0  │ │   │  · Integrity risk   │
                              │  │ Sandbox  │ │   │  · GPT-4o narrative │
                              │  │  :2358   │ │   └─────────────────────┘
                              │  └──────────┘ │
                              │  · GPT-4o AI  │
                              └───────────────┘
```

**Request flow:**
1. Candidate authenticates → receives JWT access + refresh tokens
2. Session started → adaptive engine selects questions from template
3. Each answer submission → saved to PostgreSQL → job pushed to `evaluation` queue
4. Eval worker grades: MCQ (exact match) | Coding (Judge0 sandbox) | Text (GPT-4o rubric)
5. Rolling score updated → next question difficulty adjusted automatically
6. Session complete → job pushed to `reports` queue
7. Report worker aggregates all answers, integrity events, and generates AI narrative
8. Recruiter polls report endpoint until `status === "ready"`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, App Router |
| State | Zustand (persist middleware) |
| Forms | react-hook-form + zod |
| HTTP | Axios with JWT interceptor + auto-refresh |
| Backend | NestJS, TypeScript |
| ORM | TypeORM + PostgreSQL 16 |
| Auth | Passport JWT, bcrypt (rounds=12) |
| Queues | BullMQ via `@nestjs/bull` + Redis 7 |
| AI Scoring | OpenAI GPT-4o (`json_object` response mode) |
| Code Sandbox | Judge0 v1.13.1 (self-hosted Docker) |
| API Docs | Swagger UI (`/api/docs`) |
| Security | Helmet, `@nestjs/throttler` (100 req / 60 s) |
| Containers | Docker + Docker Compose |

---

## Project Structure

```
AI-Interview-Bot/
├── backend/
│   ├── src/
│   │   ├── auth/               # JWT strategy, guards, login/register
│   │   ├── users/              # User entity, CRUD, refresh-token management
│   │   ├── interviews/         # Session + template entities, lifecycle service
│   │   ├── questions/          # Question bank (MCQ/coding/behavioral/sysdesign)
│   │   ├── answers/            # Answer submission + status tracking
│   │   ├── evaluation/         # BullMQ worker, Judge0 sandbox, GPT-4o evaluator
│   │   ├── reports/            # Report entity, BullMQ worker, recruiter controller
│   │   ├── integrity/          # Integrity-event entity, service, controller
│   │   ├── config/             # configuration.ts — central env factory
│   │   └── database/           # seed.ts — seed templates & sample questions
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                        # Landing page
│   │   │   ├── login/page.tsx                  # Login
│   │   │   ├── register/page.tsx               # Register (candidate / recruiter)
│   │   │   ├── dashboard/page.tsx              # Candidate dashboard
│   │   │   ├── interview/[sessionId]/page.tsx  # Live interview UI
│   │   │   └── report/[sessionId]/page.tsx     # Recruiter report
│   │   ├── hooks/useIntegrityMonitor.ts        # Tab-switch, copy/paste, inactivity
│   │   ├── lib/api.ts                          # Axios client + interceptors
│   │   └── store/authStore.ts                  # Zustand auth store
│   ├── Dockerfile
│   └── .env.local
├── docs/
│   ├── ARCHITECTURE.md         # Detailed system design & component descriptions
│   ├── DB_SCHEMA.md            # Entity relationships & column definitions
│   ├── API_CONTRACTS.md        # Full REST API reference with JSON samples
│   ├── SEQUENCE_FLOWS.md       # Sequence diagrams for key flows
│   └── MVP_ROADMAP.md          # 2 / 4 / 8-week phased plan
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## Quick Start (Docker)

> **Prerequisites:** Docker ≥ 24, Docker Compose v2

```bash
# 1. Clone
git clone https://github.com/your-org/ai-interview-bot.git
cd ai-interview-bot

# 2. Copy and fill in env vars
cp backend/.env.example backend/.env
# Edit backend/.env — add OPENAI_API_KEY at minimum

# 3. Spin up the full stack
docker-compose up --build

# 4. Seed initial templates
docker-compose exec backend npx ts-node src/database/seed.ts

# 5. Open
#   Frontend   → http://localhost:3000
#   API Docs   → http://localhost:3001/api/docs
#   Judge0 UI  → http://localhost:2358
```

---

## Quick Start (Local Dev)

```bash
# Infrastructure only
docker-compose up -d postgres redis judge0-server judge0-workers judge0-db judge0-redis

# Backend
cd backend
cp .env.example .env          # fill in values
npm install
npm run start:dev             # http://localhost:3001/api/docs

# Seed templates (separate terminal)
cd backend
npx ts-node src/database/seed.ts

# Frontend
cd frontend
cp .env.local.example .env.local   # or set NEXT_PUBLIC_API_URL=http://localhost:3001
npm install
npm run dev                   # http://localhost:3000
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | NestJS listen port |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USERNAME` | `postgres` | DB user |
| `DB_PASSWORD` | `postgres` | DB password |
| `DB_NAME` | `ai_interview_bot` | Database name |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `JWT_SECRET` | — | **Required** — access token signing key |
| `JWT_REFRESH_SECRET` | — | **Required** — refresh token signing key |
| `JWT_EXPIRATION` | `8h` | Access token TTL |
| `JWT_REFRESH_EXPIRATION` | `7d` | Refresh token TTL |
| `OPENAI_API_KEY` | — | **Required** — GPT-4o API key |
| `JUDGE0_API_URL` | `http://localhost:2358` | Judge0 REST endpoint |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed CORS origin |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Backend API base URL |

---

## API Reference

Full OpenAPI spec available at **`http://localhost:3001/api/docs`** when the backend is running.

### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register new user |
| `POST` | `/api/auth/login` | Login → access + refresh tokens |
| `POST` | `/api/auth/refresh` | Exchange refresh token |
| `POST` | `/api/auth/logout` | Invalidate refresh token |
| `GET` | `/api/auth/me` | Current user profile |

### Interviews

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/interviews/templates` | Create interview template (recruiter) |
| `GET` | `/api/interviews/templates` | List all templates |
| `POST` | `/api/interviews/sessions` | Start interview session |
| `GET` | `/api/interviews/sessions/:id` | Get session state |
| `GET` | `/api/interviews/sessions/:id/next-question` | Fetch next question |
| `POST` | `/api/interviews/sessions/:id/answers` | Submit an answer |
| `POST` | `/api/interviews/sessions/:id/complete` | Complete session |
| `GET` | `/api/interviews/sessions` | List user sessions |

### Integrity

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/integrity/events` | Record integrity event |
| `GET` | `/api/integrity/sessions/:id/events` | List events for session |

### Reports

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/reports/sessions/:id` | Get report for session |
| `PATCH` | `/api/reports/:id/notes` | Add recruiter notes |

---

## Key Features

### 🎯 Adaptive Question Selection
The engine tracks a rolling average of the last 3 evaluated scores. If the average exceeds **75%**, it up-shifts remaining questions toward harder difficulty. If it falls below **40%**, it down-shifts toward easier questions. This mirrors how real adaptive tests (like GRE/GMAT) work.

### 🔒 Integrity Monitoring
The `useIntegrityMonitor` hook silently watches:
- **Tab visibility** changes (`visibilitychange` event)
- **Window blur** (switching apps)
- **Copy / paste** (blocked + recorded)
- **Inactivity** (2-minute timeout with no mouse/keyboard)

After **5 cumulative events**, the session is automatically flagged. Recruiters see a per-event timeline and risk level (low / medium / high) in the report.

### ⚡ Async Evaluation Pipeline
```
Answer submitted → PostgreSQL (status=pending)
                 → BullMQ "evaluation" queue
                 → Worker grades (MCQ / Judge0 / GPT-4o)
                 → PostgreSQL updated (status=evaluated)
                 → Session rolling score refreshed
```

### 🤖 AI Rubric Scoring
Behavioral and system-design answers are graded by GPT-4o against structured rubric criteria (each with a `maxPoints`, `description`, and `keywords` hint array). The model returns a JSON object with per-criterion scores and brief feedback, which is stored in `answer.evaluationResult`.

### 📊 Recruiter Reports
After session completion, the `reports` worker:
1. Aggregates scores by section (MCQ / Coding / Behavioral / System Design)
2. Calculates integrity risk (HIGH events > 2 → "high", any HIGH → "medium", else "low")
3. Generates a 2–3 paragraph AI narrative summarising strengths and weaknesses
4. Saves as a single `Report` row — recruiter views it via polling

---

## MVP Roadmap

See [`docs/MVP_ROADMAP.md`](docs/MVP_ROADMAP.md) for the full phased plan.

| Phase | Timeline | Focus |
|---|---|---|
| Phase 1 | Weeks 1–2 | Auth, templates, MCQ sessions |
| Phase 2 | Weeks 3–4 | Coding sandbox, async evaluation |
| Phase 3 | Weeks 5–6 | AI scoring, behavioral/sysdesign |
| Phase 4 | Weeks 7–8 | Reports, integrity, recruiter dashboard |

---

## Contributing

1. Fork and create a feature branch: `git checkout -b feat/your-feature`
2. Follow NestJS module conventions — keep services, controllers, entities co-located per domain
3. Add/update DTOs with `class-validator` decorators
4. Run `npm run lint && npm run test` before opening a PR
5. Never commit `.env` files — use `.env.example` as the template
