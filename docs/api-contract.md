# API Contract

This file documents the intended API surface for future implementation. Phase 0 does not implement these endpoints.

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

## Planned Resources
- `Auth`: login, refresh token, current user
- `Cases`: disputed transaction case lifecycle
- `Evidence`: uploads, extracted fields, evidence review status
- `Policy Evaluation`: deterministic rule evaluation and explanation
- `Analyst Review`: human review queue, decisions, appeals

## Planned Endpoint Groups
- `POST /api/auth/login`
- `GET /api/auth/me`
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
