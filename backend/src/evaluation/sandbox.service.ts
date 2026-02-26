import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface SandboxRunOptions {
  code: string;
  language: string;
  stdin?: string;
  timeoutMs?: number;
  memoryLimitMb?: number;
}

export interface SandboxResult {
  stdout?: string;
  stderr?: string;
  compileError?: string;
  runtimeError?: string;
  executionTimeMs?: number;
  memoryUsedMb?: number;
  statusCode: number; // Judge0 status IDs
}

interface Judge0Response {
  stdout?: string;
  stderr?: string;
  compile_output?: string;
  time?: string;
  memory?: number;
  status?: { id: number; description: string };
}

/** Language ID mapping for Judge0 */
const JUDGE0_LANGUAGE_MAP: Record<string, number> = {
  javascript: 63,
  typescript: 74,
  python: 71,
  java: 62,
  cpp: 54,
  c: 50,
  go: 60,
  rust: 73,
  sql: 82,
};

/**
 * SandboxService wraps the Judge0 open-source code execution API.
 * Judge0 runs submitted code in isolated Docker containers.
 * Deploy Judge0 locally or use their cloud endpoint.
 */
@Injectable()
export class SandboxService {
  private readonly logger = new Logger(SandboxService.name);
  private readonly judge0Url: string;
  private readonly judge0ApiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.judge0Url =
      this.configService.get<string>('sandbox.judge0ApiUrl') ??
      'http://localhost:2358';
    this.judge0ApiKey =
      this.configService.get<string>('sandbox.judge0ApiKey') ?? '';
  }

  async runCode(options: SandboxRunOptions): Promise<SandboxResult> {
    const languageId =
      JUDGE0_LANGUAGE_MAP[options.language.toLowerCase()] ?? 63;

    try {
      const submitResponse = await axios.post(
        `${this.judge0Url}/submissions?base64_encoded=false&wait=true`,
        {
          language_id: languageId,
          source_code: options.code,
          stdin: options.stdin ?? '',
          cpu_time_limit: Math.floor((options.timeoutMs ?? 10000) / 1000),
          memory_limit: (options.memoryLimitMb ?? 128) * 1024, // KB
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': this.judge0ApiKey,
          },
          timeout: (options.timeoutMs ?? 10000) + 5000,
        },
      );

      const data = submitResponse.data as Judge0Response;
      const statusId: number = data.status?.id ?? 0;

      return {
        stdout: data.stdout,
        stderr: data.stderr,
        compileError: statusId === 6 ? data.compile_output : undefined,
        runtimeError: statusId >= 7 && statusId <= 12 ? data.stderr : undefined,
        executionTimeMs: data.time
          ? Math.floor(parseFloat(data.time) * 1000)
          : 0,
        memoryUsedMb: data.memory ? Math.floor(data.memory / 1024) : 0,
        statusCode: statusId,
      };
    } catch (err) {
      this.logger.error('Sandbox execution failed', err);
      return {
        runtimeError: 'Sandbox unavailable or timed out',
        statusCode: -1,
      };
    }
  }
}
