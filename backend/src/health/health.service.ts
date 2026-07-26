import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_PROVIDER } from '../evidence/storage/storage.constants';
import { StorageProvider } from '../evidence/storage/storage-provider.interface';

type HealthCheck = {
  status: 'ok' | 'degraded';
  detail?: string;
};

export type HealthResponse = {
  status: 'ok' | 'degraded';
  checks: {
    application: HealthCheck;
    postgresql: HealthCheck;
    aiService: HealthCheck;
    storageProvider: HealthCheck;
  };
  timestamp: string;
};

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: StorageProvider,
  ) {}

  async check(): Promise<HealthResponse> {
    const checks = {
      application: { status: 'ok' as const },
      postgresql: await this.checkPostgres(),
      aiService: await this.checkAiService(),
      storageProvider: this.checkStorageProvider(),
    };

    const status = Object.values(checks).every((check) => check.status === 'ok')
      ? 'ok'
      : 'degraded';

    return {
      status,
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkPostgres(): Promise<HealthCheck> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      return { status: 'degraded', detail: 'PostgreSQL connectivity failed' };
    }
  }

  private async checkAiService(): Promise<HealthCheck> {
    const aiServiceUrl = this.configService.get<string>(
      'AI_SERVICE_URL',
      'http://localhost:8000',
    );
    const timeoutMs = Math.min(
      this.configService.get<number>('AI_SERVICE_TIMEOUT_MS', 15000),
      3000,
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        `${aiServiceUrl.replace(/\/$/, '')}/health`,
        {
          method: 'GET',
          signal: controller.signal,
        },
      );

      return response.ok
        ? { status: 'ok' }
        : {
            status: 'degraded',
            detail: `AI service returned ${response.status}`,
          };
    } catch {
      return { status: 'degraded', detail: 'AI service connectivity failed' };
    } finally {
      clearTimeout(timeout);
    }
  }

  private checkStorageProvider(): HealthCheck {
    const provider = this.configService.get<string>(
      'STORAGE_PROVIDER',
      'local',
    );
    const hasProvider = Boolean(this.storageProvider);

    if (!hasProvider) {
      return {
        status: 'degraded',
        detail: 'Storage provider is not configured',
      };
    }

    return {
      status: 'ok',
      detail: provider,
    };
  }
}
