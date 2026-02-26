/**
 * Seed script: populates initial interview templates and sample questions.
 * Run with: npx ts-node src/database/seed.ts
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import {
  InterviewTemplate,
  TemplateDifficulty,
} from '../interviews/interview-template.entity';
import {
  Question,
  QuestionType,
  QuestionDifficulty,
} from '../questions/question.entity';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432'),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'ai_interview_bot',
  entities: [InterviewTemplate, Question],
  synchronize: true,
});

const TEMPLATES = [
  {
    name: 'Senior React Engineer Interview',
    role: 'React',
    difficulty: TemplateDifficulty.SENIOR,
    timeLimitMinutes: 90,
    passingScorePercent: 70,
    sectionConfig: {
      mcq: { count: 10, weight: 30 },
      coding: { count: 3, weight: 50 },
      behavioral: { count: 2, weight: 20 },
    },
    questions: [
      {
        type: QuestionType.MCQ,
        difficulty: QuestionDifficulty.MEDIUM,
        content: 'What is the primary purpose of the Virtual DOM in React?',
        maxScore: 1,
        orderIndex: 0,
        options: [
          {
            id: 'a',
            text: 'To directly manipulate browser DOM for speed',
            isCorrect: false,
          },
          {
            id: 'b',
            text: 'To batch and minimize actual DOM updates by diffing',
            isCorrect: true,
          },
          {
            id: 'c',
            text: 'To replace CSS styling with JavaScript',
            isCorrect: false,
          },
          {
            id: 'd',
            text: 'To enable server-side rendering only',
            isCorrect: false,
          },
        ],
        correctAnswerIds: ['b'],
      },
      {
        type: QuestionType.MCQ,
        difficulty: QuestionDifficulty.MEDIUM,
        content:
          'Which hook should you use to memoize an expensive calculation?',
        maxScore: 1,
        orderIndex: 1,
        options: [
          { id: 'a', text: 'useCallback', isCorrect: false },
          { id: 'b', text: 'useEffect', isCorrect: false },
          { id: 'c', text: 'useMemo', isCorrect: true },
          { id: 'd', text: 'useRef', isCorrect: false },
        ],
        correctAnswerIds: ['c'],
      },
      {
        type: QuestionType.CODING,
        difficulty: QuestionDifficulty.MEDIUM,
        content:
          'Write a function `flatten(arr)` that takes a nested array of any depth and returns a flat array.\n\nExample: flatten([1, [2, [3, [4]], 5]]) => [1, 2, 3, 4, 5]',
        maxScore: 10,
        orderIndex: 10,
        codingConfig: {
          allowedLanguages: ['javascript', 'typescript', 'python'],
          starterCode: {
            javascript: 'function flatten(arr) {\n  // your solution here\n}',
            python: 'def flatten(arr):\n    # your solution here\n    pass',
          },
          testCases: [
            {
              input: '[1,[2,[3,[4]],5]]',
              expectedOutput: '[1,2,3,4,5]',
              isPublic: true,
            },
            {
              input: '[[1,2],[3,[4,5]]]',
              expectedOutput: '[1,2,3,4,5]',
              isPublic: false,
            },
            { input: '[1]', expectedOutput: '[1]', isPublic: false },
          ],
          timeoutMs: 5000,
          memoryLimitMb: 64,
        },
      },
      {
        type: QuestionType.BEHAVIORAL,
        difficulty: QuestionDifficulty.MEDIUM,
        content:
          'Describe a time you significantly improved the performance of a React application. What was the problem, what did you do, and what was the measured impact?',
        maxScore: 10,
        orderIndex: 13,
        rubric: [
          {
            criterion: 'Problem Clarity',
            maxPoints: 2,
            description:
              'Clearly describes the performance bottleneck and its business impact',
            keywords: ['profiling', 'bottleneck', 'slow', 'lag'],
          },
          {
            criterion: 'Technical Solution',
            maxPoints: 4,
            description:
              'Demonstrates depth: memoization, code splitting, virtualization, bundle analysis',
            keywords: [
              'useMemo',
              'lazy',
              'virtualization',
              'bundle',
              'React.memo',
            ],
          },
          {
            criterion: 'Measured Impact',
            maxPoints: 2,
            description: 'Quantifies improvement with metrics (LCP, TTI, FPS)',
            keywords: ['%', 'ms', 'seconds', 'LCP', 'lighthouse'],
          },
          {
            criterion: 'Communication',
            maxPoints: 2,
            description: 'Answer is structured, concise, and uses STAR format',
            keywords: [],
          },
        ],
      },
    ],
  },
  {
    name: 'Java Backend Developer Interview',
    role: 'Java',
    difficulty: TemplateDifficulty.MID,
    timeLimitMinutes: 75,
    passingScorePercent: 65,
    sectionConfig: {
      mcq: { count: 10, weight: 40 },
      coding: { count: 2, weight: 40 },
      behavioral: { count: 2, weight: 20 },
    },
    questions: [
      {
        type: QuestionType.MCQ,
        difficulty: QuestionDifficulty.MEDIUM,
        content:
          'Which Java collection provides O(1) average time complexity for get and put operations?',
        maxScore: 1,
        orderIndex: 0,
        options: [
          { id: 'a', text: 'TreeMap', isCorrect: false },
          { id: 'b', text: 'LinkedList', isCorrect: false },
          { id: 'c', text: 'HashMap', isCorrect: true },
          { id: 'd', text: 'PriorityQueue', isCorrect: false },
        ],
        correctAnswerIds: ['c'],
      },
      {
        type: QuestionType.CODING,
        difficulty: QuestionDifficulty.MEDIUM,
        content:
          'Write a method that finds the first non-repeating character in a string.\n\nExample: "leetcode" → "l", "aabb" → " " (none)',
        maxScore: 10,
        orderIndex: 10,
        codingConfig: {
          allowedLanguages: ['java', 'python', 'javascript'],
          testCases: [
            { input: 'leetcode', expectedOutput: 'l', isPublic: true },
            { input: 'aabb', expectedOutput: ' ', isPublic: false },
            { input: 'z', expectedOutput: 'z', isPublic: false },
          ],
          timeoutMs: 5000,
          memoryLimitMb: 128,
        },
      },
    ],
  },
  {
    name: 'System Design Interview',
    role: 'System Design',
    difficulty: TemplateDifficulty.SENIOR,
    timeLimitMinutes: 60,
    passingScorePercent: 70,
    sectionConfig: {
      systemDesign: { count: 2, weight: 100 },
    },
    questions: [
      {
        type: QuestionType.SYSTEM_DESIGN,
        difficulty: QuestionDifficulty.HARD,
        content:
          'Design a scalable URL shortening service (like bit.ly) that can handle 100M URLs shortened per day and 10B redirects per day. Cover: API design, storage schema, hashing strategy, caching layer, and how you handle hotspot URLs.',
        maxScore: 20,
        orderIndex: 0,
        rubric: [
          {
            criterion: 'Requirements Clarification',
            maxPoints: 2,
            description:
              'Asks about scale, latency, durability, analytics requirements',
            keywords: ['scale', 'QPS', 'latency', 'SLA'],
          },
          {
            criterion: 'API Design',
            maxPoints: 3,
            description:
              'Defines clear REST endpoints for shorten, redirect, and analytics',
            keywords: ['POST', 'GET', 'REST', 'endpoint'],
          },
          {
            criterion: 'Storage & Schema',
            maxPoints: 4,
            description:
              'Chooses appropriate DB (relational vs NoSQL), defines schema with key fields',
            keywords: ['schema', 'index', 'NoSQL', 'SQL', 'table'],
          },
          {
            criterion: 'Hashing Strategy',
            maxPoints: 4,
            description:
              'Discusses collision avoidance: base62, MD5 truncation, counter-based',
            keywords: ['hash', 'base62', 'collision', 'counter'],
          },
          {
            criterion: 'Caching',
            maxPoints: 4,
            description:
              'Redis / CDN for hot URLs, cache-aside or read-through strategy',
            keywords: ['Redis', 'cache', 'CDN', 'TTL', 'LRU'],
          },
          {
            criterion: 'Scalability & Trade-offs',
            maxPoints: 3,
            description: 'Horizontal scaling, CAP theorem awareness, sharding',
            keywords: [
              'shard',
              'replica',
              'CAP',
              'horizontal',
              'load balancer',
            ],
          },
        ],
      },
      {
        type: QuestionType.SYSTEM_DESIGN,
        difficulty: QuestionDifficulty.HARD,
        content:
          'Design a distributed message queue system similar to Apache Kafka. Explain producers, brokers, consumers, partitioning, replication, offset management, and consumer groups.',
        maxScore: 20,
        orderIndex: 1,
        rubric: [
          {
            criterion: 'Core Concepts',
            maxPoints: 4,
            description:
              'Accurately describes topics, partitions, offsets, and consumer groups',
            keywords: ['topic', 'partition', 'offset', 'consumer group'],
          },
          {
            criterion: 'Replication & Durability',
            maxPoints: 4,
            description:
              'Explains leader-follower replication, ISR, acknowledgement levels',
            keywords: ['replication', 'ISR', 'acks', 'leader', 'durability'],
          },
          {
            criterion: 'Scalability',
            maxPoints: 4,
            description:
              'Horizontal scaling via partitions, independent consumer scaling',
            keywords: ['scale', 'partition', 'throughput'],
          },
          {
            criterion: 'Delivery Guarantees',
            maxPoints: 4,
            description:
              'At-least-once vs exactly-once semantics, idempotent producers',
            keywords: [
              'exactly-once',
              'at-least-once',
              'idempotent',
              'transaction',
            ],
          },
          {
            criterion: 'Trade-offs',
            maxPoints: 4,
            description:
              'Discusses ordering guarantees per-partition, back-pressure, retention',
            keywords: ['ordering', 'retention', 'back-pressure'],
          },
        ],
      },
    ],
  },
  {
    name: 'SQL & Database Interview',
    role: 'SQL',
    difficulty: TemplateDifficulty.MID,
    timeLimitMinutes: 60,
    passingScorePercent: 65,
    sectionConfig: {
      mcq: { count: 8, weight: 40 },
      coding: { count: 3, weight: 60 },
    },
    questions: [
      {
        type: QuestionType.MCQ,
        difficulty: QuestionDifficulty.MEDIUM,
        content: 'What is the difference between INNER JOIN and LEFT JOIN?',
        maxScore: 1,
        orderIndex: 0,
        options: [
          {
            id: 'a',
            text: 'No difference, they are aliases',
            isCorrect: false,
          },
          {
            id: 'b',
            text: 'INNER JOIN returns only matched rows; LEFT JOIN returns all left rows plus matched right rows',
            isCorrect: true,
          },
          {
            id: 'c',
            text: 'LEFT JOIN is faster than INNER JOIN',
            isCorrect: false,
          },
          {
            id: 'd',
            text: 'INNER JOIN includes NULL values from both tables',
            isCorrect: false,
          },
        ],
        correctAnswerIds: ['b'],
      },
      {
        type: QuestionType.CODING,
        difficulty: QuestionDifficulty.MEDIUM,
        content:
          'Given tables:\n  employees(id, name, department_id, salary)\n  departments(id, name)\n\nWrite a SQL query to find the top 3 highest-paid employees in each department, along with their department name.',
        maxScore: 10,
        orderIndex: 8,
        codingConfig: {
          allowedLanguages: ['sql'],
          testCases: [
            {
              input: '',
              expectedOutput: 'department_name | employee_name | salary | rank',
              isPublic: true,
            },
          ],
          timeoutMs: 5000,
          memoryLimitMb: 64,
        },
      },
    ],
  },
];

async function seed() {
  await AppDataSource.initialize();
  console.log('📦 Connected to database, seeding...');

  const templateRepo = AppDataSource.getRepository(InterviewTemplate);
  const questionRepo = AppDataSource.getRepository(Question);

  for (const tmplData of TEMPLATES) {
    const { questions: qData, ...tmplFields } = tmplData;

    // Upsert template by name
    let template = await templateRepo.findOne({
      where: { name: tmplFields.name },
    });
    if (!template) {
      template = templateRepo.create(tmplFields as Partial<InterviewTemplate>);
      template = await templateRepo.save(template);
      console.log(`  ✅ Template created: ${template.name}`);
    } else {
      console.log(`  ⏭️  Template exists: ${template.name}`);
    }

    for (const q of qData) {
      const existing = await questionRepo.findOne({
        where: { templateId: template.id, content: q.content },
      });
      if (!existing) {
        const question = questionRepo.create({
          ...q,
          templateId: template.id,
        } as Partial<Question>);
        await questionRepo.save(question);
        console.log(`     ❓ Question seeded: ${q.content.slice(0, 50)}...`);
      }
    }
  }

  await AppDataSource.destroy();
  console.log('\n🎉 Seed complete!');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
