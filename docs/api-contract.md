# API Contract

This file documents the API surface for ResolveX. Phase 2 implements authentication, card-member transaction reads, dispute creation, dispute reads, and dispute timelines.

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

## Planned Resources
- `Evidence`: uploads, extracted fields, evidence review status
- `Policy Evaluation`: deterministic rule evaluation and explanation
- `Analyst Review`: human review queue, decisions, appeals

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
- `POST /api/cases/:caseId/evaluate`
- `POST /api/cases/:caseId/analyst-review`

## Evidence Requirement
Every decision response must include:
- Case ID
- Final status
- Deterministic policy rule IDs
- Structured evidence references
- Confidence indicators
- Human review reason when applicable
