# ResolveX Agent Guide

## Purpose
ResolveX is an explainable AI-assisted dispute and chargeback resolution platform for transactions that have already been disputed. It is not a fraud-detection system.

## Repository Structure
- `frontend/` - React, TypeScript, Vite, React Router, Axios, Bootstrap
- `backend/` - NestJS, TypeScript, Prisma, PostgreSQL
- `ai-service/` - Python, FastAPI, spaCy, Hugging Face, OCR integrations
- `docs/` - architecture, API, database, status, and demo documentation
- `sample-data/` - non-sensitive demo fixtures only
- `docker-compose.yml` - local development dependencies

## Technology Stack
- Frontend: React, TypeScript, Vite, React Router, Axios, Bootstrap
- Backend: NestJS, TypeScript, Prisma, PostgreSQL
- AI service: Python, FastAPI
- NLP: spaCy, Hugging Face
- OCR: local Tesseract, optional AWS Textract
- Storage: local storage in development, Amazon S3 in production
- Authentication: JWT with role-based authorization
- Testing: Jest, PyTest, React Testing Library, Postman
- Deployment: Vercel frontend and AWS-compatible backend architecture

## Supported Dispute Categories
- `GOODS_NOT_RECEIVED`
- `REFUND_NOT_PROCESSED`
- `CANCELLED_GOODS_OR_SERVICES`

## User Roles
- `CARD_MEMBER`
- `MERCHANT`
- `ANALYST`

## Commands
Frontend:
- Install: `cd frontend && npm install`
- Run: `cd frontend && npm run dev`
- Build: `cd frontend && npm run build`
- Lint: `cd frontend && npm run lint`
- Test: `cd frontend && npm test`

Backend:
- Install: `cd backend && npm install`
- Run: `cd backend && npm run start:dev`
- Build: `cd backend && npm run build`
- Lint: `cd backend && npm run lint`
- Test: `cd backend && npm test`

AI service:
- Install: `cd ai-service && python -m venv .venv && .\\.venv\\Scripts\\pip install -r requirements.txt`
- Run: `cd ai-service && .\\.venv\\Scripts\\uvicorn app.main:app --reload`
- Build: `cd ai-service && python -m compileall .`
- Lint: `cd ai-service && ruff check .`
- Test: `cd ai-service && pytest`

Local dependencies:
- Run PostgreSQL: `docker compose up -d postgres`
- Validate Compose: `docker compose config`

## Rules
- Frontend code must not be placed in `backend/`.
- Backend code must not be placed in `frontend/`.
- AI models must not directly decide the winner of a dispute.
- Decision outcomes must come from a deterministic policy engine.
- Every decision must reference structured evidence.
- Low-confidence or conflicting cases must enter human review.
- No real banking credentials, card numbers, or personal data may be committed.
- All environment variables must be documented in `.env.example`.
- No phase is complete unless build, lint, and relevant tests pass.
