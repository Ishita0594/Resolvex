# API Contract

This file documents the API surface for ResolveX. Phase 6 implements authentication, card-member transaction reads, dispute creation, dispute reads, dispute timelines, merchant dispute reads, database-backed prototype policy requirements, structured merchant responses, secure evidence upload metadata, AI fact extraction, and deterministic prototype policy evaluation.

## Conventions
- Base path: `/api`
- Authentication: JWT bearer token
- Authorization: role-based access control
- Request and response bodies: JSON
- Error format: stable machine-readable code plus human-readable message

## Roles
- `CARD_MEMBER`
- `MERCHANT`
- `ANALYST`

## Dispute Categories
- `GOODS_NOT_RECEIVED`
- `REFUND_NOT_PROCESSED`
- `CANCELLED_GOODS_OR_SERVICES`

## Implemented Resources
- `Auth`: register, login, authenticated profile
- `Transactions`: card-member transaction list and detail reads
- `Disputes`: card-member dispute creation, list, detail, and timeline reads
- `Merchant Disputes`: merchant-assigned dispute list and detail reads
- `Policy Requirements`: reason-specific prototype merchant evidence checklists loaded from PostgreSQL
- `Merchant Responses`: structured merchant response submission
- `Evidence`: upload target creation, local multipart upload support, confirmation, metadata reads, temporary downloads, AI processing, extracted fact reads and updates, retry, and deletion
- `Policy Evaluation`: deterministic rule evaluation, evidence scoring, evidence matrix reads, and structured explanations

## Planned Resources
- `Analyst Review`: human review queue, decisions, appeals

## Prototype Policy Notice
Phase 6 policy requirements and policy rules are ResolveX prototype assumptions for demo and product validation. They are not official legal policy, card-network rules, or issuer/acquirer operating regulations.

## Implemented Authentication Endpoints
### `POST /api/auth/register`
Registers a prototype user.

Request:
```json
{
  "name": "ResolveX Member",
  "email": "member@resolvex.demo",
  "password": "CorrectPassword123!",
  "role": "CARD_MEMBER"
}
```

Response:
```json
{
  "accessToken": "jwt",
  "tokenType": "Bearer",
  "user": {
    "id": "uuid",
    "name": "ResolveX Member",
    "email": "member@resolvex.demo",
    "role": "CARD_MEMBER"
  }
}
```

Rules:
- `email` must be unique.
- `role` must be one of `CARD_MEMBER`, `MERCHANT`, or `ANALYST`.
- `passwordHash` must never appear in the response.

### `POST /api/auth/login`
Authenticates an existing user.

Request:
```json
{
  "email": "member@resolvex.demo",
  "password": "CorrectPassword123!"
}
```

Response:
```json
{
  "accessToken": "jwt",
  "tokenType": "Bearer",
  "user": {
    "id": "uuid",
    "name": "ResolveX Member",
    "email": "member@resolvex.demo",
    "role": "CARD_MEMBER"
  }
}
```

### `GET /api/auth/profile`
Returns the authenticated user profile.

Headers:
```text
Authorization: Bearer <accessToken>
```

Response:
```json
{
  "id": "uuid",
  "name": "ResolveX Member",
  "email": "member@resolvex.demo",
  "role": "CARD_MEMBER"
}
```

## Implemented Transaction Endpoints
All transaction endpoints require a JWT bearer token and the `CARD_MEMBER` role.

### `GET /api/transactions`
Returns only transactions belonging to the authenticated card member.

Response:
```json
[
  {
    "id": "uuid",
    "merchantId": "uuid",
    "merchantName": "Northstar Electronics",
    "amount": "249.99",
    "currency": "USD",
    "transactionDate": "2026-06-08T14:22:00.000Z",
    "status": "POSTED",
    "maskedCardLast4": "4242",
    "createdAt": "2026-07-24T00:00:00.000Z",
    "updatedAt": "2026-07-24T00:00:00.000Z"
  }
]
```

Rules:
- Merchants and analysts cannot use card-member transaction endpoints.
- Amounts are returned as decimal strings to avoid JavaScript floating-point corruption.
- Real card numbers are never returned; only masked last-four digits are allowed.

### `GET /api/transactions/:transactionId`
Returns one transaction only when it belongs to the authenticated card member.

Rules:
- A transaction owned by another card member returns `404`.
- A missing transaction returns `404`.

## Implemented Dispute Endpoints
All dispute endpoints require a JWT bearer token and the `CARD_MEMBER` role.

### `POST /api/disputes`
Creates a dispute for one authenticated card-member transaction.

Request:
```json
{
  "transactionId": "uuid",
  "reasonCode": "GOODS_NOT_RECEIVED",
  "cardMemberStatement": "The package was never delivered to my address."
}
```

Response:
```json
{
  "id": "uuid",
  "transactionId": "uuid",
  "cardMemberId": "uuid",
  "merchantId": "uuid",
  "reasonCode": "GOODS_NOT_RECEIVED",
  "cardMemberStatement": "The package was never delivered to my address.",
  "merchantStatement": null,
  "merchantResponseDate": null,
  "merchantResponseStatus": "PENDING",
  "status": "AWAITING_MERCHANT",
  "responseDeadline": "2026-07-31T00:00:00.000Z",
  "createdAt": "2026-07-24T00:00:00.000Z",
  "updatedAt": "2026-07-24T00:00:00.000Z",
  "resolvedAt": null,
  "transaction": {
    "id": "uuid",
    "merchantName": "Northstar Electronics",
    "amount": "249.99",
    "currency": "USD",
    "maskedCardLast4": "4242"
  }
}
```

Rules:
- The transaction must belong to the authenticated card member.
- Only `GOODS_NOT_RECEIVED`, `REFUND_NOT_PROCESSED`, and `CANCELLED_GOODS_OR_SERVICES` are accepted.
- Multiple active disputes for the same transaction are rejected.
- Creating a dispute records `SUBMITTED` and `AWAITING_MERCHANT` timeline events in the same database transaction.
- The merchant response deadline is configured by `DISPUTE_MERCHANT_RESPONSE_DAYS`.
- Merchants and analysts cannot create card-member disputes.

### `GET /api/disputes`
Returns only disputes belonging to the authenticated card member.

### `GET /api/disputes/:caseId`
Returns one dispute only when it belongs to the authenticated card member.

### `GET /api/disputes/:caseId/timeline`
Returns timeline events for one dispute only when the dispute belongs to the authenticated card member.

Response:
```json
[
  {
    "id": "uuid",
    "caseId": "uuid",
    "eventType": "CASE_SUBMITTED",
    "description": "Card member submitted the dispute.",
    "performedBy": "uuid",
    "metadata": {
      "status": "SUBMITTED",
      "reasonCode": "GOODS_NOT_RECEIVED"
    },
    "createdAt": "2026-07-24T00:00:00.000Z"
  }
]
```

## Error Format
All API errors use:
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "timestamp": "2026-07-24T00:00:00.000Z",
  "path": "/api/auth/register"
}
```

## Planned Endpoint Groups
- `PATCH /api/cases/:caseId/status`
- `POST /api/cases/:caseId/evidence`
- `GET /api/cases/:caseId/evidence`
- `POST /api/cases/:caseId/analyst-review`

## Evidence Requirement
Every decision response must include:
- Case ID
- Final status
- Deterministic policy rule IDs
- Structured evidence references
- Confidence indicators
- Human review reason when applicable

## Implemented Merchant Endpoints
All merchant endpoints require a JWT bearer token and the `MERCHANT` role.

### `GET /api/merchant/disputes`
Returns only disputes assigned to the authenticated merchant account.

Rules:
- A merchant sees only cases where `DisputeCase.merchantId` matches their user ID.
- Card members and analysts cannot use this endpoint.

### `GET /api/merchant/disputes/:caseId`
Returns one dispute only when it is assigned to the authenticated merchant.

Rules:
- A dispute assigned to another merchant returns `404`.
- A missing dispute returns `404`.

### `GET /api/disputes/:caseId/requirements`
Returns active prototype policy requirements for the case reason.

Response:
```json
[
  {
    "id": "uuid",
    "reasonCode": "GOODS_NOT_RECEIVED",
    "requirementKey": "delivery_confirmation",
    "requirementName": "Delivery confirmation",
    "description": "Prototype ResolveX policy rule, not official legal or card-network policy: merchant provides carrier delivery confirmation or tracking proof.",
    "acceptedEvidenceTypes": ["delivery_confirmation", "tracking_record", "carrier_proof"],
    "weight": 25,
    "isMandatory": true,
    "policyVersion": "prototype-v1",
    "active": true,
    "createdAt": "2026-07-24T00:00:00.000Z",
    "updatedAt": "2026-07-24T00:00:00.000Z"
  }
]
```

Rules:
- Requirements are loaded from PostgreSQL `PolicyRequirement` rows, not hardcoded in controllers.
- The authenticated merchant must be assigned to the dispute case.
- Phase 3 seeds prototype requirements for `GOODS_NOT_RECEIVED`, `REFUND_NOT_PROCESSED`, and `CANCELLED_GOODS_OR_SERVICES`.

### `POST /api/disputes/:caseId/merchant-response`
Submits a final structured merchant response for an assigned dispute.

Request:
```json
{
  "merchantStatement": "We shipped the goods to the card member address and have attached shipment and delivery proof.",
  "evidence": [
    {
      "requirementKey": "delivery_confirmation",
      "evidenceType": "tracking_record",
      "value": "Carrier tracking shows delivery on 2026-07-02.",
      "metadata": {
        "trackingNumber": "DEMO-TRACK-123"
      }
    }
  ]
}
```

Rules:
- Only merchants can submit merchant responses.
- The merchant must be assigned to the dispute case.
- `merchantStatement` is required.
- Submitted evidence must match active prototype policy requirements for the case reason.
- All mandatory requirements for the reason must be present.
- Evidence types must be accepted by the matching `PolicyRequirement.acceptedEvidenceTypes`.
- The case must be in `AWAITING_MERCHANT`.
- The response must be before `responseDeadline`, unless a future analyst workflow marks the merchant response as `REOPENED`.
- Duplicate final responses are rejected after `merchantResponseStatus` becomes `SUBMITTED`.
- Valid submission updates `merchantStatement`, `merchantResponseDate`, `merchantResponseStatus`, and moves status to `EVIDENCE_PROCESSING`.
- Valid submission creates `MERCHANT_RESPONSE_SUBMITTED` and `CASE_STATUS_CHANGED` timeline events.

## Implemented Evidence Endpoints
Evidence endpoints require a JWT bearer token unless the endpoint is a short-lived local download-content URL generated by `GET /api/evidence/:evidenceId/download`.

Allowed file types:
- PDF: `application/pdf` with `.pdf`
- PNG: `image/png` with `.png`
- JPG/JPEG: `image/jpeg` with `.jpg` or `.jpeg`

Rules:
- `STORAGE_PROVIDER=local` creates a local multipart upload target.
- `STORAGE_PROVIDER=s3` creates a short-lived S3 presigned `PUT` upload target.
- `MAX_EVIDENCE_FILE_SIZE_BYTES` limits evidence file size.
- File names are sanitized before persistence.
- Internal storage keys are not returned by evidence metadata endpoints.
- Card members and merchants can upload only to cases they belong to.
- Card members and merchants can read evidence for cases they belong to.
- Analysts can read evidence for review workflows; assignment modeling is reserved for a later analyst phase.
- Card members cannot modify merchant-submitted evidence, and merchants cannot modify card-member-submitted evidence.
- Deletes are allowed only before evaluation locks the case, currently `DRAFT`, `SUBMITTED`, `AWAITING_MERCHANT`, and `EVIDENCE_PROCESSING`.
- Upload target creation, upload confirmation, and deletion create timeline events with audit-ready metadata.

### `POST /api/disputes/:caseId/evidence/upload-target`
Creates an evidence metadata row and returns the upload target.

Request:
```json
{
  "evidenceType": "delivery_confirmation",
  "fileName": "delivery-proof.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 204800
}
```

Local response:
```json
{
  "evidenceId": "uuid",
  "uploadUrl": "http://localhost:3000/api/evidence/uuid/local-upload",
  "method": "POST",
  "headers": {},
  "fields": {
    "fileField": "file"
  },
  "expiresAt": "2026-07-25T10:10:00.000Z"
}
```

S3 response uses the same shape, with `method` set to `PUT`, `uploadUrl` set to a presigned URL, and required headers included in `headers`.

### `POST /api/evidence/:evidenceId/local-upload`
Local-development multipart upload target. Submit a `multipart/form-data` request with file field `file`. This route is returned only by local upload targets and requires the same authenticated submitting user.

Response:
```json
{
  "fileHash": "sha256-hex"
}
```

### `POST /api/disputes/:caseId/evidence/confirm`
Confirms that the object exists and persists a SHA-256 hash. Local storage calculates the hash if omitted. S3 confirmation accepts a caller-provided hash when supplied.

Request:
```json
{
  "evidenceId": "uuid",
  "fileHash": "4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7c75a5a5efcff8e"
}
```

Response omits the internal `storageKey`:
```json
{
  "id": "uuid",
  "caseId": "uuid",
  "submittedByUserId": "uuid",
  "submittedByRole": "CARD_MEMBER",
  "evidenceType": "delivery_confirmation",
  "fileName": "delivery-proof.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 204800,
  "fileHash": "sha256-hex",
  "processingStatus": "UPLOADED",
  "extractionConfidence": null,
  "createdAt": "2026-07-25T10:00:00.000Z",
  "updatedAt": "2026-07-25T10:01:00.000Z",
  "facts": []
}
```

### `GET /api/disputes/:caseId/evidence`
Lists evidence metadata for one visible case.

### `GET /api/evidence/:evidenceId`
Returns one visible evidence metadata record with extracted facts.

### `GET /api/evidence/:evidenceId/download`
Returns a short-lived temporary download target.

Response:
```json
{
  "downloadUrl": "temporary-url",
  "expiresAt": "2026-07-25T10:05:00.000Z"
}
```

### `PATCH /api/evidence/:evidenceId/facts`
Replaces extracted facts for one evidence item. The submitting party can correct its own evidence facts and mark them verified; analysts may update facts during review workflows.

Request:
```json
{
  "facts": [
    {
      "factType": "tracking_number",
      "factValue": "DEMO-TRACK-123",
      "normalizedValue": "DEMO-TRACK-123",
      "confidence": 0.92,
      "sourcePage": 1,
      "verifiedByUser": true,
      "correctedByUser": false
    }
  ]
}
```

### `DELETE /api/evidence/:evidenceId`
Deletes an evidence metadata row and underlying storage object when the user owns the evidence and the case status still allows evidence changes. Successful deletion returns `204`.

### `POST /api/evidence/:evidenceId/process`
Processes uploaded evidence through the AI service.

Rules:
- The submitting user or an analyst may request processing.
- The backend marks the item `PROCESSING` before calling the AI service.
- Stored evidence bytes are sent server-side; internal storage keys are not exposed.
- AI responses are schema-validated before database writes.
- AI output creates reviewable facts only. It does not decide the dispute outcome.
- Successful processing stores extracted facts, stores aggregate extraction confidence, marks evidence `PROCESSED`, and creates an `EVIDENCE_PROCESSED` timeline event.
- Failed processing marks evidence `FAILED` and creates an `EVIDENCE_PROCESSING_FAILED` timeline event.

### `POST /api/evidence/:evidenceId/retry`
Retries evidence processing only when the current evidence status is `FAILED`. Successful retry marks evidence `PROCESSED`; failed retry returns `FAILED` again with a retry failure timeline event.

### `GET /api/evidence/:evidenceId/facts`
Returns extracted facts for a visible evidence item.

Response:
```json
[
  {
    "id": "uuid",
    "evidenceId": "uuid",
    "factType": "ORDER_ID",
    "factValue": "ORD-10045",
    "normalizedValue": "ORD-10045",
    "confidence": 0.9,
    "sourcePage": null,
    "verifiedByUser": false,
    "correctedByUser": false,
    "createdAt": "2026-07-25T10:01:00.000Z",
    "updatedAt": "2026-07-25T10:01:00.000Z"
  }
]
```

## Implemented Policy Evaluation Endpoints
Policy evaluation endpoints require a JWT bearer token. Analysts can run evaluation. Card members, merchants, and analysts can read evaluation outputs for cases they can access.

The deterministic engine stores `EvidenceScore` rows and appends a `DecisionRecord`. `DecisionRecord.modelMetadata.aiDecisionUsed` is always `false`; AI and Hugging Face outputs may supply extracted facts only.

Evidence quality score:
- source reliability: 25%
- directness: 25%
- completeness: 20%
- consistency: 20%
- timeliness: 10%

Automatic recommendation gate defaults:
- `POLICY_AUTO_CONFIDENCE_THRESHOLD=85`
- `POLICY_AUTO_DECISION_MARGIN_THRESHOLD=20`
- `POLICY_CRITICAL_FACT_CONFIDENCE_THRESHOLD=0.8`

Automation is blocked when confidence or margin is too low, mandatory requirements are not configured, high-severity contradictions are unresolved, critical facts are not verified or above confidence threshold, a policy exception is present, or an applied rule requires review.

### `POST /api/disputes/:caseId/evaluate`
Runs deterministic prototype policy evaluation for an analyst-visible case.

Response excerpt:
```json
{
  "id": "uuid",
  "caseId": "uuid",
  "recommendedOutcome": "MERCHANT_SUPPORTED",
  "cardMemberScore": 0,
  "merchantScore": 96,
  "confidence": 96,
  "decisionMargin": 96,
  "decisionType": "AUTOMATED_RECOMMENDATION",
  "policyVersion": "prototype-v1",
  "modelMetadata": {
    "aiDecisionUsed": false,
    "deterministicPolicyEngine": true
  },
  "explanationData": {
    "disputeCategory": "GOODS_NOT_RECEIVED",
    "appliedRuleIdentifiers": ["PX-GNR-002"],
    "recommendedOutcome": "MERCHANT_SUPPORTED",
    "confidence": 96,
    "humanReviewReason": null
  },
  "createdAt": "2026-07-25T00:00:00.000Z"
}
```

### `GET /api/disputes/:caseId/evaluation`
Returns the latest decision record for a visible case.

### `GET /api/disputes/:caseId/evidence-matrix`
Returns active requirements and stored evidence scores grouped by requirement.

### `GET /api/disputes/:caseId/explanation`
Returns a structured explanation generated from facts and rule results:
- dispute category
- what needed to be proven
- evidence submitted by each party
- verified facts
- missing evidence
- contradictions
- applied rule identifiers
- recommended outcome
- confidence
- human review reason when applicable

Prototype rule identifiers:
- `PX-GNR-001`: dispatch alone does not prove delivery.
- `PX-GNR-002`: verified delivery confirmation plus recipient or location confirmation supports merchant.
- `PX-GNR-003`: missing delivery proof plus consistent non-delivery evidence supports card member.
- `PX-GNR-004`: conflicting location or recipient evidence requires human review.
- `PX-REF-001`: refund promise without completed refund record supports card member.
- `PX-REF-002`: matching completed refund transaction supports merchant.
- `PX-REF-003`: amount/date/reference contradictions require review.
- `PX-CAN-001`: timely valid cancellation plus no service delivery and no refund supports card member.
- `PX-CAN-002`: late cancellation after clearly accepted policy may support merchant.
- `PX-CAN-003`: unclear timing or policy acceptance requires review.

## AI Service Endpoints
The AI service is a separate FastAPI process. It extracts and classifies reviewable evidence facts only.

### `GET /health`
Returns service status and provider metadata.

### `POST /parse-document`
Accepts `multipart/form-data` with either a file field named `file` or text field `document_text`.

Response includes:
- `extracted_text`
- `structured_facts`
- `document_classification`
- `warnings`
- `provider_metadata`
- `summary`

### `POST /classify-evidence`
Classifies document text using deterministic keywords and optional Hugging Face support analysis.

### `POST /detect-contradictions`
Returns candidate contradictions across supplied texts. These are review signals only, not outcomes.

### `POST /summarize-evidence`
Returns a short evidence summary for analyst review.
