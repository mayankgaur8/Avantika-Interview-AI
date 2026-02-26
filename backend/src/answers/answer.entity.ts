import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { InterviewSession } from '../interviews/interview-session.entity';
import { Question } from '../questions/question.entity';

export enum AnswerStatus {
  PENDING = 'pending',
  EVALUATING = 'evaluating',
  EVALUATED = 'evaluated',
  SKIPPED = 'skipped',
  TIMED_OUT = 'timed_out',
}

@Entity('answers')
export class Answer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sessionId: string;

  @ManyToOne(() => InterviewSession, (session) => session.answers)
  @JoinColumn({ name: 'sessionId' })
  session: InterviewSession;

  @Column()
  questionId: string;

  @ManyToOne(() => Question, (question) => question.answers)
  @JoinColumn({ name: 'questionId' })
  question: Question;

  /** Raw submitted text / code / selected option id */
  @Column('text', { nullable: true })
  submittedText?: string;

  /** For MCQ: selected option ids */
  @Column({ type: 'jsonb', nullable: true })
  selectedOptionIds?: string[];

  /** For coding: language chosen */
  @Column({ nullable: true })
  programmingLanguage?: string;

  /** Time taken to answer in seconds */
  @Column({ type: 'int', nullable: true })
  timeTakenSeconds?: number;

  @Column({ type: 'enum', enum: AnswerStatus, default: AnswerStatus.PENDING })
  status: AnswerStatus;

  /** Score awarded */
  @Column({ type: 'float', nullable: true })
  score?: number;

  /** Max possible for this question */
  @Column({ type: 'float', nullable: true })
  maxScore?: number;

  /** Detailed evaluation result */
  @Column({ type: 'jsonb', nullable: true })
  evaluationResult?: {
    passed?: boolean;
    testCasesPassed?: number;
    testCasesTotal?: number;
    rubricScores?: Array<{
      criterion: string;
      score: number;
      maxPoints: number;
      feedback: string;
    }>;
    aiFeedback?: string;
    executionTimeMs?: number;
    memoryUsedMb?: number;
    compileError?: string;
    runtimeError?: string;
  };

  @Column({ nullable: true })
  evaluatedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
