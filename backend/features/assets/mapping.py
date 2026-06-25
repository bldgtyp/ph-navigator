"""Row-to-model adapters for asset service boundaries."""

from __future__ import annotations

from typing import Any

from features.assets.models import AssetRow, JobResponse


def asset_row(row: dict[str, Any]) -> AssetRow:
    return AssetRow.model_validate(row)


def asset_row_or_none(row: dict[str, Any] | None) -> AssetRow | None:
    return AssetRow.model_validate(row) if row is not None else None


def asset_rows(rows: list[dict[str, Any]]) -> list[AssetRow]:
    return [AssetRow.model_validate(row) for row in rows]


def job_response(row: dict[str, Any]) -> JobResponse:
    return JobResponse.model_validate(row)


def job_response_or_none(row: dict[str, Any] | None) -> JobResponse | None:
    return JobResponse.model_validate(row) if row is not None else None
