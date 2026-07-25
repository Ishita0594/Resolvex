import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import {
  buildDefaultRateLimitRules,
  createRateLimitMiddleware,
} from './common/security/rate-limit.middleware';
import { requestIdMiddleware } from './common/security/request-id.middleware';
import { secureHeadersMiddleware } from './common/security/secure-headers.middleware';

export function configureApp(app: INestApplication) {
  const configService = app.get(ConfigService);
  const allowedOrigins = configService.get<string[]>(
    'CORS_ALLOWED_ORIGINS',
    [],
  );

  app.use(requestIdMiddleware);
  app.use(secureHeadersMiddleware);
  app.enableCors({
    origin(
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
  });
  app.use(
    createRateLimitMiddleware(
      buildDefaultRateLimitRules({
        windowMs: configService.get<number>('RATE_LIMIT_WINDOW_MS', 60_000),
        authMax: configService.get<number>('AUTH_RATE_LIMIT_MAX', 100),
        uploadMax: configService.get<number>('UPLOAD_RATE_LIMIT_MAX', 120),
      }),
    ),
  );
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
      whitelist: true,
    }),
  );
}
