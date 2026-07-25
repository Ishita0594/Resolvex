-- CreateEnum
CREATE TYPE "EvidenceProcessingStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED', 'VERIFIED');

-- CreateTable
CREATE TABLE "EvidenceItem" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "submittedByUserId" UUID NOT NULL,
    "submittedByRole" "Role" NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileHash" TEXT,
    "processingStatus" "EvidenceProcessingStatus" NOT NULL DEFAULT 'UPLOADED',
    "extractionConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedFact" (
    "id" UUID NOT NULL,
    "evidenceId" UUID NOT NULL,
    "factType" TEXT NOT NULL,
    "factValue" TEXT NOT NULL,
    "normalizedValue" TEXT,
    "confidence" DOUBLE PRECISION,
    "sourcePage" INTEGER,
    "verifiedByUser" BOOLEAN NOT NULL DEFAULT false,
    "correctedByUser" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractedFact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceItem_storageKey_key" ON "EvidenceItem"("storageKey");

-- CreateIndex
CREATE INDEX "EvidenceItem_caseId_idx" ON "EvidenceItem"("caseId");

-- CreateIndex
CREATE INDEX "EvidenceItem_submittedByUserId_idx" ON "EvidenceItem"("submittedByUserId");

-- CreateIndex
CREATE INDEX "EvidenceItem_processingStatus_idx" ON "EvidenceItem"("processingStatus");

-- CreateIndex
CREATE INDEX "ExtractedFact_evidenceId_idx" ON "ExtractedFact"("evidenceId");

-- CreateIndex
CREATE INDEX "ExtractedFact_factType_idx" ON "ExtractedFact"("factType");

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DisputeCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedFact" ADD CONSTRAINT "ExtractedFact_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
