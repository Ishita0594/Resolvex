CREATE TYPE "EvidenceSupportDirection" AS ENUM ('SUPPORTS_CARD_MEMBER', 'SUPPORTS_MERCHANT', 'NEUTRAL', 'CONTRADICTORY');
CREATE TYPE "RecommendedOutcome" AS ENUM ('CARD_MEMBER_SUPPORTED', 'MERCHANT_SUPPORTED', 'HUMAN_REVIEW_REQUIRED');
CREATE TYPE "DecisionType" AS ENUM ('AUTOMATED_RECOMMENDATION', 'HUMAN_DECISION');

CREATE TABLE "PolicyRule" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ruleId" TEXT NOT NULL,
    "reasonCode" "ReasonCode" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "prototypeAssumption" BOOLEAN NOT NULL DEFAULT true,
    "severity" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EvidenceScore" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "caseId" UUID NOT NULL,
    "evidenceId" UUID NOT NULL,
    "requirementId" UUID NOT NULL,
    "sourceReliability" INTEGER NOT NULL,
    "directness" INTEGER NOT NULL,
    "completeness" INTEGER NOT NULL,
    "consistency" INTEGER NOT NULL,
    "timeliness" INTEGER NOT NULL,
    "finalScore" INTEGER NOT NULL,
    "supportDirection" "EvidenceSupportDirection" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceScore_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DecisionRecord" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "caseId" UUID NOT NULL,
    "recommendedOutcome" "RecommendedOutcome" NOT NULL,
    "cardMemberScore" INTEGER NOT NULL,
    "merchantScore" INTEGER NOT NULL,
    "confidence" INTEGER NOT NULL,
    "decisionMargin" INTEGER NOT NULL,
    "decisionType" "DecisionType" NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "modelMetadata" JSONB NOT NULL,
    "explanationData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PolicyRule_ruleId_policyVersion_key" ON "PolicyRule"("ruleId", "policyVersion");
CREATE INDEX "PolicyRule_reasonCode_active_idx" ON "PolicyRule"("reasonCode", "active");
CREATE INDEX "EvidenceScore_caseId_idx" ON "EvidenceScore"("caseId");
CREATE INDEX "EvidenceScore_evidenceId_idx" ON "EvidenceScore"("evidenceId");
CREATE INDEX "EvidenceScore_requirementId_idx" ON "EvidenceScore"("requirementId");
CREATE INDEX "EvidenceScore_supportDirection_idx" ON "EvidenceScore"("supportDirection");
CREATE INDEX "DecisionRecord_caseId_idx" ON "DecisionRecord"("caseId");
CREATE INDEX "DecisionRecord_recommendedOutcome_idx" ON "DecisionRecord"("recommendedOutcome");
CREATE INDEX "DecisionRecord_policyVersion_idx" ON "DecisionRecord"("policyVersion");

ALTER TABLE "EvidenceScore" ADD CONSTRAINT "EvidenceScore_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DisputeCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvidenceScore" ADD CONSTRAINT "EvidenceScore_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvidenceScore" ADD CONSTRAINT "EvidenceScore_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "PolicyRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DecisionRecord" ADD CONSTRAINT "DecisionRecord_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DisputeCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PolicyRule" (
    "ruleId",
    "reasonCode",
    "title",
    "description",
    "prototypeAssumption",
    "severity",
    "policyVersion",
    "active",
    "updatedAt"
) VALUES
('PX-GNR-001', 'GOODS_NOT_RECEIVED', 'Dispatch is insufficient alone', 'Prototype assumption: dispatch alone does not prove delivery.', true, 'MEDIUM', 'prototype-v1', true, CURRENT_TIMESTAMP),
('PX-GNR-002', 'GOODS_NOT_RECEIVED', 'Verified delivery supports merchant', 'Prototype assumption: verified delivery confirmation with recipient or location confirmation supports the merchant.', true, 'HIGH', 'prototype-v1', true, CURRENT_TIMESTAMP),
('PX-GNR-003', 'GOODS_NOT_RECEIVED', 'Missing delivery proof supports card member', 'Prototype assumption: missing delivery proof combined with consistent non-delivery evidence supports the card member.', true, 'HIGH', 'prototype-v1', true, CURRENT_TIMESTAMP),
('PX-GNR-004', 'GOODS_NOT_RECEIVED', 'Delivery identity contradiction requires review', 'Prototype assumption: conflicting delivery location or recipient evidence requires human review.', true, 'HIGH', 'prototype-v1', true, CURRENT_TIMESTAMP),
('PX-REF-001', 'REFUND_NOT_PROCESSED', 'Refund promise without completion supports card member', 'Prototype assumption: a refund promise without a completed refund record supports the card member.', true, 'HIGH', 'prototype-v1', true, CURRENT_TIMESTAMP),
('PX-REF-002', 'REFUND_NOT_PROCESSED', 'Completed refund supports merchant', 'Prototype assumption: a matching completed refund transaction supports the merchant.', true, 'HIGH', 'prototype-v1', true, CURRENT_TIMESTAMP),
('PX-REF-003', 'REFUND_NOT_PROCESSED', 'Refund contradiction requires review', 'Prototype assumption: amount, date, or reference contradictions require human review.', true, 'HIGH', 'prototype-v1', true, CURRENT_TIMESTAMP),
('PX-CAN-001', 'CANCELLED_GOODS_OR_SERVICES', 'Valid timely cancellation supports card member', 'Prototype assumption: timely valid cancellation plus no service delivery and no refund supports the card member.', true, 'HIGH', 'prototype-v1', true, CURRENT_TIMESTAMP),
('PX-CAN-002', 'CANCELLED_GOODS_OR_SERVICES', 'Late policy-bound cancellation supports merchant', 'Prototype assumption: late cancellation after a clearly accepted cancellation policy may support the merchant.', true, 'HIGH', 'prototype-v1', true, CURRENT_TIMESTAMP),
('PX-CAN-003', 'CANCELLED_GOODS_OR_SERVICES', 'Unclear cancellation timing requires review', 'Prototype assumption: unclear timing or unclear policy acceptance requires human review.', true, 'HIGH', 'prototype-v1', true, CURRENT_TIMESTAMP)
ON CONFLICT ("ruleId", "policyVersion") DO UPDATE SET
    "reasonCode" = EXCLUDED."reasonCode",
    "title" = EXCLUDED."title",
    "description" = EXCLUDED."description",
    "prototypeAssumption" = EXCLUDED."prototypeAssumption",
    "severity" = EXCLUDED."severity",
    "active" = EXCLUDED."active",
    "updatedAt" = CURRENT_TIMESTAMP;
