import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ReportsWorker } from './reports.worker';
import { ReportsController } from './reports.controller';
import { Report } from './report.entity';
import { InterviewSession } from '../interviews/interview-session.entity';
import { Answer } from '../answers/answer.entity';
import { IntegrityEvent } from '../integrity/integrity-event.entity';
import { EvaluationModule } from '../evaluation/evaluation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Report,
      InterviewSession,
      Answer,
      IntegrityEvent,
    ]),
    BullModule.registerQueue({ name: 'reports' }),
    EvaluationModule,
  ],
  providers: [ReportsWorker],
  controllers: [ReportsController],
  exports: [],
})
export class ReportsModule {}
