import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InterviewSession } from '../interviews/interview-session.entity';
import { Answer, AnswerStatus } from '../answers/answer.entity';
import { Report, ReportStatus } from './report.entity';
import {
  IntegrityEvent,
  IntegritySeverity,
} from '../integrity/integrity-event.entity';
import { AiEvaluatorService } from '../evaluation/ai-evaluator.service';

interface GenerateReportJob {
  sessionId: string;
}

@Processor('reports')
export class ReportsWorker {
  private readonly logger = new Logger(ReportsWorker.name);

  constructor(
    @InjectRepository(InterviewSession)
    private readonly sessionsRepo: Repository<InterviewSession>,
    @InjectRepository(Answer)
    private readonly answersRepo: Repository<Answer>,
    @InjectRepository(Report)
    private readonly reportsRepo: Repository<Report>,
    @InjectRepository(IntegrityEvent)
    private readonly integrityRepo: Repository<IntegrityEvent>,
    private readonly aiEvaluator: AiEvaluatorService,
  ) {}

  @Process('generate-report')
  async handleGenerateReport(job: Job<GenerateReportJob>): Promise<void> {
    const { sessionId } = job.data;
    this.logger.log(`Generating report for session ${sessionId}`);

    // Create or update report record
    let report = await this.reportsRepo.findOne({ where: { sessionId } });
    if (!report) {
      report = this.reportsRepo.create({
        sessionId,
        status: ReportStatus.GENERATING,
      });
      report = await this.reportsRepo.save(report);
    } else {
      await this.reportsRepo.update(report.id, {
        status: ReportStatus.GENERATING,
      });
    }

    try {
      const session = await this.sessionsRepo.findOne({
        where: { id: sessionId },
        relations: ['candidate', 'template'],
      });
      if (!session) throw new Error(`Session ${sessionId} not found`);

      const answers = await this.answersRepo.find({
        where: { sessionId, status: AnswerStatus.EVALUATED },
        relations: ['question'],
      });

      const integrityEvents = await this.integrityRepo.find({
        where: { sessionId },
      });

      // Section breakdown
      const sectionMap = new Map<
        string,
        { score: number; maxScore: number; correct: number; total: number }
      >();
      for (const answer of answers) {
        const type = answer.question?.type ?? 'unknown';
        const curr = sectionMap.get(type) ?? {
          score: 0,
          maxScore: 0,
          correct: 0,
          total: 0,
        };
        curr.score += answer.score ?? 0;
        curr.maxScore += answer.maxScore ?? 1;
        curr.total++;
        if ((answer.score ?? 0) >= (answer.maxScore ?? 1) * 0.7) curr.correct++;
        sectionMap.set(type, curr);
      }

      const sectionBreakdown = [...sectionMap.entries()].map(
        ([type, data]) => ({
          sectionType: type,
          score: data.score,
          maxScore: data.maxScore,
          percentage:
            data.maxScore > 0
              ? parseFloat(((data.score / data.maxScore) * 100).toFixed(1))
              : 0,
          questionCount: data.total,
          correctCount: data.correct,
        }),
      );

      // Integrity report
      const eventCounts = new Map<
        string,
        { count: number; severity: IntegritySeverity }
      >();
      for (const evt of integrityEvents) {
        const curr = eventCounts.get(evt.eventType) ?? {
          count: 0,
          severity: evt.severity,
        };
        curr.count++;
        eventCounts.set(evt.eventType, curr);
      }

      const highSeverityCount = integrityEvents.filter(
        (e) => e.severity === IntegritySeverity.HIGH,
      ).length;
      const overallRisk: 'low' | 'medium' | 'high' =
        highSeverityCount > 2
          ? 'high'
          : integrityEvents.length > 5
            ? 'medium'
            : 'low';

      const integrityReport = {
        flagged: overallRisk !== 'low',
        flagCount: integrityEvents.length,
        events: [...eventCounts.entries()].map(([type, data]) => ({
          type,
          severity: data.severity,
          count: data.count,
        })),
        overallRisk,
      };

      // AI Narrative
      const aiNarrative = await this.generateNarrative(
        session,
        answers,
        sectionBreakdown,
      );

      const pct = session.percentageScore ?? 0;
      const passed = pct >= (session.template?.passingScorePercent ?? 70);
      const durationMinutes = session.durationSeconds
        ? Math.floor(session.durationSeconds / 60)
        : 0;

      await this.reportsRepo.update(report.id, {
        status: ReportStatus.READY,
        summary: {
          candidateName:
            `${session.candidate?.firstName ?? ''} ${session.candidate?.lastName ?? ''}`.trim(),
          role: session.template?.role ?? '',
          difficulty: session.template?.difficulty ?? '',
          totalScore: session.totalScore ?? 0,
          maxScore: session.maxPossibleScore ?? 0,
          percentageScore: pct,
          passed,
          durationMinutes,
          completedAt: session.completedAt?.toISOString() ?? '',
        },
        sectionBreakdown,
        questionDetails: answers.map((a) => ({
          questionId: a.questionId,
          type: a.question?.type ?? '',
          content: a.question?.content ?? '',
          score: a.score ?? 0,
          maxScore: a.maxScore ?? 1,
          timeTakenSeconds: a.timeTakenSeconds ?? 0,
          feedback: a.evaluationResult?.aiFeedback ?? '',
        })),
        integrityReport,
        aiNarrative,
        generatedAt: new Date(),
      });

      // Update session report URL reference
      await this.sessionsRepo.update(sessionId, {
        reportUrl: `/api/reports/${report.id}`,
        isIntegrityFlagged: integrityReport.flagged,
      });

      this.logger.log(`Report ${report.id} generated for session ${sessionId}`);
    } catch (err) {
      this.logger.error(
        `Report generation failed for session ${sessionId}`,
        err,
      );
      await this.reportsRepo.update(report.id, { status: ReportStatus.FAILED });
    }
  }

  private async generateNarrative(
    session: InterviewSession,
    answers: Answer[],
    breakdown: Array<{ sectionType: string; percentage: number }>,
  ): Promise<string> {
    const summaryText = breakdown
      .map((b) => `${b.sectionType}: ${b.percentage}%`)
      .join(', ');

    const prompt = `Write a professional 2-paragraph recruiter summary for a ${session.template?.role ?? 'technical'} interview.
Overall score: ${session.percentageScore?.toFixed(1) ?? 0}%. Sections: ${summaryText}.
Total questions: ${answers.length}. Duration: ${Math.floor((session.durationSeconds ?? 0) / 60)} minutes.
Be factual, concise, and highlight strengths and improvement areas. Do NOT include candidate name.`;

    try {
      const response = await this.aiEvaluator['openai'].chat.completions.create(
        {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
          max_tokens: 400,
        },
      );
      return response.choices[0]?.message?.content ?? '';
    } catch {
      return `Candidate completed a ${session.template?.role ?? 'technical'} interview with an overall score of ${session.percentageScore?.toFixed(1) ?? 0}%.`;
    }
  }
}
