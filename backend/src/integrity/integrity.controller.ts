import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { IntegrityService } from './integrity.service';
import { RecordIntegrityEventDto } from './dto/integrity.dto';

@ApiTags('Integrity')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('interviews/sessions/:sessionId/integrity')
export class IntegrityController {
  constructor(private readonly integrityService: IntegrityService) {}

  @Post()
  @ApiOperation({
    summary: 'Record an integrity signal event from the frontend',
  })
  @ApiResponse({
    status: 201,
    description: 'Event recorded',
    schema: {
      example: {
        id: 'evt-uuid',
        eventType: 'tab_switch',
        severity: 'medium',
        occurredAt: '2026-02-26T10:05:30.000Z',
      },
    },
  })
  recordEvent(
    @Param('sessionId') sessionId: string,
    @Body() dto: RecordIntegrityEventDto,
  ) {
    return this.integrityService.recordEvent(sessionId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List all integrity events for a session (recruiter)',
  })
  getEvents(@Param('sessionId') sessionId: string) {
    return this.integrityService.getEventsForSession(sessionId);
  }
}
