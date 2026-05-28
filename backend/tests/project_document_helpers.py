from typing import Any

from features.project_document.custom_fields import CustomFieldDef
from features.project_document.tables._fingerprint import compute_table_schema_fingerprint
from features.projects.models import CreateProjectRequest
from features.projects.service import empty_project_document


def custom_fields_from_slice(slice_body: dict[str, Any]) -> list[dict[str, Any]]:
    return [field for field in slice_body["field_defs"] if field["origin"] == "custom"]


def field_defs_fingerprint(field_defs: list[dict[str, Any]]) -> str:
    return compute_table_schema_fingerprint([CustomFieldDef.model_validate(field) for field in field_defs])


def _empty_document_tables() -> dict[str, Any]:
    return empty_project_document(
        CreateProjectRequest(name="Test Project", bt_number="BT-TEST", cert_programs=[])
    ).tables.model_dump(mode="json")


def empty_rooms_table() -> dict[str, Any]:
    return _empty_document_tables()["rooms"]


def empty_pumps_table(rows: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    pumps = _empty_document_tables()["equipment"]["pumps"]
    pumps["rows"] = rows or []
    return pumps


def empty_required_tables() -> dict[str, Any]:
    return _empty_document_tables()
