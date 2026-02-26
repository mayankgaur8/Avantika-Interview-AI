import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { InterviewType } from '../interview-session.entity';

class SectionConfigItemDto {
  @ApiProperty() @IsInt() @Min(0) count: number;
  @ApiProperty() @IsInt() @Min(0) @Max(100) weight: number;
}

class SectionConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => SectionConfigItemDto)
  mcq?: SectionConfigItemDto;
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => SectionConfigItemDto)
  coding?: SectionConfigItemDto;
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => SectionConfigItemDto)
  behavioral?: SectionConfigItemDto;
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => SectionConfigItemDto)
  systemDesign?: SectionConfigItemDto;
}

export class CreateTemplateDto {
  @ApiProperty({ example: 'Senior React Engineer Interview' })
  @IsString()
  name: string;

  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiProperty({ example: 'React' }) @IsString() role: string;

  @ApiPropertyOptional({ example: 'senior' })
  @IsOptional()
  @IsString()
  difficulty?: string;

  @ApiProperty({ type: SectionConfigDto })
  @IsObject()
  @ValidateNested()
  @Type(() => SectionConfigDto)
  sectionConfig: SectionConfigDto;

  @ApiPropertyOptional({ default: 60 })
  @IsOptional()
  @IsInt()
  timeLimitMinutes?: number;
  @ApiPropertyOptional({ default: 70 })
  @IsOptional()
  @IsInt()
  passingScorePercent?: number;
}

export class StartInterviewDto {
  @ApiProperty() @IsUUID() templateId: string;
  @ApiPropertyOptional({ enum: InterviewType })
  @IsOptional()
  @IsEnum(InterviewType)
  interviewType?: InterviewType;
}

export class SubmitAnswerDto {
  @ApiProperty() @IsUUID() questionId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() submittedText?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  selectedOptionIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() programmingLanguage?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() timeTakenSeconds?: number;
}
