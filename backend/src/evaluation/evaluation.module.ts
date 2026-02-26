import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { EvaluationWorker } from './evaluation.worker';
import { SandboxService } from './sandbox.service';
import { AiEvaluatorService } from './ai-evaluator.service';
import { Answer } from '../answers/answer.entity';
import { Question } from '../questions/question.entity';
import { InterviewSession } from '../interviews/interview-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Answer, Question, InterviewSession]),
    BullModule.registerQueue({ name: 'evaluation' }),
  ],
  providers: [EvaluationWorker, SandboxService, AiEvaluatorService],
  exports: [AiEvaluatorService, SandboxService],
})
export class EvaluationModule {}
