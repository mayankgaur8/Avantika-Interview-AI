import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { InterviewSession } from '../interviews/interview-session.entity';

export enum IntegrityEventType {
  TAB_SWITCH = 'tab_switch',
  WINDOW_BLUR = 'window_blur',
  COPY_PASTE = 'copy_paste',
  DEVTOOLS_OPEN = 'devtools_open',
  TIME_ANOMALY = 'time_anomaly',
  RAPID_ANSWER = 'rapid_answer',
  INACTIVITY = 'inactivity',
  SCREENSHOT_ATTEMPT = 'screenshot_attempt',
}

export enum IntegritySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

@Entity('integrity_events')
export class IntegrityEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sessionId: string;

  @ManyToOne(() => InterviewSession, (session) => session.integrityEvents)
  @JoinColumn({ name: 'sessionId' })
  session: InterviewSession;

  @Column({ type: 'enum', enum: IntegrityEventType })
  eventType: IntegrityEventType;

  @Column({
    type: 'enum',
    enum: IntegritySeverity,
    default: IntegritySeverity.LOW,
  })
  severity: IntegritySeverity;

  @Column({ nullable: true })
  questionId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  occurredAt: Date;
}
