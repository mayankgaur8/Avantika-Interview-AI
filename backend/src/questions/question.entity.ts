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
import { InterviewTemplate } from '../interviews/interview-template.entity';
import { Answer } from '../answers/answer.entity';

export enum QuestionType {
  MCQ = 'mcq',
  CODING = 'coding',
  BEHAVIORAL = 'behavioral',
  SYSTEM_DESIGN = 'system_design',
}

export enum QuestionDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

@Entity('questions')
export class Question {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  templateId: string;

  @ManyToOne(() => InterviewTemplate, (template) => template.questions)
  @JoinColumn({ name: 'templateId' })
  template: InterviewTemplate;

  @Column({ type: 'enum', enum: QuestionType })
  type: QuestionType;

  @Column({
    type: 'enum',
    enum: QuestionDifficulty,
    default: QuestionDifficulty.MEDIUM,
  })
  difficulty: QuestionDifficulty;

  @Column('text')
  content: string;

  /** For MCQ: array of {id, text, isCorrect} */
  @Column({ type: 'jsonb', nullable: true })
  options?: Array<{ id: string; text: string; isCorrect: boolean }>;

  /** For MCQ: correct option ids */
  @Column({ type: 'jsonb', nullable: true })
  correctAnswerIds?: string[];

  /** For coding questions: language constraints */
  @Column({ type: 'jsonb', nullable: true })
  codingConfig?: {
    allowedLanguages: string[];
    starterCode?: Record<string, string>;
    testCases: Array<{
      input: string;
      expectedOutput: string;
      isPublic: boolean;
    }>;
    timeoutMs?: number;
    memoryLimitMb?: number;
  };

  /** Rubric for behavioral/system design scoring */
  @Column({ type: 'jsonb', nullable: true })
  rubric?: Array<{
    criterion: string;
    maxPoints: number;
    description: string;
    keywords?: string[];
  }>;

  @Column({ type: 'float', default: 1.0 })
  maxScore: number;

  @Column({ type: 'int', default: 0 })
  orderIndex: number;

  @Column({ default: true })
  isActive: boolean;

  /** Tags for adaptive selection: topic, skill area */
  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Answer, (answer) => answer.question)
  answers: Answer[];
}
