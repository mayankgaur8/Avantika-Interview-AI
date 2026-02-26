import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface RubricCriterion {
  criterion: string;
  maxPoints: number;
  description: string;
  keywords?: string[];
}

export interface RubricScore {
  criterion: string;
  score: number;
  maxPoints: number;
  feedback: string;
}

@Injectable()
export class AiEvaluatorService {
  private readonly logger = new Logger(AiEvaluatorService.name);
  private readonly openai: OpenAI;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('openai.apiKey') ?? '',
    });
    this.model = this.configService.get<string>('openai.model') ?? 'gpt-4o';
  }

  async scoreWithRubric(
    questionText: string,
    candidateAnswer: string,
    rubric: RubricCriterion[],
  ): Promise<RubricScore[]> {
    if (!rubric.length) {
      return this.genericScore(questionText, candidateAnswer);
    }

    const rubricText = rubric
      .map(
        (r, i) =>
          `${i + 1}. **${r.criterion}** (max ${r.maxPoints} pts): ${r.description}` +
          (r.keywords?.length ? ` [Keywords: ${r.keywords.join(', ')}]` : ''),
      )
      .join('\n');

    const prompt = `You are a senior technical interviewer. Evaluate the candidate's answer strictly against the rubric below.

**Question:** ${questionText}

**Rubric:**
${rubricText}

**Candidate's Answer:**
${candidateAnswer}

Respond ONLY with a valid JSON array matching this schema, nothing else:
[
  {
    "criterion": "string",
    "score": number,
    "maxPoints": number,
    "feedback": "one sentence of constructive feedback"
  }
]

Be objective. Award partial credit where justified. Do not award more than maxPoints per criterion.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content ?? '[]';
      const parsed = JSON.parse(content) as
        | RubricScore[]
        | { scores?: RubricScore[]; results?: RubricScore[] };
      return Array.isArray(parsed)
        ? parsed
        : ((parsed as { scores?: RubricScore[]; results?: RubricScore[] })
            .scores ??
            (parsed as { scores?: RubricScore[]; results?: RubricScore[] })
              .results ??
            []);
    } catch (err) {
      this.logger.error('AI evaluation failed', err);
      // Fallback: award 50% for each criterion
      return rubric.map((r) => ({
        criterion: r.criterion,
        score: r.maxPoints * 0.5,
        maxPoints: r.maxPoints,
        feedback: 'Automated evaluation unavailable. Score estimated.',
      }));
    }
  }

  private async genericScore(
    questionText: string,
    candidateAnswer: string,
  ): Promise<RubricScore[]> {
    const prompt = `Score this interview answer on a scale of 0-10 for: clarity, correctness, depth.
Question: ${questionText}
Answer: ${candidateAnswer}
Respond as JSON: {"criterion":"Overall","score":number,"maxPoints":10,"feedback":"string"}`;
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 300,
      });
      const parsed = JSON.parse(
        response.choices[0]?.message?.content ?? '{}',
      ) as RubricScore;
      return [parsed];
    } catch {
      return [
        {
          criterion: 'Overall',
          score: 5,
          maxPoints: 10,
          feedback: 'Score estimated.',
        },
      ];
    }
  }
}
