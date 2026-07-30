"""Shared response helpers for REST routes."""

from __future__ import annotations

import re

from fastapi.responses import Response


def json_download_response(content: str, filename: str) -> Response:
    return _download_response(content, filename, "application/json")


def csv_download_response(text: str, filename: str) -> Response:
    return _download_response(
        text.encode("utf-8"),
        filename,
        "text/csv; charset=utf-8",
    )


def xlsx_download_response(data: bytes, filename: str) -> Response:
    return _download_response(
        data,
        filename,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


def zip_download_response(data: bytes, filename: str) -> Response:
    return _download_response(data, filename, "application/zip")


def download_filename_part(
    value: str,
    fallback: str,
    *,
    max_length: int = 80,
) -> str:
    """Return a compact ASCII filename component safe for response headers."""
    slug = re.sub(r"[^A-Za-z0-9_-]+", "-", value).strip("-_")
    return slug[:max_length].rstrip("-_") or fallback


def safe_header_filename(filename: str) -> str:
    """Remove characters that can break a quoted HTTP filename parameter."""
    return filename.replace('"', "'").replace("\r", "").replace("\n", "")


def _download_response(
    content: str | bytes,
    filename: str,
    media_type: str,
) -> Response:
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": (f'attachment; filename="{safe_header_filename(filename)}"')},
    )
