# Architecture — InterviewAI

## System Overview

InterviewAI is a horizontally-scalable, event-driven interview platform built around five logical layers:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER                                                          │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Next.js 15  ·  App Router  ·  Tailwind CSS  ·  Zustand             │    │
│  │                                                                     │    │
│  │   /               /login       /register                            │    │
│  │   /dashboard      /interview/[sessionId]   /report/[sessionId]      │    │
│  └──────────────────────────────┬──────────────────────────────────────┘    │
└─────────────────────────────────┼────────────────────────────────────────────┘
                                  │ REST over HTTPS
                                  │ Bearer JWT (access token)
┌─────────────────────────────────▼────────────────────────────────────────────┐
│  API LAYER                                                                   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  NestJS  ·  TypeScript  ·  Passport-JWT  ·  Swagger (/api/docs)     │    │
│  │                                                                     │    │
│  │  AuthController          /api/auth/*                                │    │
│  │  InterviewsController    /api/interviews/*                          │    │
│  │  IntegrityController     /api/integrity/*                           │    │
│  │  ReportsController       /api/reports/*                             │    │
│  │                                                                     │    │
│  │  Security: Helmet · ThrottlerGuard (100/60s) · ValidationPipe       │    │
│  └────────┬────────────────────────────────────┬────────────────────────┘    │
└───────────┼────────────────────────────────────┼─────────────────────────────┘
            │ TypeORM                            │ BullMQ (enqueue jobs)
┌───────────▼──────────────┐        ┌────────────▼───────────────────────────┐
│  DATA LAYER              │        │  QUEUE LAYER                           │
│                          │        │                                        │
│  PostgreSQL 16           │        │  Redis 7  (broker)                     │
│  ┌────────────────────┐  │        │  ┌─────────────────────────────────┐   │
│  │  users             │  │        │  │  Queue: "evaluation"            │   │
│  │  interview_sessions│  │        │  │    job: evaluate_answer         │   │
│  │  interview_templates│ │        │  │                                 │   │
│  │  questions         │  │        │  │  Queue: "reports"               │   │
│  │  answers           │  │        │  │    job: generate_report         │   │
│  │  integrity_events  │  │        │  └─────────────────────────────────┘   │
│  │  reports           │  │        └────────────┬───────────────────────────┘
│  └────────────────────┘  │                     │ consumed by
└──────────────────────────┘        ┌────────────▼───────────────────────────┐
                                    │  WORKER LAYER                          │
                                    │                                        │
                                    │  EvaluationWorker                      │
                                    │  ┌───────────────────────────────────┐ │
                                    │  │  MCQ   → exact set match          │ │
                                    │  │  Code  → Judge0 Docker sandbox    │ │
                                    │  │  Text  → GPT-4o rubric scoring    │ │
                                    │  └───────────────────────────────────┘ │
                                    │                                        │
                                    │  ReportsWorker                         │
                                    │  ┌───────────────────────────────────┐ │
                                    │  │  Aggregate section scores         │ │
                                    │  │  Compute integrity risk level     │ │
                                    │  │  GPT-4o AI narrative              │ │
                                    │  │  Save Report → notify session     │ │
                                    │  └───────────────────────────────────┘ │
                                    └────────────────────────────────────────┘
                                                     │
                             ┌───────────────────────▼────────────────────────┐
                             │  EXTERNAL SERVICES                             │
                             │                                                │
                             │  ┌─────────────────────┐  ┌────────────────┐  │
                             │  │  Judge0  v1.13.1     │  │  OpenAI        │  │
                             │  │  (self-hosted Docker)│  │  GPT-4o API    │  │
                             │  │  :2358               │  │  (cloud)       │  │
                             │  └─────────────────────┘  └────────────────┘  │
                             └────────────────────────────────────────────────┘
```

---

## Component Descriptions

### 1. Next.js Frontend (`frontend/`)

| File | Responsibility |
|---|---|
| `app/page.tsx` | Public landing page with feature showcase |
| `app/login/page.tsx` | JWT login form (react-hook-form + zod) |
| `app/register/page.tsx` | Registration — supports `?role=recruiter` |
| `app/dashboard/page.tsx` | Candidate home: templates, session history |
| `app/interview/[sessionId]/page.tsx` | Live interview: timer, MCQ, code editor, text area |
| `app/report/[sessionId]/page.tsx` | Recruiter report with polling (3s interval, 120s timeout) |
| `hooks/useIntegrityMonitor.ts` | Browser-side integrity signal detector |
| `lib/api.ts` | Axios instance with JWT attach + 401 auto-refresh |
| `store/authStore.ts` | Zustand auth state with localStorage persistence |

### 2. NestJS Backend (`backend/src/`)

| Module | Key Files | Responsibility |
|---|---|---|
| `auth` | `auth.service.ts`, `jwt.strategy.ts` | bcrypt password, JWT sign/verify, refresh rotation |
| `users` | `users.service.ts`, `user.entity.ts` | User CRUD, refresh token hashing |
| `interviews` | `interviews.service.ts`, `*session*.entity.ts` | Session lifecycle, adaptive engine |
| `questions` | `question.entity.ts` | Question bank with rubric & test cases |
| `answers` | `answer.entity.ts` | Answer submission + evaluation result storage |
| `evaluation` | `evaluation.worker.ts`, `sandbox.service.ts`, `ai-evaluator.service.ts` | Async grading pipeline |
| `integrity` | `integrity.service.ts`, `integrity-event.entity.ts` | Proctoring signal recording |
| `reports` | `reports.worker.ts`, `report.entity.ts` | Async report generation |

### 3. Adaptive Engine

Located in `interviews.service.ts → applyAdaptiveSelection()`:

```
Rolling window = last 3 evaluated answers (by evaluatedAt desc)
avgScore = sum(answer.score / answer.maxScore) / count

if avgScore >= 0.75:  sort remaining questions [HARD, MEDIUM, EASY]
if avgScore <  0.40:  sort remaining questions [EASY, MEDIUM, HARD]
else:                 maintain original orderIndex
```

### 4. Evaluation Pipeline

```
POST /api/interviews/sessions/:id/answers
  └─► Save Answer (status=PENDING)
  └─► Enqueue job { answerId, sessionId, questionType, ... }
        └─► EvaluationWorker.handleEvaluateAnswer()
              ├─ MCQ         ─► setEqual(submitted, correct) → 100 or 0
              ├─ CODING      ─► loop testCases via Judge0 → ratio scoring
              └─ BEHAVIORAL/SYSTEM_DESIGN ─► GPT-4o rubric JSON → per-criterion scores
        └─► Answer updated (status=EVALUATED, score, evaluationResult)
        └─► Session.rollingScore refreshed (last 3 answers avg)
```

### 5. Integrity Monitoring

**Frontend signals captured:**
- `visibilitychange` → `tab_switch`
- `window blur` → `window_blur`
- `copy/paste` events → `copy_paste` (event blocked + recorded)
- Inactivity timer (2 min no mouse/keyboard) → `inactivity`

**Backend auto-flag logic (`integrity.service.ts`):**
```
SEVERITY_MAP:
  tab_switch       → medium
  window_blur      → low
  copy_paste       → high
  devtools_open    → high
  time_anomaly     → high
  rapid_answer     → medium
  inactivity       → low
  screenshot_attempt → medium

FLAG_THRESHOLD = 5 cumulative events
→ session.isIntegrityFlagged = true
```

### 6. Docker Compose Services

| Service | Image | Port | Purpose |
|---|---|---|---|
| `postgres` | postgres:16-alpine | 5432 | Main application database |
| `redis` | redis:7-alpine | 6379 | BullMQ broker |
| `judge0-server` | judge0/judge0:1.13.1 | 2358 | Code execution REST API |
| `judge0-workers` | judge0/judge0:1.13.1 | — | Judge0 background workers |
| `judge0-db` | postgres:13 | 5433 | Judge0 internal DB |
| `judge0-redis` | redis:6 | 6380 | Judge0 internal cache |
| `backend` | ./backend/Dockerfile | 3001 | NestJS API |
| `frontend` | ./frontend/Dockerfile | 3000 | Next.js app |

---

## Security Model

| Concern | Mitigation |
|---|---|
| Brute force | `@nestjs/throttler`: 100 requests / 60 s per IP |
| XSS | `helmet()` sets `Content-Security-Policy`, `X-XSS-Protection` |
| CORS | Configurable `CORS_ORIGIN` env var, credentials=true |
| Passwords | bcrypt with cost factor 12 |
| Tokens | Short-lived access token (8h) + rotated refresh token (7d, stored as bcrypt hash) |
| Code execution | Judge0 sandboxed in Docker with `privileged: true` namespacing + CPU/memory limits per submission |
| Answer leakage | `sanitizeQuestion()` strips `correctAnswerIds`; hides non-public test case `expectedOutput` |
| Input validation | `ValidationPipe(whitelist: true, transform: true)` on all endpoints |
