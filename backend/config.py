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
    app_version: str = "0.1.0"
    environment: str = "development"
    git_sha: str = ""
    session_lifetime_minutes: int = 60
    session_cookie_name: str = "phn_session"
    password_argon2_time_cost: int = 3
    password_argon2_memory_cost: int = 65536
    password_argon2_parallelism: int = 4

    # Database
    database_url: str = Field(default="postgresql://phn:phn_local_only@localhost:5433/ph_navigator_v2")

    # Object storage (R2)
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = "ph-navigator-v2-dev"
    r2_endpoint_url: str = ""

    # Future at-rest field encryption. Not used by TB-01 session cookies,
    # which are opaque pointers to rows in the sessions table.
    fernet_secret_key: str = ""

    # CORS — comma-separated origins in env, list at use site
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def cors_origins_set(self) -> frozenset[str]:
        return frozenset(self.cors_origins_list)

    @property
    def session_cookie_secure(self) -> bool:
        return self.environment not in {"development", "test", "local"}


settings = Settings()
