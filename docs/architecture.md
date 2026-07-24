# ResolveX Architecture

## Purpose
ResolveX assists with already-disputed transactions by collecting evidence, extracting structured signals, evaluating deterministic policy rules, and routing uncertain cases to human analysts.

## Services
- Frontend: React app for card members, merchants, and analysts.
- Backend: NestJS API for authentication, dispute workflows, evidence records, policy evaluation, and audit history.
- AI service: FastAPI service for OCR, NLP extraction, summarization, and confidence scoring.
- PostgreSQL: relational source of truth for cases, users, evidence, status history, and policy outcomes.
- Document storage: local file storage in development and Amazon S3 in production.

## Decision Flow
1. A disputed transaction case is submitted.
2. The backend requests merchant and card-member evidence as required.
3. Evidence documents are stored and passed to the AI service for extraction.
4. The AI service returns structured evidence, labels, summaries, and confidence scores.
5. A deterministic policy engine evaluates the structured evidence.
6. Low-confidence, incomplete, or conflicting cases move to `HUMAN_REVIEW`.
7. Final outcomes reference policy rules and structured evidence.

## Core Boundary
AI models may assist evidence extraction and explanation, but they must not directly decide the winning party. Resolution outcomes must come from deterministic policy rules.
