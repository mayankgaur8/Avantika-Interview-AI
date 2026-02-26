import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Answer, AnswerStatus } from '../answers/answer.entity';
import { Question, QuestionType } from '../questions/question.entity';
import { InterviewSession } from '../interviews/interview-session.entity';
import { SandboxService } from './sandbox.service';
import { AiEvaluatorService } from './ai-evaluator.service';

interface EvaluateAnswerJob {
  answerId: string;
  questionType: QuestionType;
  sessionId: string;
}

@Processor('evaluation')
export class EvaluationWorker {
  private readonly logger = new Logger(EvaluationWorker.name);

  constructor(
    @InjectRepository(Answer)
    private readonly answersRepo: Repository<Answer>,
    @InjectRepository(Question)
    private readonly questionsRepo: Repository<Question>,
    @InjectRepository(InterviewSession)
    private readonly sessionsRepo: Repository<InterviewSession>,
    private readonly sandboxService: SandboxService,
    private readonly aiEvaluatorService: AiEvaluatorService,
  ) {}

  @Process('evaluate-answer')
  async handleEvaluateAnswer(job: Job<EvaluateAnswerJob>): Promise<void> {
    const { answerId, questionType } = job.data;
    this.logger.log(`Evaluating answer ${answerId} [${questionType}]`);

    const answer = await this.answersRepo.findOne({ where: { id: answerId } });
    if (!answer) {
      this.logger.warn(`Answer ${answerId} not found`);
      return;
    }

    const question = await this.questionsRepo.findOne({
      where: { id: answer.questionId },
    });
    if (!question) return;

    await this.answersRepo.update(answerId, {
      status: AnswerStatus.EVALUATING,
    });

    try {
      let score = 0;
      let evaluationResult: Answer['evaluationResult'] = {};

      switch (questionType) {
        case QuestionType.MCQ:
          ({ score, evaluationResult } = this.evaluateMcq(answer, question));
          break;

        case QuestionType.CODING:
          ({ score, evaluationResult } = await this.evaluateCoding(
            answer,
            question,
          ));
          break;

        case QuestionType.BEHAVIORAL:
        case QuestionType.SYSTEM_DESIGN:
          ({ score, evaluationResult } = await this.evaluateTextWithAI(
            answer,
            question,
          ));
          break;
      }

      await this.answersRepo.update(answerId, {
        score,
        status: AnswerStatus.EVALUATED,
        evaluationResult,
        evaluatedAt: new Date(),
      });

      // Update rolling session score
      await this.updateSessionScore(answer.sessionId);

      this.logger.log(
        `Answer ${answerId} evaluated: ${score}/${question.maxScore}`,
      );
    } catch (err) {
      this.logger.error(`Evaluation failed for answer ${answerId}`, err);
      await this.answersRepo.update(answerId, {
        status: AnswerStatus.EVALUATED,
        score: 0,
        evaluationResult: {
          aiFeedback: 'Evaluation failed - score pending manual review',
        },
        evaluatedAt: new Date(),
      });
    }
  }

  // ──────────────────────────────────────────────
  // MCQ Evaluation: exact match on selected options
  // ──────────────────────────────────────────────
  private evaluateMcq(
    answer: Answer,
    question: Question,
  ): { score: number; evaluationResult: Answer['evaluationResult'] } {
    const correctIds = new Set(question.correctAnswerIds ?? []);
    const selectedIds = new Set(answer.selectedOptionIds ?? []);

    const allCorrect = [...correctIds].every((id) => selectedIds.has(id));
    const noExtra = [...selectedIds].every((id) => correctIds.has(id));
    const passed = allCorrect && noExtra;
    const score = passed ? question.maxScore : 0;

    return {
      score,
      evaluationResult: {
        passed,
        aiFeedback: passed
          ? 'Correct answer selected.'
          : `Incorrect. Correct answer(s): ${[...correctIds].join(', ')}`,
      },
    };
  }

  // ──────────────────────────────────────────────
  // Coding Evaluation: Docker sandbox via Judge0
  // ──────────────────────────────────────────────
  private async evaluateCoding(
    answer: Answer,
    question: Question,
  ): Promise<{ score: number; evaluationResult: Answer['evaluationResult'] }> {
    if (!question.codingConfig || !answer.submittedText) {
      return {
        score: 0,
        evaluationResult: { passed: false, aiFeedback: 'No code submitted' },
      };
    }

    const testCases = question.codingConfig.testCases;
    let passed = 0;
    let compileError: string | undefined;
    let runtimeError: string | undefined;
    let totalExecutionMs = 0;

    for (const tc of testCases) {
      const result = await this.sandboxService.runCode({
        code: answer.submittedText,
        language: answer.programmingLanguage ?? 'javascript',
        stdin: tc.input,
        timeoutMs: question.codingConfig.timeoutMs ?? 10000,
        memoryLimitMb: question.codingConfig.memoryLimitMb ?? 128,
      });

      if (result.compileError) {
        compileError = result.compileError;
        break;
      }
      if (result.runtimeError) {
        runtimeError = result.runtimeError;
      }
      if (result.stdout?.trim() === tc.expectedOutput.trim()) passed++;
      totalExecutionMs += result.executionTimeMs ?? 0;
    }

    const ratio = testCases.length > 0 ? passed / testCases.length : 0;
    const score = parseFloat((question.maxScore * ratio).toFixed(2));

    return {
      score,
      evaluationResult: {
        passed: passed === testCases.length,
        testCasesPassed: passed,
        testCasesTotal: testCases.length,
        executionTimeMs: totalExecutionMs,
        compileError,
        runtimeError,
        aiFeedback: compileError
          ? `Compilation error: ${compileError}`
          : `Passed ${passed}/${testCases.length} test cases.`,
      },
    };
  }

  // ──────────────────────────────────────────────
  // Behavioral / System Design: GPT-4o rubric scoring
  // ──────────────────────────────────────────────
  private async evaluateTextWithAI(
    answer: Answer,
    question: Question,
  ): Promise<{ score: number; evaluationResult: Answer['evaluationResult'] }> {
    if (!answer.submittedText) {
      return {
        score: 0,
        evaluationResult: { passed: false, aiFeedback: 'No answer provided' },
      };
    }

    const rubricScores = await this.aiEvaluatorService.scoreWithRubric(
      question.content,
      answer.submittedText,
      question.rubric ?? [],
    );

    const totalScore = rubricScores.reduce((sum, r) => sum + r.score, 0);
    const maxPossible = rubricScores.reduce((sum, r) => sum + r.maxPoints, 0);
    const score =
      maxPossible > 0
        ? parseFloat(
            ((totalScore / maxPossible) * question.maxScore).toFixed(2),
          )
        : 0;

    const narrative = rubricScores
      .map(
        (r) => `**${r.criterion}** (${r.score}/${r.maxPoints}): ${r.feedback}`,
      )
      .join('\n');

    return {
      score,
      evaluationResult: {
        passed: score >= question.maxScore * 0.7,
        rubricScores,
        aiFeedback: narrative,
      },
    };
  }

  private async updateSessionScore(sessionId: string): Promise<void> {
    const answers = await this.answersRepo.find({
      where: { sessionId, status: AnswerStatus.EVALUATED },
    });
    const total = answers.reduce((s, a) => s + (a.score ?? 0), 0);
    const max = answers.reduce((s, a) => s + (a.maxScore ?? 1), 0);
    const pct = max > 0 ? parseFloat(((total / max) * 100).toFixed(1)) : 0;
    await this.sessionsRepo.update(sessionId, {
      totalScore: total,
      maxPossibleScore: max,
      percentageScore: pct,
    });
  }
}
