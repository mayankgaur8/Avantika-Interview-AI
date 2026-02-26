# API Contracts — InterviewAI

Base URL: `http://localhost:3001/api`
Interactive docs: `http://localhost:3001/api/docs` (Swagger UI)

All protected endpoints require:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

---

## Auth

### POST `/auth/register`

Register a new candidate or recruiter.

**Request:**
```json
{
  "email": "jane@example.com",
  "password": "SuperSecret123!",
  "name": "Jane Doe",
  "role": "candidate"
}
```
`role` is optional — defaults to `"candidate"`. Valid values: `"candidate"`, `"recruiter"`, `"admin"`.

**Response `201`:**
```json
{
  "user": {
    "id": "a1b2c3d4-...",
    "email": "jane@example.com",
    "name": "Jane Doe",
    "role": "candidate",
    "createdAt": "2025-01-15T09:00:00.000Z"
  },
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci..."
}
```

**Errors:**
- `409 Conflict` — email already registered
- `400 Bad Request` — validation errors

---

### POST `/auth/login`

**Request:**
```json
{
  "email": "jane@example.com",
  "password": "SuperSecret123!"
}
```

**Response `200`:**
```json
{
  "user": { "id": "...", "email": "...", "name": "...", "role": "candidate" },
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci..."
}
```

**Errors:** `401 Unauthorized` — invalid credentials

---

### POST `/auth/refresh`

**Request:**
```json
{
  "userId": "a1b2c3d4-...",
  "refreshToken": "eyJhbGci..."
}
```

**Response `200`:**
```json
{
  "accessToken": "eyJhbGci...(new)",
  "refreshToken": "eyJhbGci...(new, rotated)"
}
```

---

### POST `/auth/logout` 🔒

**Request:** _(empty body)_

**Response `200`:**
```json
{ "message": "Logged out successfully" }
```

---

### GET `/auth/me` 🔒

**Response `200`:**
```json
{
  "id": "a1b2c3d4-...",
  "email": "jane@example.com",
  "name": "Jane Doe",
  "role": "candidate",
  "createdAt": "2025-01-15T09:00:00.000Z"
}
```

---

## Interviews

### POST `/interviews/templates` 🔒 (recruiter / admin)

Create an interview template.

**Request:**
```json
{
  "name": "Senior React Engineer Interview",
  "role": "React",
  "difficulty": "senior",
  "timeLimitMinutes": 90,
  "passingScorePercent": 70,
  "sectionConfig": {
    "mcq":       { "count": 10, "weight": 30 },
    "coding":    { "count": 3,  "weight": 50 },
    "behavioral":{ "count": 2,  "weight": 20 }
  }
}
```

**Response `201`:**
```json
{
  "id": "tmpl-uuid-...",
  "name": "Senior React Engineer Interview",
  "role": "React",
  "difficulty": "senior",
  "timeLimitMinutes": 90,
  "passingScorePercent": 70,
  "sectionConfig": { "mcq": {...}, "coding": {...}, "behavioral": {...} },
  "isActive": true,
  "createdAt": "2025-01-15T09:00:00.000Z"
}
```

---

### GET `/interviews/templates` 🔒

List all active templates.

**Response `200`:**
```json
[
  {
    "id": "tmpl-uuid-...",
    "name": "Senior React Engineer Interview",
    "role": "React",
    "difficulty": "senior",
    "timeLimitMinutes": 90,
    "sectionConfig": { ... }
  }
]
```

---

### POST `/interviews/sessions` 🔒

Start a new interview session.

**Request:**
```json
{
  "templateId": "tmpl-uuid-..."
}
```

**Response `201`:**
```json
{
  "id": "sess-uuid-...",
  "status": "in_progress",
  "type": "mixed",
  "templateId": "tmpl-uuid-...",
  "currentQuestionIndex": 0,
  "timeRemainingSeconds": 5400,
  "startedAt": "2025-01-15T10:00:00.000Z"
}
```

> If a session for this user + template is already `in_progress`, it is **resumed** rather than duplicated.

---

### GET `/interviews/sessions` 🔒

List all sessions for the authenticated user.

**Response `200`:**
```json
[
  {
    "id": "sess-uuid-...",
    "status": "completed",
    "type": "mixed",
    "totalScore": 45.5,
    "maxPossibleScore": 60,
    "isIntegrityFlagged": false,
    "completedAt": "2025-01-15T11:30:00.000Z",
    "template": { "name": "Senior React Engineer Interview", "role": "React" }
  }
]
```

---

### GET `/interviews/sessions/:sessionId` 🔒

Get full session state.

**Response `200`:**
```json
{
  "id": "sess-uuid-...",
  "status": "in_progress",
  "currentQuestionIndex": 3,
  "timeRemainingSeconds": 4200,
  "rollingScore": 0.72,
  "tabSwitchCount": 1,
  "copyPasteCount": 0,
  "isIntegrityFlagged": false
}
```

---

### GET `/interviews/sessions/:sessionId/next-question` 🔒

Fetch the next question. Answer keys are **stripped** before sending.

**Response `200` (MCQ example):**
```json
{
  "question": {
    "id": "q-uuid-...",
    "type": "mcq",
    "difficulty": "medium",
    "content": "What is the primary purpose of the Virtual DOM in React?",
    "maxScore": 1,
    "options": [
      { "id": "a", "text": "To directly manipulate browser DOM for speed" },
      { "id": "b", "text": "To batch and minimize actual DOM updates by diffing" },
      { "id": "c", "text": "To replace CSS styling with JavaScript" },
      { "id": "d", "text": "To enable server-side rendering only" }
    ]
  },
  "questionNumber": 4,
  "totalQuestions": 15,
  "timeRemainingSeconds": 4150
}
```

**Response `200` (coding example):**
```json
{
  "question": {
    "id": "q-uuid-...",
    "type": "coding",
    "difficulty": "medium",
    "content": "Write a function `flatten(arr)` that ...",
    "maxScore": 10,
    "codingConfig": {
      "allowedLanguages": ["javascript", "typescript", "python"],
      "starterCode": { "javascript": "function flatten(arr) {\n  // your solution here\n}" },
      "testCases": [
        { "input": "[1,[2,[3,[4]],5]]", "expectedOutput": "[1,2,3,4,5]", "isPublic": true },
        { "input": "...", "expectedOutput": "[hidden]", "isPublic": false }
      ],
      "timeoutMs": 5000
    }
  },
  "questionNumber": 12,
  "totalQuestions": 15,
  "timeRemainingSeconds": 3800
}
```

**Response `200` (session complete):**
```json
{
  "complete": true,
  "message": "All questions answered. Session will be completed."
}
```

---

### POST `/interviews/sessions/:sessionId/answers` 🔒

Submit an answer. Evaluation is asynchronous.

**Request (MCQ):**
```json
{
  "questionId": "q-uuid-...",
  "questionType": "mcq",
  "submittedAnswerIds": ["b"],
  "timeTakenSeconds": 45
}
```

**Request (coding):**
```json
{
  "questionId": "q-uuid-...",
  "questionType": "coding",
  "codeAnswer": "function flatten(arr) {\n  return arr.flat(Infinity);\n}",
  "language": "javascript",
  "timeTakenSeconds": 420
}
```

**Request (behavioral / system design):**
```json
{
  "questionId": "q-uuid-...",
  "questionType": "behavioral",
  "textAnswer": "In my previous role at Acme Corp, I identified a performance bottleneck...",
  "timeTakenSeconds": 360
}
```

**Response `201`:**
```json
{
  "answerId": "ans-uuid-...",
  "status": "pending",
  "message": "Answer submitted. Evaluation is in progress."
}
```

---

### POST `/interviews/sessions/:sessionId/complete` 🔒

Manually complete a session (also triggered automatically when all questions are answered).

**Request:** _(empty body)_

**Response `200`:**
```json
{
  "sessionId": "sess-uuid-...",
  "status": "completed",
  "message": "Session completed. Report generation has started.",
  "reportUrl": "/api/reports/sessions/sess-uuid-..."
}
```

---

## Integrity

### POST `/integrity/events` 🔒

Record a proctoring signal. Fire-and-forget from frontend.

**Request:**
```json
{
  "sessionId": "sess-uuid-...",
  "type": "tab_switch",
  "metadata": { "durationMs": 3200 },
  "occurredAt": "2025-01-15T10:23:45.123Z"
}
```

Valid `type` values: `tab_switch`, `window_blur`, `copy_paste`, `devtools_open`, `time_anomaly`, `rapid_answer`, `inactivity`, `screenshot_attempt`

**Response `201`:**
```json
{
  "id": "evt-uuid-...",
  "severity": "medium",
  "sessionFlagged": false
}
```

`sessionFlagged: true` when cumulative event count reaches the threshold (5).

---

### GET `/integrity/sessions/:sessionId/events` 🔒

**Response `200`:**
```json
[
  {
    "id": "evt-uuid-...",
    "type": "tab_switch",
    "severity": "medium",
    "metadata": { "durationMs": 3200 },
    "occurredAt": "2025-01-15T10:23:45.123Z"
  }
]
```

---

## Reports

### GET `/reports/sessions/:sessionId` 🔒

Poll this endpoint until `status === "ready"`.

**Response `200` (generating):**
```json
{
  "id": "rpt-uuid-...",
  "sessionId": "sess-uuid-...",
  "status": "generating"
}
```

**Response `200` (ready):**
```json
{
  "id": "rpt-uuid-...",
  "sessionId": "sess-uuid-...",
  "status": "ready",
  "generatedAt": "2025-01-15T11:45:00.000Z",
  "summary": {
    "totalScore": 45.5,
    "maxScore": 60,
    "percentage": 75.8,
    "passed": true,
    "durationMinutes": 72
  },
  "sectionBreakdown": {
    "mcq":      { "earned": 8,  "max": 10, "percentage": 80, "questionCount": 10 },
    "coding":   { "earned": 23, "max": 30, "percentage": 76, "questionCount": 3 },
    "behavioral":{ "earned": 14, "max": 20, "percentage": 70, "questionCount": 2 }
  },
  "questionDetails": [
    {
      "questionId": "q-uuid-...",
      "type": "mcq",
      "content": "What is the primary purpose...",
      "score": 1,
      "maxScore": 1,
      "submittedAnswerIds": ["b"],
      "evaluationResult": null
    },
    {
      "questionId": "q-uuid-...",
      "type": "behavioral",
      "content": "Describe a time you improved performance...",
      "score": 7,
      "maxScore": 10,
      "textAnswer": "In my previous role...",
      "evaluationResult": {
        "rubricScores": [
          { "criterion": "Problem Clarity", "earned": 2, "max": 2 },
          { "criterion": "Technical Solution", "earned": 3, "max": 4, "feedback": "Mentioned useMemo but missed code splitting" },
          { "criterion": "Measured Impact", "earned": 1, "max": 2 },
          { "criterion": "Communication", "earned": 1, "max": 2 }
        ],
        "aiFeedback": "Strong understanding of React optimization. Quantified the improvement well. Consider structuring answer more explicitly with STAR format."
      }
    }
  ],
  "integrityReport": {
    "riskLevel": "low",
    "totalEvents": 2,
    "highSeverityCount": 0,
    "eventCounts": { "tab_switch": 1, "window_blur": 1 },
    "timeline": [
      { "type": "tab_switch", "severity": "medium", "occurredAt": "2025-01-15T10:23:45.000Z" }
    ]
  },
  "aiNarrative": "The candidate demonstrated strong React fundamentals with an 80% MCQ score and solid performance on the behavioral question. The coding section showed competent problem-solving skills, though there is room for improvement in algorithmic efficiency. Integrity monitoring detected only minor signals (1 brief tab switch) with no red flags. Overall, this candidate appears to be a strong mid-to-senior level React engineer and would be recommended for a technical interview round.",
  "recruiterNotes": null
}
```

---

### PATCH `/reports/:reportId/notes` 🔒 (recruiter / admin)

**Request:**
```json
{
  "notes": "Strong candidate. Proceed to onsite. Note: briefly switched tabs around Q4 — may be innocent."
}
```

**Response `200`:**
```json
{
  "id": "rpt-uuid-...",
  "recruiterNotes": "Strong candidate. Proceed to onsite...",
  "updatedAt": "2025-01-15T14:00:00.000Z"
}
```

---

## Error Response Format

All errors follow this structure:

```json
{
  "statusCode": 400,
  "message": ["email must be an email", "password must be at least 8 characters"],
  "error": "Bad Request",
  "timestamp": "2025-01-15T10:00:00.000Z",
  "path": "/api/auth/register"
}
```

## Rate Limiting

- Default: **100 requests / 60 seconds** per IP (`@nestjs/throttler`)
- `429 Too Many Requests` when exceeded:

```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
```
