import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Question } from '../questions/question.entity';

export enum TemplateDifficulty {
  JUNIOR = 'junior',
  MID = 'mid',
  SENIOR = 'senior',
  STAFF = 'staff',
}

@Entity('interview_templates')
export class InterviewTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  /** e.g. Java, React, Kafka, SQL, System Design, Behavioral */
  @Column()
  role: string;

  @Column({
    type: 'enum',
    enum: TemplateDifficulty,
    default: TemplateDifficulty.MID,
  })
  difficulty: TemplateDifficulty;

  @Column({ type: 'jsonb' })
  sectionConfig: {
    mcq?: { count: number; weight: number };
    coding?: { count: number; weight: number };
    behavioral?: { count: number; weight: number };
    systemDesign?: { count: number; weight: number };
  };

  @Column({ type: 'int', default: 60 })
  timeLimitMinutes: number;

  @Column({ type: 'int', default: 70 })
  passingScorePercent: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  createdById?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Question, (question) => question.template)
  questions: Question[];
}
