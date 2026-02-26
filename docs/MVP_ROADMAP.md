# MVP Roadmap — InterviewAI

A phased delivery plan targeting a production-ready platform in 8 weeks.

---

## Phase 1 — Core Auth + Templates + MCQ (Weeks 1–2)

**Goal:** A recruiter can define a template; a candidate can log in and complete an MCQ-only session.

### Week 1

| Task | Owner | Notes |
|---|---|---|
| Scaffold NestJS backend + PostgreSQL via Docker Compose | Backend | TypeORM `synchronize: true` for dev |
| Scaffold Next.js frontend with Tailwind + App Router | Frontend | — |
| Implement `users` module: register / login / JWT | Backend | bcrypt (12), access + refresh token rotation |
| Implement Zustand auth store + Axios interceptor | Frontend | Auto-refresh on 401 |
| Login + Register pages (react-hook-form + zod) | Frontend | Support `?role=recruiter` |

### Week 2

| Task | Owner | Notes |
|---|---|---|
| `interview_templates` + `questions` entities | Backend | JSONB sectionConfig, MCQ options |
| Seed script with 2–3 starter templates | Backend | `src/database/seed.ts` |
| `InterviewsService`: `startSession`, `getNextQuestion` | Backend | Adaptive engine stub (random order) |
| `InterviewsService`: `submitAnswer` (synchronous MCQ grading) | Backend | Exact set-match scoring |
| Dashboard page: list templates, start session | Frontend | — |
| Live interview page: MCQ multi-select + timer | Frontend | Basic countdown from `timeLimitMinutes` |

**Milestone checkpoint:** Candidate can log in, start an MCQ session, answer 10 questions, and see a basic score page.

---

## Phase 2 — Coding Sandbox + Async Evaluation Queue (Weeks 3–4)

**Goal:** Code submissions are executed in a sandboxed environment; evaluation is fully asynchronous.

### Week 3

| Task | Owner | Notes |
|---|---|---|
| Add Judge0 v1.13.1 to Docker Compose | DevOps | `privileged: true`, language ID map |
| `SandboxService`: submit + poll Judge0 | Backend | Language → ID map, retry on pending |
| `evaluation` BullMQ queue + `@nestjs/bull` wiring | Backend | Redis broker |
| `EvaluationWorker`: MCQ + Coding job handlers | Backend | Ratio scoring for test cases |
| `IntegrityEvent` entity + `IntegrityService` | Backend | Auto-flag at threshold 5 |
| `IntegrityController`: POST events, GET timeline | Backend | — |

### Week 4

| Task | Owner | Notes |
|---|---|---|
| Code editor in interview page: textarea + language picker | Frontend | Paste blocked + integrity event fired |
| `useIntegrityMonitor` hook | Frontend | Tab switch, window blur, copy/paste, inactivity |
| Connect integrity hook → POST `/integrity/events` | Frontend | Silent fail — no disruption to candidate |
| Answer status polling (pending → evaluated) | Frontend | Poll every 2s for current answer status |
| Update session `rollingScore` after each eval | Backend | `getNextQuestion` starts applying adaptive sort |

**Milestone checkpoint:** Code submissions run in Docker sandbox; integrity signals are recorded; adaptive difficulty sorting activates based on performance.

---

## Phase 3 — AI Scoring: Behavioral + System Design (Weeks 5–6)

**Goal:** All four question types are fully evaluated; rubric-based AI scoring is live.

### Week 5

| Task | Owner | Notes |
|---|---|---|
| `AiEvaluatorService`: GPT-4o rubric scoring | Backend | `response_format: json_object`, fallback on API error |
| `EvaluationWorker`: behavioral + system_design handlers | Backend | Per-criterion scores, feedback extraction |
| Seed behavioral + system-design questions with rubrics | Backend | Update seed.ts |
| Interview page: text area for behavioral/system_design | Frontend | Paste blocked, char counter |
| System-design question display with rich prompt | Frontend | Markdown rendering for long prompts |

### Week 6

| Task | Owner | Notes |
|---|---|---|
| Full adaptive engine: avgScore → difficulty shift | Backend | `applyAdaptiveSelection()` complete |
| Session completion: detect all questions answered | Backend | Auto-call `completeSession()` |
| `POST /sessions/:id/complete` endpoint | Backend | Enqueues `generate_report` job |
| `InterviewTemplate` management UI (recruiter) | Frontend | Create / list / toggle active templates |
| Add question form: all 4 types with rubric builder | Frontend | (v1: JSON textarea for rubric is acceptable) |

**Milestone checkpoint:** All 4 question types work end-to-end with AI scoring; adaptive difficulty is live; sessions complete cleanly.

---

## Phase 4 — Reports, Recruiter Dashboard + Polish (Weeks 7–8)

**Goal:** Recruiters receive rich async reports; the platform is production-ready with security hardening.

### Week 7

| Task | Owner | Notes |
|---|---|---|
| `reports` BullMQ queue + `ReportsWorker` | Backend | Section rollup, integrity risk, GPT-4o narrative |
| `ReportsController`: GET by session, PATCH notes | Backend | Swagger docs |
| Report page: polling, section breakdown, integrity timeline | Frontend | Progress bars, risk badge, collapsible Q&A |
| Recruiter dashboard: list all sessions + report links | Frontend | Filter by template / date / integrity flag |
| Email notification on report ready (optional) | Backend | Nodemailer + SMTP env vars |

### Week 8

| Task | Owner | Notes |
|---|---|---|
| Security hardening: Helmet, ThrottlerGuard, CORS | Backend | `configuration.ts` env-driven |
| Multi-stage Dockerfiles (builder + runner) | DevOps | Minimal image size |
| `docker-compose.yml` for full prod stack | DevOps | Health checks, restart policies |
| `.env.example` + documentation | All | README, ARCHITECTURE.md, API_CONTRACTS.md |
| End-to-end test pass: register → interview → report | QA | All 4 question types, integrity signals |
| Fix TypeScript compilation errors, `npm run build` pass | Backend+Frontend | Both services |
| (Stretch) PDF report export | Backend | `puppeteer` or `pdfmake` |

**Milestone checkpoint:** Full platform deployed via Docker Compose; recruiter can view reports with AI narrative, section breakdown, and integrity risk level.

---

## Post-MVP Backlog (Weeks 9+)

| Feature | Priority | Description |
|---|---|---|
| PDF report export | High | Puppeteer-rendered report download |
| Email notifications | High | Invite candidates, notify recruiter on completion |
| Multi-tenant org support | High | Companies have isolated templates + candidates |
| Webcam proctoring | Medium | Record + detect face absence via browser API |
| Video/audio questions | Medium | Candidate records 90s video response |
| Admin analytics dashboard | Medium | Pass rates, avg scores by role/template |
| Question bank marketplace | Medium | Recruiter imports community-contributed questions |
| Resume parsing + ATS integration | Low | Pre-fill candidate profile from PDF |
| Collaborative review | Low | Multiple recruiters annotate same report |
| Mobile-responsive interview UI | Low | Native iOS/Android PWA feel |

---

## Definition of Done

A phase is complete when:
1. All listed tasks have a corresponding PR merged to `main`
2. `npm run build` passes for both `backend/` and `frontend/` without TypeScript errors
3. The milestone checkpoint can be demonstrated end-to-end in a fresh `docker-compose up` environment
4. No `HIGH` severity security issues in `npm audit`
5. At least one unit test per new service method
