import re
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Iterable

import spacy

from app.schemas import (
    ContradictionCandidate,
    DocumentClassification,
    FactType,
    ProviderMetadata,
    StructuredFact,
)


@dataclass
class NLPResult:
    text: str
    facts: list[StructuredFact]
    classification: DocumentClassification
    summary: str
    warnings: list[str]
    metadata: ProviderMetadata


class NLPProcessor:
    def __init__(
        self,
        spacy_model: str = "blank:en",
        hf_enabled: bool = False,
        hf_model: str = "distilbert-base-uncased-finetuned-sst-2-english",
    ) -> None:
        self.warnings: list[str] = []
        self.spacy_model_name = spacy_model
        self.nlp = self._load_spacy(spacy_model)
        self.hf_model = hf_model
        self.hf_classifier = self._load_hf_pipeline(hf_enabled, hf_model)

    def process(self, text: str, evidence_type_hint: str | None = None) -> NLPResult:
        warnings: list[str] = []
        cleaned = self.cleanup_text(text)
        facts = self.extract_facts(cleaned)
        classification, classification_warnings = self.classify(cleaned, evidence_type_hint)
        warnings.extend(self.warnings)
        warnings.extend(classification_warnings)
        summary = self.summarize(cleaned)

        return NLPResult(
            text=cleaned,
            facts=facts,
            classification=classification,
            summary=summary,
            warnings=dedupe(warnings),
            metadata=self.metadata(),
        )

    def cleanup_text(self, text: str) -> str:
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    def extract_facts(self, text: str) -> list[StructuredFact]:
        facts: list[StructuredFact] = []
        facts.extend(self._amount_facts(text))
        facts.extend(self._date_facts(text))
        facts.extend(self._id_facts(text))
        facts.extend(self._named_text_facts(text))
        return merge_duplicate_facts(facts)

    def classify(self, text: str, evidence_type_hint: str | None = None) -> tuple[DocumentClassification, list[str]]:
        warnings: list[str] = []
        lowered = text.lower()
        scores = {
            "invoice": keyword_score(lowered, ["invoice", "amount due", "order id", "merchant"]),
            "delivery_record": keyword_score(lowered, ["delivered", "delivery", "recipient", "tracking"]),
            "refund_email": keyword_score(lowered, ["refund", "refunded", "refund reference", "refund date"]),
            "cancellation_email": keyword_score(lowered, ["cancelled", "canceled", "cancellation"]),
        }

        if evidence_type_hint:
            hint = evidence_type_hint.lower()
            for label in scores:
                if hint in label or label in hint:
                    scores[label] += 1.0

        label, score = max(scores.items(), key=lambda item: item[1])
        confidence = min(0.95, 0.45 + score * 0.12) if score > 0 else 0.25
        method = "deterministic-keywords"

        if self.hf_classifier is not None:
            try:
                result = self.hf_classifier(text[:1024])
                first = result[0] if isinstance(result, list) and result else {}
                if first.get("label"):
                    warnings.append("Hugging Face classifier is used only as support analysis, not as a decision.")
                    confidence = max(confidence, min(float(first.get("score", 0.0)), 0.95))
                    method = f"hf-support:{self.hf_model}"
            except Exception as exc:
                warnings.append(f"Hugging Face classifier unavailable at runtime; fallback used: {exc}")

        return DocumentClassification(label=label, confidence=confidence, method=method), warnings

    def detect_contradictions(self, texts: Iterable[str]) -> list[ContradictionCandidate]:
        values_by_type: dict[FactType, set[str]] = {}
        for text in texts:
            for fact in self.extract_facts(self.cleanup_text(text)):
                if fact.normalized_value or fact.fact_value:
                    values_by_type.setdefault(fact.fact_type, set()).add(fact.normalized_value or fact.fact_value)

        candidates: list[ContradictionCandidate] = []
        for fact_type, values in values_by_type.items():
            if len(values) > 1 and fact_type in {
                FactType.TRANSACTION_AMOUNT,
                FactType.TRANSACTION_DATE,
                FactType.ORDER_ID,
                FactType.DELIVERY_STATUS,
                FactType.REFUND_AMOUNT,
                FactType.REFUND_DATE,
            }:
                candidates.append(
                    ContradictionCandidate(
                        fact_type=fact_type,
                        values=sorted(values),
                        confidence=0.72,
                        explanation=f"Multiple candidate values were extracted for {fact_type.value}.",
                    )
                )
        return candidates

    def summarize(self, text: str, max_sentences: int = 3) -> str:
        cleaned = self.cleanup_text(text)
        doc = self.nlp(cleaned)
        sentences = [sent.text.strip() for sent in doc.sents if sent.text.strip()]
        if not sentences:
            sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+", cleaned) if part.strip()]
        return " ".join(sentences[:max_sentences])[:1200]

    def metadata(self) -> ProviderMetadata:
        return ProviderMetadata(
            ocr_provider="none",
            nlp_processor="regex-spacy-hf-fallback",
            spacy_model=self.spacy_model_name,
            hf_model=self.hf_model if self.hf_classifier is not None else None,
            hf_available=self.hf_classifier is not None,
        )

    def _load_spacy(self, spacy_model: str):
        try:
            if spacy_model.startswith("blank:"):
                nlp = spacy.blank(spacy_model.split(":", 1)[1])
            else:
                nlp = spacy.load(spacy_model)
        except Exception:
            nlp = spacy.blank("en")
            self.warnings.append("Configured spaCy model unavailable; using blank English pipeline.")

        if "sentencizer" not in nlp.pipe_names:
            nlp.add_pipe("sentencizer")
        return nlp

    def _load_hf_pipeline(self, hf_enabled: bool, hf_model: str):
        if not hf_enabled:
            return None

        try:
            from transformers import pipeline

            return pipeline("text-classification", model=hf_model)
        except Exception as exc:
            self.warnings.append(f"Hugging Face classifier unavailable; deterministic fallback active: {exc}")
            return None

    def _amount_facts(self, text: str) -> list[StructuredFact]:
        facts: list[StructuredFact] = []
        amount_patterns = [
            (FactType.TRANSACTION_AMOUNT, r"(?:transaction amount|amount due|total|amount)\s*[:#-]?\s*\$?\s*([0-9][0-9,]*(?:\.[0-9]{2})?)"),
            (FactType.REFUND_AMOUNT, r"(?:refund amount|refunded|refund)\s*[:#-]?\s*\$?\s*([0-9][0-9,]*(?:\.[0-9]{2})?)"),
        ]
        for fact_type, pattern in amount_patterns:
            for match in re.finditer(pattern, text, flags=re.IGNORECASE):
                normalized = normalize_amount(match.group(1))
                if normalized:
                    facts.append(
                        StructuredFact(
                            fact_type=fact_type,
                            fact_value=match.group(1),
                            normalized_value=normalized,
                            confidence=0.88,
                            evidence=match.group(0),
                        )
                    )
        return facts

    def _date_facts(self, text: str) -> list[StructuredFact]:
        patterns = [
            (FactType.TRANSACTION_DATE, r"(?:transaction date|purchase date|invoice date|date)\s*[:#-]?\s*([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{4})"),
            (FactType.DELIVERY_DATE, r"(?:delivery date|delivered on|delivered)\s*[:#-]?\s*([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{4})"),
            (FactType.CANCELLATION_DATE, r"(?:cancellation date|cancelled on|canceled on|cancelled|canceled)\s*[:#-]?\s*([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{4})"),
            (FactType.REFUND_DATE, r"(?:refund date|refunded on|refund processed on)\s*[:#-]?\s*([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{4})"),
        ]
        facts: list[StructuredFact] = []
        for fact_type, pattern in patterns:
            for match in re.finditer(pattern, text, flags=re.IGNORECASE):
                normalized = normalize_date(match.group(1))
                facts.append(
                    StructuredFact(
                        fact_type=fact_type,
                        fact_value=match.group(1),
                        normalized_value=normalized,
                        confidence=0.84 if normalized else 0.45,
                        evidence=match.group(0),
                    )
                )
        return facts

    def _id_facts(self, text: str) -> list[StructuredFact]:
        patterns = [
            (FactType.ORDER_ID, r"(?:order id|order number|order #)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{3,40})"),
            (FactType.REFUND_REFERENCE, r"(?:refund reference|refund ref|reference)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{3,40})"),
        ]
        facts: list[StructuredFact] = []
        for fact_type, pattern in patterns:
            for match in re.finditer(pattern, text, flags=re.IGNORECASE):
                facts.append(
                    StructuredFact(
                        fact_type=fact_type,
                        fact_value=match.group(1),
                        normalized_value=match.group(1).upper(),
                        confidence=0.9,
                        evidence=match.group(0),
                    )
                )
        return facts

    def _named_text_facts(self, text: str) -> list[StructuredFact]:
        patterns = [
            (FactType.MERCHANT_NAME, r"(?:merchant|seller|from)\s*[:#-]?\s*([A-Za-z0-9 &'.,-]{2,80})"),
            (FactType.RECIPIENT_NAME, r"(?:recipient|received by|signed by)\s*[:#-]?\s*([A-Za-z &'.,-]{2,80})"),
            (FactType.DELIVERY_LOCATION, r"(?:delivery location|delivered to|ship to|shipping address)\s*[:#-]?\s*([A-Za-z0-9 #&'.,-]{5,140})"),
            (FactType.DELIVERY_STATUS, r"(?:delivery status|status)\s*[:#-]?\s*(delivered|in transit|not delivered|returned|failed|cancelled|canceled)"),
        ]
        facts: list[StructuredFact] = []
        for fact_type, pattern in patterns:
            for match in re.finditer(pattern, text, flags=re.IGNORECASE):
                value = match.group(1).strip(" .,\n")
                facts.append(
                    StructuredFact(
                        fact_type=fact_type,
                        fact_value=value,
                        normalized_value=value.upper() if fact_type == FactType.DELIVERY_STATUS else value,
                        confidence=0.78,
                        evidence=match.group(0),
                    )
                )
        return facts


def normalize_amount(value: str) -> str | None:
    try:
        amount = Decimal(value.replace(",", ""))
    except InvalidOperation:
        return None
    return f"{amount:.2f}"


def normalize_date(value: str) -> str | None:
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(value.strip(), fmt).date().isoformat()
        except ValueError:
            continue
    return None


def keyword_score(text: str, keywords: list[str]) -> float:
    return sum(1.0 for keyword in keywords if keyword in text)


def merge_duplicate_facts(facts: list[StructuredFact]) -> list[StructuredFact]:
    best_by_key: dict[tuple[FactType, str], StructuredFact] = {}
    for fact in facts:
        key = (fact.fact_type, fact.normalized_value or fact.fact_value)
        current = best_by_key.get(key)
        if current is None or (fact.confidence or 0) > (current.confidence or 0):
            best_by_key[key] = fact
    return list(best_by_key.values())


def dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value not in seen:
            result.append(value)
            seen.add(value)
    return result
