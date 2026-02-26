import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import {
  PanelPhase,
  PanelQuestion,
  PanelAnswer,
  PanelFinalReport,
} from './panel-session.entity';

// ── Sub-topic rotation pools ─────────────────────────────────────
// Each question number gets a forced sub-topic so GPT can't default to the same topic.
const WARMUP_SUBTOPICS = [
  'your background and journey into this technology stack',
  'a challenging project you shipped recently and the technical decisions you made',
  'a time you had to learn a new tool or technology under time pressure',
  'your development workflow: tools, testing habits, and code review approach',
  'a production incident or bug you debugged and what you learned',
];

const CORE_SUBTOPICS = [
  'concurrency and thread-safety (locks, race conditions, atomic operations)',
  'memory management and garbage collection internals',
  'design patterns (which ones you apply and why, with a real example)',
  'performance profiling and optimization techniques',
  'security: common vulnerabilities and how you prevent them in your code',
  'distributed systems concepts: consistency, availability, partition tolerance',
  'testing strategy: unit vs integration vs e2e, mocking, test coverage',
  'system architecture and scalability: how you would design for 10x load',
  'database internals: indexing strategies, query optimization, transactions',
  'framework internals and how the technology works under the hood',
];

const CODING_SUBTOPICS = [
  'arrays or strings manipulation with optimal time complexity',
  'linked list or tree traversal',
  'dynamic programming or memoization',
  'graph traversal (BFS/DFS)',
  'hash maps and frequency counting',
  'sliding window or two-pointer technique',
  'binary search or sorted data structures',
  'stack or queue based problem',
];

const QUERY_SUBTOPICS = [
  'window functions (ROW_NUMBER, RANK, DENSE_RANK, LAG, LEAD)',
  'complex multi-table JOINs with aggregation',
  'CTEs and recursive queries',
  'subqueries vs JOINs performance considerations',
  'grouping, HAVING clauses and conditional aggregation',
  'NULL handling and COALESCE patterns',
  'self-joins and hierarchical data',
];

function pickSubtopic(phase: PanelPhase, questionNumber: number): string {
  const pool =
    phase === PanelPhase.WARMUP ? WARMUP_SUBTOPICS :
    phase === PanelPhase.CODING ? CODING_SUBTOPICS :
    phase === PanelPhase.QUERY ? QUERY_SUBTOPICS :
    CORE_SUBTOPICS;
  // Use (questionNumber - 1) mod pool size so each successive question covers a fresh sub-topic
  return pool[(questionNumber - 1) % pool.length];
}

@Injectable()
export class PanelAiService {
  private readonly logger = new Logger(PanelAiService.name);
  private readonly openai: OpenAI;
  private readonly model: string;

  constructor(private readonly cfg: ConfigService) {
    this.openai = new OpenAI({
      apiKey: cfg.get<string>('openai.apiKey') ?? '',
    });
    this.model = cfg.get<string>('openai.model') ?? 'gpt-4o';
  }

  // ── Question generation ──────────────────────────────────────────

  async generateQuestion(params: {
    phase: PanelPhase;
    track: string;
    experienceYears: string;
    targetRole: string;
    difficulty: string;
    questionNumber: number;
    previousQA: Array<{ q: string; a: string; score: number }>;
    alreadyAskedQuestions?: string[];
  }): Promise<PanelQuestion> {
    const { phase, track, experienceYears, targetRole, difficulty, questionNumber, previousQA, alreadyAskedQuestions = [] } = params;

    const panelist =
      phase === PanelPhase.CODING
        ? 'Panelist B'
        : phase === PanelPhase.QUERY
        ? 'Panelist C'
        : 'Panelist A';

    const panelistRole =
      panelist === 'Panelist B' ? 'Coding Evaluator' :
      panelist === 'Panelist C' ? 'SQL/Query Evaluator' : 'Technical Lead';

    const avgScore = previousQA.length
      ? previousQA.reduce((s, x) => s + x.score, 0) / previousQA.length
      : 5;

    const difficultyHint =
      avgScore >= 7.5 ? 'harder' : avgScore < 4 ? 'easier' : 'same difficulty';

    const prevContext = previousQA
      .slice(-3)
      .map((x, i) => `Q${i + 1}: ${x.q}\nA: ${x.a}\nScore: ${x.score}/10`)
      .join('\n\n');

    // Forced sub-topic for this question number — guarantees variety
    const forcedSubtopic = pickSubtopic(phase, questionNumber);

    // Explicit "do not repeat" block from every question asked so far
    const doNotRepeat = alreadyAskedQuestions.length
      ? `\n\nSTRICT RULE — The following questions have ALREADY been asked. Do NOT repeat, rephrase, or overlap with ANY of them:\n${alreadyAskedQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n`
      : '';

    // Random nonce forces OpenAI not to return a cached/identical response
    const nonce = uuidv4().slice(0, 8);

    const isCoding = phase === PanelPhase.CODING;
    const isQuery = phase === PanelPhase.QUERY;

    const systemPrompt = `You are ${panelist} (${panelistRole}) on an AI Interview Panel for InterviewAI. [session-nonce:${nonce}]
Track: ${track}, Experience: ${experienceYears} years, Role: ${targetRole}, Difficulty: ${difficulty}.
You are generating question #${questionNumber} for the ${phase} phase.
Based on recent performance (avg ${avgScore.toFixed(1)}/10), make the question ${difficultyHint}.
${prevContext ? `\nPrevious Q&A context (for continuity only — do NOT repeat these topics):\n${prevContext}` : ''}${doNotRepeat}
MANDATORY: This question MUST specifically focus on the sub-topic: "${forcedSubtopic}".
Generate a UNIQUE, SPECIFIC question on this sub-topic that has NOT been asked before in this session.`;

    const userPrompt = isCoding
      ? `Generate exactly 1 coding problem specifically about "${forcedSubtopic}" for a ${track} ${difficulty} interview.
Candidate has ${experienceYears} years experience applying for ${targetRole}.
Make the problem concrete, named, and different from any typical "reverse a string" or "two sum" pattern.
Include: problem statement, constraints, 2 public test cases, 2 hidden test cases, and starter code in JavaScript, Python, and Java.
Respond in STRICT JSON:
{
  "questionText": "full problem statement",
  "constraints": "time/space constraints, input limits",
  "editor": {
    "enabled": true,
    "languageOptions": ["javascript","python","java"],
    "starterCode": "// starter code in javascript",
    "testCases": [
      {"input": "...", "output": "..."},
      {"input": "...", "output": "..."},
      {"input": "[hidden]", "output": "[hidden]"},
      {"input": "[hidden]", "output": "[hidden]"}
    ]
  }
}`
      : isQuery
      ? `Generate exactly 1 SQL query question specifically about "${forcedSubtopic}" for a ${track} ${difficulty} interview.
Candidate has ${experienceYears} years experience.
Make it a realistic business scenario (e-commerce, banking, SaaS, etc.) with concrete tables and data.
Respond in STRICT JSON:
{
  "questionText": "full question with table schema and sample data",
  "constraints": "must handle: NULLs, duplicates, edge cases specific to this scenario",
  "schemaInfo": "CREATE TABLE ... (show 1-3 tables with realistic columns)"
}`
      : `Generate exactly 1 ${phase === PanelPhase.WARMUP ? 'warm-up' : 'core technical'} interview question specifically about "${forcedSubtopic}" for a ${track} candidate.
Candidate has ${experienceYears} years experience applying for ${targetRole} (${difficulty} difficulty).
The question must:
- Be directly and specifically about "${forcedSubtopic}" — not a generic question
- Be answerable in 2–4 minutes verbally
- Probe real hands-on knowledge, not just definitions
- Be phrased as a single clear question (not multi-part)
Respond in STRICT JSON:
{
  "questionText": "the specific question — must mention the sub-topic explicitly",
  "constraints": "any specific focus or scenario constraints"
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.9,
        max_tokens: 1200,
      });

      const raw = JSON.parse(response.choices[0]?.message?.content ?? '{}') as {
        questionText?: string;
        constraints?: string;
        editor?: PanelQuestion['editor'];
        schemaInfo?: string;
      };

      return {
        id: uuidv4(),
        phase,
        askedBy: panelist as PanelQuestion['askedBy'],
        type: isCoding ? 'coding' : isQuery ? 'query' : 'technical',
        questionText: raw.questionText ?? 'Please describe your experience with ' + track,
        constraints: raw.constraints,
        expectedAnswerFormat: isCoding ? 'code' : isQuery ? 'sql' : 'text',
        editor: raw.editor,
        schemaInfo: raw.schemaInfo,
      };
    } catch (err) {
      this.logger.error('Question generation failed', err);
      return this.fallbackQuestion(phase, track, questionNumber);
    }
  }

  // ── Answer evaluation ────────────────────────────────────────────

  async evaluateAnswer(params: {
    question: PanelQuestion;
    answer: string;
    language?: string;
    track: string;
    experienceYears: string;
    difficulty: string;
  }): Promise<{ score: number; feedback: string; followUpQuestion?: string }> {
    const { question, answer, language, track, experienceYears, difficulty } = params;

    const prompt = `You are a strict technical interviewer evaluating a ${track} candidate with ${experienceYears} years experience (${difficulty} difficulty).

Question asked by ${question.askedBy}:
"${question.questionText}"
${question.constraints ? `Constraints: ${question.constraints}` : ''}
${question.schemaInfo ? `Schema: ${question.schemaInfo}` : ''}

Candidate's answer${language ? ` (${language})` : ''}:
"""
${answer || '[No answer provided]'}
"""

Evaluate strictly on a 0–10 scale based on:
- Correctness and completeness (0–4 pts)
- Clarity and reasoning (0–2 pts)  
- Depth and best practices (0–2 pts)
- Edge cases / error handling (0–2 pts)

Respond ONLY in valid JSON:
{
  "score": <0-10>,
  "feedback": "2-3 sentences of specific, constructive feedback",
  "followUpQuestion": "one targeted follow-up question if score < 7, else null"
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 400,
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}') as {
        score?: number;
        feedback?: string;
        followUpQuestion?: string | null;
      };
      return {
        score: Math.min(10, Math.max(0, parsed.score ?? 5)),
        feedback: parsed.feedback ?? 'Answer received.',
        followUpQuestion: parsed.followUpQuestion ?? undefined,
      };
    } catch (err) {
      this.logger.error('Evaluation failed', err);
      return { score: 5, feedback: 'Evaluation could not be completed. Score estimated.' };
    }
  }

  // ── Follow-up evaluation ─────────────────────────────────────────

  async evaluateFollowUp(params: {
    originalQuestion: string;
    followUpQuestion: string;
    followUpAnswer: string;
    track: string;
  }): Promise<{ score: number; feedback: string }> {
    const prompt = `A candidate was asked a follow-up question during a ${params.track} interview.

Original question: "${params.originalQuestion}"
Follow-up question: "${params.followUpQuestion}"
Follow-up answer: "${params.followUpAnswer || '[No answer]'}"

Score 0–10 and provide brief feedback. JSON only:
{"score": <0-10>, "feedback": "1-2 sentences"}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 200,
      });
      const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}') as {
        score?: number;
        feedback?: string;
      };
      return {
        score: Math.min(10, Math.max(0, parsed.score ?? 5)),
        feedback: parsed.feedback ?? '',
      };
    } catch {
      return { score: 5, feedback: 'Follow-up evaluation unavailable.' };
    }
  }

  // ── Final report generation ──────────────────────────────────────

  async generateFinalReport(params: {
    track: string;
    experienceYears: string;
    targetRole: string;
    difficulty: string;
    answers: PanelAnswer[];
    questions: PanelQuestion[];
    isPartial?: boolean;
    questionsAsked?: number;
    questionsAnswered?: number;
    questionsSkipped?: number;
  }): Promise<PanelFinalReport> {
    const { track, experienceYears, targetRole, difficulty, answers, questions,
      isPartial = false, questionsAsked, questionsAnswered, questionsSkipped } = params;

    // Build Q&A summary for GPT
    const qaSummary = answers.map((a, i) => {
      const q = questions.find((q) => q.id === a.questionId);
      return `[Q${i + 1}] Phase: ${q?.phase ?? '?'} | Asked by: ${q?.askedBy ?? '?'}
Question: ${q?.questionText ?? '?'}
Answer: ${a.answer || '[skipped]'}
Score: ${a.score}/10
Feedback: ${a.feedback}
${a.followUpQuestion ? `Follow-up: ${a.followUpQuestion}\nFollow-up Answer: ${a.followUpAnswer ?? '[not answered]'}\nFollow-up Score: ${a.followUpScore ?? 0}/10` : ''}`;
    }).join('\n\n---\n\n');

    const totalRawScore = answers.reduce((sum, a) => {
      const base = a.score;
      const followUp = a.followUpScore ?? 0;
      return sum + (a.followUpQuestion ? (base + followUp) / 2 : base);
    }, 0);
    const maxRaw = answers.length * 10;
    const overallScore = maxRaw > 0 ? Math.round((totalRawScore / maxRaw) * 100) : 0;

    const partialNote = isPartial
      ? `\n⚠️ NOTE: This is a PARTIAL interview report. The candidate exited early.\nTotal questions asked: ${questionsAsked ?? answers.length}, Answered: ${questionsAnswered ?? answers.filter(a => a.answer !== '[SKIPPED]').length}, Skipped: ${questionsSkipped ?? answers.filter(a => a.answer === '[SKIPPED]').length}.\nScore is calculated only from answered/skipped questions. Be explicit about the incomplete nature in the improvement plan.\n`
      : '';

    const prompt = `You are a senior hiring manager generating a structured final interview report for InterviewAI.
${partialNote}
Candidate Profile:
- Track: ${track}
- Experience: ${experienceYears} years  
- Applied Role: ${targetRole}
- Difficulty: ${difficulty}

Interview Q&A:
${qaSummary}

Overall score: ${overallScore}/100

Generate a comprehensive, actionable report. Be specific — reference actual questions and answers.
Respond ONLY in valid JSON matching this EXACT schema:
{
  "strengths": ["3-5 specific strengths based on their answers"],
  "weakAreas": ["3-5 specific weak areas"],
  "mistakesSummary": ["list of specific mistakes made in the interview"],
  "interviewTips": ["5 actionable tips for how to answer better in real interviews"],
  "focusAreas": ["6-8 specific topics to study in the next 2 weeks"],
  "improvementPlan": "A 3-paragraph personalized improvement plan",
  "questionBreakdown": [
    {
      "questionText": "exact question",
      "phase": "warmup|core|coding|query",
      "askedBy": "Panelist A|B|C",
      "score": <0-10>,
      "maxScore": 10,
      "feedback": "specific feedback",
      "whereYouWentWrong": "specific explanation if score < 7, else null"
    }
  ]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 2500,
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}') as {
        strengths?: string[];
        weakAreas?: string[];
        mistakesSummary?: string[];
        interviewTips?: string[];
        focusAreas?: string[];
        improvementPlan?: string;
        questionBreakdown?: PanelFinalReport['questionBreakdown'];
      };

      // Build section scores
      const phaseTotals = new Map<string, { score: number; max: number }>();
      answers.forEach((a) => {
        const q = questions.find((x) => x.id === a.questionId);
        const phase = q?.phase ?? 'unknown';
        const curr = phaseTotals.get(phase) ?? { score: 0, max: 0 };
        const effectiveScore = a.followUpQuestion
          ? (a.score + (a.followUpScore ?? 0)) / 2
          : a.score;
        curr.score += effectiveScore;
        curr.max += 10;
        phaseTotals.set(phase, curr);
      });

      const sectionScores = [...phaseTotals.entries()].map(([section, data]) => ({
        section,
        score: parseFloat(data.score.toFixed(1)),
        maxScore: data.max,
        percentage: data.max > 0 ? Math.round((data.score / data.max) * 100) : 0,
      }));

      return {
        candidateProfile: { track, experienceYears, role: targetRole, difficulty },
        overallScore,
        sectionScores,
        questionBreakdown: parsed.questionBreakdown ?? answers.map((a) => {
          const q = questions.find((x) => x.id === a.questionId);
          return {
            questionText: q?.questionText ?? '',
            phase: q?.phase ?? '',
            askedBy: q?.askedBy ?? '',
            score: a.score,
            maxScore: 10,
            feedback: a.feedback,
          };
        }),
        strengths: parsed.strengths ?? [],
        weakAreas: parsed.weakAreas ?? [],
        mistakesSummary: parsed.mistakesSummary ?? [],
        interviewTips: parsed.interviewTips ?? [],
        focusAreas: parsed.focusAreas ?? [],
        improvementPlan: parsed.improvementPlan ?? '',
        passed: overallScore >= 60,
      };
    } catch (err) {
      this.logger.error('Final report generation failed', err);
      return this.fallbackReport(params, overallScore, answers, questions);
    }
  }

  // ── Fallbacks ────────────────────────────────────────────────────

  private fallbackQuestion(phase: PanelPhase, track: string, num: number): PanelQuestion {
    const panelist =
      phase === PanelPhase.CODING ? 'Panelist B' :
      phase === PanelPhase.QUERY ? 'Panelist C' : 'Panelist A';
    const subtopic = pickSubtopic(phase, num);
    const fallbackTexts: Record<string, string> = {
      [PanelPhase.WARMUP]: `Tell me about a time you worked with ${track} and specifically had to deal with ${subtopic}. What was the situation and how did you handle it?`,
      [PanelPhase.CORE]: `In your ${track} experience, how have you approached ${subtopic}? Give me a concrete example from a real project.`,
      [PanelPhase.CODING]: `Write a solution that demonstrates your understanding of ${subtopic} using ${track}. Describe your approach before coding.`,
      [PanelPhase.QUERY]: `Write a SQL query that demonstrates ${subtopic}. Use a realistic business table structure of your choice.`,
    };
    return {
      id: uuidv4(),
      phase,
      askedBy: panelist as PanelQuestion['askedBy'],
      type: phase === PanelPhase.CODING ? 'coding' : phase === PanelPhase.QUERY ? 'query' : 'technical',
      questionText: fallbackTexts[phase] ?? `Question ${num}: Describe how you've used ${subtopic} in your ${track} work.`,
      constraints: `Focus specifically on ${subtopic}`,
      expectedAnswerFormat: phase === PanelPhase.CODING ? 'code' : phase === PanelPhase.QUERY ? 'sql' : 'text',
    };
  }

  private fallbackReport(
    params: { track: string; experienceYears: string; targetRole: string; difficulty: string },
    overallScore: number,
    answers: PanelAnswer[],
    questions: PanelQuestion[],
  ): PanelFinalReport {
    return {
      candidateProfile: {
        track: params.track,
        experienceYears: params.experienceYears,
        role: params.targetRole,
        difficulty: params.difficulty,
      },
      overallScore,
      sectionScores: [],
      questionBreakdown: answers.map((a) => {
        const q = questions.find((x) => x.id === a.questionId);
        return { questionText: q?.questionText ?? '', phase: q?.phase ?? '', askedBy: q?.askedBy ?? '', score: a.score, maxScore: 10, feedback: a.feedback };
      }),
      strengths: ['Attempted all questions'],
      weakAreas: ['Report generation unavailable — please review individual scores'],
      mistakesSummary: [],
      interviewTips: ['Practice more on ' + params.track],
      focusAreas: [params.track + ' fundamentals'],
      improvementPlan: `Focus on strengthening ${params.track} concepts for a ${params.targetRole} role.`,
      passed: overallScore >= 60,
    };
  }
}
