import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PanelSession,
  PanelPhase,
  PanelStatus,
  PanelQuestion,
  PanelAnswer,
  PanelFinalReport,
} from './panel-session.entity';
import { PanelAiService } from './panel-ai.service';
import { PanelMailService } from './panel-mail.service';
import { User } from '../users/user.entity';

// ── Update payload type (avoids TypeORM deep-partial issues) ──────
interface PanelUpdate {
  answers?: PanelAnswer[];
  questions?: PanelQuestion[];
  pendingFollowUpFor?: string | null;
  phase?: PanelPhase;
  questionIndex?: number;
  completedAt?: Date;
  status?: PanelStatus;
  finalReport?: PanelFinalReport;
}

// How many questions per phase
const PHASE_QUESTION_COUNTS: Record<string, number> = {
  [PanelPhase.WARMUP]: 2,
  [PanelPhase.CORE]: 6,
  [PanelPhase.CODING]: 1,
  [PanelPhase.QUERY]: 1,
};

const PHASE_ORDER = [
  PanelPhase.WARMUP,
  PanelPhase.CORE,
  PanelPhase.CODING,
  PanelPhase.QUERY,
  PanelPhase.REPORT,
];

@Injectable()
export class PanelService {
  constructor(
    @InjectRepository(PanelSession)
    private readonly repo: Repository<PanelSession>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly aiService: PanelAiService,
    private readonly mailService: PanelMailService,
  ) {}

  // ── Create session ───────────────────────────────────────────────

  async createSession(
    candidateId: string,
    dto: {
      track: string;
      experienceYears: string;
      targetRole: string;
      difficulty: 'Normal' | 'Hard';
    },
  ): Promise<PanelSession> {
    const session = this.repo.create({
      candidateId,
      track: dto.track,
      experienceYears: dto.experienceYears,
      targetRole: dto.targetRole,
      difficulty: dto.difficulty,
      phase: PanelPhase.WARMUP,
      questionIndex: 0,
      questions: [],
      answers: [],
      startedAt: new Date(),
    });
    return this.repo.save(session);
  }

  // ── Get current question ─────────────────────────────────────────

  async getCurrentQuestion(
    sessionId: string,
    candidateId: string,
  ): Promise<PanelApiResponse> {
    const session = await this.getOrFail(sessionId, candidateId);

    if (session.phase === PanelPhase.REPORT) {
      throw new BadRequestException('Interview is complete. View your report.');
    }

    const existingForPhase = (session.questions ?? []).filter(
      (q) => q.phase === session.phase,
    );
    const neededIndex = session.questionIndex;

    let question: PanelQuestion;
    if (neededIndex < existingForPhase.length) {
      question = existingForPhase[neededIndex];
    } else {
      const previousQA = this.buildPreviousQA(session);
      // Pass ALL question texts already asked in this session so GPT never repeats
      const alreadyAskedQuestions = (session.questions ?? []).map((q) => q.questionText);
      question = await this.aiService.generateQuestion({
        phase: session.phase,
        track: session.track,
        experienceYears: session.experienceYears,
        targetRole: session.targetRole,
        difficulty: session.difficulty,
        questionNumber: (session.questions ?? []).length + 1,
        previousQA,
        alreadyAskedQuestions,
      });

      const allQuestions = [...(session.questions ?? []), question];
      await this.doUpdate(sessionId, { questions: allQuestions });
      session.questions = allQuestions;
    }

    return this.buildResponse(session, question, null);
  }

  // ── Submit answer ────────────────────────────────────────────────

  async submitAnswer(
    sessionId: string,
    candidateId: string,
    dto: {
      questionId: string;
      answer: string;
      language?: string;
      isFollowUp?: boolean;
    },
  ): Promise<PanelApiResponse> {
    const session = await this.getOrFail(sessionId, candidateId);

    if (session.phase === PanelPhase.REPORT) {
      throw new BadRequestException('Interview already completed.');
    }

    const question = (session.questions ?? []).find((q) => q.id === dto.questionId);
    if (!question) throw new NotFoundException('Question not found in session.');

    // Handle follow-up answer
    if (dto.isFollowUp && session.pendingFollowUpFor === dto.questionId) {
      const existingAnswer = (session.answers ?? []).find(
        (a) => a.questionId === dto.questionId,
      );
      if (!existingAnswer) throw new BadRequestException('No pending follow-up.');

      const { score, feedback } = await this.aiService.evaluateFollowUp({
        originalQuestion: question.questionText,
        followUpQuestion: existingAnswer.followUpQuestion ?? '',
        followUpAnswer: dto.answer,
        track: session.track,
      });

      existingAnswer.followUpAnswer = dto.answer;
      existingAnswer.followUpScore = score;

      const updatedAnswers = (session.answers ?? []).map((a) =>
        a.questionId === dto.questionId ? existingAnswer : a,
      );

      const { nextPhase, nextIndex } = this.advance(session);
      const updates: PanelUpdate = {
        answers: updatedAnswers,
        pendingFollowUpFor: null,
        phase: nextPhase,
        questionIndex: nextIndex,
      };
      if (nextPhase === PanelPhase.REPORT) {
        updates.completedAt = new Date();
        updates.status = PanelStatus.COMPLETED;
        updates.finalReport = await this.aiService.generateFinalReport({
          track: session.track,
          experienceYears: session.experienceYears,
          targetRole: session.targetRole,
          difficulty: session.difficulty,
          answers: updatedAnswers,
          questions: session.questions ?? [],
        });
      }
      await this.doUpdate(sessionId, updates);
      const updated = await this.getOrFail(sessionId, candidateId);
      return this.buildResponse(updated, question, { score, feedback });
    }

    // Evaluate the answer
    const evaluation = await this.aiService.evaluateAnswer({
      question,
      answer: dto.answer,
      language: dto.language,
      track: session.track,
      experienceYears: session.experienceYears,
      difficulty: session.difficulty,
    });

    const answer: PanelAnswer = {
      questionId: dto.questionId,
      answer: dto.answer,
      language: dto.language,
      score: evaluation.score,
      feedback: evaluation.feedback,
      followUpQuestion: evaluation.followUpQuestion,
    };

    const updatedAnswers = [
      ...(session.answers ?? []).filter((a) => a.questionId !== dto.questionId),
      answer,
    ];

    const needsFollowUp = !!evaluation.followUpQuestion && evaluation.score < 7;

    if (needsFollowUp) {
      await this.doUpdate(sessionId, {
        answers: updatedAnswers,
        pendingFollowUpFor: dto.questionId,
      });
      const updated = await this.getOrFail(sessionId, candidateId);
      return this.buildResponse(updated, question, evaluation);
    }

    const { nextPhase, nextIndex } = this.advance(session);
    const updates: PanelUpdate = {
      answers: updatedAnswers,
      pendingFollowUpFor: null,
      phase: nextPhase,
      questionIndex: nextIndex,
    };

    if (nextPhase === PanelPhase.REPORT) {
      updates.completedAt = new Date();
      updates.status = PanelStatus.COMPLETED;
      updates.finalReport = await this.aiService.generateFinalReport({
        track: session.track,
        experienceYears: session.experienceYears,
        targetRole: session.targetRole,
        difficulty: session.difficulty,
        answers: updatedAnswers,
        questions: session.questions ?? [],
      });
    }

    await this.doUpdate(sessionId, updates);
    const updated = await this.getOrFail(sessionId, candidateId);
    return this.buildResponse(updated, question, evaluation);
  }

  // ── Skip question ────────────────────────────────────────────────

  async skipQuestion(
    sessionId: string,
    candidateId: string,
  ): Promise<PanelApiResponse> {
    const session = await this.getOrFail(sessionId, candidateId);

    if (session.status !== PanelStatus.ACTIVE) {
      throw new BadRequestException('Interview is not active.');
    }
    if (session.phase === PanelPhase.REPORT) {
      throw new BadRequestException('Interview is already complete.');
    }

    // Find the current question for this phase/index
    const phaseQuestions = (session.questions ?? []).filter(
      (q) => q.phase === session.phase,
    );
    const currentQ = phaseQuestions[session.questionIndex];

    if (!currentQ) {
      throw new BadRequestException('No current question to skip.');
    }

    // Already answered? Just advance
    const alreadyAnswered = (session.answers ?? []).some(
      (a) => a.questionId === currentQ.id,
    );
    if (!alreadyAnswered) {
      const skippedAnswer: PanelAnswer = {
        questionId: currentQ.id,
        answer: '[SKIPPED]',
        score: 0,
        feedback: 'Candidate skipped this question.',
      };
      const updatedAnswers = [...(session.answers ?? []), skippedAnswer];
      const { nextPhase, nextIndex } = this.advance(session);
      const updates: PanelUpdate = {
        answers: updatedAnswers,
        pendingFollowUpFor: null,
        phase: nextPhase,
        questionIndex: nextIndex,
      };

      if (nextPhase === PanelPhase.REPORT) {
        updates.completedAt = new Date();
        updates.status = PanelStatus.COMPLETED;
        updates.finalReport = await this.aiService.generateFinalReport({
          track: session.track,
          experienceYears: session.experienceYears,
          targetRole: session.targetRole,
          difficulty: session.difficulty,
          answers: updatedAnswers,
          questions: session.questions ?? [],
        });
        // Send completion email
        const user = await this.userRepo.findOne({ where: { id: candidateId } });
        if (user && updates.finalReport) {
          const allAnswers = updatedAnswers;
          const answered = allAnswers.filter((a) => a.answer !== '[SKIPPED]').length;
          const skipped = allAnswers.filter((a) => a.answer === '[SKIPPED]').length;
          void this.mailService.sendInterviewReport({
            to: user.email,
            candidateName: `${user.firstName} ${user.lastName}`,
            sessionId,
            report: updates.finalReport,
            abandoned: false,
            questionsAsked: allAnswers.length,
            questionsAnswered: answered,
            questionsSkipped: skipped,
          });
        }
      }

      await this.doUpdate(sessionId, updates);
    } else {
      const { nextPhase, nextIndex } = this.advance(session);
      await this.doUpdate(sessionId, {
        pendingFollowUpFor: null,
        phase: nextPhase,
        questionIndex: nextIndex,
      });
    }

    const updated = await this.getOrFail(sessionId, candidateId);
    if (updated.phase === PanelPhase.REPORT) {
      return this.buildResponse(updated, null, null);
    }
    // Load next question
    return this.getCurrentQuestion(sessionId, candidateId);
  }

  // ── Abandon interview ────────────────────────────────────────────

  async abandonInterview(
    sessionId: string,
    candidateId: string,
  ): Promise<PanelApiResponse> {
    const session = await this.getOrFail(sessionId, candidateId);

    if (session.status !== PanelStatus.ACTIVE) {
      throw new BadRequestException('Interview is not active.');
    }

    const allAnswers = session.answers ?? [];
    const allQuestions = session.questions ?? [];
    const answeredCount = allAnswers.filter((a) => a.answer !== '[SKIPPED]').length;
    const skippedCount = allAnswers.filter((a) => a.answer === '[SKIPPED]').length;

    // Generate partial report from what has been answered so far
    const partialReport = await this.aiService.generateFinalReport({
      track: session.track,
      experienceYears: session.experienceYears,
      targetRole: session.targetRole,
      difficulty: session.difficulty,
      answers: allAnswers,
      questions: allQuestions,
      isPartial: true,
      questionsAsked: allQuestions.length,
      questionsAnswered: answeredCount,
      questionsSkipped: skippedCount,
    });

    await this.doUpdate(sessionId, {
      status: PanelStatus.ABANDONED,
      phase: PanelPhase.REPORT,
      completedAt: new Date(),
      finalReport: partialReport,
    });

    // Send report email
    const user = await this.userRepo.findOne({ where: { id: candidateId } });
    if (user) {
      void this.mailService.sendInterviewReport({
        to: user.email,
        candidateName: `${user.firstName} ${user.lastName}`,
        sessionId,
        report: partialReport,
        abandoned: true,
        questionsAsked: allQuestions.length,
        questionsAnswered: answeredCount,
        questionsSkipped: skippedCount,
      });
    }

    const updated = await this.getOrFail(sessionId, candidateId);
    return this.buildResponse(updated, null, null);
  }

  // ── Get report ───────────────────────────────────────────────────

  async getReport(
    sessionId: string,
    candidateId: string,
  ): Promise<PanelApiResponse> {
    const session = await this.getOrFail(sessionId, candidateId);
    if (session.phase !== PanelPhase.REPORT) {
      throw new BadRequestException('Interview not yet completed.');
    }
    return this.buildResponse(session, null, null);
  }

  // ── List sessions ────────────────────────────────────────────────

  async listSessions(candidateId: string): Promise<PanelSession[]> {
    return this.repo.find({
      where: { candidateId },
      order: { createdAt: 'DESC' },
    });
  }

  // ── Private helpers ──────────────────────────────────────────────

  private async doUpdate(sessionId: string, payload: PanelUpdate): Promise<void> {
    await this.repo.update(sessionId, payload as object);
  }

  private async getOrFail(sessionId: string, candidateId: string): Promise<PanelSession> {
    const session = await this.repo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException(`Panel session ${sessionId} not found`);
    if (session.candidateId !== candidateId) throw new ForbiddenException();
    return session;
  }

  private advance(session: PanelSession): { nextPhase: PanelPhase; nextIndex: number } {
    const phaseCount = PHASE_QUESTION_COUNTS[session.phase] ?? 1;
    let adjustedCount = phaseCount;
    if (session.phase === PanelPhase.CORE) {
      const coreAnswers = (session.answers ?? []).filter((a) => {
        const q = (session.questions ?? []).find((q) => q.id === a.questionId);
        return q?.phase === PanelPhase.CORE;
      });
      if (coreAnswers.length >= 3) {
        const avg = coreAnswers.reduce((s, a) => s + a.score, 0) / coreAnswers.length;
        adjustedCount = avg >= 7.5 ? 7 : avg < 4 ? 5 : 6;
      }
    }
    const nextIndex = session.questionIndex + 1;
    if (nextIndex < adjustedCount) {
      return { nextPhase: session.phase, nextIndex };
    }
    const currentPhaseIdx = PHASE_ORDER.indexOf(session.phase);
    const nextPhase = PHASE_ORDER[currentPhaseIdx + 1] ?? PanelPhase.REPORT;
    return { nextPhase, nextIndex: 0 };
  }

  private buildPreviousQA(session: PanelSession): Array<{ q: string; a: string; score: number }> {
    return (session.answers ?? [])
      .map((a) => {
        const q = (session.questions ?? []).find((x) => x.id === a.questionId);
        return { q: q?.questionText ?? '', a: a.answer, score: a.score };
      })
      .filter((x) => x.q);
  }

  private buildResponse(
    session: PanelSession,
    currentQuestion: PanelQuestion | null,
    evaluation: { score: number; feedback: string; followUpQuestion?: string } | null,
  ): PanelApiResponse {
    return {
      session: {
        id: session.id,
        track: session.track,
        experienceYears: session.experienceYears,
        role: session.targetRole,
        difficulty: session.difficulty,
        phase: session.phase,
        questionIndex: session.questionIndex,
        status: session.status,
      },
      panel: [
        { name: 'Panelist A', role: 'Technical Lead' },
        { name: 'Panelist B', role: 'Coding Evaluator' },
        { name: 'Panelist C', role: 'SQL/Query Evaluator' },
      ],
      currentQuestion: currentQuestion
        ? {
            id: currentQuestion.id,
            askedBy: currentQuestion.askedBy,
            type: currentQuestion.type,
            questionText: currentQuestion.questionText,
            constraints: currentQuestion.constraints,
            expectedAnswerFormat: currentQuestion.expectedAnswerFormat,
            editor: currentQuestion.editor,
            schemaInfo: currentQuestion.schemaInfo,
            pendingFollowUp:
              session.pendingFollowUpFor === currentQuestion.id
                ? (evaluation?.followUpQuestion ?? null)
                : null,
          }
        : null,
      evaluation: evaluation
        ? {
            score: evaluation.score,
            feedback: evaluation.feedback,
            followUpQuestion: session.pendingFollowUpFor ? (evaluation.followUpQuestion ?? null) : null,
          }
        : null,
      finalReport: session.phase === PanelPhase.REPORT ? (session.finalReport ?? null) : null,
    };
  }
}

// ── Response shape ────────────────────────────────────────────────

export interface PanelApiResponse {
  session: {
    id: string;
    track: string;
    experienceYears: string;
    role: string;
    difficulty: string;
    phase: PanelPhase;
    questionIndex: number;
    status: PanelStatus;
  };
  panel: Array<{ name: string; role: string }>;
  currentQuestion: {
    id: string;
    askedBy: string;
    type: string;
    questionText: string;
    constraints?: string;
    expectedAnswerFormat: string;
    editor?: PanelQuestion['editor'];
    schemaInfo?: string;
    pendingFollowUp: string | null;
  } | null;
  evaluation: {
    score: number;
    feedback: string;
    followUpQuestion: string | null;
  } | null;
  finalReport: PanelFinalReport | null | undefined;
}
