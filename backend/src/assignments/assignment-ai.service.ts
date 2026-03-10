import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { GenerateAssignmentDto } from './dto/generate-assignment.dto';

@Injectable()
export class AssignmentAiService {
  private readonly logger = new Logger(AssignmentAiService.name);
  private readonly openai: OpenAI | null;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('openai.apiKey') ?? '';
    this.openai = apiKey ? new OpenAI({ apiKey }) : null;
    if (!this.openai) {
      this.logger.warn(
        'OPENAI_API_KEY is not configured. Assignment generation is unavailable.',
      );
    }
    this.model = this.configService.get<string>('openai.model') ?? 'gpt-4.1-mini';
  }

  async generateAssignmentText(payload: GenerateAssignmentDto): Promise<string> {
    if (!this.openai) {
      throw new ServiceUnavailableException(
        'AI provider is not configured. Please set OPENAI_API_KEY.',
      );
    }

    const prompt = `
Create a school assignment in JSON format.

Subject: ${payload.subject}
Topic: ${payload.topic}
Grade: ${payload.grade}
Difficulty: ${payload.difficulty}
Number of questions: ${payload.questions}
Total marks: ${payload.marks}
Special instructions: ${payload.instructions ?? 'None'}

Return valid JSON with this exact structure:
{
  "title": "string",
  "instructions": "string",
  "questions": [
    {
      "question": "string",
      "marks": number,
      "answerGuideline": "string"
    }
  ]
}
`;

    try {
      const response = await this.openai.responses.create({
        model: this.model,
        input: prompt,
      });

      const outputText = response.output_text?.trim();
      if (!outputText) {
        throw new Error('OpenAI returned empty output');
      }

      return outputText;
    } catch (error) {
      this.logger.error('OpenAI assignment generation failed', error);
      throw new ServiceUnavailableException(
        'Unable to generate assignment from AI provider right now.',
      );
    }
  }
}
