# Database Design

Phase 0 defines the intended data model only. Prisma schema and migrations will be added in a later phase.

## Core Entities
- `User`: authenticated user with a role.
- `DisputeCase`: disputed transaction case and current workflow status.
- `TransactionSnapshot`: immutable transaction details relevant to the dispute.
- `EvidenceDocument`: uploaded document metadata and storage location.
- `StructuredEvidence`: extracted facts used by policy evaluation.
- `PolicyEvaluation`: deterministic rule results and referenced evidence.
- `StatusHistory`: append-only case status transition log.
- `AnalystReview`: human review notes and final action.

## Key Relationships
- A `User` can create or review many `DisputeCase` records.
- A `DisputeCase` has one `TransactionSnapshot`.
- A `DisputeCase` has many `EvidenceDocument` records.
- An `EvidenceDocument` can produce many `StructuredEvidence` records.
- A `DisputeCase` can have many `PolicyEvaluation` records.
- A `DisputeCase` can have many `StatusHistory` records.
- A `DisputeCase` can have zero or more `AnalystReview` records.

## Data Safety
Do not store real card numbers, bank credentials, or personal data in development fixtures. Use tokenized transaction references and synthetic demo data.

## Auditability
Resolution records must preserve:
- Input evidence references
- Policy rule IDs
- Status transitions
- Actor role
- Timestamp
- Human review reason when applicable
