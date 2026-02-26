import { IsEnum, IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IntegrityEventType } from '../integrity-event.entity';

export class RecordIntegrityEventDto {
  @ApiProperty({ enum: IntegrityEventType })
  @IsEnum(IntegrityEventType)
  eventType: IntegrityEventType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  questionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
