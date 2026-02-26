import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { InterviewsService } from './interviews.service';
import { InterviewsController } from './interviews.controller';
import { InterviewSession } from './interview-session.entity';
import { InterviewTemplate } from './interview-template.entity';
import { Question } from '../questions/question.entity';
import { Answer } from '../answers/answer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InterviewSession,
      InterviewTemplate,
      Question,
      Answer,
    ]),
    BullModule.registerQueue({ name: 'evaluation' }),
    BullModule.registerQueue({ name: 'reports' }),
  ],
  providers: [InterviewsService],
  controllers: [InterviewsController],
  exports: [InterviewsService],
})
export class InterviewsModule {}
