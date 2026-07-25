# ResolveX Architecture

## Purpose
ResolveX assists with already-disputed transactions by collecting evidence, extracting structured signals, evaluating deterministic policy rules, and routing uncertain cases to human analysts.

## Services
- Frontend: React app for card members, merchants, and analysts.
- Backend: NestJS API for authentication, dispute workflows, evidence records, policy evaluation, and audit history.
- AI service: FastAPI service for OCR, NLP extraction, evidence classification, contradiction candidates, summarization, and confidence scoring.
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

## Phase 5 Evidence Extraction Flow
1. A card member or merchant uploads evidence through the backend storage abstraction.
2. `POST /api/evidence/:evidenceId/process` marks the evidence `PROCESSING`.
3. The backend reads the stored object server-side and sends the file bytes to the AI service `/parse-document` endpoint.
4. The AI service uses local text extraction, Tesseract where available, optional AWS Textract, spaCy, deterministic parsers, and optional Hugging Face support analysis.
5. The backend validates the AI response schema and allowed fact types before storing extracted facts in PostgreSQL.
6. Evidence becomes `PROCESSED` with extraction confidence, or `FAILED` with an audit timeline event.
7. Users can correct and verify facts through the backend. Corrected or verified facts are preserved across later processing.

## Core Boundary
AI models may assist evidence extraction and explanation, but they must not directly decide the winning party. Resolution outcomes must come from deterministic policy rules.
