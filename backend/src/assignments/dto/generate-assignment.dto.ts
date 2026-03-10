import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class GenerateAssignmentDto {
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  topic!: string;

  @IsString()
  @IsNotEmpty()
  grade!: string;

  @IsString()
  @IsNotEmpty()
  difficulty!: string;

  @IsInt()
  @Min(1)
  @Max(50)
  questions!: number;

  @IsInt()
  @Min(1)
  @Max(500)
  marks!: number;

  @IsOptional()
  @IsString()
  instructions?: string;
}
