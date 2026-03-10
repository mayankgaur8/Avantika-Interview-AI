import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AssignmentsService } from './assignments.service';
import { GenerateAssignmentDto } from './dto/generate-assignment.dto';

@ApiTags('Assignments')
@Controller('assignment')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Generate assignment using AI' })
  @ApiResponse({
    status: 201,
    description: 'Assignment generated successfully',
    schema: {
      example: {
        success: true,
        data: {
          title: 'Mathematics Assignment: Quadratic Equations',
          instructions: 'Answer all questions clearly.',
          questions: [
            {
              question: 'Solve x^2 - 5x + 6 = 0',
              marks: 5,
              answerGuideline: 'Factorize and show both roots.',
            },
          ],
        },
      },
    },
  })
  async generate(@Body() dto: GenerateAssignmentDto) {
    try {
      const data = await this.assignmentsService.generateAssignment(dto);
      return { success: true, data };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Failed to generate assignment. Please try again.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
