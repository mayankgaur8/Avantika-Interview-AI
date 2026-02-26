import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { InterviewSession } from '../interviews/interview-session.entity';

export enum ReportStatus {
  PENDING = 'pending',
  GENERATING = 'generating',
  READY = 'ready',
  FAILED = 'failed',
}

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sessionId: string;

  @ManyToOne(() => InterviewSession)
  @JoinColumn({ name: 'sessionId' })
  session: InterviewSession;

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.PENDING })
  status: ReportStatus;

  @Column({ type: 'jsonb', nullable: true })
  summary?: {
    candidateName: string;
    role: string;
    difficulty: string;
    totalScore: number;
    maxScore: number;
    percentageScore: number;
    passed: boolean;
    durationMinutes: number;
    completedAt: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  sectionBreakdown?: Array<{
    sectionType: string;
    score: number;
    maxScore: number;
    percentage: number;
    questionCount: number;
    correctCount: number;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  questionDetails?: Array<{
    questionId: string;
    type: string;
    content: string;
    score: number;
    maxScore: number;
    timeTakenSeconds: number;
    feedback: string;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  integrityReport?: {
    flagged: boolean;
    flagCount: number;
    events: Array<{ type: string; severity: string; count: number }>;
    overallRisk: 'low' | 'medium' | 'high';
  };

  @Column({ type: 'text', nullable: true })
  aiNarrative?: string;

  @Column({ type: 'text', nullable: true })
  recruiterNotes?: string;

  @Column({ nullable: true })
  pdfUrl?: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  generatedAt?: Date;
}
