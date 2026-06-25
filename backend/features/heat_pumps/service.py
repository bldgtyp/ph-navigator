"""Service rules for the Heat Pumps equipment slice.

Heat-pump writes go through the generic registered-contract path (the four
leaf `TableContract`s) and the shared write spine — exactly like every other
equipment table. The legacy single-row `PATCH` endpoints survive only as a thin
translation shim (`apply_patch` / `apply_option_patch`) until the Phase-3
frontend rewires onto the generic table-write client; they hold no bespoke
draft/ETag/persist plumbing of their own. Delete-cascade and dry-run preview are
generic `TableContract.dependent_links` capabilities (see `dependent_links.py`),
not heat-pump specials.
"""

from __future__ import annotations

from typing import Any, Literal, cast
from uuid import UUID

from pydantic import BaseModel, ConfigDict
from starlette import status

from database import connection, transaction
from features.heat_pumps import repository
from features.heat_pumps.models import (
    HEAT_PUMP_OWNED_OPTION_KEYS,
    HEAT_PUMP_VISIBLE_OPTION_KEYS,
    HeatPumpIndoorEquipRow,
    HeatPumpIndoorUnitRow,
    HeatPumpOutdoorEquipRow,
    HeatPumpOutdoorUnitRow,
    HeatPumpsTableSlice,
)
from features.project_document.document import ProjectDocumentV1
from features.project_document.options import (
    read_option_list,
    replace_option_list,
    validate_option_list,
)
from features.project_document.rows import SingleSelectOption
from features.project_document.service import get_current_document_view
from features.project_document.tables.contracts import read_table_envelope
from features.project_document.tables.dependent_links import preview_dependent_link_cascade
from features.project_document.tables.heat_pumps import build_leaf_replace_payload, leaf_contract_for
from features.project_document.validation import validate_document
from features.project_document.write_spine import apply_document_write, load_draft_context
from features.projects.access import ProjectAccess, require_editor_user
from features.shared.errors import api_error

HeatPumpTableKey = Literal["outdoor-equip", "indoor-equip", "outdoor-units", "indoor-units"]
PatchOpName = Literal["add", "replace", "remove"]

_DRAFT_MISMATCH_MESSAGE = "The draft changed before this heat-pump update was applied."


class HeatPumpRowPatch(BaseModel):
    """Single-row add/replace/remove for the legacy heat-pump PATCH endpoint.

    A thin wire shape translated into a whole-slice replace; removed once the
    Phase-3 frontend posts full-table payloads through the generic client.
    """

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


def active_version_id_for_project(project_id: UUID) -> UUID:
    with connection() as conn:
        version_id = repository.get_active_version_id(conn, project_id)
    if version_id is None:
        raise api_error(
            status.HTTP_404_NOT_FOUND,
            "project_active_version_not_found",
            "Active project version not found.",
        )
    return version_id


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
    patch: HeatPumpRowPatch,
    access: ProjectAccess,
    *,
    if_match: str | None,
    if_match_version: str | None,
    dry_run: bool,
) -> HeatPumpsPatchResponse:
    """Apply one row patch by translating it into a generic slice-replace.

    The real write runs through the registered contract → spine (cascade,
    validation, and the size guard all live there). A dry run computes the
    delete cascade preview without persisting; a delete blocked by a required
    dependent link raises 409 in both modes.
    """
    user = require_editor_user(access)
    _validate_patch_path(patch)
    contract = leaf_contract_for(table_key)

    if dry_run:
        with transaction() as conn:
            base_body, _base_version_etag, version_etag, draft = load_draft_context(
                conn,
                access.project_id,
                version_id,
                user.id,
                if_match,
                if_match_version,
                draft_etag_mismatch_message=_DRAFT_MISMATCH_MESSAGE,
            )
            affected = preview_dependent_link_cascade(
                base_body,
                table_path=contract.table_path,
                removed=_removed_ids_for_patch(patch),
                dependent_links=contract.dependent_links,
            )
            preview = CascadePreview(affected=[CascadeReference(**ref.as_dict()) for ref in affected])
            return _patch_response(
                access.project_id,
                version_id,
                "draft" if draft is not None else "version",
                version_etag,
                draft["draft_etag"] if draft is not None else None,
                base_body,
                preview,
            )

    def mutate(_conn: object, base_body: ProjectDocumentV1) -> tuple[ProjectDocumentV1, None]:
        payload = build_leaf_replace_payload(
            table_key, base_body, _rows_after_patch(base_body, contract.table_path, patch)
        )
        return contract.apply_replace(base_body, payload), None

    result = apply_document_write(
        access,
        version_id,
        user.id,
        if_match=if_match,
        if_match_version=if_match_version,
        mutate=mutate,
        draft_etag_mismatch_message=_DRAFT_MISMATCH_MESSAGE,
        validate_asset_references=True,
    )
    return _patch_response(
        access.project_id,
        version_id,
        result.source,
        result.version_etag,
        result.draft_etag,
        result.body,
        None,
    )


def _rows_after_patch(
    base_body: ProjectDocumentV1, table_path: tuple[str, ...], patch: HeatPumpRowPatch
) -> list[dict[str, Any]]:
    """Apply the row patch to the leaf's current rows, returning JSON row dicts."""
    envelope = cast(Any, read_table_envelope(base_body, table_path))
    rows = [row.model_dump(mode="json") for row in envelope.rows]
    if patch.op == "add":
        if patch.value is None:
            raise _validation_error("value", "Add operations require a value.")
        rows.append(patch.value)
        return rows

    row_id = _row_id_from_path(patch.path)
    if not any(row["id"] == row_id for row in rows):
        raise _validation_error("path", "Patch path did not match an existing row.", {"row_id": row_id})
    if patch.op == "replace":
        if patch.value is None:
            raise _validation_error("value", "Replace operations require a value.")
        if patch.value.get("id") != row_id:
            raise _validation_error("id", "Replacement row id must match the patch path.", {"row_id": row_id})
        return [patch.value if row["id"] == row_id else row for row in rows]
    return [row for row in rows if row["id"] != row_id]


def _removed_ids_for_patch(patch: HeatPumpRowPatch) -> set[str]:
    return {_row_id_from_path(patch.path)} if patch.op == "remove" else set()


def _validate_patch_path(patch: HeatPumpRowPatch) -> None:
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
    result = apply_document_write(
        access,
        version_id,
        user.id,
        if_match=if_match,
        if_match_version=if_match_version,
        mutate=lambda _conn, base_body: (_apply_option_patch_to_body(base_body, option_key, patch), None),
        draft_etag_mismatch_message="The draft changed before this heat-pump option update was applied.",
    )
    return _response(
        access.project_id,
        version_id,
        result.source,
        result.version_etag,
        result.draft_etag,
        result.body,
    )


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
