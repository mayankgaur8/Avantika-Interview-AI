import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { InterviewTemplate } from './interview-template.entity';
import { Answer } from '../answers/answer.entity';
import { IntegrityEvent } from '../integrity/integrity-event.entity';

export enum SessionStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
  FLAGGED = 'flagged',
}

export enum InterviewType {
  MCQ = 'mcq',
  CODING = 'coding',
  BEHAVIORAL = 'behavioral',
  SYSTEM_DESIGN = 'system_design',
  MIXED = 'mixed',
}

@Entity('interview_sessions')
export class InterviewSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  candidateId: string;

  @ManyToOne(() => User, (user) => user.sessions)
  @JoinColumn({ name: 'candidateId' })
  candidate: User;

  @Column()
  templateId: string;

  @ManyToOne(() => InterviewTemplate)
  @JoinColumn({ name: 'templateId' })
  template: InterviewTemplate;

  @Column({
    type: 'enum',
    enum: SessionStatus,
    default: SessionStatus.SCHEDULED,
  })
  status: SessionStatus;

  @Column({ type: 'enum', enum: InterviewType })
  interviewType: InterviewType;

  @Column({ nullable: true })
  scheduledAt?: Date;

  @Column({ nullable: true })
  startedAt?: Date;

  @Column({ nullable: true })
  completedAt?: Date;

  @Column({ type: 'int', nullable: true })
  durationSeconds?: number;

  @Column({ type: 'int', default: 60 })
  timeLimitMinutes: number;

  @Column({ type: 'float', nullable: true })
  totalScore?: number;

  @Column({ type: 'float', nullable: true })
  maxPossibleScore?: number;

  @Column({ type: 'float', nullable: true })
  percentageScore?: number;

  @Column({ type: 'int', default: 0 })
  currentQuestionIndex: number;

  @Column({ type: 'int', default: 0 })
  tabSwitchCount: number;

  @Column({ type: 'int', default: 0 })
  copyPasteCount: number;

  @Column({ type: 'boolean', default: false })
  isIntegrityFlagged: boolean;

  @Column({ type: 'jsonb', nullable: true })
  adaptiveState?: Record<string, unknown>;

  @Column({ nullable: true })
  reportUrl?: string;

  @Column({ nullable: true })
  invitedByRecruiterId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Answer, (answer) => answer.session)
  answers: Answer[];

  @OneToMany(() => IntegrityEvent, (event) => event.session)
  integrityEvents: IntegrityEvent[];
}
