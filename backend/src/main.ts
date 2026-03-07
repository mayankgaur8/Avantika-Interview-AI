import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, RequestMethod } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  const config = app.get(ConfigService);
  const server = app.getHttpAdapter().getInstance();

  // Security headers
  app.use(helmet());

  // CORS — support comma-separated list of allowed origins
  const corsOrigin = config.get<string>('cors.origin') ?? 'http://localhost:3000';
  const allowedOrigins = corsOrigin.split(',').map((o) => o.trim());
  app.enableCors({
    origin: (origin, callback) => {
      if (
        !origin ||
        /^http:\/\/localhost(:\d+)?$/.test(origin) ||
        allowedOrigins.includes(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Fallback liveness routes available even if controller wiring drifts.
  server.get('/', (_req: unknown, res: { send: (body: string) => void }) => {
    res.send('Avantika Interview API is running');
  });
  server.get('/health', (_req: unknown, res: { json: (body: object) => void }) => {
    res.json({ status: 'UP' });
  });

  // Global prefix
  app.setGlobalPrefix('api', {
    exclude: [
      { path: '', method: RequestMethod.GET },
      { path: 'health', method: RequestMethod.GET },
    ],
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('AI Interview Bot API')
    .setDescription(
      'REST API for the AI Interview Bot platform — sessions, questions, evaluation, reports, and integrity signals.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth')
    .addTag('Interviews')
    .addTag('Reports')
    .addTag('Integrity')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = Number(process.env.PORT) || config.get<number>('port') || 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`Application is running on port ${port}`);
  logger.log(`📚 Swagger UI: /api/docs`);
}

void bootstrap();
