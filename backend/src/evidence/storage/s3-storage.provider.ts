import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  ConfirmUploadInput,
  ConfirmUploadResult,
  CreateUploadTargetInput,
  StorageProvider,
  TemporaryDownloadInput,
  TemporaryDownloadTarget,
  UploadTarget,
} from './storage-provider.interface';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private client: S3Client | undefined;

  constructor(private readonly configService: ConfigService) {}

  async createUploadTarget(
    input: CreateUploadTargetInput,
  ): Promise<UploadTarget> {
    const ttlSeconds = this.configService.get<number>(
      'EVIDENCE_UPLOAD_URL_TTL_SECONDS',
      600,
    );
    const command = new PutObjectCommand({
      Bucket: this.bucket(),
      Key: input.storageKey,
      ContentType: input.mimeType,
    });
    const uploadUrl = await getSignedUrl(this.getClient(), command, {
      expiresIn: ttlSeconds,
    });

    return {
      uploadUrl,
      method: 'PUT',
      headers: { 'Content-Type': input.mimeType },
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      storageKey: input.storageKey,
    };
  }

  async confirmUpload(
    input: ConfirmUploadInput,
  ): Promise<ConfirmUploadResult> {
    const head = await this.getClient().send(
      new HeadObjectCommand({ Bucket: this.bucket(), Key: input.storageKey }),
    );
    const fileHash = input.expectedHash ?? head.ETag?.replace(/"/g, '') ?? null;
    return { fileHash };
  }

  async objectExists(storageKey: string): Promise<boolean> {
    try {
      await this.getClient().send(
        new HeadObjectCommand({ Bucket: this.bucket(), Key: storageKey }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async getObjectBuffer(storageKey: string): Promise<Buffer> {
    const object = await this.getClient().send(
      new GetObjectCommand({ Bucket: this.bucket(), Key: storageKey }),
    );
    const stream = object.Body as NodeJS.ReadableStream;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async getTemporaryDownloadUrl(
    input: TemporaryDownloadInput,
  ): Promise<TemporaryDownloadTarget> {
    const ttlSeconds = this.configService.get<number>(
      'EVIDENCE_DOWNLOAD_URL_TTL_SECONDS',
      300,
    );
    const command = new GetObjectCommand({
      Bucket: this.bucket(),
      Key: input.storageKey,
      ResponseContentDisposition: `attachment; filename="${input.fileName.replace(/"/g, '')}"`,
      ResponseContentType: input.mimeType,
    });
    const downloadUrl = await getSignedUrl(this.getClient(), command, {
      expiresIn: ttlSeconds,
    });

    return {
      downloadUrl,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    };
  }

  async deleteObject(storageKey: string): Promise<void> {
    await this.getClient().send(
      new DeleteObjectCommand({ Bucket: this.bucket(), Key: storageKey }),
    );
  }

  private getClient(): S3Client {
    if (!this.client) {
      const accessKeyId = this.configService.get<string>(
        'AWS_ACCESS_KEY_ID',
      );
      const secretAccessKey = this.configService.get<string>(
        'AWS_SECRET_ACCESS_KEY',
      );

      this.client = new S3Client({
        region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
        credentials:
          accessKeyId && secretAccessKey
            ? {
                accessKeyId,
                secretAccessKey,
                sessionToken: this.configService.get<string>(
                  'AWS_SESSION_TOKEN',
                ),
              }
            : undefined,
      });
    }

    return this.client;
  }

  private bucket(): string {
    return this.configService.get<string>('AWS_S3_BUCKET', '');
  }
}
