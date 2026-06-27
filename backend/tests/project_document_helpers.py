from typing import Any

from psycopg.types.json import Jsonb

from database import connection, transaction
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


def empty_space_types_table(rows: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    space_types = _empty_document_tables()["space_types"]
    space_types["rows"] = rows or []
    return space_types


def empty_thermal_bridges_table(rows: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    thermal_bridges = _empty_document_tables()["thermal_bridges"]
    thermal_bridges["rows"] = rows or []
    return thermal_bridges


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


def empty_hot_water_heaters_table(rows: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    hot_water_heaters = _empty_document_tables()["equipment"]["hot_water_heaters"]
    hot_water_heaters["rows"] = rows or []
    return hot_water_heaters


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


def set_saved_version_schema(version_id: object, schema_version: int) -> None:
    with transaction() as conn:
        row = conn.execute(
            """
            SELECT body
            FROM project_versions
            WHERE id = %(version_id)s
            """,
            {"version_id": version_id},
        ).fetchone()
        assert row is not None
        raw_body = dict(row["body"])
        raw_body["schema_version"] = schema_version
        conn.execute(
            """
            UPDATE project_versions
            SET body = %(body)s,
                schema_version = %(schema_version)s
            WHERE id = %(version_id)s
            """,
            {"body": Jsonb(raw_body), "schema_version": schema_version, "version_id": version_id},
        )


def set_draft_schema(version_id: object, schema_version: int) -> str:
    with transaction() as conn:
        row = conn.execute(
            """
            SELECT body, draft_etag
            FROM project_version_drafts
            WHERE version_id = %(version_id)s
            """,
            {"version_id": version_id},
        ).fetchone()
        assert row is not None
        raw_body = dict(row["body"])
        raw_body["schema_version"] = schema_version
        conn.execute(
            """
            UPDATE project_version_drafts
            SET body = %(body)s,
                schema_version = %(schema_version)s
            WHERE version_id = %(version_id)s
            """,
            {"body": Jsonb(raw_body), "schema_version": schema_version, "version_id": version_id},
        )
    return str(row["draft_etag"])


def project_version_schema(version_id: object) -> tuple[int, int]:
    with connection() as conn:
        row = conn.execute(
            """
            SELECT schema_version, body
            FROM project_versions
            WHERE id = %(version_id)s
            """,
            {"version_id": version_id},
        ).fetchone()
    assert row is not None
    return int(row["schema_version"]), int(row["body"]["schema_version"])


def draft_schema_and_etag(version_id: object) -> tuple[int, int, str]:
    with connection() as conn:
        row = conn.execute(
            """
            SELECT schema_version, body, draft_etag
            FROM project_version_drafts
            WHERE version_id = %(version_id)s
            """,
            {"version_id": version_id},
        ).fetchone()
    assert row is not None
    return int(row["schema_version"]), int(row["body"]["schema_version"]), str(row["draft_etag"])
