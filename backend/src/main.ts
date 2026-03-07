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

  const port = process.env.PORT || config.get<number>('port') || 3001;
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 AI Interview Bot API running on port ${port}`);
  logger.log(`📚 Swagger UI: /api/docs`);
}

void bootstrap();
