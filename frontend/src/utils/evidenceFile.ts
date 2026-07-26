import {
  ALLOWED_EVIDENCE_EXTENSIONS_BY_MIME_TYPE,
  ALLOWED_EVIDENCE_MIME_TYPES,
} from '../constants/evidenceTypes';
import { formatFileSize } from './format';

function extensionOf(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  return index === -1 ? '' : fileName.slice(index).toLowerCase();
}

/** Mirrors the backend's evidence-file.validation.ts checks so unsupported files never reach the network. */
export function validateEvidenceFileClientSide(file: File, maxSizeBytes: number): string | null {
  if (!ALLOWED_EVIDENCE_MIME_TYPES.has(file.type)) {
    return 'Only PDF, PNG, JPG, and JPEG files are supported.';
  }

  const allowedExtensions = ALLOWED_EVIDENCE_EXTENSIONS_BY_MIME_TYPE[file.type] ?? [];
  if (!allowedExtensions.includes(extensionOf(file.name))) {
    return 'The file extension does not match its file type.';
  }

  if (file.size > maxSizeBytes) {
    return `This file exceeds the ${formatFileSize(maxSizeBytes)} size limit.`;
  }

  return null;
}
