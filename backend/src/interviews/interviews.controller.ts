import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { InterviewsService } from './interviews.service';
import {
  StartInterviewDto,
  SubmitAnswerDto,
  CreateTemplateDto,
} from './dto/interview.dto';
import { User } from '../users/user.entity';

interface RequestWithUser extends Request {
  user: User;
}

@ApiTags('Interviews')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('interviews')
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  // ── Templates ──────────────────────────────────

  @Get('templates')
  @ApiOperation({ summary: 'List all active interview templates' })
  getTemplates() {
    return this.interviewsService.getTemplates();
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Get a specific template with questions' })
  getTemplate(@Param('id') id: string) {
    return this.interviewsService.getTemplateById(id);
  }

  @Post('templates')
  @ApiOperation({
    summary: 'Create a new interview template (recruiter/admin)',
  })
  @ApiResponse({
    status: 201,
    description: 'Template created',
    schema: {
      example: {
        id: 'uuid',
        name: 'Senior React Engineer Interview',
        role: 'React',
        difficulty: 'senior',
        sectionConfig: {
          mcq: { count: 10, weight: 30 },
          coding: { count: 3, weight: 50 },
          behavioral: { count: 2, weight: 20 },
        },
        timeLimitMinutes: 90,
        passingScorePercent: 70,
      },
    },
  })
  createTemplate(
    @Body() dto: CreateTemplateDto,
    @Request() req: RequestWithUser,
  ) {
    return this.interviewsService.createTemplate(dto, req.user.id);
  }

  // ── Sessions ───────────────────────────────────

  @Get('sessions')
  @ApiOperation({ summary: 'List all sessions for the current candidate' })
  getMySessions(@Request() req: RequestWithUser) {
    return this.interviewsService.listSessions(req.user.id);
  }

  @Post('sessions/start')
  @ApiOperation({ summary: 'Start or resume an interview session' })
  @ApiResponse({
    status: 201,
    description: 'Interview session started',
    schema: {
      example: {
        id: 'session-uuid',
        status: 'in_progress',
        interviewType: 'mixed',
        timeLimitMinutes: 90,
        startedAt: '2026-02-26T10:00:00.000Z',
      },
    },
  })
  startSession(
    @Body() dto: StartInterviewDto,
    @Request() req: RequestWithUser,
  ) {
    return this.interviewsService.startSession(dto, req.user);
  }

  @Get('sessions/:id/next-question')
  @ApiOperation({ summary: 'Get next adaptive question for the session' })
  @ApiResponse({
    status: 200,
    description: 'Next question with time remaining',
    schema: {
      example: {
        question: {
          id: 'q-uuid',
          type: 'mcq',
          difficulty: 'medium',
          content: 'What is the Virtual DOM in React?',
          options: [
            {
              id: 'o1',
              text: 'A lightweight copy of the real DOM',
              isCorrect: false,
            },
            { id: 'o2', text: 'A browser API', isCorrect: false },
          ],
        },
        index: 3,
        total: 15,
        timeRemainingSeconds: 3240,
      },
    },
  })
  getNextQuestion(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.interviewsService.getNextQuestion(id, req.user.id);
  }

  @Post('sessions/:id/submit-answer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit an answer for the current question' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        answerId: 'answer-uuid',
        nextAvailable: true,
      },
    },
  })
  submitAnswer(
    @Param('id') id: string,
    @Body() dto: SubmitAnswerDto,
    @Request() req: RequestWithUser,
  ) {
    return this.interviewsService.submitAnswer(id, dto, req.user.id);
  }

  @Patch('sessions/:id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark session as complete and trigger report generation',
  })
  completeSession(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.interviewsService.completeSession(id, req.user.id);
  }

  @Get('sessions/:id/result')
  @ApiOperation({
    summary: 'Get session result and scores (candidate + recruiter)',
  })
  getResult(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.interviewsService.getSessionResult(id, req.user.id);
  }
}
