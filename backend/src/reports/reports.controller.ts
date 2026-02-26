import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request,
  Patch,
  Body,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './report.entity';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

class UpdateReportNotesDto {
  @ApiPropertyOptional() @IsOptional() @IsString() recruiterNotes?: string;
}

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('reports')
export class ReportsController {
  constructor(
    @InjectRepository(Report)
    private readonly reportsRepo: Repository<Report>,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get a generated interview report' })
  async getReport(@Param('id') id: string) {
    return this.reportsRepo.findOne({
      where: { id },
      relations: ['session', 'session.candidate'],
    });
  }

  @Get('session/:sessionId')
  @ApiOperation({ summary: 'Get report by session ID' })
  async getReportBySession(@Param('sessionId') sessionId: string) {
    return this.reportsRepo.findOne({ where: { sessionId } });
  }

  @Patch(':id/notes')
  @ApiOperation({ summary: 'Add recruiter notes to a report' })
  async addNotes(@Param('id') id: string, @Body() dto: UpdateReportNotesDto) {
    await this.reportsRepo.update(id, { recruiterNotes: dto.recruiterNotes });
    return this.reportsRepo.findOne({ where: { id } });
  }
}
