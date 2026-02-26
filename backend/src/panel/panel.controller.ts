import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { PanelService } from './panel.service';
import { User } from '../users/user.entity';

interface RequestWithUser extends Request {
  user: User;
}

class CreatePanelSessionDto {
  @ApiProperty({ example: 'Java', description: 'Interview track e.g. Java, Spring Boot, React, SQL' })
  @IsString()
  track: string;

  @ApiProperty({ example: '5+', description: 'Years of experience e.g. 3+, 5+, 10+' })
  @IsString()
  experienceYears: string;

  @ApiProperty({ example: 'Backend Engineer', description: 'Target role' })
  @IsString()
  targetRole: string;

  @ApiProperty({ enum: ['Normal', 'Hard'], default: 'Normal' })
  @IsEnum(['Normal', 'Hard'])
  difficulty: 'Normal' | 'Hard';
}

class SubmitPanelAnswerDto {
  @ApiProperty()
  @IsUUID()
  questionId: string;

  @ApiProperty({ example: 'My answer here...' })
  @IsString()
  answer: string;

  @ApiPropertyOptional({ example: 'javascript', description: 'For coding questions' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ description: 'true when submitting a follow-up answer' })
  @IsOptional()
  @IsBoolean()
  isFollowUp?: boolean;
}

@ApiTags('Panel Interview')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('panel')
export class PanelController {
  constructor(private readonly panelService: PanelService) {}

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new panel interview session (setup phase)' })
  createSession(
    @Body() dto: CreatePanelSessionDto,
    @Request() req: RequestWithUser,
  ) {
    return this.panelService.createSession(req.user.id, dto);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List all panel sessions for the current user' })
  listSessions(@Request() req: RequestWithUser) {
    return this.panelService.listSessions(req.user.id);
  }

  @Get('sessions/:id/question')
  @ApiOperation({ summary: 'Get the current question for a panel session' })
  getCurrentQuestion(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.panelService.getCurrentQuestion(id, req.user.id);
  }

  @Post('sessions/:id/answer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit an answer (or follow-up answer) for the current question' })
  submitAnswer(
    @Param('id') id: string,
    @Body() dto: SubmitPanelAnswerDto,
    @Request() req: RequestWithUser,
  ) {
    return this.panelService.submitAnswer(id, req.user.id, dto);
  }

  @Get('sessions/:id/report')
  @ApiOperation({ summary: 'Get the final panel report (only available after completion)' })
  getReport(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.panelService.getReport(id, req.user.id);
  }

  @Patch('sessions/:id/skip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Skip the current question (score 0) and advance to next' })
  skipQuestion(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.panelService.skipQuestion(id, req.user.id);
  }

  @Patch('sessions/:id/abandon')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exit the interview early — generates partial report and sends it by email' })
  abandonInterview(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.panelService.abandonInterview(id, req.user.id);
  }
}
