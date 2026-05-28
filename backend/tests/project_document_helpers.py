from collections.abc import Iterable
from typing import Any

from features.project_document.custom_fields import CustomFieldDef
from features.project_document.tables._fingerprint import compute_table_schema_fingerprint
from features.project_document.tables.pumps import PUMPS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.rooms import ROOMS_BUILT_IN_FIELD_DEFS


def custom_fields_from_slice(slice_body: dict[str, Any]) -> list[dict[str, Any]]:
    return [field for field in slice_body["field_defs"] if field["origin"] == "custom"]


def field_defs_fingerprint(field_defs: list[dict[str, Any]]) -> str:
    return compute_table_schema_fingerprint([CustomFieldDef.model_validate(field) for field in field_defs])


def field_defs_json(field_defs: Iterable[Any]) -> list[dict[str, Any]]:
    return [field.model_dump(mode="json") for field in field_defs]


def empty_rooms_table() -> dict[str, Any]:
    return {"field_defs": field_defs_json(ROOMS_BUILT_IN_FIELD_DEFS), "rows": []}


def empty_pumps_table(rows: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return {
        "field_defs": field_defs_json(PUMPS_BUILT_IN_FIELD_DEFS),
        "rows": rows or [],
    }


def empty_required_tables() -> dict[str, Any]:
    return {
        "rooms": empty_rooms_table(),
        "equipment": {"pumps": empty_pumps_table()},
    }
