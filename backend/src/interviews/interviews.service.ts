import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import {
  InterviewSession,
  SessionStatus,
  InterviewType,
} from './interview-session.entity';
import {
  InterviewTemplate,
  TemplateDifficulty,
} from './interview-template.entity';
import { Question, QuestionDifficulty } from '../questions/question.entity';
import { Answer, AnswerStatus } from '../answers/answer.entity';
import { User } from '../users/user.entity';
import {
  StartInterviewDto,
  SubmitAnswerDto,
  CreateTemplateDto,
} from './dto/interview.dto';

@Injectable()
export class InterviewsService {
  constructor(
    @InjectRepository(InterviewSession)
    private readonly sessionsRepo: Repository<InterviewSession>,
    @InjectRepository(InterviewTemplate)
    private readonly templatesRepo: Repository<InterviewTemplate>,
    @InjectRepository(Question)
    private readonly questionsRepo: Repository<Question>,
    @InjectRepository(Answer)
    private readonly answersRepo: Repository<Answer>,
    @InjectQueue('evaluation')
    private readonly evaluationQueue: Queue,
    @InjectQueue('reports')
    private readonly reportsQueue: Queue,
  ) {}

  // ──────────────────────────────────────────────
  // Templates
  // ──────────────────────────────────────────────

  async createTemplate(
    dto: CreateTemplateDto,
    creatorId: string,
  ): Promise<InterviewTemplate> {
    const template = this.templatesRepo.create({
      name: dto.name,
      description: dto.description,
      role: dto.role,
      difficulty: dto.difficulty as TemplateDifficulty,
      sectionConfig: dto.sectionConfig as InterviewTemplate['sectionConfig'],
      timeLimitMinutes: dto.timeLimitMinutes ?? 60,
      passingScorePercent: dto.passingScorePercent ?? 70,
      createdById: creatorId,
    });
    return await this.templatesRepo.save(template);
  }

  async getTemplates(): Promise<InterviewTemplate[]> {
    return this.templatesRepo.find({ where: { isActive: true } });
  }

  async getTemplateById(id: string): Promise<InterviewTemplate> {
    const t = await this.templatesRepo.findOne({
      where: { id },
      relations: ['questions'],
    });
    if (!t) throw new NotFoundException(`Template ${id} not found`);
    return t;
  }

  // ──────────────────────────────────────────────
  // Session lifecycle
  // ──────────────────────────────────────────────

  async startSession(
    dto: StartInterviewDto,
    candidate: User,
  ): Promise<InterviewSession> {
    const template = await this.getTemplateById(dto.templateId);

    // Check for existing in-progress session
    const existing = await this.sessionsRepo.findOne({
      where: {
        candidateId: candidate.id,
        templateId: template.id,
        status: SessionStatus.IN_PROGRESS,
      },
    });
    if (existing) return existing; // Resume

    const session = this.sessionsRepo.create({
      candidateId: candidate.id,
      templateId: template.id,
      status: SessionStatus.IN_PROGRESS,
      interviewType: dto.interviewType ?? InterviewType.MIXED,
      timeLimitMinutes: template.timeLimitMinutes,
      startedAt: new Date(),
    });
    return this.sessionsRepo.save(session);
  }

  async getNextQuestion(
    sessionId: string,
    candidateId: string,
  ): Promise<{
    question: Question;
    index: number;
    total: number;
    timeRemainingSeconds: number;
  }> {
    const session = await this.getSessionOrFail(sessionId, candidateId);
    this.assertSessionActive(session);

    // Get all questions for template, ordered
    const questions = await this.questionsRepo.find({
      where: { templateId: session.templateId, isActive: true },
      order: { orderIndex: 'ASC' },
    });

    // Adaptive: filter based on past performance
    const adaptedQuestions = await this.applyAdaptiveSelection(
      session,
      questions,
    );

    if (session.currentQuestionIndex >= adaptedQuestions.length) {
      throw new BadRequestException('No more questions. Submit to complete.');
    }

    const question = adaptedQuestions[session.currentQuestionIndex];
    const timeRemainingSeconds = this.calculateTimeRemaining(session);

    return {
      question: this.sanitizeQuestion(question),
      index: session.currentQuestionIndex,
      total: adaptedQuestions.length,
      timeRemainingSeconds,
    };
  }

  async submitAnswer(
    sessionId: string,
    dto: SubmitAnswerDto,
    candidateId: string,
  ): Promise<{ answerId: string; nextAvailable: boolean }> {
    const session = await this.getSessionOrFail(sessionId, candidateId);
    this.assertSessionActive(session);

    const question = await this.questionsRepo.findOne({
      where: { id: dto.questionId },
    });
    if (!question)
      throw new NotFoundException(`Question ${dto.questionId} not found`);

    // Create answer record
    const answer = this.answersRepo.create({
      sessionId,
      questionId: dto.questionId,
      submittedText: dto.submittedText,
      selectedOptionIds: dto.selectedOptionIds,
      programmingLanguage: dto.programmingLanguage,
      timeTakenSeconds: dto.timeTakenSeconds,
      maxScore: question.maxScore,
      status: AnswerStatus.PENDING,
    });
    const saved = await this.answersRepo.save(answer);

    // Advance question index
    await this.sessionsRepo.update(sessionId, {
      currentQuestionIndex: session.currentQuestionIndex + 1,
    });

    // Enqueue async evaluation
    await this.evaluationQueue.add(
      'evaluate-answer',
      {
        answerId: saved.id,
        questionType: question.type,
        sessionId,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );

    // Check if this was last question
    const totalQuestions = await this.questionsRepo.count({
      where: { templateId: session.templateId, isActive: true },
    });

    return {
      answerId: saved.id,
      nextAvailable: session.currentQuestionIndex + 1 < totalQuestions,
    };
  }

  async completeSession(
    sessionId: string,
    candidateId: string,
  ): Promise<InterviewSession> {
    const session = await this.getSessionOrFail(sessionId, candidateId);
    if (session.status === SessionStatus.COMPLETED) return session;

    const now = new Date();
    const durationSeconds = session.startedAt
      ? Math.floor((now.getTime() - session.startedAt.getTime()) / 1000)
      : 0;

    await this.sessionsRepo.update(sessionId, {
      status: SessionStatus.COMPLETED,
      completedAt: now,
      durationSeconds,
    });

    // Enqueue report generation
    await this.reportsQueue.add(
      'generate-report',
      { sessionId },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    return this.sessionsRepo.findOne({
      where: { id: sessionId },
    }) as Promise<InterviewSession>;
  }

  async getSessionResult(
    sessionId: string,
    requesterId: string,
  ): Promise<InterviewSession> {
    const session = await this.sessionsRepo.findOne({
      where: { id: sessionId },
      relations: ['answers', 'template', 'candidate'],
    });
    if (!session) throw new NotFoundException();
    // Recruiter or owner can view
    if (
      session.candidateId !== requesterId &&
      session.invitedByRecruiterId !== requesterId
    ) {
      throw new ForbiddenException();
    }
    return session;
  }

  async listSessions(candidateId: string): Promise<InterviewSession[]> {
    return this.sessionsRepo.find({
      where: { candidateId },
      order: { createdAt: 'DESC' },
      relations: ['template'],
    });
  }

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────

  private async getSessionOrFail(
    sessionId: string,
    candidateId: string,
  ): Promise<InterviewSession> {
    const session = await this.sessionsRepo.findOne({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
    if (session.candidateId !== candidateId) throw new ForbiddenException();
    return session;
  }

  private assertSessionActive(session: InterviewSession): void {
    if (session.status !== SessionStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Session is ${session.status}, cannot proceed`,
      );
    }
    if (this.calculateTimeRemaining(session) <= 0) {
      // Auto-complete on timeout — fire and forget is intentional here
      void this.sessionsRepo.update(session.id, {
        status: SessionStatus.COMPLETED,
      });
      throw new BadRequestException('Time limit exceeded. Session closed.');
    }
  }

  private calculateTimeRemaining(session: InterviewSession): number {
    if (!session.startedAt) return session.timeLimitMinutes * 60;
    const elapsed = (Date.now() - session.startedAt.getTime()) / 1000;
    return Math.max(0, session.timeLimitMinutes * 60 - elapsed);
  }

  /**
   * Adaptive engine: promotes harder questions if candidate is performing well,
   * demotes if performing poorly (based on rolling average of recent answers).
   */
  private async applyAdaptiveSelection(
    session: InterviewSession,
    questions: Question[],
  ): Promise<Question[]> {
    if (session.currentQuestionIndex < 2) return questions;

    const recentAnswers = await this.answersRepo.find({
      where: { sessionId: session.id, status: AnswerStatus.EVALUATED },
      order: { createdAt: 'DESC' },
      take: 3,
    });

    if (!recentAnswers.length) return questions;

    const avgScore =
      recentAnswers.reduce(
        (sum, a) => sum + ((a.score ?? 0) / (a.maxScore ?? 1)) * 100,
        0,
      ) / recentAnswers.length;

    // Reorder remaining questions based on performance
    const answered = new Set(recentAnswers.map((a) => a.questionId));
    const remaining = questions.filter(
      (q, idx) => idx >= session.currentQuestionIndex && !answered.has(q.id),
    );
    const already = questions.slice(0, session.currentQuestionIndex);

    let sorted: Question[];
    if (avgScore >= 75) {
      // Promote harder questions
      sorted = remaining.sort((a, b) => {
        const order = {
          [QuestionDifficulty.HARD]: 0,
          [QuestionDifficulty.MEDIUM]: 1,
          [QuestionDifficulty.EASY]: 2,
        };
        return (order[a.difficulty] ?? 1) - (order[b.difficulty] ?? 1);
      });
    } else if (avgScore < 40) {
      // Demote to easier
      sorted = remaining.sort((a, b) => {
        const order = {
          [QuestionDifficulty.EASY]: 0,
          [QuestionDifficulty.MEDIUM]: 1,
          [QuestionDifficulty.HARD]: 2,
        };
        return (order[a.difficulty] ?? 1) - (order[b.difficulty] ?? 1);
      });
    } else {
      sorted = remaining;
    }

    return [...already, ...sorted];
  }

  /** Remove answer keys before sending to candidate */
  private sanitizeQuestion(question: Question): Question {
    const q = { ...question };
    if (q.options) {
      q.options = q.options.map(({ id, text }) => ({
        id,
        text,
        isCorrect: false,
      }));
    }
    q.correctAnswerIds = undefined;
    if (q.codingConfig) {
      q.codingConfig = {
        ...q.codingConfig,
        testCases: q.codingConfig.testCases.map((tc) =>
          tc.isPublic ? tc : { ...tc, expectedOutput: '[hidden]' },
        ),
      };
    }
    return q as Question;
  }
}
