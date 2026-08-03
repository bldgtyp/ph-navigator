"""Structured REST error helpers.

The same envelope shape is intended for REST and future MCP wrappers.
"""

from __future__ import annotations

from html import escape
from typing import Any

import structlog
from fastapi import HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import HTMLResponse, JSONResponse, Response
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


async def http_exception_handler(request: Request, exc: Exception) -> Response:
    if not isinstance(exc, HTTPException):
        raise exc

    detail = exc.detail
    if isinstance(detail, dict):
        error_code = str(detail.get("error_code", "http_error"))
        message = str(detail.get("message", "Request failed."))
        details = detail.get("details", {})
        _log_http_error(exc.status_code, error_code, message)
        if _wants_asset_download_error_page(request):
            return _asset_download_error_page(request, exc.status_code, error_code)
        return error_response(
            request=request,
            status_code=exc.status_code,
            error_code=error_code,
            message=message,
            details=details if isinstance(details, dict) else {},
        )

    message = str(detail)
    _log_http_error(exc.status_code, "http_error", message)
    if _wants_asset_download_error_page(request):
        return _asset_download_error_page(request, exc.status_code, "http_error")
    return error_response(
        request=request,
        status_code=exc.status_code,
        error_code="http_error",
        message=message,
    )


def _wants_asset_download_error_page(request: Request) -> bool:
    path = request.url.path
    return (
        "/assets/" in path and path.endswith("/download") and "text/html" in request.headers.get("accept", "").lower()
    )


def _asset_download_error_page(request: Request, status_code: int, error_code: str) -> HTMLResponse:
    messages = {
        "asset_not_referenced": "This file is not available in the shared view. Ask the project owner to attach it.",
        "asset_not_found": "This file is no longer available.",
        "asset_upload_incomplete": "This file is still uploading. Try again in a moment.",
        "project_deleted": "This project has been deleted.",
        "not_authenticated": "Your session expired. Sign in again to download.",
    }
    message = messages.get(error_code, "This file is not available. Return to PH-Navigator and try again.")
    request_id = escape(str(getattr(request.state, "request_id", "")))
    request_note = f"<p>Request ID: {request_id}</p>" if request_id else ""
    content = (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        "<title>File unavailable</title></head><body><main>"
        f"<h1>File unavailable</h1><p>{escape(message)}</p>{request_note}"
        "</main></body></html>"
    )
    return HTMLResponse(content=content, status_code=status_code)


async def validation_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, RequestValidationError):
        raise exc

    errors = jsonable_encoder(exc.errors())
    log.warning("api.validation_error", status=status.HTTP_422_UNPROCESSABLE_CONTENT, errors=errors)
    return error_response(
        request=request,
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        error_code="validation_error",
        message="Request validation failed.",
        details={"errors": errors},
    )


def _log_http_error(status_code: int, error_code: str, message: str) -> None:
    level = log.warning if status_code < 500 else log.error
    level("api.http_error", status=status_code, error_code=error_code, message=message)
