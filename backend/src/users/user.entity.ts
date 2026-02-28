import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { InterviewSession } from '../interviews/interview-session.entity';

export enum UserRole {
  CANDIDATE = 'candidate',
  RECRUITER = 'recruiter',
  ADMIN = 'admin',
}

export enum PlanTier {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CANDIDATE })
  role: UserRole;

  @Column({ nullable: true })
  company?: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'enum', enum: PlanTier, default: PlanTier.FREE })
  plan: PlanTier;

  @Column({ nullable: true, type: 'timestamptz' })
  planExpiresAt?: Date;

  @Column({ nullable: true })
  razorpayCustomerId?: string;

  @Column({ nullable: true })
  refreshTokenHash?: string;

  @Column({ nullable: true })
  resetToken?: string;

  @Column({ nullable: true, type: 'timestamptz' })
  resetTokenExpiry?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => InterviewSession, (session) => session.candidate)
  sessions: InterviewSession[];

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.passwordHash && !this.passwordHash.startsWith('$2b$')) {
      this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
    }
  }

  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.passwordHash);
  }
}
