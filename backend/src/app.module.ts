import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { getDatabaseConfig } from './config/database.config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { InterviewsModule } from './interviews/interviews.module';
import { EvaluationModule } from './evaluation/evaluation.module';
import { ReportsModule } from './reports/reports.module';
import { IntegrityModule } from './integrity/integrity.module';
import { PanelModule } from './panel/panel.module';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),

    // Rate Limiting
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        throttlers: [
          {
            ttl: cfg.get<number>('rateLimit.windowMs') ?? 60000,
            limit: cfg.get<number>('rateLimit.max') ?? 100,
          },
        ],
      }),
    }),

    // Database
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),

    // Redis / BullMQ
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        redis: {
          host: cfg.get<string>('redis.host') ?? 'localhost',
          port: cfg.get<number>('redis.port') ?? 6379,
          password: cfg.get<string>('redis.password'),
        },
      }),
    }),

    // Feature modules
    AuthModule,
    UsersModule,
    InterviewsModule,
    EvaluationModule,
    ReportsModule,
    IntegrityModule,
    PanelModule,
  ],
})
export class AppModule {}
