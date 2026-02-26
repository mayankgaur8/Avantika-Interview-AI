# Sequence Flows — InterviewAI

## 1. Authentication Flow

```
Candidate           Next.js             NestJS API          PostgreSQL
    │                   │                    │                   │
    │── POST /register ─►│                   │                   │
    │                   │── POST /auth/register ─►               │
    │                   │                    │── INSERT users ──►│
    │                   │                    │◄── user row ───────│
    │                   │                    │ bcrypt(password)   │
    │                   │                    │ sign accessToken   │
    │                   │                    │ sign refreshToken  │
    │                   │                    │── UPDATE          │
    │                   │                    │   refreshTokenHash│
    │                   │◄── { user, tokens } ──                 │
    │◄── redirect /dashboard ─│             │                   │
    │                   │                    │                   │
    │── POST /login ────►│                   │                   │
    │                   │── POST /auth/login ─►                  │
    │                   │                    │── SELECT user ───►│
    │                   │                    │◄── user row ───────│
    │                   │                    │ bcrypt.compare()   │
    │                   │                    │ sign new tokens    │
    │                   │◄── { accessToken, refreshToken } ──    │
    │   (stored in      │                    │                   │
    │    localStorage   │                    │                   │
    │    + zustand)     │                    │                   │
    │                   │                    │                   │
    │── any API call ───►│                   │                   │
    │                   │── GET /resource ───►                   │
    │                   │   Bearer: <token>  │                   │
    │                   │                    │ JwtStrategy        │
    │                   │                    │ verify + decode    │
    │                   │◄── 200 OK ─────────│                   │
    │                   │                    │                   │
    │                   │ (401 received)     │                   │
    │                   │── POST /auth/refresh ──►               │
    │                   │   { userId, refreshToken }             │
    │                   │                    │── SELECT user ───►│
    │                   │                    │ bcrypt.compare()   │
    │                   │                    │ sign new tokens    │
    │                   │◄── { newAccessToken, newRefreshToken }─│
    │                   │ (retry original    │                   │
    │                   │  request)          │                   │
```

---

## 2. Interview Session Lifecycle

```
Candidate           Next.js             NestJS API          PostgreSQL        Redis (BullMQ)
    │                   │                    │                   │                  │
    │── Start session ──►│                   │                   │                  │
    │                   │── POST /interviews/sessions ──►        │                  │
    │                   │                    │── SELECT template►│                  │
    │                   │                    │── SELECT questions►                  │
    │                   │                    │── INSERT session ─►                  │
    │                   │                    │   adaptiveState = │                  │
    │                   │                    │   { questionOrder }                  │
    │                   │◄── { sessionId, timeRemaining } ──     │                  │
    │                   │                    │                   │                  │
    │   ┌─────────────────────────────────────────────────────┐  │                  │
    │   │                QUESTION LOOP                        │  │                  │
    │   │                                                     │  │                  │
    │   │── GET /sessions/:id/next-question ──────────────────►  │                  │
    │   │                    │── SELECT session ──────────────►  │                  │
    │   │                    │── SELECT question (adaptive) ───► │                  │
    │   │                    │   sanitizeQuestion()              │                  │
    │   │◄── { question, questionNumber, total, timeLeft } ──    │                  │
    │   │                    │                                   │                  │
    │   │   (candidate answers)                                  │                  │
    │   │                    │                                   │                  │
    │   │── POST /sessions/:id/answers ──────────────────────────►                  │
    │   │                    │── INSERT answer (status=PENDING) ─►                  │
    │   │                    │── UPDATE session.currentIndex ────►                  │
    │   │                    │── queue.add('evaluate_answer', ────────────────────► │
    │   │                    │   { answerId, sessionId, ... })   │                  │
    │   │◄── { answerId, status: 'pending' } ──                  │                  │
    │   └─────────────────────────────────────────────────────┘  │                  │
    │                   │                    │                   │                  │
    │── POST /sessions/:id/complete ──────────►                  │                  │
    │                   │                    │── UPDATE session  │                  │
    │                   │                    │   status=completed│                  │
    │                   │                    │── queue.add(       ─────────────────►│
    │                   │                    │  'generate_report')│                 │
    │                   │◄── { reportUrl } ──│                   │                  │
    │                   │                    │                   │                  │
    │   (poll report)                        │                   │                  │
    │── GET /reports/sessions/:id ──────────►│                   │                  │
    │                   │◄── { status: 'generating' } ──         │                  │
    │   ... (every 3s)  │                    │                   │                  │
    │── GET /reports/sessions/:id ──────────►│                   │                  │
    │                   │◄── { status: 'ready', ... full report } │                 │
```

---

## 3. Async Evaluation Pipeline (per answer)

```
BullMQ Queue          EvaluationWorker      SandboxService       AiEvaluatorService   PostgreSQL
    │                        │                    │                      │                │
    │── job: evaluate_answer─►                    │                      │                │
    │   { answerId,          │                    │                      │                │
    │     questionType,      │                    │                      │                │
    │     sessionId }        │                    │                      │                │
    │                        │── SELECT answer ──────────────────────────────────────────►│
    │                        │── SELECT question ────────────────────────────────────────►│
    │                        │                    │                      │                │
    │                 ┌──────┴──────────────────────────────────────────────────────┐    │
    │                 │                  TYPE DISPATCH                              │    │
    │                 │                                                             │    │
    │                 │  MCQ:                                                       │    │
    │                 │    setEqual(submittedIds, correctAnswerIds)                 │    │
    │                 │    score = match ? maxScore : 0                             │    │
    │                 │                                                             │    │
    │                 │  CODING:                                                    │    │
    │                 │    for each testCase:                                       │    │
    │                 │      POST /submissions?wait=true ─────────────►             │    │
    │                 │      { source_code, language_id, stdin }      │             │    │
    │                 │      ◄─── { stdout, stderr, status, time } ───│             │    │
    │                 │      compare stdout vs expectedOutput         │             │    │
    │                 │    score = (passed / total) * maxScore        │             │    │
    │                 │                                                             │    │
    │                 │  BEHAVIORAL / SYSTEM_DESIGN:                               │    │
    │                 │    buildRubricPrompt(rubric, answer)                        │    │
    │                 │    POST openai.chat.completions ────────────────────────────►    │
    │                 │    { model: 'gpt-4o',                         │             │    │
    │                 │      response_format: json_object }           │             │    │
    │                 │    ◄─── { rubricScores[], feedback } ─────────────────────── │   │
    │                 │    score = sum(rubricScores.earned)                          │   │
    │                 └──────┬──────────────────────────────────────────────────────┘   │
    │                        │                    │                      │                │
    │                        │── UPDATE answer ───────────────────────────────────────► │
    │                        │   status=EVALUATED │                      │                │
    │                        │   score, evalResult│                      │                │
    │                        │                    │                      │                │
    │                        │── SELECT last 3 evaluated answers ────────────────────────►
    │                        │── UPDATE session.rollingScore ────────────────────────────►
    │                        │   (avg of last 3)  │                      │                │
```

---

## 4. Report Generation Flow

```
BullMQ Queue         ReportsWorker                          OpenAI GPT-4o     PostgreSQL
    │                     │                                      │                 │
    │── generate_report ──►                                      │                 │
    │   { sessionId }     │                                      │                 │
    │                     │── SELECT session + answers ─────────────────────────► │
    │                     │── SELECT integrity_events ──────────────────────────► │
    │                     │── UPDATE report.status=generating ─────────────────► │
    │                     │                                      │                 │
    │                     │  Build sectionBreakdown:             │                 │
    │                     │    group answers by questionType     │                 │
    │                     │    sum earned/max per section        │                 │
    │                     │                                      │                 │
    │                     │  Build integrityReport:              │                 │
    │                     │    count events by type              │                 │
    │                     │    HIGH events > 2 → risk='high'     │                 │
    │                     │    any HIGH → risk='medium'          │                 │
    │                     │    else → risk='low'                 │                 │
    │                     │                                      │                 │
    │                     │── POST chat.completions ────────────►│                 │
    │                     │   "Generate a 2-3 paragraph report   │                 │
    │                     │    for a recruiter based on these    │                 │
    │                     │    section scores and integrity data"│                 │
    │                     │◄── aiNarrative (plain text) ─────────│                 │
    │                     │                                      │                 │
    │                     │── UPDATE report ────────────────────────────────────► │
    │                     │   status=ready                       │                 │
    │                     │   summary, sectionBreakdown,         │                 │
    │                     │   questionDetails, integrityReport,  │                 │
    │                     │   aiNarrative, generatedAt           │                 │
    │                     │                                      │                 │
    │                     │── UPDATE session.reportUrl ─────────────────────────► │
    │                     │── (if integrity HIGH): session.isIntegrityFlagged=true│ │
```

---

## 5. Integrity Monitoring Flow

```
Candidate Browser    useIntegrityMonitor    Next.js API Layer      NestJS API         PostgreSQL
    │                       │                      │                    │                 │
    │ visibilitychange ─────►                      │                    │                 │
    │ (tab hidden)          │                      │                    │                 │
    │                       │── POST /integrity/events ──────────────►  │                 │
    │                       │   { sessionId,        │                    │                 │
    │                       │     type:'tab_switch',│                    │                 │
    │                       │     occurredAt }      │                    │                 │
    │                       │                       │                    │                 │
    │                       │                       │── INSERT event ────────────────────►│
    │                       │                       │                    │── SELECT COUNT  │
    │                       │                       │                    │   events ──────►│
    │                       │                       │ if COUNT >= 5:     │                 │
    │                       │                       │                    │── UPDATE session│
    │                       │                       │                    │   flagged=true ►│
    │                       │                       │◄── { severity,     │                 │
    │                       │                       │     sessionFlagged }│                │
    │                       │                       │                    │                 │
    │ copy event ────────────►                      │                    │                 │
    │ (event.preventDefault())                      │                    │                 │
    │                       │── POST /integrity/events ──────────────►  │                 │
    │                       │   { type:'copy_paste', severity:'high' }   │                 │
    │                       │                       │                    │                 │
    │ 2 min inactivity ──────►                      │                    │                 │
    │                       │── POST /integrity/events ──────────────►  │                 │
    │                       │   { type:'inactivity', severity:'low' }    │                 │
```

---

## 6. Adaptive Question Selection

```
interviewsService.getNextQuestion(sessionId)
    │
    ├── Load session.adaptiveState.questionOrder (ordered uuid[])
    ├── Slice from currentQuestionIndex → remaining questions
    │
    ├── applyAdaptiveSelection(session, remaining):
    │     ├── Load last 3 evaluated answers (ORDER BY evaluatedAt DESC)
    │     ├── avgScore = mean(answer.score / answer.maxScore)
    │     │
    │     ├── avgScore >= 0.75:
    │     │     sort remaining by difficulty [HARD, MEDIUM, EASY]
    │     │
    │     ├── avgScore < 0.40:
    │     │     sort remaining by difficulty [EASY, MEDIUM, HARD]
    │     │
    │     └── else: maintain current order
    │
    ├── nextQuestion = reordered[0]
    ├── sanitizeQuestion(nextQuestion)
    │     ├── delete question.correctAnswerIds
    │     ├── delete option.isCorrect (for each MCQ option)
    │     └── testCases: if !isPublic → expectedOutput = '[hidden]'
    │
    └── Return { question, questionNumber, totalQuestions, timeRemainingSeconds }
```
