import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum PanelPhase {
  SETUP = 'setup',
  WARMUP = 'warmup',
  CORE = 'core',
  CODING = 'coding',
  QUERY = 'query',
  REPORT = 'report',
}

export enum PanelStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
}

export interface PanelQuestion {
  id: string;
  phase: PanelPhase;
  askedBy: 'Panelist A' | 'Panelist B' | 'Panelist C';
  type: 'technical' | 'coding' | 'query';
  questionText: string;
  constraints?: string;
  expectedAnswerFormat: 'text' | 'code' | 'sql';
  editor?: {
    enabled: boolean;
    languageOptions: string[];
    starterCode: string;
    testCases: Array<{ input: string; output: string }>;
  };
  schemaInfo?: string;
}

export interface PanelAnswer {
  questionId: string;
  answer: string;
  language?: string;
  score: number;
  feedback: string;
  followUpQuestion?: string;
  followUpAnswer?: string;
  followUpScore?: number;
}

export interface PanelFinalReport {
  candidateProfile: {
    track: string;
    experienceYears: string;
    role: string;
    difficulty: string;
  };
  overallScore: number;
  sectionScores: Array<{
    section: string;
    score: number;
    maxScore: number;
    percentage: number;
  }>;
  questionBreakdown: Array<{
    questionText: string;
    phase: string;
    askedBy: string;
    score: number;
    maxScore: number;
    feedback: string;
    whereYouWentWrong?: string;
  }>;
  strengths: string[];
  weakAreas: string[];
  mistakesSummary: string[];
  interviewTips: string[];
  focusAreas: string[];
  improvementPlan: string;
  passed: boolean;
}

@Entity('panel_sessions')
export class PanelSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  candidateId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'candidateId' })
  candidate: User;

  @Column({ type: 'enum', enum: PanelPhase, default: PanelPhase.SETUP })
  phase: PanelPhase;

  @Column({ type: 'enum', enum: PanelStatus, default: PanelStatus.ACTIVE })
  status: PanelStatus;

  @Column({ default: '' })
  track: string;

  @Column({ default: '' })
  experienceYears: string;

  @Column({ default: '' })
  targetRole: string;

  @Column({ default: 'Normal' })
  difficulty: string;

  @Column({ type: 'int', default: 0 })
  questionIndex: number;

  @Column({ type: 'jsonb', nullable: true })
  questions?: PanelQuestion[];

  @Column({ type: 'jsonb', nullable: true })
  answers?: PanelAnswer[];

  @Column({ nullable: true })
  pendingFollowUpFor?: string;

  @Column({ type: 'jsonb', nullable: true })
  finalReport?: PanelFinalReport;

  @Column({ nullable: true })
  startedAt?: Date;

  @Column({ nullable: true })
  completedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
