"""Pumps table contract for the project document registry (v3).

Phase 1b: Pumps gains a persisted `field_defs` array (storage-only —
the full schema-mutation capability is deferred to a follow-up phase
that ships record_id and the catalog rollout). Mutable-type built-in
pump values (`tag`, `use`, `manufacturer`, `model`, `volts`,
`horse_power`, `wattage`, `flow_gpm`, `runtime_khr_yr`) live in
`PumpRow.custom_values`. Locked-type built-ins (`device_type`, `phase`,
`link`, `notes`) keep typed Pydantic columns. The `datasheet`
attachment lives in `datasheet_asset_ids` (not in the FieldDef
registry — attachment is a FE-only renderer type).
"""

from __future__ import annotations

from typing import cast
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from features.project_document.custom_fields import (
    CustomFieldType,
    TableFieldDef,
)
from features.project_document.document import (
    PUMP_DEVICE_TYPE_OPTION_KEY,
    PUMP_OPTION_KEYS,
    ProjectDocumentV1,
    PumpRow,
    PumpsTableEnvelope,
    SingleSelectOption,
)
from features.project_document.models import ProjectDocumentSource
from features.project_document.tables._built_in_seeds import built_in_field_def
from features.project_document.tables.contracts import TableContract
from features.project_document.validation import validate_document

PUMPS_TABLE_NAME = "pumps"


# Pumps built-in FieldDef seeds. `tag` survives this phase so Phase 2
# can rename it cleanly to `record_id`. The `datasheet` attachment is
# NOT a TableFieldDef entry — attachment is a FE-only renderer type and
# never round-trips through the schema-mutation pipeline (PRD §P5.5).
PUMPS_BUILT_IN_FIELD_DEFS: tuple[TableFieldDef, ...] = (
    built_in_field_def(field_key="tag", display_name="Tag", field_type=CustomFieldType.short_text),
    built_in_field_def(field_key="device_type", display_name="Device", field_type=CustomFieldType.single_select),
    built_in_field_def(field_key="use", display_name="Use", field_type=CustomFieldType.short_text),
    built_in_field_def(field_key="manufacturer", display_name="Manufacturer", field_type=CustomFieldType.short_text),
    built_in_field_def(field_key="model", display_name="Model", field_type=CustomFieldType.short_text),
    built_in_field_def(field_key="volts", display_name="Volts", field_type=CustomFieldType.number),
    built_in_field_def(field_key="phase", display_name="Phase", field_type=CustomFieldType.number),
    built_in_field_def(field_key="horse_power", display_name="Horse Power", field_type=CustomFieldType.number),
    built_in_field_def(field_key="wattage", display_name="Wattage", field_type=CustomFieldType.number),
    built_in_field_def(field_key="flow_gpm", display_name="Flow - GPM", field_type=CustomFieldType.number),
    built_in_field_def(
        field_key="runtime_khr_yr",
        display_name="Runtime - kHR/YEAR",
        field_type=CustomFieldType.number,
    ),
    built_in_field_def(field_key="link", display_name="Link", field_type=CustomFieldType.url),
    built_in_field_def(field_key="notes", display_name="Notes", field_type=CustomFieldType.long_text),
)

PUMPS_BUILT_IN_FIELD_KEYS: tuple[str, ...] = tuple(f.field_key for f in PUMPS_BUILT_IN_FIELD_DEFS)


class PumpsSliceOptions(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    pumps_device_type: list[SingleSelectOption] = Field(alias=PUMP_DEVICE_TYPE_OPTION_KEY)

    def by_option_key(self) -> dict[str, list[SingleSelectOption]]:
        return {PUMP_DEVICE_TYPE_OPTION_KEY: self.pumps_device_type}


class PumpsSliceReplaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    pumps: list[PumpRow]
    single_select_options: PumpsSliceOptions
    field_defs: list[TableFieldDef] = Field(default_factory=list)


class PumpsSliceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    pumps: list[PumpRow]
    field_defs: list[TableFieldDef]
    single_select_options: dict[str, list[SingleSelectOption]]


def apply_pumps_replace(body: ProjectDocumentV1, payload: BaseModel) -> ProjectDocumentV1:
    pumps_payload = cast(PumpsSliceReplaceRequest, payload)
    pump_options = pumps_payload.single_select_options.by_option_key()
    if (
        body.tables.equipment.pumps.rows == pumps_payload.pumps
        and body.tables.equipment.pumps.field_defs == pumps_payload.field_defs
        and all(body.single_select_options.get(key, []) == pump_options[key] for key in PUMP_OPTION_KEYS)
    ):
        return body

    options = dict(body.single_select_options)
    for key in PUMP_OPTION_KEYS:
        options[key] = pump_options[key]
    next_pumps_envelope = PumpsTableEnvelope(
        field_defs=pumps_payload.field_defs,
        rows=pumps_payload.pumps,
    )
    next_equipment = body.tables.equipment.model_copy(update={"pumps": next_pumps_envelope})
    next_tables = body.tables.model_copy(update={"equipment": next_equipment})
    next_body = body.model_copy(update={"tables": next_tables, "single_select_options": options})
    return validate_document(next_body.model_dump(mode="json"))


def pumps_response(
    project_id: UUID,
    version_id: UUID,
    source: ProjectDocumentSource,
    version_etag: str,
    draft_etag: str | None,
    body: ProjectDocumentV1,
) -> PumpsSliceResponse:
    return PumpsSliceResponse(
        project_id=project_id,
        version_id=version_id,
        source=source,
        version_etag=version_etag,
        draft_etag=draft_etag,
        pumps=body.tables.equipment.pumps.rows,
        field_defs=body.tables.equipment.pumps.field_defs,
        single_select_options={PUMP_DEVICE_TYPE_OPTION_KEY: body.single_select_options[PUMP_DEVICE_TYPE_OPTION_KEY]},
    )


def extract_pumps_envelope(body: ProjectDocumentV1) -> dict[str, object]:
    """Return the Pumps table envelope as a JSON-serializable dict.

    Mirrors `extract_rooms_envelope`'s `{field_defs, rows}` shape.
    """
    return {
        "field_defs": [field.model_dump(mode="json") for field in body.tables.equipment.pumps.field_defs],
        "rows": [pump.model_dump(mode="json") for pump in body.tables.equipment.pumps.rows],
    }


def extract_pumps_diff_value(body: ProjectDocumentV1) -> dict[str, object]:
    return {
        "pumps": extract_pumps_envelope(body),
        "single_select_options": {
            PUMP_DEVICE_TYPE_OPTION_KEY: [
                option.model_dump(mode="json") for option in body.single_select_options[PUMP_DEVICE_TYPE_OPTION_KEY]
            ],
        },
    }


pumps_contract = TableContract(
    name=PUMPS_TABLE_NAME,
    schema_slug="pump",
    schema_model=PumpRow,
    replace_request_model=PumpsSliceReplaceRequest,
    build_response=pumps_response,
    apply_replace=apply_pumps_replace,
    extract_rows=extract_pumps_envelope,
    extract_diff_value=extract_pumps_diff_value,
    table_path=("equipment", "pumps"),
    field_registry=None,
)
