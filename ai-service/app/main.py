import logging
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.logging_config import configure_logging
from app.processors.nlp import NLPProcessor
from app.providers.ocr import LocalTesseractOCRProvider, OCRProvider, OptionalAWSTextractOCRProvider
from app.schemas import (
    ClassifyEvidenceRequest,
    ClassifyEvidenceResponse,
    ContradictionRequest,
    ContradictionResponse,
    ErrorResponse,
    HealthResponse,
    ParseDocumentRequest,
    ParseDocumentResponse,
    ProviderMetadata,
    SummarizeEvidenceRequest,
    SummarizeEvidenceResponse,
)
from app.settings import Settings, get_settings

configure_logging()
logger = logging.getLogger("resolvex.ai")

app = FastAPI(
    title="ResolveX AI Service",
    description="Evidence extraction service. It extracts reviewable facts and never decides dispute outcomes.",
    version="0.1.0",
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled AI service error")
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(error="internal_error", detail="AI service request failed").model_dump(),
    )


@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    return JSONResponse(
        status_code=422,
        content=ErrorResponse(error="validation_error", detail=exc.errors()).model_dump(),
    )


def get_ocr_provider(settings: Annotated[Settings, Depends(get_settings)]) -> OCRProvider:
    if settings.ocr_provider.lower() == "aws-textract":
        return OptionalAWSTextractOCRProvider(
            enabled=settings.aws_textract_enabled,
            region=settings.aws_region,
        )
    return LocalTesseractOCRProvider()


def get_nlp_processor(settings: Annotated[Settings, Depends(get_settings)]) -> NLPProcessor:
    return NLPProcessor(
        spacy_model=settings.spacy_model,
        hf_enabled=settings.hf_classification_enabled,
        hf_model=settings.hf_classification_model,
    )


@app.get("/health", response_model=HealthResponse)
def health(
    settings: Annotated[Settings, Depends(get_settings)],
    processor: Annotated[NLPProcessor, Depends(get_nlp_processor)],
) -> HealthResponse:
    metadata = processor.metadata()
    return HealthResponse(
        status="ok",
        service=settings.service_name,
        provider_metadata=metadata,
    )


@app.post("/parse-document", response_model=ParseDocumentResponse)
async def parse_document(
    processor: Annotated[NLPProcessor, Depends(get_nlp_processor)],
    ocr_provider: Annotated[OCRProvider, Depends(get_ocr_provider)],
    settings: Annotated[Settings, Depends(get_settings)],
    file: UploadFile | None = File(default=None),
    document_text: str | None = Form(default=None),
    file_name: str | None = Form(default=None),
    mime_type: str | None = Form(default=None),
    evidence_type_hint: str | None = Form(default=None),
) -> ParseDocumentResponse:
    request = ParseDocumentRequest(
        document_text=document_text,
        file_name=file_name or file.filename if file else file_name,
        mime_type=mime_type or file.content_type if file else mime_type,
        evidence_type_hint=evidence_type_hint,
    )
    warnings: list[str] = []

    if file is not None:
        document_bytes = await file.read()
        if len(document_bytes) > settings.max_document_bytes:
            raise HTTPException(status_code=413, detail="Document exceeds MAX_DOCUMENT_BYTES")
        ocr_result = ocr_provider.extract_text(document_bytes, request.mime_type, request.file_name)
        extracted_text = ocr_result.text
        warnings.extend(ocr_result.warnings)
        ocr_provider_name = str(ocr_result.provider_metadata.get("ocr_provider", "unknown"))
    elif request.document_text is not None:
        extracted_text = request.document_text
        ocr_provider_name = "text-input"
    else:
        raise HTTPException(status_code=400, detail="Either file or document_text is required")

    result = processor.process(extracted_text, request.evidence_type_hint)
    metadata = with_ocr_provider(result.metadata, ocr_provider_name)
    logger.info("parsed_document facts=%s classification=%s", len(result.facts), result.classification.label)

    return ParseDocumentResponse(
        extracted_text=result.text,
        structured_facts=result.facts,
        document_classification=result.classification,
        warnings=warnings + result.warnings,
        provider_metadata=metadata,
        summary=result.summary,
    )


@app.post("/classify-evidence", response_model=ClassifyEvidenceResponse)
def classify_evidence(
    request: ClassifyEvidenceRequest,
    processor: Annotated[NLPProcessor, Depends(get_nlp_processor)],
) -> ClassifyEvidenceResponse:
    classification, warnings = processor.classify(processor.cleanup_text(request.text), request.evidence_type_hint)
    return ClassifyEvidenceResponse(
        document_classification=classification,
        warnings=warnings + processor.warnings,
        provider_metadata=processor.metadata(),
    )


@app.post("/detect-contradictions", response_model=ContradictionResponse)
def detect_contradictions(
    request: ContradictionRequest,
    processor: Annotated[NLPProcessor, Depends(get_nlp_processor)],
) -> ContradictionResponse:
    candidates = processor.detect_contradictions(request.texts)
    return ContradictionResponse(
        contradiction_candidates=candidates,
        warnings=processor.warnings,
        provider_metadata=processor.metadata(),
    )


@app.post("/summarize-evidence", response_model=SummarizeEvidenceResponse)
def summarize_evidence(
    request: SummarizeEvidenceRequest,
    processor: Annotated[NLPProcessor, Depends(get_nlp_processor)],
) -> SummarizeEvidenceResponse:
    return SummarizeEvidenceResponse(
        summary=processor.summarize(request.text, request.max_sentences),
        warnings=processor.warnings,
        provider_metadata=processor.metadata(),
    )


def with_ocr_provider(metadata: ProviderMetadata, ocr_provider_name: str) -> ProviderMetadata:
    return ProviderMetadata(
        ocr_provider=ocr_provider_name,
        nlp_processor=metadata.nlp_processor,
        spacy_model=metadata.spacy_model,
        hf_model=metadata.hf_model,
        hf_available=metadata.hf_available,
    )
