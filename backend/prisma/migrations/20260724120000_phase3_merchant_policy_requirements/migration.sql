CREATE TYPE "MerchantResponseStatus" AS ENUM ('PENDING', 'SUBMITTED', 'REOPENED');

ALTER TABLE "DisputeCase"
ADD COLUMN "merchantResponseDate" TIMESTAMP(3),
ADD COLUMN "merchantResponseStatus" "MerchantResponseStatus" NOT NULL DEFAULT 'PENDING';

CREATE TABLE "PolicyRequirement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reasonCode" "ReasonCode" NOT NULL,
    "requirementKey" TEXT NOT NULL,
    "requirementName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "acceptedEvidenceTypes" JSONB NOT NULL,
    "weight" INTEGER NOT NULL,
    "isMandatory" BOOLEAN NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyRequirement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PolicyRequirement_reasonCode_requirementKey_policyVersion_key" ON "PolicyRequirement"("reasonCode", "requirementKey", "policyVersion");
CREATE INDEX "PolicyRequirement_reasonCode_active_idx" ON "PolicyRequirement"("reasonCode", "active");
