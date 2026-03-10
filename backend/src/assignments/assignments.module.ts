import { Module } from '@nestjs/common';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { AssignmentAiService } from './assignment-ai.service';

@Module({
  controllers: [AssignmentsController],
  providers: [AssignmentsService, AssignmentAiService],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
