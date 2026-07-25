# Database Design

Phase 4 defines and implements the authentication, transaction, dispute case, timeline, merchant response, prototype policy requirement, evidence metadata, and extracted fact portions of the data model in Prisma.

## Core Entities
- `User`: authenticated user with a role.
- `Transaction`: posted or dispute-relevant transaction visible to its card member.
- `DisputeCase`: disputed transaction case and current workflow status.
- `PolicyRequirement`: database-backed prototype evidence checklist row for one dispute reason.
- `EvidenceItem`: uploaded evidence metadata and internal storage reference.
- `ExtractedFact`: structured facts extracted from one evidence item for later AI and policy processing.
- `TimelineEvent`: append-only case timeline event.
- `TransactionSnapshot`: future immutable transaction details relevant to policy evaluation.
- `PolicyEvaluation`: deterministic rule results and referenced evidence.
- `AnalystReview`: human review notes and final action.

## Key Relationships
- A `User` with role `CARD_MEMBER` can have many `Transaction` records.
- A `User` with role `MERCHANT` can be associated with many `Transaction` records.
- A `Transaction` can have only one non-closed active `DisputeCase`.
- A `DisputeCase` belongs to one `Transaction`, one card member, and one merchant.
- A `DisputeCase` has many `TimelineEvent` records.
- A `DisputeCase.reasonCode` resolves to active `PolicyRequirement` rows for merchant response checklists.
- A future `DisputeCase` may have one immutable `TransactionSnapshot`.
- A `DisputeCase` has many `EvidenceItem` records.
- An `EvidenceItem` belongs to the submitting user and can produce many `ExtractedFact` records.
- A `DisputeCase` can have many `PolicyEvaluation` records.
- A `DisputeCase` can have zero or more `AnalystReview` records.

## Implemented Fields
### `Transaction`
- `id`: UUID primary key.
- `cardMemberId`: UUID reference to the card-member user.
- `merchantId`: UUID reference to the merchant user.
- `merchantName`: display name captured for transaction views.
- `amount`: PostgreSQL decimal, returned by the API as a string.
- `currency`: ISO-style currency code such as `USD`.
- `transactionDate`: transaction timestamp.
- `status`: transaction lifecycle label.
- `maskedCardLast4`: masked card last-four digits only.
- `createdAt`, `updatedAt`: audit timestamps.

### `DisputeCase`
- `id`: UUID primary key.
- `transactionId`: UUID reference to the disputed transaction.
- `cardMemberId`: UUID reference to the card-member user.
- `merchantId`: UUID reference to the merchant user.
- `reasonCode`: one of `GOODS_NOT_RECEIVED`, `REFUND_NOT_PROCESSED`, or `CANCELLED_GOODS_OR_SERVICES`.
- `cardMemberStatement`: card-member explanation.
- `merchantStatement`: nullable merchant response, reserved for a later phase.
- `merchantResponseDate`: nullable timestamp for final merchant response submission.
- `merchantResponseStatus`: merchant response lifecycle value, currently `PENDING`, `SUBMITTED`, or `REOPENED`.
- `status`: documented status-machine value.
- `responseDeadline`: configurable merchant response deadline.
- `createdAt`, `updatedAt`: audit timestamps.
- `resolvedAt`: nullable resolution timestamp.

### `TimelineEvent`
- `id`: UUID primary key.
- `caseId`: UUID reference to the dispute case.
- `eventType`: timeline event label.
- `description`: human-readable event description.
- `performedBy`: nullable user ID.
- `metadata`: nullable JSON payload with structured details.
- `createdAt`: event timestamp.

### `PolicyRequirement`
- `id`: UUID primary key.
- `reasonCode`: one of `GOODS_NOT_RECEIVED`, `REFUND_NOT_PROCESSED`, or `CANCELLED_GOODS_OR_SERVICES`.
- `requirementKey`: stable machine-readable checklist key such as `delivery_confirmation`.
- `requirementName`: human-readable requirement label.
- `description`: requirement description. Seeded Phase 3 descriptions clearly label the rows as prototype ResolveX policy rules, not official legal or card-network policy.
- `acceptedEvidenceTypes`: JSON array of evidence type keys accepted for the requirement.
- `weight`: integer prototype scoring/importance weight for future deterministic policy evaluation.
- `isMandatory`: whether a merchant response must include evidence for this requirement.
- `policyVersion`: version label for the prototype policy set, currently `prototype-v1`.
- `active`: whether the requirement is active for checklist retrieval and response validation.
- `createdAt`, `updatedAt`: audit timestamps.

### `EvidenceItem`
- `id`: UUID primary key.
- `caseId`: UUID reference to the dispute case.
- `submittedByUserId`: UUID reference to the submitting user.
- `submittedByRole`: submitting role, currently `CARD_MEMBER` or `MERCHANT`.
- `evidenceType`: product/policy evidence type key such as `delivery_confirmation`.
- `fileName`: sanitized display filename.
- `mimeType`: accepted MIME type, limited in Phase 4 to PDF, PNG, JPG, and JPEG.
- `sizeBytes`: uploaded file size.
- `storageKey`: unique internal storage object key. This is stored for backend use and omitted from public API metadata responses.
- `fileHash`: nullable SHA-256 hex digest until confirmation. Local storage calculates the hash when omitted; S3 confirmation accepts a provided hash.
- `processingStatus`: one of `UPLOADED`, `PROCESSING`, `PROCESSED`, `FAILED`, or `VERIFIED`.
- `extractionConfidence`: nullable aggregate extraction confidence for later AI processing.
- `createdAt`, `updatedAt`: audit timestamps.

### `ExtractedFact`
- `id`: UUID primary key.
- `evidenceId`: UUID reference to the source evidence item.
- `factType`: machine-readable fact label such as `tracking_number`.
- `factValue`: extracted or user-corrected value.
- `normalizedValue`: nullable canonical value for policy evaluation.
- `confidence`: nullable extraction confidence from `0` to `1`.
- `sourcePage`: nullable source page number for multi-page documents.
- `verifiedByUser`: whether a user verified the extracted fact.
- `correctedByUser`: whether a user corrected the extracted fact.
- `createdAt`, `updatedAt`: audit timestamps.

## Seeded Prototype Policy Requirements
Phase 3 seeds prototype policy rules for all supported dispute categories. These rows are for ResolveX product validation only and are not official legal policy.

`GOODS_NOT_RECEIVED`:
- `invoice`
- `dispatch_record`
- `delivery_confirmation`
- `recipient_confirmation`
- `verified_delivery_location`

`REFUND_NOT_PROCESSED`:
- `purchase_record`
- `refund_initiation_record`
- `refund_reference`
- `refund_amount`
- `refund_processing_date`
- `completed_refund_transaction`

`CANCELLED_GOODS_OR_SERVICES`:
- `cancellation_request`
- `cancellation_date`
- `accepted_cancellation_policy`
- `service_delivery_record`
- `cancellation_confirmation`
- `refund_confirmation`

## Data Safety
Do not store real card numbers, bank credentials, or personal data in development fixtures. Use tokenized transaction references and synthetic demo data.

## Auditability
Case and resolution records must preserve:
- Input evidence references
- Policy rule IDs
- Status transitions
- Actor role
- Timestamp
- Human review reason when applicable

Phase 2 records initial status transitions through `TimelineEvent` entries when a card member creates a dispute. Phase 3 records `MERCHANT_RESPONSE_SUBMITTED` and `CASE_STATUS_CHANGED` timeline events when a merchant submits a valid structured response. Phase 4 records `EVIDENCE_UPLOAD_TARGET_CREATED`, `EVIDENCE_UPLOADED`, and `EVIDENCE_DELETED` timeline events for evidence auditability.
