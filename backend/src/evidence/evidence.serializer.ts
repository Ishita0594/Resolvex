import { EvidenceItem, ExtractedFact } from '@prisma/client';

export type ExtractedFactResponse = {
  id: string;
  evidenceId: string;
  factType: string;
  factValue: string;
  normalizedValue: string | null;
  confidence: number | null;
  sourcePage: number | null;
  verifiedByUser: boolean;
  correctedByUser: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EvidenceItemResponse = {
  id: string;
  caseId: string;
  submittedByUserId: string;
  submittedByRole: string;
  evidenceType: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  fileHash: string | null;
  processingStatus: string;
  extractionConfidence: number | null;
  createdAt: string;
  updatedAt: string;
  facts?: ExtractedFactResponse[];
};

type EvidenceWithFacts = EvidenceItem & {
  extractedFacts?: ExtractedFact[];
};

export function serializeEvidenceItem(evidence: EvidenceWithFacts): EvidenceItemResponse {
  return {
    id: evidence.id,
    caseId: evidence.caseId,
    submittedByUserId: evidence.submittedByUserId,
    submittedByRole: evidence.submittedByRole,
    evidenceType: evidence.evidenceType,
    fileName: evidence.fileName,
    mimeType: evidence.mimeType,
    sizeBytes: evidence.sizeBytes,
    fileHash: evidence.fileHash,
    processingStatus: evidence.processingStatus,
    extractionConfidence: evidence.extractionConfidence,
    createdAt: evidence.createdAt.toISOString(),
    updatedAt: evidence.updatedAt.toISOString(),
    facts: evidence.extractedFacts?.map(serializeExtractedFact),
  };
}

export function serializeExtractedFact(fact: ExtractedFact): ExtractedFactResponse {
  return {
    id: fact.id,
    evidenceId: fact.evidenceId,
    factType: fact.factType,
    factValue: fact.factValue,
    normalizedValue: fact.normalizedValue,
    confidence: fact.confidence,
    sourcePage: fact.sourcePage,
    verifiedByUser: fact.verifiedByUser,
    correctedByUser: fact.correctedByUser,
    createdAt: fact.createdAt.toISOString(),
    updatedAt: fact.updatedAt.toISOString(),
  };
}
