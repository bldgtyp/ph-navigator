"""Backend logging configuration and request-context tests."""

from __future__ import annotations

import asyncio
import json
import logging
import sys
from collections.abc import Iterator
from io import StringIO
from typing import Literal
from uuid import UUID

import httpx
import pytest
import structlog
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.requests import Request

import logging_config
from config import Settings
from features.shared.middleware import _accept_request_id, _client_ip, _int_or_none, request_context_middleware


@pytest.fixture(autouse=True)
def reset_logging() -> Iterator[None]:
    logging_config._reset_logging_for_tests()
    yield
    logging_config._reset_logging_for_tests()


def test_configure_logging_renders_json_with_logger_redaction_and_truncation(monkeypatch: pytest.MonkeyPatch) -> None:
    stream = StringIO()
    monkeypatch.setattr(sys, "stdout", stream)
    logging_config.configure_logging(_settings(log_format="json"))

    long_value = "x" * (100 * 1024)
    structlog.get_logger("tests.logging").info(
        "logging.json_ready",
        token="secret-token",
        Authorization="Bearer secret",
        password="secret-password",
        body=long_value,
    )

    payload = json.loads(stream.getvalue())
    assert payload["event"] == "logging.json_ready"
    assert payload["logger"] == "tests.logging"
    assert payload["environment"] == "test"
    assert payload["git_sha"] == "abc123"
    assert payload["token"] == "***"
    assert payload["Authorization"] == "***"
    assert payload["password"] == "***"
    assert payload["body"].endswith("...<trunc>")
    assert len(payload["body"]) <= 4106


def test_configure_logging_renders_console_output(monkeypatch: pytest.MonkeyPatch) -> None:
    stream = StringIO()
    monkeypatch.setattr(sys, "stdout", stream)
    logging_config.configure_logging(_settings(log_format="console"))

    structlog.get_logger("tests.logging").info("logging.console_ready", project_id="p1")

    output = stream.getvalue()
    assert "logging.console_ready" in output
    assert "project_id" in output
    assert "p1" in output


def test_configure_logging_is_idempotent_and_clears_existing_root_handlers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    stale_stream = StringIO()
    stale_handler = logging.StreamHandler(stale_stream)
    logging.getLogger().addHandler(stale_handler)

    stream = StringIO()
    monkeypatch.setattr(sys, "stdout", stream)
    logging_config.configure_logging(_settings(log_format="json"))
    logging_config.configure_logging(_settings(log_format="json"))

    assert stale_handler not in logging.getLogger().handlers
    app_handlers = [
        handler for handler in logging.getLogger().handlers if not handler.__class__.__module__.startswith("_pytest.")
    ]
    assert len(app_handlers) == 1

    log = structlog.get_logger("tests.logging")
    log.info("logging.once")
    log.info("logging.twice")
    assert len([line for line in stream.getvalue().splitlines() if line]) == 2
    assert stale_stream.getvalue() == ""


def test_request_middleware_binds_context_and_emits_access_log(caplog: pytest.LogCaptureFixture) -> None:
    logging_config.configure_logging(_settings(log_format="json"))
    app = FastAPI()
    app.middleware("http")(request_context_middleware)

    @app.get("/api/v1/projects")
    def route() -> dict[str, bool]:
        structlog.get_logger("tests.middleware").info("logging.context_seen")
        return {"ok": True}

    with caplog.at_level(logging.INFO):
        response = TestClient(app).get(
            "/api/v1/projects",
            headers={"X-Request-ID": "request-123", "X-Forwarded-For": "203.0.113.10, 10.0.0.1"},
        )

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "request-123"
    route_record = _record_event(caplog.records, "logging.context_seen")
    assert route_record["request_id"] == "request-123"
    assert route_record["method"] == "GET"
    assert route_record["path"] == "/api/v1/projects"
    assert route_record["client_ip"] == "203.0.113.10"
    assert _record_event(caplog.records, "http.request")["status"] == 200


@pytest.mark.asyncio
async def test_request_contextvars_do_not_leak_user_id_between_concurrent_requests(
    caplog: pytest.LogCaptureFixture,
) -> None:
    logging_config.configure_logging(_settings(log_format="json"))
    app = FastAPI()
    app.middleware("http")(request_context_middleware)

    @app.get("/users/{user_id}")
    async def route(user_id: str) -> dict[str, str]:
        structlog.contextvars.bind_contextvars(user_id=user_id)
        await asyncio.sleep(0.01)
        structlog.get_logger("tests.middleware").info("logging.user_seen", route_user=user_id)
        return {"user_id": user_id}

    transport = httpx.ASGITransport(app=app)
    with caplog.at_level(logging.INFO):
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            await asyncio.gather(client.get("/users/u1"), client.get("/users/u2"))

    seen: dict[object, object] = {}
    for record in caplog.records:
        if getattr(record, "event", None) != "logging.user_seen":
            continue
        message = record.msg
        if isinstance(message, dict):
            seen[message["route_user"]] = message["user_id"]
    assert seen == {"u1": "u1", "u2": "u2"}


def test_request_contextvars_clear_when_route_raises() -> None:
    logging_config.configure_logging(_settings(log_format="json"))
    app = FastAPI()
    app.middleware("http")(request_context_middleware)

    @app.get("/boom")
    def route() -> None:
        raise RuntimeError("boom")

    response = TestClient(app, raise_server_exceptions=False).get("/boom", headers={"X-Request-ID": "boom-request"})

    assert response.status_code == 500
    assert "request_id" not in structlog.contextvars.get_contextvars()


def test_accept_request_id_trust_boundary() -> None:
    valid = "frontend-request-1"
    assert _accept_request_id(valid) == valid

    for raw in [None, "", "x" * 65, "bad\nid"]:
        accepted = _accept_request_id(raw)
        UUID(accepted)
        assert accepted != raw


def test_client_ip_and_int_helpers() -> None:
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/inspect",
            "headers": [(b"x-forwarded-for", b"198.51.100.2, 10.0.0.1")],
            "client": ("127.0.0.1", 1234),
        }
    )
    assert _client_ip(request) == "198.51.100.2"
    assert _int_or_none("42") == 42
    assert _int_or_none(None) is None
    assert _int_or_none("") is None
    assert _int_or_none("chunked") is None


def test_caplog_can_assert_on_event_name(caplog: pytest.LogCaptureFixture) -> None:
    logging_config.configure_logging(_settings(log_format="json"))

    with caplog.at_level(logging.INFO):
        structlog.get_logger("tests.logging").info("project_document.saved", project_id="p1")

    assert any(getattr(record, "event", None) == "project_document.saved" for record in caplog.records)


def _settings(*, log_format: Literal["json", "console"]) -> Settings:
    return Settings(
        app_version="test-version",
        environment="test",
        git_sha="abc123",
        render_instance_id="test-instance",
        log_format=log_format,
    )


def _record_event(records: list[logging.LogRecord], event: str) -> dict[str, object]:
    for record in records:
        if getattr(record, "event", None) == event:
            if isinstance(record.msg, dict):
                return record.msg
            raise AssertionError(f"Log record for {event!r} did not carry a structured event dict.")
    raise AssertionError(f"Missing log event {event!r}.")
