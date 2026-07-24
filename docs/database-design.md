# Database Design

Phase 2 defines and implements the authentication, transaction, dispute case, and timeline portions of the data model in Prisma.

## Core Entities
- `User`: authenticated user with a role.
- `Transaction`: posted or dispute-relevant transaction visible to its card member.
- `DisputeCase`: disputed transaction case and current workflow status.
- `TimelineEvent`: append-only case timeline event.
- `TransactionSnapshot`: future immutable transaction details relevant to policy evaluation.
- `EvidenceDocument`: uploaded document metadata and storage location.
- `StructuredEvidence`: extracted facts used by policy evaluation.
- `PolicyEvaluation`: deterministic rule results and referenced evidence.
- `AnalystReview`: human review notes and final action.

## Key Relationships
- A `User` with role `CARD_MEMBER` can have many `Transaction` records.
- A `User` with role `MERCHANT` can be associated with many `Transaction` records.
- A `Transaction` can have only one non-closed active `DisputeCase`.
- A `DisputeCase` belongs to one `Transaction`, one card member, and one merchant.
- A `DisputeCase` has many `TimelineEvent` records.
- A future `DisputeCase` may have one immutable `TransactionSnapshot`.
- A `DisputeCase` has many `EvidenceDocument` records.
- An `EvidenceDocument` can produce many `StructuredEvidence` records.
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

Phase 2 records initial status transitions through `TimelineEvent` entries when a card member creates a dispute.
