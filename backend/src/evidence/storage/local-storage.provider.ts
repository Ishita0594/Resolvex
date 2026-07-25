import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import { dirname, normalize, resolve, sep } from 'path';
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
export class LocalStorageProvider implements StorageProvider {
  private readonly rootPath: string;

  constructor(private readonly configService: ConfigService) {
    this.rootPath = resolve(
      this.configService.get<string>(
        'LOCAL_STORAGE_PATH',
        './storage/evidence',
      ),
    );
  }

  createUploadTarget(input: CreateUploadTargetInput): Promise<UploadTarget> {
    const ttlSeconds = this.configService.get<number>(
      'EVIDENCE_UPLOAD_URL_TTL_SECONDS',
      600,
    );

    return Promise.resolve({
      uploadUrl: `${this.publicBaseUrl()}/api/evidence/${input.evidenceId}/local-upload`,
      method: 'POST',
      headers: {},
      fields: { fileField: 'file' },
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      storageKey: input.storageKey,
    });
  }

  async confirmUpload(
    input: ConfirmUploadInput,
  ): Promise<ConfirmUploadResult> {
    const path = this.resolvePath(input.storageKey);

    let buffer: Buffer;
    try {
      buffer = await fs.readFile(path);
    } catch {
      throw new BadRequestException(
        'Evidence file was not found in local storage; upload it before confirming',
      );
    }

    const computedHash = createHash('sha256').update(buffer).digest('hex');
    if (input.expectedHash && input.expectedHash !== computedHash) {
      throw new BadRequestException(
        'Uploaded file hash does not match the expected hash',
      );
    }

    return { fileHash: computedHash };
  }

  async objectExists(storageKey: string): Promise<boolean> {
    try {
      await fs.access(this.resolvePath(storageKey));
      return true;
    } catch {
      return false;
    }
  }

  async getObjectBuffer(storageKey: string): Promise<Buffer> {
    return fs.readFile(this.resolvePath(storageKey));
  }

  getTemporaryDownloadUrl(
    input: TemporaryDownloadInput,
  ): Promise<TemporaryDownloadTarget> {
    const ttlSeconds = this.configService.get<number>(
      'EVIDENCE_DOWNLOAD_URL_TTL_SECONDS',
      300,
    );
    const expiresAt = Date.now() + ttlSeconds * 1000;
    const signature = this.sign(input.evidenceId, expiresAt);

    const url = new URL(
      `${this.publicBaseUrl()}/api/evidence/${input.evidenceId}/download-content`,
    );
    url.searchParams.set('expires', String(expiresAt));
    url.searchParams.set('signature', signature);

    return Promise.resolve({
      downloadUrl: url.toString(),
      expiresAt: new Date(expiresAt).toISOString(),
    });
  }

  async deleteObject(storageKey: string): Promise<void> {
    try {
      await fs.unlink(this.resolvePath(storageKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async saveMultipartUpload(
    storageKey: string,
    buffer: Buffer,
  ): Promise<string> {
    const path = this.resolvePath(storageKey);
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, buffer);
    return createHash('sha256').update(buffer).digest('hex');
  }

  verifyDownloadSignature(
    evidenceId: string,
    expires: string,
    signature: string,
  ): boolean {
    const expiresAt = Number(expires);
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
      return false;
    }

    const expectedSignature = this.sign(evidenceId, expiresAt);
    const providedBuffer = Buffer.from(signature ?? '');
    const expectedBuffer = Buffer.from(expectedSignature);
    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(providedBuffer, expectedBuffer);
  }

  createReadStream(storageKey: string): NodeJS.ReadableStream {
    return createReadStream(this.resolvePath(storageKey));
  }

  private sign(evidenceId: string, expiresAt: number): string {
    const secret = this.configService.get<string>('JWT_SECRET', '');
    return createHmac('sha256', secret)
      .update(`${evidenceId}:${expiresAt}`)
      .digest('hex');
  }

  private publicBaseUrl(): string {
    const configured = this.configService.get<string>('API_PUBLIC_BASE_URL');
    const base =
      configured ??
      `http://localhost:${this.configService.get<number>('PORT', 3000)}`;
    return base.replace(/\/$/, '');
  }

  private resolvePath(storageKey: string): string {
    const normalized = normalize(storageKey).replace(/^([.]{2}[/\\]?)+/, '');
    const fullPath = resolve(this.rootPath, normalized);
    if (fullPath !== this.rootPath && !fullPath.startsWith(this.rootPath + sep)) {
      throw new BadRequestException('Invalid storage key');
    }
    return fullPath;
  }
}
