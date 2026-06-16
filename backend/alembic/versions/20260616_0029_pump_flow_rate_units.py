"""convert pump flow to l_min number units

Revision ID: 20260616_0029
Revises: 20260615_0028
Create Date: 2026-06-16 10:00:00.000000
"""

from __future__ import annotations

import copy
import hashlib
import json
from collections.abc import MutableMapping, Sequence
from typing import TypeGuard, cast

import sqlalchemy as sa

from alembic import op

revision: str = "20260616_0029"
down_revision: str | None = "20260615_0028"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

L_PER_GAL = 3.785411784
FLOW_FIELD_KEY = "flow_gpm"
FLOW_RATE_UNITS: dict[str, object] = {
    "mode": "fixed",
    "unit_type": "flow_rate",
    "si_unit": "l_min",
    "ip_unit": "gpm",
    "precision_si": 1,
    "precision_ip": 1,
}
DRAFT_ETAG_SALT = "20260616_0029_pump_flow_rate_units"


def upgrade() -> None:
    conn = op.get_bind()
    version_etags = _convert_project_versions(conn, direction="to_l_min")
    _convert_project_version_drafts(conn, version_etags, direction="to_l_min")


def downgrade() -> None:
    conn = op.get_bind()
    version_etags = _convert_project_versions(conn, direction="to_gpm")
    _convert_project_version_drafts(conn, version_etags, direction="to_gpm")


def _convert_project_versions(conn: sa.Connection, *, direction: str) -> dict[str, str]:
    rows = conn.execute(sa.text("SELECT id, body FROM project_versions")).mappings()
    version_etags: dict[str, str] = {}
    for row in rows:
        body = copy.deepcopy(row["body"])
        changed = _convert_body(body, direction=direction)
        version_etag = _document_etag(body)
        version_etags[str(row["id"])] = version_etag
        if changed:
            conn.execute(
                sa.text(
                    """
                    UPDATE project_versions
                    SET body = CAST(:body AS jsonb),
                        body_size_bytes = :body_size_bytes
                    WHERE id = :id
                    """
                ),
                {
                    "id": row["id"],
                    "body": _json_body(body),
                    "body_size_bytes": _body_size_bytes(body),
                },
            )
    return version_etags


def _convert_project_version_drafts(conn: sa.Connection, version_etags: dict[str, str], *, direction: str) -> None:
    rows = conn.execute(
        sa.text("SELECT version_id, user_id, body, base_version_etag, draft_etag FROM project_version_drafts")
    ).mappings()
    for row in rows:
        body = copy.deepcopy(row["body"])
        changed = _convert_body(body, direction=direction)
        base_version_etag = version_etags.get(str(row["version_id"]), row["base_version_etag"])
        draft_etag = _draft_etag(body) if changed else row["draft_etag"]
        if changed or base_version_etag != row["base_version_etag"]:
            conn.execute(
                sa.text(
                    """
                    UPDATE project_version_drafts
                    SET body = CAST(:body AS jsonb),
                        base_version_etag = :base_version_etag,
                        draft_etag = :draft_etag
                    WHERE version_id = :version_id
                      AND user_id = :user_id
                    """
                ),
                {
                    "version_id": row["version_id"],
                    "user_id": row["user_id"],
                    "body": _json_body(body),
                    "base_version_etag": base_version_etag,
                    "draft_etag": draft_etag,
                },
            )


def _convert_body(body: object, *, direction: str) -> bool:
    pumps = _pumps_envelope(body)
    if pumps is None:
        return False

    target_units_already_present = _flow_field_has_target_units(pumps)
    changed = False
    if direction == "to_l_min":
        changed = _set_flow_field_def(pumps, display_name="Flow", units=FLOW_RATE_UNITS) or changed
        if not target_units_already_present:
            changed = _convert_flow_values(pumps, direction=direction) or changed
        return changed
    if direction == "to_gpm":
        if target_units_already_present:
            changed = _convert_flow_values(pumps, direction=direction) or changed
        changed = _set_flow_field_def(pumps, display_name="Flow - GPM", units=None) or changed
        return changed
    raise ValueError(f"Unsupported pump flow migration direction: {direction}")


def _pumps_envelope(body: object) -> MutableMapping[str, object] | None:
    body_mapping = _as_mapping(body)
    if body_mapping is None:
        return None
    tables = _as_mapping(body_mapping.get("tables"))
    if tables is None:
        return None
    equipment = _as_mapping(tables.get("equipment"))
    if equipment is None:
        return None
    pumps = equipment.get("pumps")
    return _as_mapping(pumps)


def _flow_field_has_target_units(pumps: MutableMapping[str, object]) -> bool:
    field = _flow_field_def(pumps)
    if field is None:
        return False
    config = _as_mapping(field.get("config"))
    if config is None:
        return False
    return config.get("units") == FLOW_RATE_UNITS


def _set_flow_field_def(
    pumps: MutableMapping[str, object],
    *,
    display_name: str,
    units: dict[str, object] | None,
) -> bool:
    field = _flow_field_def(pumps)
    if field is None:
        return False

    changed = False
    current_display_name = field.get("display_name")
    if current_display_name in {"Flow", "Flow - GPM"} and current_display_name != display_name:
        field["display_name"] = display_name
        changed = True

    config = _as_mapping(field.get("config"))
    if config is None:
        config = {}
    next_config = dict(config)
    if units is None:
        next_config.pop("units", None)
    else:
        next_config["units"] = dict(units)
    if next_config != config:
        field["config"] = next_config
        changed = True
    return changed


def _flow_field_def(pumps: MutableMapping[str, object]) -> MutableMapping[str, object] | None:
    field_defs = pumps.get("field_defs")
    if not isinstance(field_defs, list):
        return None
    for field in field_defs:
        field_mapping = _as_mapping(field)
        if field_mapping is not None and field_mapping.get("field_key") == FLOW_FIELD_KEY:
            return field_mapping
    return None


def _convert_flow_values(pumps: MutableMapping[str, object], *, direction: str) -> bool:
    rows = pumps.get("rows")
    if not isinstance(rows, list):
        return False

    changed = False
    for row in rows:
        row_mapping = _as_mapping(row)
        if row_mapping is None:
            continue
        custom_values = _as_mapping(row_mapping.get("custom_values"))
        if custom_values is None:
            continue
        value = custom_values.get(FLOW_FIELD_KEY)
        if not _is_number(value):
            continue
        next_value = _convert_flow(float(value), direction=direction)
        if next_value != value:
            custom_values[FLOW_FIELD_KEY] = next_value
            changed = True
    return changed


def _convert_flow(value: float, *, direction: str) -> float:
    if direction == "to_l_min":
        return round(value * L_PER_GAL, 9)
    if direction == "to_gpm":
        return round(value / L_PER_GAL, 9)
    raise ValueError(f"Unsupported pump flow conversion direction: {direction}")


def _as_mapping(value: object) -> MutableMapping[str, object] | None:
    if not isinstance(value, MutableMapping):
        return None
    return cast(MutableMapping[str, object], value)


def _is_number(value: object) -> TypeGuard[int | float]:
    return isinstance(value, int | float) and not isinstance(value, bool)


def _document_etag(body: object) -> str:
    payload = json.dumps(body, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _draft_etag(body: object) -> str:
    payload = f"{_document_etag(body)}:{DRAFT_ETAG_SALT}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _json_body(body: object) -> str:
    return json.dumps(body, separators=(",", ":"))


def _body_size_bytes(body: object) -> int:
    return len(_json_body(body).encode("utf-8"))
