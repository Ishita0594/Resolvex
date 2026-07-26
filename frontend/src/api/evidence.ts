import axios from 'axios';
import { apiClient } from './client';
import type { EvidenceItem, EvidenceUploadTarget, ExtractedFact } from '../types/domain';

export interface CreateEvidenceUploadTargetPayload {
  evidenceType: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ConfirmEvidenceUploadPayload {
  evidenceId: string;
  fileHash?: string;
}

export interface EvidenceDownloadTarget {
  downloadUrl: string;
  expiresAt: string;
}

function normalizeEvidenceItem(item: EvidenceItem): EvidenceItem {
  return { ...item, facts: item.facts ?? [] };
}

export async function createEvidenceUploadTarget(
  caseId: string,
  payload: CreateEvidenceUploadTargetPayload,
): Promise<EvidenceUploadTarget> {
  const response = await apiClient.post<EvidenceUploadTarget>(`/disputes/${caseId}/evidence/upload-target`, payload);
  return response.data;
}

export async function confirmEvidenceUpload(
  caseId: string,
  payload: ConfirmEvidenceUploadPayload,
): Promise<EvidenceItem> {
  const response = await apiClient.post<EvidenceItem>(`/disputes/${caseId}/evidence/confirm`, payload);
  return normalizeEvidenceItem(response.data);
}

export async function listCaseEvidence(caseId: string): Promise<EvidenceItem[]> {
  const response = await apiClient.get<EvidenceItem[]>(`/disputes/${caseId}/evidence`);
  return response.data.map(normalizeEvidenceItem);
}

export async function deleteEvidence(evidenceId: string): Promise<void> {
  await apiClient.delete(`/evidence/${evidenceId}`);
}

export async function getEvidence(evidenceId: string): Promise<EvidenceItem> {
  const response = await apiClient.get<EvidenceItem>(`/evidence/${evidenceId}`);
  return normalizeEvidenceItem(response.data);
}

export async function processEvidence(evidenceId: string): Promise<EvidenceItem> {
  const response = await apiClient.post<EvidenceItem>(`/evidence/${evidenceId}/process`);
  return normalizeEvidenceItem(response.data);
}

export async function retryEvidenceProcessing(evidenceId: string): Promise<EvidenceItem> {
  const response = await apiClient.post<EvidenceItem>(`/evidence/${evidenceId}/retry`);
  return normalizeEvidenceItem(response.data);
}

/** Replaces the full fact set for one evidence item; the backend deletes and recreates from this array, so unrelated facts must be passed through unchanged. */
export async function replaceEvidenceFacts(evidenceId: string, facts: ExtractedFact[]): Promise<EvidenceItem> {
  const response = await apiClient.patch<EvidenceItem>(`/evidence/${evidenceId}/facts`, {
    facts: facts.map((fact) => ({
      id: fact.id,
      factType: fact.factType,
      factValue: fact.factValue,
      normalizedValue: fact.normalizedValue,
      confidence: fact.confidence,
      sourcePage: fact.sourcePage,
      verifiedByUser: fact.verifiedByUser,
      correctedByUser: fact.correctedByUser,
    })),
  });
  return normalizeEvidenceItem(response.data);
}

export async function getEvidenceDownloadUrl(evidenceId: string): Promise<EvidenceDownloadTarget> {
  const response = await apiClient.get<EvidenceDownloadTarget>(`/evidence/${evidenceId}/download`);
  return response.data;
}

// A bare axios instance (no auth interceptor) for uploads that go straight to external storage
// (e.g. an S3 presigned URL), where the returned `headers` are the complete, correct header set.
const externalUploadClient = axios.create();

export interface UploadEvidenceFileOptions {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

export interface UploadEvidenceFileResult {
  fileHash?: string;
}

/**
 * Uploads file bytes to the target returned by createEvidenceUploadTarget. The upload target's
 * shape (method/uploadUrl/headers/fields) fully describes how to perform the upload, so this
 * stays storage-provider-agnostic: no S3- or local-storage-specific branching lives here.
 *
 * When `fields` is present (the local-development multipart flow), the request is routed through
 * the authenticated `apiClient` because that upload target is our own backend endpoint. When
 * `fields` is absent (a direct presigned storage PUT), the request goes through a bare axios
 * instance so our bearer token is never sent to external storage.
 */
export async function uploadEvidenceFile(
  target: EvidenceUploadTarget,
  file: File,
  options: UploadEvidenceFileOptions = {},
): Promise<UploadEvidenceFileResult> {
  const onUploadProgress = (event: { loaded: number; total?: number }) => {
    if (options.onProgress && event.total) {
      options.onProgress(Math.round((event.loaded / event.total) * 100));
    }
  };

  if (target.fields) {
    const fileFieldName = target.fields.fileField ?? 'file';
    const formData = new FormData();
    Object.entries(target.fields).forEach(([key, value]) => {
      if (key !== 'fileField') {
        formData.append(key, value);
      }
    });
    formData.append(fileFieldName, file);

    const response = await apiClient.request<UploadEvidenceFileResult | undefined>({
      url: target.uploadUrl,
      method: target.method,
      data: formData,
      headers: target.headers,
      onUploadProgress,
      signal: options.signal,
    });
    return response.data ?? {};
  }

  await externalUploadClient.request({
    url: target.uploadUrl,
    method: target.method,
    data: file,
    headers: { ...target.headers, 'Content-Type': file.type },
    onUploadProgress,
    signal: options.signal,
  });
  return {};
}

export { isCancel as isEvidenceUploadCanceled } from 'axios';
