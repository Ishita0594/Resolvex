# Security Hardening Notes

## Threat Assumptions
- ResolveX is a financial-services hackathon prototype for disputed transactions only.
- The prototype assumes authenticated users may be card members, merchants, or analysts and must be constrained by role and case ownership.
- Evidence files may contain sensitive dispute context, so metadata endpoints must not expose internal storage keys or full evidence content in events.
- AI service output is untrusted extraction data. It may support fact review, but it must never directly decide the dispute winner.
- Websocket events are safe-display signals only and must not broadcast complete evidence content.

## Implemented Hardening
- Secure HTTP headers are applied globally.
- CORS uses `CORS_ALLOWED_ORIGINS`; empty allowlist permits local/non-browser development clients.
- Request IDs are attached to responses and safe error bodies.
- Auth and upload/processing endpoints use bounded in-memory rate limiting.
- DTO validation is global with whitelist and forbidden unknown properties.
- Error responses avoid stack traces and include a request ID.
- Audit log JSON is recursively masked for password, token, authorization, secret, card, and similar sensitive fields.
- Evidence filenames are sanitized, executable extensions are rejected, MIME/extension pairs are validated, and file size is configurable.
- Temporary local evidence downloads use signed, expiring URLs.
- AI calls use timeout, bounded retry with backoff, schema validation, and safe `FAILED` evidence state.
- Status transitions are centralized in `CaseStatusService` and tested for allowed/prohibited moves.

## Database Reliability
- Prisma models use foreign keys for users, cases, transactions, evidence, reviews, audit logs, notifications, scores, and decisions.
- High-traffic and lookup paths have indexes for case, user, status, outcome, policy version, and notification read state.
- Multi-record workflows use transactions for merchant responses, evidence confirmation, policy evaluation, and analyst decisions.
- Money uses PostgreSQL `Decimal`; API serializers return decimal values as strings.
- Previous system and human decision records are preserved instead of overwritten.

## Prototype Limitations
- Rate limiting is in-memory and per-process. Production needs a shared store such as Redis.
- Analyst assignment is not modeled; analysts can see the review queue.
- Local storage is for development only. Production should use S3 or equivalent with malware scanning and retention policies.
- The health endpoint reports connectivity status but is not a full observability system.
- The prototype does not claim PCI DSS, SOC 2, ISO 27001, or any compliance certification.
- The prototype must not process real cardholder data, real banking credentials, or live payment-network evidence.

## Production Recommendations
- Use managed secrets, key rotation, and separate signing keys per environment.
- Enforce a strict production CORS allowlist.
- Move rate limiting and websocket session state to shared infrastructure.
- Add malware scanning, content-type sniffing defenses, and quarantine for evidence uploads.
- Add immutable audit storage and centralized logging with secret redaction.
- Add database migration checks in CI/CD against disposable databases before production deploys.
- Add formal data-retention, deletion, legal hold, and evidence lifecycle policies.
- Add analyst assignment, dual-control review for overrides, and operational alerting.

## Data Retention Considerations
- Evidence files and extracted facts should have category-specific retention windows.
- Audit logs should be retained separately from mutable operational data.
- Temporary evidence URLs should remain short-lived and non-cacheable.
- Demo fixtures should remain synthetic and non-sensitive.
