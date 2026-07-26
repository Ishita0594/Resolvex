export interface CreateUploadTargetInput {
  evidenceId: string;
  caseId: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface UploadTarget {
  uploadUrl: string;
  method: 'PUT' | 'POST';
  headers: Record<string, string>;
  fields?: Record<string, string>;
  expiresAt: string;
  storageKey: string;
}

export interface ConfirmUploadInput {
  storageKey: string;
  expectedHash?: string;
}

export interface ConfirmUploadResult {
  fileHash: string | null;
}

export interface TemporaryDownloadInput {
  evidenceId: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
}

export interface TemporaryDownloadTarget {
  downloadUrl: string;
  expiresAt: string;
}

export interface StorageProvider {
  createUploadTarget(input: CreateUploadTargetInput): Promise<UploadTarget>;
  confirmUpload(input: ConfirmUploadInput): Promise<ConfirmUploadResult>;
  objectExists(storageKey: string): Promise<boolean>;
  getObjectBuffer(storageKey: string): Promise<Buffer>;
  getTemporaryDownloadUrl(
    input: TemporaryDownloadInput,
  ): Promise<TemporaryDownloadTarget>;
  deleteObject(storageKey: string): Promise<void>;
}
