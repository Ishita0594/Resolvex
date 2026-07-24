CREATE TYPE "ReasonCode" AS ENUM ('GOODS_NOT_RECEIVED', 'REFUND_NOT_PROCESSED', 'CANCELLED_GOODS_OR_SERVICES');

CREATE TYPE "CaseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'AWAITING_MERCHANT', 'EVIDENCE_PROCESSING', 'UNDER_EVALUATION', 'HUMAN_REVIEW', 'RESOLVED', 'APPEALED', 'CLOSED');

ALTER TABLE "User" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

CREATE TABLE "Transaction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cardMemberId" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "merchantName" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "maskedCardLast4" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DisputeCase" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transactionId" UUID NOT NULL,
    "cardMemberId" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "reasonCode" "ReasonCode" NOT NULL,
    "cardMemberStatement" TEXT NOT NULL,
    "merchantStatement" TEXT,
    "status" "CaseStatus" NOT NULL,
    "responseDeadline" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "DisputeCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TimelineEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "caseId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "performedBy" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DisputeCase_active_transactionId_key" ON "DisputeCase"("transactionId") WHERE "status" <> 'CLOSED';
CREATE INDEX "Transaction_cardMemberId_idx" ON "Transaction"("cardMemberId");
CREATE INDEX "Transaction_merchantId_idx" ON "Transaction"("merchantId");
CREATE INDEX "DisputeCase_cardMemberId_idx" ON "DisputeCase"("cardMemberId");
CREATE INDEX "DisputeCase_merchantId_idx" ON "DisputeCase"("merchantId");
CREATE INDEX "DisputeCase_transactionId_idx" ON "DisputeCase"("transactionId");
CREATE INDEX "DisputeCase_status_idx" ON "DisputeCase"("status");
CREATE INDEX "TimelineEvent_caseId_idx" ON "TimelineEvent"("caseId");
CREATE INDEX "TimelineEvent_performedBy_idx" ON "TimelineEvent"("performedBy");

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_cardMemberId_fkey" FOREIGN KEY ("cardMemberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DisputeCase" ADD CONSTRAINT "DisputeCase_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DisputeCase" ADD CONSTRAINT "DisputeCase_cardMemberId_fkey" FOREIGN KEY ("cardMemberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DisputeCase" ADD CONSTRAINT "DisputeCase_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DisputeCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
