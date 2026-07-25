from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from io import BytesIO


@dataclass
class OCRResult:
    text: str
    warnings: list[str] = field(default_factory=list)
    provider_metadata: dict[str, str | bool | None] = field(default_factory=dict)


class OCRProvider(ABC):
    @abstractmethod
    def extract_text(self, document_bytes: bytes, mime_type: str | None, file_name: str | None) -> OCRResult:
        raise NotImplementedError


class LocalTesseractOCRProvider(OCRProvider):
    name = "local-tesseract"

    def extract_text(self, document_bytes: bytes, mime_type: str | None, file_name: str | None) -> OCRResult:
        warnings: list[str] = []
        normalized_mime = (mime_type or "").lower()
        suffix = (file_name or "").lower()

        if normalized_mime.startswith("text/") or suffix.endswith((".txt", ".md", ".eml")):
            return OCRResult(
                text=document_bytes.decode("utf-8", errors="replace"),
                warnings=warnings,
                provider_metadata={"ocr_provider": self.name},
            )

        if normalized_mime == "application/pdf" or suffix.endswith(".pdf"):
            text = self._extract_pdf_text(document_bytes, warnings)
            return OCRResult(
                text=text,
                warnings=warnings,
                provider_metadata={"ocr_provider": self.name},
            )

        if normalized_mime in {"image/png", "image/jpeg"} or suffix.endswith((".png", ".jpg", ".jpeg")):
            text = self._extract_image_text(document_bytes, warnings)
            return OCRResult(
                text=text,
                warnings=warnings,
                provider_metadata={"ocr_provider": self.name},
            )

        warnings.append("Unsupported OCR mime type; attempted UTF-8 text fallback.")
        return OCRResult(
            text=document_bytes.decode("utf-8", errors="replace"),
            warnings=warnings,
            provider_metadata={"ocr_provider": self.name},
        )

    def _extract_pdf_text(self, document_bytes: bytes, warnings: list[str]) -> str:
        try:
            from pypdf import PdfReader
        except Exception:
            warnings.append("pypdf is unavailable; attempted UTF-8 PDF fallback.")
            return document_bytes.decode("utf-8", errors="replace")

        try:
            reader = PdfReader(BytesIO(document_bytes))
            pages = [page.extract_text() or "" for page in reader.pages]
            text = "\n".join(page.strip() for page in pages if page.strip())
            if not text:
                warnings.append("No embedded PDF text found; image OCR may be required.")
            return text
        except Exception as exc:
            warnings.append(f"PDF text extraction failed: {exc}")
            return document_bytes.decode("utf-8", errors="replace")

    def _extract_image_text(self, document_bytes: bytes, warnings: list[str]) -> str:
        try:
            from PIL import Image
            import pytesseract
        except Exception:
            warnings.append("Pillow or pytesseract is unavailable; image OCR skipped.")
            return ""

        try:
            image = Image.open(BytesIO(document_bytes))
            return pytesseract.image_to_string(image)
        except Exception as exc:
            warnings.append(f"Tesseract OCR failed: {exc}")
            return ""


class OptionalAWSTextractOCRProvider(OCRProvider):
    name = "aws-textract"

    def __init__(self, enabled: bool = False, region: str = "us-east-1") -> None:
        self.enabled = enabled
        self.region = region

    def extract_text(self, document_bytes: bytes, mime_type: str | None, file_name: str | None) -> OCRResult:
        if not self.enabled:
            return OCRResult(
                text="",
                warnings=["AWS Textract provider is disabled."],
                provider_metadata={"ocr_provider": self.name, "aws_textract_enabled": False},
            )

        try:
            import boto3
        except Exception:
            return OCRResult(
                text="",
                warnings=["boto3 is unavailable; AWS Textract OCR skipped."],
                provider_metadata={"ocr_provider": self.name, "aws_textract_enabled": False},
            )

        client = boto3.client("textract", region_name=self.region)
        response = client.detect_document_text(Document={"Bytes": document_bytes})
        lines = [
            block.get("Text", "")
            for block in response.get("Blocks", [])
            if block.get("BlockType") == "LINE" and block.get("Text")
        ]
        return OCRResult(
            text="\n".join(lines),
            warnings=[],
            provider_metadata={"ocr_provider": self.name, "aws_textract_enabled": True},
        )
