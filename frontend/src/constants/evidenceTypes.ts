export interface EvidenceTypeOption {
  value: string;
  label: string;
}

/**
 * The backend does not define a fixed evidenceType enum (CreateUploadTargetDto accepts any
 * 1-80 character string). Merchant uploads should use options derived from the case's active
 * PolicyRequirement.acceptedEvidenceTypes; this generic list covers card-member uploads, which
 * have no policy-requirement catalog to draw from.
 */
export const CARD_MEMBER_EVIDENCE_TYPE_OPTIONS: EvidenceTypeOption[] = [
  { value: 'receipt', label: 'Receipt' },
  { value: 'invoice', label: 'Invoice or order record' },
  { value: 'correspondence', label: 'Correspondence with merchant' },
  { value: 'non_delivery_statement', label: 'Non-delivery statement' },
  { value: 'refund_confirmation', label: 'Refund confirmation' },
  { value: 'cancellation_confirmation', label: 'Cancellation confirmation' },
  { value: 'other', label: 'Other supporting document' },
];

export const ALLOWED_EVIDENCE_MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg']);

export const ALLOWED_EVIDENCE_EXTENSIONS_BY_MIME_TYPE: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};

export const DEFAULT_MAX_EVIDENCE_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const EVIDENCE_FILE_INPUT_ACCEPT = '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg';
