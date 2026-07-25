# ResolveX AI Service

FastAPI service for evidence text extraction, structured fact extraction, classification, contradiction candidates, and summaries.

AI output is reviewable evidence support only. It must not directly decide which party wins a dispute.

## Local Setup
```powershell
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\uvicorn app.main:app --reload
```

The default setup uses `SPACY_MODEL=blank:en`, deterministic regex parsers, text-based fixtures, and local OCR fallbacks. Hugging Face classification is disabled by default to avoid downloading a model during local setup.

## Endpoints
- `GET /health`
- `POST /parse-document`
- `POST /classify-evidence`
- `POST /detect-contradictions`
- `POST /summarize-evidence`

## Tests
```powershell
pytest
python -m compileall app
```

## Docker
```powershell
docker build -t resolvex-ai-service .
```

The repository-level Compose stack builds this service, exposes it on `8000`, and checks `GET /health` before starting the backend.
