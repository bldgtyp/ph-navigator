"""Centralized settings — Pydantic v2 Settings.

Every config value is a field here; no `os.getenv` calls anywhere
else in the codebase. Reads from `backend/.env` in local dev and
from process env in production (env vars win on conflict).
"""

from __future__ import annotations

from typing import Literal
from urllib.parse import urlparse

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
    session_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
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

    # MCP resource-server metadata for Streamable HTTP clients.
    mcp_issuer_url: str = "http://localhost:8000"
    mcp_resource_server_url: str = "http://localhost:8000/mcp"
    mcp_enable_dns_rebinding_protection: bool = True
    mcp_allowed_hosts: str = ""
    mcp_allowed_origins: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def cors_origins_set(self) -> frozenset[str]:
        return frozenset(self.cors_origins_list)

    @property
    def mcp_allowed_hosts_list(self) -> list[str]:
        local_hosts = ["localhost:*", "127.0.0.1:*", "[::1]:*"]
        configured_hosts = _comma_separated(self.mcp_allowed_hosts)
        derived_hosts = [_url_netloc(url) for url in [self.mcp_issuer_url, self.mcp_resource_server_url]]
        return _dedupe([*local_hosts, *configured_hosts, *derived_hosts])

    @property
    def mcp_allowed_origins_list(self) -> list[str]:
        local_origins = ["http://localhost:*", "http://127.0.0.1:*"]
        configured_origins = _comma_separated(self.mcp_allowed_origins)
        derived_origins = [
            _url_origin(url) for url in [self.mcp_issuer_url, self.mcp_resource_server_url, *self.cors_origins_list]
        ]
        return _dedupe([*local_origins, *configured_origins, *derived_origins])

    @property
    def session_cookie_secure(self) -> bool:
        return self.environment not in {"development", "test", "local"}


def _comma_separated(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _url_netloc(value: str) -> str | None:
    parsed = urlparse(value)
    return parsed.netloc or None


def _url_origin(value: str) -> str | None:
    parsed = urlparse(value)
    if not parsed.scheme or not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}"


def _dedupe(values: list[str | None]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for value in values:
        if value is None or value in seen:
            continue
        seen.add(value)
        deduped.append(value)
    return deduped


settings = Settings()
