"""Error-envelope logging integration tests."""

from __future__ import annotations

import logging
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.testclient import TestClient
from pydantic import BaseModel

import logging_config
from config import Settings
from features.shared.errors import api_error, http_exception_handler, validation_exception_handler
from features.shared.middleware import request_context_middleware


@pytest.fixture(autouse=True)
def reset_logging() -> Iterator[None]:
    logging_config._reset_logging_for_tests()
    yield
    logging_config._reset_logging_for_tests()


def test_validation_error_logs_same_request_id_as_response(caplog: pytest.LogCaptureFixture) -> None:
    logging_config.configure_logging(_settings())
    client = TestClient(_app())

    with caplog.at_level(logging.WARNING):
        response = client.post("/items", json={"count": "not-an-int"}, headers={"X-Request-ID": "validation-req"})

    payload = response.json()
    assert response.status_code == 422
    assert payload["request_id"] == "validation-req"

    record = _record_event(caplog.records, "api.validation_error")
    assert record["request_id"] == "validation-req"
    assert record["status"] == 422
    assert record["errors"]


def test_http_500_error_logs_same_request_id_as_response(caplog: pytest.LogCaptureFixture) -> None:
    logging_config.configure_logging(_settings())
    client = TestClient(_app())

    with caplog.at_level(logging.ERROR):
        response = client.get("/http-500", headers={"X-Request-ID": "http-500-req"})

    payload = response.json()
    assert response.status_code == 500
    assert payload["request_id"] == "http-500-req"
    assert payload["error_code"] == "forced_failure"

    record = _record_event(caplog.records, "api.http_error")
    assert record["request_id"] == "http-500-req"
    assert record["status"] == 500
    assert record["error_code"] == "forced_failure"


class Payload(BaseModel):
    count: int


def _app() -> FastAPI:
    app = FastAPI()
    app.middleware("http")(request_context_middleware)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)

    @app.post("/items")
    def create_item(payload: Payload) -> dict[str, int]:
        return {"count": payload.count}

    @app.get("/http-500")
    def http_500() -> None:
        raise api_error(500, "forced_failure", "Forced failure.")

    return app


def _settings() -> Settings:
    return Settings(
        app_version="test-version",
        environment="test",
        git_sha="abc123",
        render_instance_id="test-instance",
        log_format="json",
    )


def _record_event(records: list[logging.LogRecord], event: str) -> dict[str, Any]:
    for record in records:
        if getattr(record, "event", None) == event:
            if isinstance(record.msg, dict):
                return record.msg
            raise AssertionError(f"Log record for {event!r} did not carry a structured event dict.")
    raise AssertionError(f"Missing log event {event!r}.")
