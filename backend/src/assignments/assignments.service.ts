import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AssignmentAiService } from './assignment-ai.service';
import { GenerateAssignmentDto } from './dto/generate-assignment.dto';
import { AssignmentData, AssignmentQuestion } from './assignments.types';

type PartialAssignmentData = Partial<AssignmentData> & {
  questions?: Array<Partial<AssignmentQuestion>>;
};

@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name);

  constructor(private readonly assignmentAiService: AssignmentAiService) {}

  async generateAssignment(payload: GenerateAssignmentDto): Promise<AssignmentData> {
    try {
      const rawText = await this.assignmentAiService.generateAssignmentText(payload);
      const parsed = this.parseAiOutput(rawText);
      return this.normalizeAssignment(parsed, payload);
    } catch (error) {
      this.logger.error('Assignment generation failed', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        'Could not generate assignment. Please check inputs and try again.',
      );
    }
  }

  private parseAiOutput(rawText: string): PartialAssignmentData {
    const cleaned = rawText.trim();

    try {
      return JSON.parse(cleaned) as PartialAssignmentData;
    } catch {
      const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch?.[1]) {
        try {
          return JSON.parse(fenceMatch[1]) as PartialAssignmentData;
        } catch {
          // Continue to object extraction.
        }
      }

      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        const candidate = cleaned.slice(firstBrace, lastBrace + 1);
        try {
          return JSON.parse(candidate) as PartialAssignmentData;
        } catch {
          throw new BadRequestException(
            'AI returned an invalid assignment format. Please retry.',
          );
        }
      }

      throw new BadRequestException(
        'AI returned non-JSON content. Please retry.',
      );
    }
  }

  private normalizeAssignment(
    parsed: PartialAssignmentData,
    payload: GenerateAssignmentDto,
  ): AssignmentData {
    const requestedQuestions = payload.questions;
    const defaultMarks = Math.max(1, Math.floor(payload.marks / requestedQuestions));

    const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
    const normalizedQuestions = rawQuestions
      .slice(0, requestedQuestions)
      .map((q, index) => ({
        question: (q.question ?? '').toString().trim(),
        marks:
          typeof q.marks === 'number' && Number.isFinite(q.marks) && q.marks > 0
            ? q.marks
            : defaultMarks,
        answerGuideline: (q.answerGuideline ?? '').toString().trim(),
        index,
      }))
      .filter((q) => q.question.length > 0)
      .map(({ index: _index, ...rest }) => rest);

    while (normalizedQuestions.length < requestedQuestions) {
      const currentIndex = normalizedQuestions.length + 1;
      normalizedQuestions.push({
        question: `Explain ${payload.topic} (${payload.subject}) question ${currentIndex}.`,
        marks: defaultMarks,
        answerGuideline: 'Provide a clear and well-structured answer with examples.',
      });
    }

    const title =
      (parsed.title ?? '').toString().trim() ||
      `${payload.subject} Assignment: ${payload.topic}`;
    const instructions =
      (parsed.instructions ?? '').toString().trim() ||
      payload.instructions?.trim() ||
      'Answer all questions clearly. Show working where needed.';

    return {
      title,
      instructions,
      questions: normalizedQuestions,
    };
  }
}
