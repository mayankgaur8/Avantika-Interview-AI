# AI Interview Bot — Workspace Copilot Instructions

## Project Overview
Full-stack AI-powered technical interview platform:
- **Frontend**: Next.js 15 (App Router, TypeScript, Tailwind CSS) in `frontend/`
- **Backend**: NestJS (TypeScript, TypeORM, PostgreSQL) in `backend/`
- **Queues**: Redis + BullMQ via `@nestjs/bull` — two queues: `evaluation`, `reports`
- **AI Scoring**: OpenAI GPT-4o for behavioral/system-design rubric grading
- **Code Sandbox**: Judge0 v1.13.1 via Docker for secure code execution
- **Auth**: JWT (access 8 h) + refresh token (7 d) stored as bcrypt hash in DB

## Directory Layout
```
AI-Interview-Bot/
├── backend/src/
│   ├── auth/           # JWT strategy, guards, controller, service
│   ├── users/          # User entity, CRUD service
│   ├── interviews/     # Session + template entities, lifecycle service, controller
│   ├── questions/      # Question entity (MCQ/coding/behavioral/system_design)
│   ├── answers/        # Answer entity + status tracking
│   ├── evaluation/     # BullMQ worker, SandboxService (Judge0), AiEvaluatorService (GPT-4o)
│   ├── reports/        # Report entity, BullMQ report-generation worker, controller
│   ├── integrity/      # IntegrityEvent entity, service, controller
│   ├── config/         # configuration.ts (env factory)
│   └── database/       # seed.ts
├── frontend/src/
│   ├── app/            # Next.js App Router pages
│   │   ├── page.tsx            # Landing
│   │   ├── login/page.tsx      # Auth
│   │   ├── register/page.tsx   # Auth
│   │   ├── dashboard/page.tsx  # Candidate home
│   │   ├── interview/[sessionId]/page.tsx  # Live interview
│   │   └── report/[sessionId]/page.tsx     # Recruiter report
│   ├── hooks/useIntegrityMonitor.ts  # Tab/copy/inactivity detection
│   ├── lib/api.ts              # Axios client + JWT interceptor
│   └── store/authStore.ts      # Zustand auth store
├── docker-compose.yml          # Full stack: postgres, redis, judge0, backend, frontend
└── docs/                       # Architecture, DB schema, API contracts, MVP roadmap
```

## Key Conventions
- **Entities**: TypeORM with `@Entity()`, JSONB columns use `{ type: 'jsonb' }`, forward references via `() => Entity`
- **DTOs**: `class-validator` decorators, `class-transformer` in `ValidationPipe` (whitelist + transform)
- **Workers**: `@Processor('queue-name')` + `@Process('job-name')` from `@nestjs/bull`
- **Guards**: `@UseGuards(JwtAuthGuard)` on all protected routes; `@Public()` decorator skips guard
- **API prefix**: All routes prefixed `/api` — Swagger UI at `/api/docs`
- **Adaptive engine**: In `interviews.service.ts → applyAdaptiveSelection()` — rolls last 3 answers; avg ≥ 75% → harder, avg < 40% → easier
- **Sanitization**: `sanitizeQuestion()` strips `correctAnswerIds` and hidden test case outputs before sending to candidate

## Environment Variables (backend)
See `backend/.env.example` for all required vars. Key ones:
- `DATABASE_URL` / `DB_*` — PostgreSQL connection
- `REDIS_HOST`, `REDIS_PORT` — BullMQ broker
- `JWT_SECRET`, `JWT_REFRESH_SECRET` — token signing
- `OPENAI_API_KEY` — GPT-4o evaluation
- `JUDGE0_API_URL` — code sandbox (default: `http://localhost:2358`)

## Running Locally
```bash
# Infrastructure (postgres + redis + judge0)
docker-compose up -d postgres redis judge0-server judge0-workers judge0-db judge0-redis

# Backend
cd backend && npm run start:dev

# Frontend
cd frontend && npm run dev
```

## Testing Patterns
- Backend unit tests: Jest with `@nestjs/testing` `TestingModule`
- Mock `getRepositoryToken(Entity)` for TypeORM repos
- Mock `getQueueToken('queue-name')` for BullMQ queues
- Frontend: React Testing Library + MSW for API mocking

## Important Notes for Copilot
- Never expose `correctAnswerIds`, `isCorrect`, or non-public test case `expectedOutput` in responses to candidates
- All integrity events are fire-and-forget from frontend; backend flags session after ≥ 5 events
- Reports are generated asynchronously — frontend polls until `status === 'ready'`
- Judge0 language IDs: JavaScript=63, TypeScript=74, Python=71, Java=62, C++=54, Go=60, SQL=82
- BullMQ job data shapes are defined in respective `*.worker.ts` files — keep in sync with service enqueue calls
