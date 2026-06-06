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


def empty_ventilators_table(rows: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    ventilators = _empty_document_tables()["equipment"]["ervs"]
    ventilators["rows"] = rows or []
    return ventilators


def empty_fans_table(rows: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    fans = _empty_document_tables()["equipment"]["fans"]
    fans["rows"] = rows or []
    return fans


def empty_hot_water_tanks_table(rows: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    hot_water_tanks = _empty_document_tables()["equipment"]["hot_water_tanks"]
    hot_water_tanks["rows"] = rows or []
    return hot_water_tanks


def empty_electric_heaters_table(rows: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    electric_heaters = _empty_document_tables()["equipment"]["electric_heaters"]
    electric_heaters["rows"] = rows or []
    return electric_heaters


def empty_appliances_table(rows: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    appliances = _empty_document_tables()["equipment"]["appliances"]
    appliances["rows"] = rows or []
    return appliances


def empty_required_tables() -> dict[str, Any]:
    return _empty_document_tables()
