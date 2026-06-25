"""Project-document attachment reference validation."""

from __future__ import annotations

from uuid import UUID

from psycopg import Connection
from starlette import status

from features.assets import repository
from features.assets.mapping import asset_rows
from features.assets.registry import ATTACHMENT_FIELDS, asset_matches_field, list_asset_references
from features.project_document.document import ProjectDocumentV1
from features.shared.errors import api_error


def validate_document_asset_references(
    conn: Connection[object],
    *,
    project_id: UUID,
    body: ProjectDocumentV1,
) -> None:
    """Reject attachment ids that do not resolve to valid project assets."""

    fields_by_key = {field.key: field for field in ATTACHMENT_FIELDS}
    references = list_asset_references(body)
    for field in ATTACHMENT_FIELDS:
        field_references = [
            ref for ref in references if ref["table_key"] == field.table_key and ref["field_key"] == field.field_key
        ]
        row_counts: dict[str | None, int] = {}
        for ref in field_references:
            row_id = str(ref["row_id"]) if ref["row_id"] is not None else None
            row_counts[row_id] = row_counts.get(row_id, 0) + 1
        for row_id, count in row_counts.items():
            if count > field.max_count:
                _raise_asset_reference_error(
                    "asset_count_exceeded",
                    "Attachment cell exceeds its maximum count.",
                    field_key=field.key,
                    row_id=row_id,
                    max_count=field.max_count,
                )

    ordered_asset_ids = list(dict.fromkeys(str(ref["asset_id"]) for ref in references))
    assets = asset_rows(repository.list_assets_by_ids(conn, project_id, ordered_asset_ids))
    assets_by_id = {asset.id: asset for asset in assets}
    for ref in references:
        field = fields_by_key.get(f"{ref['table_key']}.{ref['field_key']}")
        if field is None:
            continue
        asset_id = str(ref["asset_id"])
        asset = assets_by_id.get(asset_id)
        if asset is None:
            other = repository.get_asset_by_id_any_project(conn, asset_id)
            if other is not None:
                _raise_asset_reference_error(
                    "asset_cross_project_reference",
                    "Asset belongs to another project.",
                    field_key=field.key,
                    row_id=str(ref["row_id"]) if ref["row_id"] is not None else None,
                    asset_id=asset_id,
                )
            _raise_asset_reference_error(
                "asset_not_found",
                "Asset does not exist for this project.",
                field_key=field.key,
                row_id=str(ref["row_id"]) if ref["row_id"] is not None else None,
                asset_id=asset_id,
            )
        assert asset is not None
        if asset.upload_status != "uploaded":
            _raise_asset_reference_error(
                "asset_upload_incomplete",
                "Asset upload is not complete.",
                status_code=status.HTTP_409_CONFLICT,
                field_key=field.key,
                row_id=str(ref["row_id"]) if ref["row_id"] is not None else None,
                asset_id=asset_id,
            )
        if not asset_matches_field(
            field,
            asset_kind=asset.asset_kind,
            content_type=asset.content_type,
            original_filename=asset.original_filename,
            size_bytes=asset.size_bytes,
        ):
            _raise_asset_reference_error(
                "asset_mime_not_allowed",
                "Asset is not valid for this attachment field.",
                field_key=field.key,
                row_id=str(ref["row_id"]) if ref["row_id"] is not None else None,
                asset_id=asset_id,
                asset_kind=asset.asset_kind,
            )


def _raise_asset_reference_error(
    error_code: str,
    message: str,
    *,
    status_code: int = status.HTTP_422_UNPROCESSABLE_CONTENT,
    field_key: str,
    row_id: str | None,
    asset_id: str | None = None,
    max_count: int | None = None,
    asset_kind: str | None = None,
) -> None:
    details: dict[str, object] = {"field_key": field_key}
    if row_id is not None:
        details["row_id"] = row_id
    if asset_id is not None:
        details["asset_id"] = asset_id
    if max_count is not None:
        details["max_count"] = max_count
    if asset_kind is not None:
        details["asset_kind"] = asset_kind
    raise api_error(status_code, error_code, message, details)
