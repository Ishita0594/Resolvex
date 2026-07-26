# ResolveX

ResolveX is an explainable AI-assisted dispute and chargeback resolution platform. It helps process transactions that have already been disputed and routes outcomes through deterministic policy rules backed by structured evidence.

This prototype is for non-sensitive demo data only. It must not process real cardholder data, real banking credentials, or live payment-network evidence, and it does not claim compliance certifications.

ResolveX is not a fraud-detection system.

## Phase 9 Backend Scope

Phase 9 prepares the completed backend and AI service for local judging:

- Production-ready backend and AI-service Dockerfiles
- Development Compose stack with PostgreSQL, backend, AI service, and local evidence storage
- Prisma seed data with demo users and stable dispute scenarios
- Health checks, startup checks, HTTP examples, and deployment environment documentation

## Structure

- `frontend/` - React, TypeScript, Vite, React Router, Axios, Bootstrap
- `backend/` - NestJS, TypeScript, Prisma, PostgreSQL
- `ai-service/` - Python, FastAPI, spaCy, Hugging Face, OCR
- `docs/` - project documentation
- `sample-data/` - safe demo data only

## Prerequisites

- Docker Desktop with Compose
- Node.js 22 if running the backend outside Docker
- Python 3.12 if running the AI service outside Docker
- PostgreSQL 16 if not using Compose

## Fast Local Demo

```powershell
copy .env.example .env
docker compose up -d --build
docker compose ps
Invoke-RestMethod http://localhost:3000/api/health
Invoke-RestMethod http://localhost:8000/health
```

The backend container runs migrations and seeds demo data on startup. PostgreSQL is exposed on `5432`, the backend on `3000`, and the AI service on `8000`.

## Demo Credentials

All demo accounts use `ResolveXDemo123!` unless `RESOLVEX_DEMO_PASSWORD` or role-specific seed passwords are set.

- `member@resolvex.demo`
- `merchant@resolvex.demo`
- `analyst@resolvex.demo`

## Stable Demo Scenarios

- Scenario A, card member supported: `91000000-0000-4000-8000-000000000001`
- Scenario B, merchant supported: `91000000-0000-4000-8000-000000000002`
- Scenario C, human review: `91000000-0000-4000-8000-000000000003`
- Scenario D, refund not processed: `91000000-0000-4000-8000-000000000004`

## Backend Commands

```powershell
cd backend
npm install
copy .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run reset-demo-data
npm run start:dev
npm run lint
npm run build
npm test
```

## AI Service Commands

```powershell
cd ai-service
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\uvicorn app.main:app --reload
python -m compileall app
pytest
```

## Deployment Variables

Documented deployment settings live in [.env.example](.env.example), [backend/.env.example](backend/.env.example), [ai-service/.env.example](ai-service/.env.example), and [docs/deployment.md](docs/deployment.md). Required backend values include `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `AI_SERVICE_URL`, `STORAGE_PROVIDER`, and automatic decision thresholds. S3 credentials are required only when `STORAGE_PROVIDER=s3`.

## Architecture Summary

ResolveX separates responsibilities across a React frontend, NestJS backend, PostgreSQL database, and FastAPI AI service. AI extraction produces structured facts only. The deterministic policy engine evaluates those facts and stores explainable decision records. Low-confidence, contradictory, or policy-exception cases go to analyst review with audit logs and notifications.

## Known Limitations

- Synthetic prototype data only; do not process real cardholder data.
- No compliance certification is claimed.
- Local evidence storage is for development and judging only.
- Prototype policy rules are explainable assumptions, not legal or card-network rules.
- Hugging Face classification is disabled by default to keep local startup deterministic.

## Documentation

- [Architecture](docs/architecture.md)
- [API Contract](docs/api-contract.md)
- [Database Design](docs/database-design.md)
- [Status Machine](docs/status-machine.md)
- [Demo Scenarios](docs/demo-scenarios.md)
- [Deployment Notes](docs/deployment.md)
- [HTTP Examples](docs/http-examples.md)
