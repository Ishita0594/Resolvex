# API Contract

This file documents the API surface for ResolveX. Phase 1 implements authentication only; dispute, evidence, policy evaluation, and analyst review endpoints remain planned.

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

## Planned Resources
- `Cases`: disputed transaction case lifecycle
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
- `POST /api/cases`
- `GET /api/cases`
- `GET /api/cases/:caseId`
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
