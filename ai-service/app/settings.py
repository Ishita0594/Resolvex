from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "resolvex-ai-service"
    ocr_provider: str = "local"
    aws_textract_enabled: bool = False
    aws_region: str = "us-east-1"
    spacy_model: str = "blank:en"
    hf_classification_enabled: bool = False
    hf_classification_model: str = "distilbert-base-uncased-finetuned-sst-2-english"
    max_document_bytes: int = 10 * 1024 * 1024

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
