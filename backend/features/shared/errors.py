"""Structured REST error helpers.

The same envelope shape is intended for REST and future MCP wrappers.
"""

from __future__ import annotations

from typing import Any

import structlog
from fastapi import HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette import status

log = structlog.get_logger(__name__)


class ErrorEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    error_code: str
    message: str
    request_id: str
    details: dict[str, Any] = Field(default_factory=dict)


def api_error(
    status_code: int,
    error_code: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={
            "error_code": error_code,
            "message": message,
            "details": details or {},
        },
    )


def error_response(
    request: Request,
    status_code: int,
    error_code: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", "")
    envelope = ErrorEnvelope(
        error_code=error_code,
        message=message,
        request_id=request_id,
        details=details or {},
    )
    return JSONResponse(status_code=status_code, content=envelope.model_dump())


async def http_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, HTTPException):
        raise exc

    detail = exc.detail
    if isinstance(detail, dict):
        error_code = str(detail.get("error_code", "http_error"))
        message = str(detail.get("message", "Request failed."))
        details = detail.get("details", {})
        _log_http_error(exc.status_code, error_code, message)
        return error_response(
            request=request,
            status_code=exc.status_code,
            error_code=error_code,
            message=message,
            details=details if isinstance(details, dict) else {},
        )

    message = str(detail)
    _log_http_error(exc.status_code, "http_error", message)
    return error_response(
        request=request,
        status_code=exc.status_code,
        error_code="http_error",
        message=message,
    )


async def validation_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, RequestValidationError):
        raise exc

    errors = jsonable_encoder(exc.errors())
    log.warning("api.validation_error", status=status.HTTP_422_UNPROCESSABLE_ENTITY, errors=errors)
    return error_response(
        request=request,
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        error_code="validation_error",
        message="Request validation failed.",
        details={"errors": errors},
    )


def _log_http_error(status_code: int, error_code: str, message: str) -> None:
    level = log.warning if status_code < 500 else log.error
    level("api.http_error", status=status_code, error_code=error_code, message=message)
