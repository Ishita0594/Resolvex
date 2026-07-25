# ResolveX Deployment Notes

ResolveX Phase 9 prepares the backend and AI service for local judging and production-style container deployment. This prototype uses synthetic demo data only and must not process real cardholder data, banking credentials, or live payment-network evidence.

## Containers

- `backend/Dockerfile` builds the NestJS API, generates Prisma Client, installs production dependencies, and runs as a non-root user.
- `ai-service/Dockerfile` builds the FastAPI evidence extraction service with local Tesseract support and runs as a non-root user.
- `docker-compose.yml` starts PostgreSQL, the backend, the AI service, and a local evidence volume.

## Required Backend Variables

- `DATABASE_URL`: PostgreSQL connection string.
- `JWT_SECRET`: signing secret, at least 32 characters. Use a real secret outside local demos.
- `FRONTEND_URL`: browser origin allowed by default CORS configuration.
- `CORS_ALLOWED_ORIGINS`: comma-separated allowlist. Overrides `FRONTEND_URL` when set.
- `AI_SERVICE_URL`: FastAPI base URL. In Compose this is `http://ai-service:8000`.
- `STORAGE_PROVIDER`: `local` or `s3`.
- `LOCAL_STORAGE_PATH`: local evidence directory when `STORAGE_PROVIDER=local`.
- `MAX_EVIDENCE_FILE_SIZE_BYTES`: configurable upload cap.
- `POLICY_AUTO_CONFIDENCE_THRESHOLD`: default `85`.
- `POLICY_AUTO_DECISION_MARGIN_THRESHOLD`: default `20`.
- `POLICY_CRITICAL_FACT_CONFIDENCE_THRESHOLD`: default `0.8`.

## S3 Variables

Set these only when `STORAGE_PROVIDER=s3`:

- `AWS_REGION`
- `S3_BUCKET_NAME` or `AWS_S3_BUCKET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN`, when temporary credentials are used

Do not commit credentials or place real secrets in sample files.

## AI Service Variables

- `OCR_PROVIDER`: `local` for local OCR, or deployment-specific provider names.
- `AWS_TEXTRACT_ENABLED`: `true` only when Textract is configured.
- `SPACY_MODEL`: defaults to `blank:en` for deterministic local startup.
- `HF_CLASSIFICATION_ENABLED`: defaults to `false` to avoid model downloads during judging.
- `HF_CLASSIFICATION_MODEL`: Hugging Face classifier name when enabled.
- `MAX_DOCUMENT_BYTES`: AI-service input size cap.

## Health Checks

- Backend: `GET http://localhost:3000/api/health`
- AI service: `GET http://localhost:8000/health`
- Compose waits for PostgreSQL and AI service health before starting the backend.
- Backend startup runs `prisma migrate deploy` and `prisma db seed` before serving traffic.

## Production Recommendations

- Use managed PostgreSQL with automated backups and migration review.
- Use S3 or equivalent object storage with private buckets, short-lived URLs, and lifecycle retention.
- Put the backend and AI service behind TLS and a managed ingress or API gateway.
- Use a secret manager for JWT, database, and cloud credentials.
- Disable demo seed credentials outside judging environments.
- Keep Hugging Face models pinned by version or digest if enabled.
- Add observability for request IDs, audit events, queue latency, AI failures, and policy outcomes.

ResolveX does not claim PCI, SOC 2, ISO, or card-network compliance.
