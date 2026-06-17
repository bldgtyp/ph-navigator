"""Service rules for the Heat Pumps equipment slice."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, ValidationError
from starlette import status

from database import transaction
from features.assets.reference_validation import validate_document_asset_references
from features.heat_pumps.models import (
    HEAT_PUMP_OWNED_OPTION_KEYS,
    HEAT_PUMP_VISIBLE_OPTION_KEYS,
    HeatPumpIndoorEquipRow,
    HeatPumpIndoorUnitRow,
    HeatPumpOutdoorEquipRow,
    HeatPumpOutdoorUnitRow,
    HeatPumpsTableSlice,
)
from features.project_document import repository as document_repository
from features.project_document.document import ProjectDocumentV1
from features.project_document.drafts import load_draft_context
from features.project_document.options import (
    read_option_list,
    replace_option_list,
    validate_option_list,
)
from features.project_document.rows import SingleSelectOption
from features.project_document.service import get_current_document_view
from features.project_document.validation import next_draft_etag, validate_document
from features.projects.access import ProjectAccess, require_editor_user
from features.shared.errors import api_error

HeatPumpTableKey = Literal["outdoor-equip", "indoor-equip", "outdoor-units", "indoor-units"]
PatchOpName = Literal["add", "replace", "remove"]


class JsonPatchOp(BaseModel):
    model_config = ConfigDict(extra="forbid")

    op: PatchOpName
    path: str
    value: dict[str, Any] | None = None


class CascadeReference(BaseModel):
    model_config = ConfigDict(extra="forbid")

    table: str
    row_id: str
    tag: str
    field: str


class CascadePreview(BaseModel):
    model_config = ConfigDict(extra="forbid")

    affected: list[CascadeReference]


class HeatPumpsReadResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: str
    version_etag: str
    draft_etag: str | None
    outdoor_equip: list[HeatPumpOutdoorEquipRow]
    indoor_equip: list[HeatPumpIndoorEquipRow]
    outdoor_units: list[HeatPumpOutdoorUnitRow]
    indoor_units: list[HeatPumpIndoorUnitRow]
    single_select_options: dict[str, list[SingleSelectOption]]


class HeatPumpsPatchResponse(HeatPumpsReadResponse):
    cascade_preview: CascadePreview | None = None


@dataclass(frozen=True)
class _TableSpec:
    attr: Literal["outdoor_equip", "indoor_equip", "outdoor_units", "indoor_units"]
    row_model: type[HeatPumpOutdoorEquipRow | HeatPumpIndoorEquipRow | HeatPumpOutdoorUnitRow | HeatPumpIndoorUnitRow]


_TABLE_SPECS: dict[HeatPumpTableKey, _TableSpec] = {
    "outdoor-equip": _TableSpec("outdoor_equip", HeatPumpOutdoorEquipRow),
    "indoor-equip": _TableSpec("indoor_equip", HeatPumpIndoorEquipRow),
    "outdoor-units": _TableSpec("outdoor_units", HeatPumpOutdoorUnitRow),
    "indoor-units": _TableSpec("indoor_units", HeatPumpIndoorUnitRow),
}


def compose_read(version_id: UUID, access: ProjectAccess) -> HeatPumpsReadResponse:
    document = get_current_document_view(version_id, access)
    return _response(
        access.project_id,
        version_id,
        document.source,
        document.version_etag,
        document.draft_etag,
        document.body,
    )


def read_slice(version_id: UUID, access: ProjectAccess) -> HeatPumpsTableSlice:
    """Read-only view of the heat-pump slice for downstream computations (e.g. Phius export)."""

    return get_current_document_view(version_id, access).body.tables.equipment.heat_pumps


def apply_patch(
    version_id: UUID,
    table_key: HeatPumpTableKey,
    patch: JsonPatchOp,
    access: ProjectAccess,
    *,
    if_match: str | None,
    if_match_version: str | None,
    dry_run: bool,
) -> HeatPumpsPatchResponse:
    user = require_editor_user(access)
    _validate_patch_path(patch)
    with transaction() as conn:
        base_body, base_version_etag, version_etag, draft = load_draft_context(
            conn,
            access.project_id,
            version_id,
            user.id,
            if_match,
            if_match_version,
            draft_etag_mismatch_message="The draft changed before this heat-pump update was applied.",
        )
        next_body, preview = _apply_patch_to_body(base_body, table_key, patch, dry_run=dry_run)
        if dry_run and preview is not None:
            return _patch_response(
                access.project_id,
                version_id,
                "draft" if draft is not None else "version",
                version_etag,
                draft["draft_etag"] if draft is not None else None,
                base_body,
                preview,
            )
        if next_body == base_body:
            return _patch_response(
                access.project_id,
                version_id,
                "draft" if draft is not None else "version",
                version_etag,
                draft["draft_etag"] if draft is not None else None,
                base_body,
                None,
            )
        validate_document_asset_references(conn, project_id=access.project_id, body=next_body)
        draft_etag = document_repository.upsert_draft(
            conn,
            version_id,
            user.id,
            next_body,
            base_version_etag,
            next_draft_etag(next_body),
        )
    return _patch_response(access.project_id, version_id, "draft", version_etag, draft_etag, next_body, preview)


def _apply_patch_to_body(
    body: ProjectDocumentV1, table_key: HeatPumpTableKey, patch: JsonPatchOp, *, dry_run: bool
) -> tuple[ProjectDocumentV1, CascadePreview | None]:
    slice_ = body.tables.equipment.heat_pumps
    spec = _TABLE_SPECS[table_key]
    envelope = getattr(slice_, spec.attr)
    rows = list(envelope.rows)
    if patch.op == "add":
        if patch.value is None:
            raise _validation_error("value", "Add operations require a value.")
        row = _validate_row(spec.row_model, patch.value)
        rows.append(row)
    elif patch.op == "replace":
        if patch.value is None:
            raise _validation_error("value", "Replace operations require a value.")
        row_id = _row_id_from_path(patch.path)
        row = _validate_row(spec.row_model, patch.value)
        if row.id != row_id:
            raise _validation_error("id", "Replacement row id must match the patch path.", {"row_id": row_id})
        rows = _replace_row(rows, row_id, row)
    else:
        row_id = _row_id_from_path(patch.path)
        preview = _delete_preview(slice_, table_key, row_id)
        if preview.affected and dry_run:
            return body, preview
        rows = _remove_row(rows, row_id)
        slice_ = _apply_delete_cascades(slice_, table_key, row_id)

    next_slice = slice_.model_copy(update={spec.attr: envelope.model_copy(update={"rows": rows})})
    _validate_slice(next_slice)
    next_equipment = body.tables.equipment.model_copy(update={"heat_pumps": next_slice})
    next_tables = body.tables.model_copy(update={"equipment": next_equipment})
    return validate_document(body.model_copy(update={"tables": next_tables}).model_dump(mode="json")), None


def _validate_row(row_model: type[Any], value: dict[str, Any]) -> Any:
    try:
        return row_model.model_validate(value)
    except ValidationError as exc:
        raise _validation_error(
            "row",
            "Heat-pump row failed validation.",
            {"errors": [str(error["msg"]) for error in exc.errors()]},
        ) from exc


def _validate_slice(slice_: HeatPumpsTableSlice) -> None:
    for table_key, spec in _TABLE_SPECS.items():
        rows = getattr(slice_, spec.attr).rows
        seen_ids: set[str] = set()
        for row in rows:
            if row.id in seen_ids:
                raise _validation_error("id", "Duplicate row id.", {"table": table_key, "row_id": row.id})
            seen_ids.add(row.id)

    indoor_equip_ids = {row.id for row in slice_.indoor_equip.rows}
    outdoor_equip_ids = {row.id for row in slice_.outdoor_equip.rows}
    outdoor_unit_ids = {row.id for row in slice_.outdoor_units.rows}
    for row in slice_.outdoor_equip.rows:
        if row.paired_indoor_equip_id is not None and row.paired_indoor_equip_id not in indoor_equip_ids:
            raise _validation_error(
                "paired_indoor_equip_id",
                "Paired indoor equipment does not exist.",
                {"row_id": row.id, "missing_id": row.paired_indoor_equip_id},
            )
    for row in slice_.outdoor_units.rows:
        if row.outdoor_equip_id not in outdoor_equip_ids:
            raise _validation_error(
                "outdoor_equip_id",
                "Outdoor equipment does not exist.",
                {"row_id": row.id, "missing_id": row.outdoor_equip_id},
            )
    for row in slice_.indoor_units.rows:
        if row.indoor_equip_id not in indoor_equip_ids:
            raise _validation_error(
                "indoor_equip_id",
                "Indoor equipment does not exist.",
                {"row_id": row.id, "missing_id": row.indoor_equip_id},
            )
        if row.outdoor_unit_id is not None and row.outdoor_unit_id not in outdoor_unit_ids:
            raise _validation_error(
                "outdoor_unit_id",
                "Outdoor unit does not exist.",
                {"row_id": row.id, "missing_id": row.outdoor_unit_id},
            )


def _delete_preview(slice_: HeatPumpsTableSlice, table_key: HeatPumpTableKey, row_id: str) -> CascadePreview:
    affected: list[CascadeReference] = []
    if table_key == "outdoor-equip":
        for row in slice_.outdoor_units.rows:
            if row.outdoor_equip_id == row_id:
                affected.append(
                    CascadeReference(
                        table="outdoor-units",
                        row_id=row.id,
                        tag=row.tag,
                        field="outdoor_equip_id",
                    )
                )
        if affected:
            raise api_error(
                status.HTTP_409_CONFLICT,
                "heat_pump_delete_blocked",
                "Outdoor equipment is referenced by outdoor units.",
                {"referenced_by": [item.model_dump(mode="json") for item in affected]},
            )
    elif table_key == "indoor-equip":
        blockers = [
            CascadeReference(table="indoor-units", row_id=row.id, tag=row.tag, field="indoor_equip_id")
            for row in slice_.indoor_units.rows
            if row.indoor_equip_id == row_id
        ]
        if blockers:
            raise api_error(
                status.HTTP_409_CONFLICT,
                "heat_pump_delete_blocked",
                "Indoor equipment is referenced by indoor units.",
                {"referenced_by": [item.model_dump(mode="json") for item in blockers]},
            )
        affected.extend(
            CascadeReference(table="outdoor-equip", row_id=row.id, tag=row.tag, field="paired_indoor_equip_id")
            for row in slice_.outdoor_equip.rows
            if row.paired_indoor_equip_id == row_id
        )
    elif table_key == "outdoor-units":
        affected.extend(
            CascadeReference(table="indoor-units", row_id=row.id, tag=row.tag, field="outdoor_unit_id")
            for row in slice_.indoor_units.rows
            if row.outdoor_unit_id == row_id
        )
    return CascadePreview(affected=affected)


def _apply_delete_cascades(
    slice_: HeatPumpsTableSlice, table_key: HeatPumpTableKey, row_id: str
) -> HeatPumpsTableSlice:
    if table_key == "indoor-equip":
        return slice_.model_copy(
            update={
                "outdoor_equip": slice_.outdoor_equip.model_copy(
                    update={
                        "rows": [
                            row.model_copy(update={"paired_indoor_equip_id": None})
                            if row.paired_indoor_equip_id == row_id
                            else row
                            for row in slice_.outdoor_equip.rows
                        ]
                    }
                )
            }
        )
    if table_key == "outdoor-units":
        return slice_.model_copy(
            update={
                "indoor_units": slice_.indoor_units.model_copy(
                    update={
                        "rows": [
                            row.model_copy(update={"outdoor_unit_id": None}) if row.outdoor_unit_id == row_id else row
                            for row in slice_.indoor_units.rows
                        ]
                    }
                )
            }
        )
    return slice_


def _replace_row(rows: list[Any], row_id: str, replacement: Any) -> list[Any]:
    for index, row in enumerate(rows):
        if row.id == row_id:
            return [*rows[:index], replacement, *rows[index + 1 :]]
    raise _validation_error("path", "Patch path did not match an existing row.", {"row_id": row_id})


def _remove_row(rows: list[Any], row_id: str) -> list[Any]:
    next_rows = [row for row in rows if row.id != row_id]
    if len(next_rows) == len(rows):
        raise _validation_error("path", "Patch path did not match an existing row.", {"row_id": row_id})
    return next_rows


def _validate_patch_path(patch: JsonPatchOp) -> None:
    if patch.op == "add" and patch.path == "/-":
        return
    _row_id_from_path(patch.path)


def _row_id_from_path(path: str) -> str:
    if not path.startswith("/"):
        raise _validation_error("path", "Patch path must start with '/'.")
    row_id = path[1:]
    if not row_id or "/" in row_id:
        raise _validation_error("path", "Patch path must be '/{row_id}' or '/-' for add.")
    if row_id == "-":
        raise _validation_error("path", "Only add operations may use '/-'.")
    return row_id


def _response(
    project_id: UUID,
    version_id: UUID,
    source: str,
    version_etag: str,
    draft_etag: str | None,
    body: ProjectDocumentV1,
) -> HeatPumpsReadResponse:
    slice_ = body.tables.equipment.heat_pumps
    return HeatPumpsReadResponse(
        project_id=project_id,
        version_id=version_id,
        source=source,
        version_etag=version_etag,
        draft_etag=draft_etag,
        outdoor_equip=slice_.outdoor_equip.rows,
        indoor_equip=slice_.indoor_equip.rows,
        outdoor_units=slice_.outdoor_units.rows,
        indoor_units=slice_.indoor_units.rows,
        single_select_options={key: read_option_list(body, key) for key in HEAT_PUMP_VISIBLE_OPTION_KEYS},
    )


def _patch_response(
    project_id: UUID,
    version_id: UUID,
    source: str,
    version_etag: str,
    draft_etag: str | None,
    body: ProjectDocumentV1,
    preview: CascadePreview | None,
) -> HeatPumpsPatchResponse:
    read = _response(project_id, version_id, source, version_etag, draft_etag, body)
    return HeatPumpsPatchResponse(**read.model_dump(), cascade_preview=preview)


def _validation_error(field: str, message: str, details: dict[str, object] | None = None) -> Exception:
    return api_error(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "heat_pump_validation_error",
        message,
        {"field": field, **(details or {})},
    )


class OptionPatchOp(BaseModel):
    """Patch op for a single SingleSelectOption inside a heat-pumps option list.

    `add`     : append a new option (id must not already exist in the list).
    `replace` : in-place edit a single option by id (label/color/order).
    `remove`  : remove an option by id; rows referencing it are NOT auto-cleared
                — the caller (UI) decides; for now we 422 if any row points at it.
    """

    model_config = ConfigDict(extra="forbid")

    op: Literal["add", "replace", "remove"]
    option: SingleSelectOption


def apply_option_patch(
    version_id: UUID,
    option_key: str,
    patch: OptionPatchOp,
    access: ProjectAccess,
    *,
    if_match: str | None,
    if_match_version: str | None,
) -> HeatPumpsReadResponse:
    """Apply a single-option mutation to one of the heat-pump-owned option lists."""

    if option_key not in HEAT_PUMP_OWNED_OPTION_KEYS:
        raise api_error(
            status.HTTP_404_NOT_FOUND,
            "heat_pump_option_key_unknown",
            "Option key is not owned by the heat-pumps slice.",
            {"option_key": option_key, "allowed": list(HEAT_PUMP_OWNED_OPTION_KEYS)},
        )

    user = require_editor_user(access)
    with transaction() as conn:
        base_body, base_version_etag, version_etag, draft = load_draft_context(
            conn,
            access.project_id,
            version_id,
            user.id,
            if_match,
            if_match_version,
            draft_etag_mismatch_message="The draft changed before this heat-pump option update was applied.",
        )
        next_body = _apply_option_patch_to_body(base_body, option_key, patch)
        if next_body == base_body:
            return _response(
                access.project_id,
                version_id,
                "draft" if draft is not None else "version",
                version_etag,
                draft["draft_etag"] if draft is not None else None,
                base_body,
            )
        draft_etag = document_repository.upsert_draft(
            conn,
            version_id,
            user.id,
            next_body,
            base_version_etag,
            next_draft_etag(next_body),
        )
    return _response(access.project_id, version_id, "draft", version_etag, draft_etag, next_body)


def _apply_option_patch_to_body(body: ProjectDocumentV1, option_key: str, patch: OptionPatchOp) -> ProjectDocumentV1:
    current = read_option_list(body, option_key)
    by_id = {opt.id: index for index, opt in enumerate(current)}

    if patch.op == "add":
        if patch.option.id in by_id:
            raise _validation_error(
                "option.id", "Option id already exists in this list.", {"option_id": patch.option.id}
            )
        next_options = [*current, patch.option]
    elif patch.op == "replace":
        index = by_id.get(patch.option.id)
        if index is None:
            raise _validation_error("option.id", "Option id not found in this list.", {"option_id": patch.option.id})
        next_options = [*current[:index], patch.option, *current[index + 1 :]]
    else:
        index = by_id.get(patch.option.id)
        if index is None:
            raise _validation_error("option.id", "Option id not found in this list.", {"option_id": patch.option.id})
        if _option_is_referenced(body, option_key, patch.option.id):
            raise api_error(
                status.HTTP_409_CONFLICT,
                "heat_pump_option_in_use",
                "Option is still referenced by one or more heat-pump rows.",
                {"option_id": patch.option.id, "option_key": option_key},
            )
        next_options = [*current[:index], *current[index + 1 :]]

    validate_option_list(next_options)
    next_body = replace_option_list(body, option_key, next_options)
    return validate_document(next_body.model_dump(mode="json"))


# Maps each owned option key to the (sub_table_attr, field_name) cell that
# stores its option id. Kept narrow on purpose — the rooms-owned zone/floor
# keys are NOT writable here, so they don't appear in this table.
_OPTION_KEY_TO_CELL: dict[str, tuple[str, str]] = {
    "heat_pumps.manufacturer": ("__manufacturer__", "manufacturer"),
    "heat_pumps.system_family": ("outdoor_equip", "system_family"),
    "heat_pumps.refrigerant": ("outdoor_equip", "refrigerant"),
    "heat_pumps.model_type": ("indoor_equip", "model_type"),
    "heat_pumps.install_type": ("indoor_equip", "install_type"),
}


def _option_is_referenced(body: ProjectDocumentV1, option_key: str, option_id: str) -> bool:
    slice_ = body.tables.equipment.heat_pumps
    sub_table, field_name = _OPTION_KEY_TO_CELL[option_key]
    if sub_table == "__manufacturer__":
        return any(row.manufacturer == option_id for row in slice_.outdoor_equip.rows) or any(
            row.manufacturer == option_id for row in slice_.indoor_equip.rows
        )
    rows = getattr(slice_, sub_table).rows
    return any(getattr(row, field_name) == option_id for row in rows)
