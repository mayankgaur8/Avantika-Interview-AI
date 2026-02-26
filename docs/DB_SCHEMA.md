# Database Schema — InterviewAI

## Entity Relationship Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           ENTITY RELATIONSHIPS                               │
│                                                                              │
│  ┌─────────────┐         ┌──────────────────────┐        ┌────────────────┐ │
│  │    users    │ 1     * │  interview_sessions  │ *    1 │interview_templ.│ │
│  │─────────────│────────►│──────────────────────│◄───────│────────────────│ │
│  │ id (PK)     │         │ id (PK)              │        │ id (PK)        │ │
│  │ email       │         │ userId (FK)          │        │ name           │ │
│  │ name        │         │ templateId (FK)      │        │ role           │ │
│  │ role        │         │ status               │        │ difficulty     │ │
│  │ passwordHash│         │ type                 │        │ sectionConfig  │ │
│  │ refreshToken│         │ adaptiveState        │        │ timeLimitMins  │ │
│  └─────────────┘         │ currentQuestionIndex │        │ passingScore%  │ │
│                          │ tabSwitchCount       │        └────────────────┘ │
│                          │ copyPasteCount       │                           │
│                          │ isIntegrityFlagged   │        ┌────────────────┐ │
│                          │ rollingScore         │ 1    * │   questions    │ │
│                          │ reportUrl            │        │────────────────│ │
│                          └──────────┬───────────┘        │ id (PK)        │ │
│                                     │                    │ templateId (FK)│ │
│                              ┌──────┴───────┐            │ type           │ │
│                              │              │            │ difficulty     │ │
│                           *  ▼           *  ▼            │ content        │ │
│                    ┌─────────────┐  ┌───────────────┐   │ options (JSONB)│ │
│                    │   answers   │  │integrity_events│   │ correctAnswer.│ │
│                    │─────────────│  │───────────────│   │ rubric (JSONB) │ │
│                    │ id (PK)     │  │ id (PK)       │   │ codingConfig   │ │
│                    │ sessionId   │  │ sessionId (FK)│   │  (JSONB)       │ │
│                    │ questionId  │  │ type          │   │ maxScore       │ │
│                    │ submittedAns│  │ severity      │   │ tags           │ │
│                    │ status      │  │ metadata      │   └────────────────┘ │
│                    │ score       │  │ occurredAt    │                       │
│                    │ evalResult  │  └───────────────┘                       │
│                    │ timeTaken   │                                           │
│                    └─────────────┘                                           │
│                                                                              │
│  ┌───────────────────────────────┐                                          │
│  │           reports             │  1:1 with interview_sessions             │
│  │───────────────────────────────│                                          │
│  │ id (PK)                       │                                          │
│  │ sessionId (FK, unique)        │                                          │
│  │ status                        │                                          │
│  │ summary (JSONB)               │                                          │
│  │ sectionBreakdown (JSONB)      │                                          │
│  │ questionDetails (JSONB)       │                                          │
│  │ integrityReport (JSONB)       │                                          │
│  │ aiNarrative                   │                                          │
│  │ recruiterNotes                │                                          │
│  └───────────────────────────────┘                                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Table Definitions

### `users`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Primary key |
| `email` | `varchar` | UNIQUE, NOT NULL | Login identifier |
| `name` | `varchar` | NOT NULL | Display name |
| `role` | `enum` | NOT NULL, default `candidate` | `candidate \| recruiter \| admin` |
| `passwordHash` | `varchar` | NOT NULL | bcrypt hash (cost=12) |
| `refreshTokenHash` | `varchar` | nullable | bcrypt hash of last refresh token |
| `createdAt` | `timestamp` | NOT NULL | Row creation time |
| `updatedAt` | `timestamp` | NOT NULL | Row update time |

**Indexes:** `email` (unique)

---

### `interview_templates`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `name` | `varchar` | NOT NULL | E.g. "Senior React Engineer" |
| `role` | `varchar` | NOT NULL | E.g. "React", "Java", "SQL" |
| `difficulty` | `enum` | NOT NULL | `junior \| mid \| senior` |
| `timeLimitMinutes` | `integer` | NOT NULL | Total session time limit |
| `passingScorePercent` | `integer` | NOT NULL, default `70` | Threshold for "pass" |
| `sectionConfig` | `jsonb` | NOT NULL | Section weights (see below) |
| `isActive` | `boolean` | NOT NULL, default `true` | Soft disable templates |
| `createdAt` | `timestamp` | NOT NULL | — |

**`sectionConfig` shape:**
```json
{
  "mcq":          { "count": 10, "weight": 30 },
  "coding":       { "count": 3,  "weight": 50 },
  "behavioral":   { "count": 2,  "weight": 20 },
  "systemDesign": { "count": 1,  "weight": 100 }
}
```

---

### `questions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `templateId` | `uuid` | FK → `interview_templates.id` | Owning template |
| `type` | `enum` | NOT NULL | `mcq \| coding \| behavioral \| system_design` |
| `difficulty` | `enum` | NOT NULL | `easy \| medium \| hard` |
| `content` | `text` | NOT NULL | Question text / prompt |
| `maxScore` | `integer` | NOT NULL | Maximum achievable points |
| `orderIndex` | `integer` | NOT NULL | Default display order |
| `options` | `jsonb` | nullable | MCQ options array |
| `correctAnswerIds` | `simple-array` | nullable | MCQ correct option IDs |
| `rubric` | `jsonb` | nullable | Rubric criteria array |
| `codingConfig` | `jsonb` | nullable | Languages, test cases, timeouts |
| `tags` | `simple-array` | nullable | Searchable topic tags |
| `createdAt` | `timestamp` | NOT NULL | — |

**`options` shape (MCQ):**
```json
[
  { "id": "a", "text": "Option text", "isCorrect": false },
  { "id": "b", "text": "Correct answer", "isCorrect": true }
]
```

**`rubric` shape (behavioral / system design):**
```json
[
  {
    "criterion": "Technical Depth",
    "maxPoints": 4,
    "description": "Demonstrates deep understanding of...",
    "keywords": ["cache", "latency", "throughput"]
  }
]
```

**`codingConfig` shape:**
```json
{
  "allowedLanguages": ["javascript", "python", "java"],
  "starterCode": { "javascript": "function solution() {}" },
  "testCases": [
    { "input": "5", "expectedOutput": "120", "isPublic": true },
    { "input": "10", "expectedOutput": "3628800", "isPublic": false }
  ],
  "timeoutMs": 5000,
  "memoryLimitMb": 64
}
```

---

### `interview_sessions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `userId` | `uuid` | FK → `users.id` | Candidate |
| `templateId` | `uuid` | FK → `interview_templates.id` | Template used |
| `status` | `enum` | NOT NULL, default `scheduled` | `scheduled \| in_progress \| completed \| abandoned \| flagged` |
| `type` | `enum` | NOT NULL | `mcq \| coding \| behavioral \| system_design \| mixed` |
| `currentQuestionIndex` | `integer` | NOT NULL, default `0` | Pointer into question sequence |
| `adaptiveState` | `jsonb` | nullable | `{ questionOrder: uuid[], lockedIn: boolean }` |
| `rollingScore` | `float` | NOT NULL, default `0` | Rolling avg of last 3 answers (0–1) |
| `totalScore` | `float` | nullable | Final weighted score |
| `maxPossibleScore` | `float` | nullable | Sum of maxScore for all questions |
| `tabSwitchCount` | `integer` | NOT NULL, default `0` | Proctoring counter |
| `copyPasteCount` | `integer` | NOT NULL, default `0` | Proctoring counter |
| `isIntegrityFlagged` | `boolean` | NOT NULL, default `false` | Auto-flagged at threshold |
| `startedAt` | `timestamp` | nullable | When candidate started |
| `completedAt` | `timestamp` | nullable | When session ended |
| `timeRemainingSeconds` | `integer` | nullable | Seconds left (synced periodically) |
| `reportUrl` | `varchar` | nullable | Link to generated report |
| `createdAt` | `timestamp` | NOT NULL | — |
| `updatedAt` | `timestamp` | NOT NULL | — |

---

### `answers`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `sessionId` | `uuid` | FK → `interview_sessions.id` | Parent session |
| `questionId` | `uuid` | FK → `questions.id` | Question answered |
| `submittedAnswerIds` | `simple-array` | nullable | MCQ selected option IDs |
| `codeAnswer` | `text` | nullable | Code submission |
| `textAnswer` | `text` | nullable | Free-text answer |
| `language` | `varchar` | nullable | Coding language used |
| `status` | `enum` | NOT NULL, default `pending` | `pending \| evaluating \| evaluated \| skipped \| timed_out` |
| `score` | `float` | nullable | Earned score |
| `maxScore` | `float` | NOT NULL | Max possible for this question |
| `evaluationResult` | `jsonb` | nullable | Detailed result (see below) |
| `timeTakenSeconds` | `integer` | nullable | Time spent on question |
| `submittedAt` | `timestamp` | NOT NULL | Submission time |
| `evaluatedAt` | `timestamp` | nullable | When eval completed |

**`evaluationResult` shape:**
```json
{
  "rubricScores": [
    { "criterion": "Technical Depth", "earned": 3, "max": 4, "feedback": "Good coverage of..." }
  ],
  "testCasesPassed": 3,
  "testCasesTotal": 4,
  "testCaseResults": [
    { "input": "5", "expected": "120", "actual": "120", "passed": true, "executionTimeMs": 12 }
  ],
  "aiFeedback": "Strong answer covering the core concepts. Could improve on...",
  "executionTimeMs": 145,
  "compileError": null
}
```

---

### `integrity_events`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `sessionId` | `uuid` | FK → `interview_sessions.id` | Parent session |
| `type` | `enum` | NOT NULL | `tab_switch \| window_blur \| copy_paste \| devtools_open \| time_anomaly \| rapid_answer \| inactivity \| screenshot_attempt` |
| `severity` | `enum` | NOT NULL | `low \| medium \| high` |
| `metadata` | `jsonb` | nullable | Extra context (e.g. `{ durationMs: 5000 }`) |
| `occurredAt` | `timestamp` | NOT NULL | Client-reported event time |
| `createdAt` | `timestamp` | NOT NULL | Server receipt time |

**Index:** `(sessionId, occurredAt)` for fast timeline queries

---

### `reports`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Primary key |
| `sessionId` | `uuid` | FK → `interview_sessions.id`, UNIQUE | One report per session |
| `status` | `enum` | NOT NULL, default `pending` | `pending \| generating \| ready \| failed` |
| `summary` | `jsonb` | nullable | `{ totalScore, maxScore, percentage, passed, duration }` |
| `sectionBreakdown` | `jsonb` | nullable | Per-section scores and percentages |
| `questionDetails` | `jsonb` | nullable | Array of Q+A details with scores |
| `integrityReport` | `jsonb` | nullable | Event counts, risk level, timeline |
| `aiNarrative` | `text` | nullable | GPT-4o generated summary for recruiter |
| `recruiterNotes` | `text` | nullable | Manual notes added by recruiter |
| `pdfUrl` | `varchar` | nullable | Future: link to generated PDF |
| `generatedAt` | `timestamp` | nullable | When report was completed |
| `createdAt` | `timestamp` | NOT NULL | — |

**`sectionBreakdown` shape:**
```json
{
  "mcq":     { "earned": 8, "max": 10, "percentage": 80, "questionCount": 10 },
  "coding":  { "earned": 23, "max": 30, "percentage": 77, "questionCount": 3 },
  "behavioral": { "earned": 15, "max": 20, "percentage": 75, "questionCount": 2 }
}
```

**`integrityReport` shape:**
```json
{
  "riskLevel": "medium",
  "totalEvents": 7,
  "highSeverityCount": 1,
  "eventCounts": {
    "tab_switch": 3, "copy_paste": 1, "window_blur": 3
  },
  "timeline": [
    { "type": "tab_switch", "severity": "medium", "occurredAt": "2025-01-15T10:23:45Z" }
  ]
}
```
