"""Shared response helpers for REST routes."""

from __future__ import annotations

from fastapi.responses import Response


def json_download_response(content: str, filename: str) -> Response:
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def zip_download_response(data: bytes, filename: str) -> Response:
    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
