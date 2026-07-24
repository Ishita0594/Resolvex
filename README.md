# ResolveX

ResolveX is an explainable AI-assisted dispute and chargeback resolution platform. It helps process transactions that have already been disputed and routes outcomes through deterministic policy rules backed by structured evidence.

ResolveX is not a fraud-detection system.

## Phase 0 Scope
This repository currently contains the project foundation only:
- Repository structure
- Documentation
- Local PostgreSQL Compose setup
- Environment examples

Authentication, dispute APIs, AI processing, and UI screens are intentionally not implemented yet.

## Structure
- `frontend/` - React, TypeScript, Vite, React Router, Axios, Bootstrap
- `backend/` - NestJS, TypeScript, Prisma, PostgreSQL
- `ai-service/` - Python, FastAPI, spaCy, Hugging Face, OCR
- `docs/` - project documentation
- `sample-data/` - safe demo data only

## Start Local Dependencies
```powershell
docker compose up -d postgres
```

PostgreSQL is exposed locally on port `5432` using safe development credentials from `.env.example`. Change all credentials outside local development.

## Developer Startup
Developer 1 can begin backend setup in `backend/` using NestJS, Prisma, and PostgreSQL. Developer 2 can begin frontend setup in `frontend/` using React, Vite, Bootstrap, Axios, and React Router.

Both developers should read `AGENTS.md` and the files in `docs/` before writing implementation code.

## Documentation
- [Architecture](docs/architecture.md)
- [API Contract](docs/api-contract.md)
- [Database Design](docs/database-design.md)
- [Status Machine](docs/status-machine.md)
- [Demo Scenarios](docs/demo-scenarios.md)
