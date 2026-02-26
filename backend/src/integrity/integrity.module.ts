import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrityService } from './integrity.service';
import { IntegrityController } from './integrity.controller';
import { IntegrityEvent } from './integrity-event.entity';
import { InterviewSession } from '../interviews/interview-session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([IntegrityEvent, InterviewSession])],
  providers: [IntegrityService],
  controllers: [IntegrityController],
  exports: [IntegrityService],
})
export class IntegrityModule {}
