from enum import Enum
from typing import Any
from pydantic import BaseModel, Field


class FactType(str, Enum):
    TRANSACTION_AMOUNT = "TRANSACTION_AMOUNT"
    TRANSACTION_DATE = "TRANSACTION_DATE"
    ORDER_ID = "ORDER_ID"
    MERCHANT_NAME = "MERCHANT_NAME"
    DELIVERY_DATE = "DELIVERY_DATE"
    DELIVERY_STATUS = "DELIVERY_STATUS"
    RECIPIENT_NAME = "RECIPIENT_NAME"
    DELIVERY_LOCATION = "DELIVERY_LOCATION"
    CANCELLATION_DATE = "CANCELLATION_DATE"
    REFUND_AMOUNT = "REFUND_AMOUNT"
    REFUND_DATE = "REFUND_DATE"
    REFUND_REFERENCE = "REFUND_REFERENCE"


class StructuredFact(BaseModel):
    fact_type: FactType
    fact_value: str = Field(min_length=1)
    normalized_value: str | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    source_page: int | None = Field(default=None, ge=1)
    evidence: str | None = None


class DocumentClassification(BaseModel):
    label: str
    confidence: float = Field(ge=0, le=1)
    method: str


class ProviderMetadata(BaseModel):
    ocr_provider: str
    nlp_processor: str
    spacy_model: str
    hf_model: str | None = None
    hf_available: bool = False


class ParseDocumentRequest(BaseModel):
    document_text: str | None = None
    file_name: str | None = None
    mime_type: str | None = None
    evidence_type_hint: str | None = None


class ParseDocumentResponse(BaseModel):
    extracted_text: str
    structured_facts: list[StructuredFact]
    document_classification: DocumentClassification
    warnings: list[str] = Field(default_factory=list)
    provider_metadata: ProviderMetadata
    summary: str


class ClassifyEvidenceRequest(BaseModel):
    text: str = Field(min_length=1)
    evidence_type_hint: str | None = None


class ClassifyEvidenceResponse(BaseModel):
    document_classification: DocumentClassification
    warnings: list[str] = Field(default_factory=list)
    provider_metadata: ProviderMetadata


class ContradictionRequest(BaseModel):
    texts: list[str] = Field(min_length=1)


class ContradictionCandidate(BaseModel):
    fact_type: FactType
    values: list[str]
    confidence: float = Field(ge=0, le=1)
    explanation: str


class ContradictionResponse(BaseModel):
    contradiction_candidates: list[ContradictionCandidate]
    warnings: list[str] = Field(default_factory=list)
    provider_metadata: ProviderMetadata


class SummarizeEvidenceRequest(BaseModel):
    text: str = Field(min_length=1)
    max_sentences: int = Field(default=3, ge=1, le=8)


class SummarizeEvidenceResponse(BaseModel):
    summary: str
    warnings: list[str] = Field(default_factory=list)
    provider_metadata: ProviderMetadata


class HealthResponse(BaseModel):
    status: str
    service: str
    provider_metadata: ProviderMetadata


class ErrorResponse(BaseModel):
    error: str
    detail: Any | None = None
