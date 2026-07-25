# ResolveX Backend

NestJS, TypeScript, Prisma, PostgreSQL, JWT authentication, and role-based authorization live here.

Do not place frontend or AI service code in this directory.

## Setup
```powershell
npm install
copy .env.example .env
npm run prisma:generate
npm run prisma:migrate -- --name init_auth
npm run prisma:seed
```

The seed script creates prototype users for local demos:
- `member@resolvex.demo`
- `merchant@resolvex.demo`
- `analyst@resolvex.demo`

Set `RESOLVEX_DEMO_PASSWORD` or role-specific `RESOLVEX_DEMO_*_PASSWORD` values in `.env`. If omitted, the script uses the documented development-only fallback `ResolveXDemo123!`.

## Evidence Storage
Local development uses `STORAGE_PROVIDER=local` and writes evidence files under `LOCAL_STORAGE_PATH` without AWS credentials.

Use `STORAGE_PROVIDER=s3` in production-style environments and provide `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY`. Evidence upload and download URLs are short-lived and controlled by `EVIDENCE_UPLOAD_URL_TTL_SECONDS` and `EVIDENCE_DOWNLOAD_URL_TTL_SECONDS`.

## AI Evidence Processing
Set `AI_SERVICE_URL` to the FastAPI AI service base URL, usually `http://localhost:8000` in development. `AI_SERVICE_TIMEOUT_MS` controls the backend request timeout when processing evidence.

AI extraction can create structured facts, but it must not decide dispute outcomes.

## Deterministic Policy Evaluation
Phase 6 stores prototype `PolicyRule`, `EvidenceScore`, and `DecisionRecord` data in PostgreSQL. Analysts run `POST /api/disputes/:caseId/evaluate`; case participants can read `/evaluation`, `/evidence-matrix`, and `/explanation`.

Automatic recommendations use deterministic prototype rules only. The default gate is `POLICY_AUTO_CONFIDENCE_THRESHOLD=85`, `POLICY_AUTO_DECISION_MARGIN_THRESHOLD=20`, and `POLICY_CRITICAL_FACT_CONFIDENCE_THRESHOLD=0.8`.

## Commands
```powershell
npm run start:dev
npm run lint
npm run build
npm test
```
