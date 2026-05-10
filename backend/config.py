"""Centralized settings — Pydantic v2 Settings.

Every config value is a field here; no `os.getenv` calls anywhere
else in the codebase. Reads from `backend/.env` in local dev and
from process env in production (env vars win on conflict).
"""
from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Auth
    session_secret_key: str = Field(default="dev-insecure-change-me")
    session_lifetime_minutes: int = 60

    # Database
    database_url: str = Field(
        default="postgresql+psycopg://phn:phn_local_only@localhost:5432/ph_navigator_v2"
    )

    # Object storage (R2)
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = "ph-navigator-v2-dev"
    r2_endpoint_url: str = ""

    # Crypto
    fernet_secret_key: str = ""

    # CORS — comma-separated origins in env, list at use site
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
