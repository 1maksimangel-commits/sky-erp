"""Application configuration loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    telegram_bot_token: str = Field(..., alias="TELEGRAM_BOT_TOKEN")
    telegram_group_id: int = Field(..., alias="TELEGRAM_GROUP_ID")
    supabase_url: str = Field(..., alias="SUPABASE_URL")
    supabase_service_role_key: str = Field(..., alias="SUPABASE_SERVICE_ROLE_KEY")
    openai_api_key: str = Field(..., alias="OPENAI_API_KEY")
    timezone: str = Field(default="Asia/Vladivostok", alias="TIMEZONE")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    # Defaults mirrored in bot_settings / schema seed; overridable via DB.
    reminder_start_day: int = 23
    reading_due_day: int = 25
    common_warning_percent: float = 25.0
    consumption_warning_percent: float = 30.0

    meter_photos_bucket: str = "meter-photos"
    payment_documents_bucket: str = "payment-documents"
    reports_bucket: str = "reports"
    openai_vision_model: str = "gpt-4o"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
