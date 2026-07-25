from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.processors.nlp import NLPProcessor
from app.providers.ocr import LocalTesseractOCRProvider
from app.schemas import FactType

FIXTURES = Path(__file__).parent / "fixtures"


def fixture_text(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


def fact_values(response: dict, fact_type: FactType) -> list[str]:
    return [
        fact["normalized_value"] or fact["fact_value"]
        for fact in response["structured_facts"]
        if fact["fact_type"] == fact_type.value
    ]


def test_health_endpoint() -> None:
    client = TestClient(app)
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_ocr_provider_returns_text_for_text_fixture() -> None:
    provider = LocalTesseractOCRProvider()
    result = provider.extract_text(
        fixture_text("invoice.txt").encode("utf-8"),
        "text/plain",
        "invoice.txt",
    )

    assert "Northstar Electronics" in result.text
    assert result.warnings == []


def test_date_amount_and_order_id_extraction_on_invoice_fixture() -> None:
    processor = NLPProcessor()
    result = processor.process(fixture_text("invoice.txt"))

    values = {(fact.fact_type, fact.normalized_value or fact.fact_value) for fact in result.facts}
    assert (FactType.ORDER_ID, "ORD-10045") in values
    assert (FactType.TRANSACTION_AMOUNT, "249.99") in values
    assert (FactType.TRANSACTION_DATE, "2026-07-02") in values


def test_parse_document_endpoint_extracts_delivery_facts() -> None:
    client = TestClient(app)
    response = client.post(
        "/parse-document",
        data={
            "document_text": fixture_text("delivery_record.txt"),
            "file_name": "delivery_record.txt",
            "mime_type": "text/plain",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert "DELIVERED" in fact_values(body, FactType.DELIVERY_STATUS)
    assert "ORD-10045" in fact_values(body, FactType.ORDER_ID)
    assert body["document_classification"]["label"] == "delivery_record"


def test_low_confidence_or_missing_values_are_represented_safely() -> None:
    processor = NLPProcessor()
    result = processor.process("This message says a package exists but gives no amount or date.")

    assert result.facts == []
    assert result.classification.confidence <= 0.45


def test_refund_and_cancellation_fixtures_extract_expected_facts() -> None:
    processor = NLPProcessor()
    refund = processor.process(fixture_text("refund_email.txt"))
    cancellation = processor.process(fixture_text("cancellation_email.txt"))

    refund_values = {(fact.fact_type, fact.normalized_value or fact.fact_value) for fact in refund.facts}
    cancellation_values = {
        (fact.fact_type, fact.normalized_value or fact.fact_value)
        for fact in cancellation.facts
    }
    assert (FactType.REFUND_AMOUNT, "89.50") in refund_values
    assert (FactType.REFUND_DATE, "2026-07-08") in refund_values
    assert (FactType.REFUND_REFERENCE, "RFND-77881") in refund_values
    assert (FactType.CANCELLATION_DATE, "2026-07-10") in cancellation_values


def test_contradiction_candidates_are_basic_and_reviewable() -> None:
    client = TestClient(app)
    response = client.post(
        "/detect-contradictions",
        json={
            "texts": [
                "Order ID: ORD-10045\nDelivery Status: delivered",
                "Order ID: ORD-10045\nDelivery Status: not delivered",
            ]
        },
    )

    assert response.status_code == 200
    candidates = response.json()["contradiction_candidates"]
    assert any(candidate["fact_type"] == FactType.DELIVERY_STATUS.value for candidate in candidates)
