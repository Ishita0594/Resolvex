import { BadRequestException } from '@nestjs/common';

export const ALLOWED_EVIDENCE_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
]);

const ALLOWED_EXTENSIONS_BY_MIME_TYPE: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};

const EXECUTABLE_EXTENSIONS = new Set([
  '.bat',
  '.cmd',
  '.com',
  '.dll',
  '.exe',
  '.js',
  '.msi',
  '.ps1',
  '.scr',
  '.sh',
  '.vbs',
]);

export function sanitizeFileName(fileName: string): string {
  const withoutPath = fileName.replace(/\\/g, '/').split('/').pop() ?? 'evidence';
  const trimmed = withoutPath.trim().replace(/\s+/g, ' ');
  const sanitized = trimmed.replace(/[^A-Za-z0-9._ -]/g, '_').replace(/^\.+/, '');

  return sanitized.length > 0 ? sanitized.slice(0, 255) : 'evidence';
}

export function validateEvidenceFile(input: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  maxSizeBytes: number;
}): string {
  const sanitizedFileName = sanitizeFileName(input.fileName);
  const extension = extensionOf(sanitizedFileName);

  if (EXECUTABLE_EXTENSIONS.has(extension)) {
    throw new BadRequestException('Executable evidence files are not allowed');
  }

  if (!ALLOWED_EVIDENCE_MIME_TYPES.has(input.mimeType)) {
    throw new BadRequestException('Unsupported evidence file type');
  }

  const allowedExtensions = ALLOWED_EXTENSIONS_BY_MIME_TYPE[input.mimeType] ?? [];
  if (!allowedExtensions.includes(extension)) {
    throw new BadRequestException('File extension does not match the declared evidence file type');
  }

  if (input.sizeBytes > input.maxSizeBytes) {
    throw new BadRequestException('Evidence file exceeds the configured maximum size');
  }

  return sanitizedFileName;
}

function extensionOf(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  return index === -1 ? '' : fileName.slice(index).toLowerCase();
}
