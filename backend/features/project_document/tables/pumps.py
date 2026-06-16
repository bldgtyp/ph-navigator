"""Pumps table contract for the project document registry (v3).

Pumps publishes a `TableFieldRegistry` for user-defined custom-field
schema mutations through the generic project-document mutation path.
Mutable-type built-in pump values (`tag`, `use`, `manufacturer`,
`model`, `volts`, `horse_power`, `wattage`, `flow_gpm`,
`runtime_khr_yr`) live in `PumpRow.custom_values`. Locked-type built-ins
(`device_type`, `phase`, `link`, `notes`) keep typed Pydantic columns.
The `datasheet` attachment lives in `datasheet_asset_ids` (not in the
FieldDef registry — attachment is a FE-only renderer type).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Literal, cast
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from features.project_document.custom_fields import (
    RESERVED_FIELD_KEY_RECORD_ID,
    CustomFieldType,
    CustomValue,
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
from features.project_document.inverse_view import (
    attach_inverse_links_overlay,
    build_inverse_table_view,
)
from features.project_document.models import ProjectDocumentSource
from features.project_document.options import option_list_key, read_option_list, replace_option_list
from features.project_document.tables._built_in_seeds import built_in_field_def
from features.project_document.tables._fingerprint import compute_table_schema_fingerprint
from features.project_document.tables.contracts import (
    InverseLinkField,
    TableContract,
    TableFieldRegistry,
    default_attach_computed_overlay,
)
from features.project_document.validation import validate_document

if TYPE_CHECKING:
    from features.project_document.schema_mutations import FieldSchemaMutation

PUMPS_TABLE_NAME = "pumps"
_PUMPS_TABLE_PATH: tuple[str, ...] = ("equipment", PUMPS_TABLE_NAME)


# Pumps built-in FieldDef seeds. `record_id` replaces Phase 1b's `tag`
# entry end-to-end (display name stays "Tag" — the domain term). The
# `datasheet` attachment is NOT a TableFieldDef entry — attachment is
# a FE-only renderer type and never round-trips through the schema-
# mutation pipeline (PRD §P5.5).
PUMPS_BUILT_IN_FIELD_DEFS: tuple[TableFieldDef, ...] = (
    built_in_field_def(
        field_key=RESERVED_FIELD_KEY_RECORD_ID,
        display_name="Tag",
        field_type=CustomFieldType.short_text,
        description="Drawing-schedule tag (Phase 2: replaces `tag`).",
    ),
    built_in_field_def(field_key="device_type", display_name="Device", field_type=CustomFieldType.single_select),
    built_in_field_def(field_key="use", display_name="Use", field_type=CustomFieldType.short_text),
    built_in_field_def(field_key="manufacturer", display_name="Manufacturer", field_type=CustomFieldType.short_text),
    built_in_field_def(field_key="model", display_name="Model", field_type=CustomFieldType.short_text),
    built_in_field_def(field_key="volts", display_name="Volts", field_type=CustomFieldType.number),
    built_in_field_def(field_key="phase", display_name="Phase", field_type=CustomFieldType.number),
    built_in_field_def(field_key="horse_power", display_name="Horse Power", field_type=CustomFieldType.number),
    built_in_field_def(field_key="wattage", display_name="Wattage", field_type=CustomFieldType.number),
    built_in_field_def(
        field_key="flow_gpm",
        display_name="Flow",
        field_type=CustomFieldType.number,
        config={
            "units": {
                "mode": "fixed",
                "unit_type": "flow_rate",
                "si_unit": "l_min",
                "ip_unit": "gpm",
                "precision_si": 1,
                "precision_ip": 1,
            }
        },
    ),
    built_in_field_def(
        field_key="runtime_khr_yr",
        display_name="Runtime - kHR/YEAR",
        field_type=CustomFieldType.number,
    ),
    built_in_field_def(field_key="link", display_name="Link", field_type=CustomFieldType.url),
    built_in_field_def(field_key="notes", display_name="Notes", field_type=CustomFieldType.long_text),
)

PUMPS_BUILT_IN_FIELD_KEYS: tuple[str, ...] = tuple(f.field_key for f in PUMPS_BUILT_IN_FIELD_DEFS)

# Module-load assertion: every FieldDef-capable table contract module
# guarantees a `record_id` seed (PRD §P4.3, plan-31 phase-2 P3.3).
assert any(f.field_key == RESERVED_FIELD_KEY_RECORD_ID for f in PUMPS_BUILT_IN_FIELD_DEFS), (
    "Pumps built-in seed must contain a record_id FieldDef"
)


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
    rows_computed: dict[str, dict[str, object]] = Field(default_factory=dict)
    inverse_links: dict[str, dict[str, list[str]]] = Field(default_factory=dict)
    inverse_link_fields: list[InverseLinkField] = Field(default_factory=list)
    inverse_links_fingerprint: str = ""


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
    from features.project_document.formula import evaluate_table_formulas

    rows_computed = evaluate_table_formulas(pumps_field_registry, body)
    inverse_view = build_inverse_table_view(body, _PUMPS_TABLE_PATH)
    return PumpsSliceResponse(
        project_id=project_id,
        version_id=version_id,
        source=source,
        version_etag=version_etag,
        draft_etag=draft_etag,
        pumps=body.tables.equipment.pumps.rows,
        field_defs=body.tables.equipment.pumps.field_defs,
        single_select_options={PUMP_DEVICE_TYPE_OPTION_KEY: body.single_select_options[PUMP_DEVICE_TYPE_OPTION_KEY]},
        rows_computed=rows_computed,
        inverse_links=inverse_view.inverse_links,
        inverse_link_fields=inverse_view.inverse_link_fields,
        inverse_links_fingerprint=inverse_view.fingerprint,
    )


def extract_pumps_envelope(body: ProjectDocumentV1) -> dict[str, object]:
    """Return the Pumps table envelope as a JSON-serializable dict.

    Mirrors `extract_rooms_envelope`'s `{field_defs, rows}` shape.
    """
    from features.project_document.formula import evaluate_table_formulas

    overlay = evaluate_table_formulas(pumps_field_registry, body)
    inverse_view = build_inverse_table_view(body, _PUMPS_TABLE_PATH)
    rows = [pump.model_dump(mode="json") for pump in body.tables.equipment.pumps.rows]
    rows_with_overlay = pumps_field_registry.attach_computed_overlay(rows, overlay)
    rows_with_overlay = attach_inverse_links_overlay(rows_with_overlay, inverse_view.inverse_links)
    return {
        "field_defs": [field.model_dump(mode="json") for field in body.tables.equipment.pumps.field_defs],
        "rows": rows_with_overlay,
        "inverse_link_fields": [field.model_dump(mode="json") for field in inverse_view.inverse_link_fields],
        "inverse_links_fingerprint": inverse_view.fingerprint,
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


def _read_pumps_field_defs(body: ProjectDocumentV1) -> list[TableFieldDef]:
    return list(body.tables.equipment.pumps.field_defs)


def _replace_pumps_field_defs(body: ProjectDocumentV1, field_defs: list[TableFieldDef]) -> ProjectDocumentV1:
    next_envelope = body.tables.equipment.pumps.model_copy(update={"field_defs": list(field_defs)})
    next_equipment = body.tables.equipment.model_copy(update={"pumps": next_envelope})
    next_tables = body.tables.model_copy(update={"equipment": next_equipment})
    return body.model_copy(update={"tables": next_tables})


def _read_pump_row_custom_values(row: object) -> dict[str, CustomValue]:
    if not isinstance(row, PumpRow):
        raise TypeError(f"expected PumpRow, got {type(row).__name__}")
    return row.custom_values


def _set_pump_row_custom_values(row: object, custom_values: dict[str, CustomValue]) -> object:
    if not isinstance(row, PumpRow):
        raise TypeError(f"expected PumpRow, got {type(row).__name__}")
    return row.model_copy(update={"custom_values": dict(custom_values)})


def _read_pump_row_links(row: object) -> dict[str, list[str]]:
    if not isinstance(row, PumpRow):
        raise TypeError(f"expected PumpRow, got {type(row).__name__}")
    return row.custom_links


def _set_pump_row_links(row: object, custom_links: dict[str, list[str]]) -> object:
    if not isinstance(row, PumpRow):
        raise TypeError(f"expected PumpRow, got {type(row).__name__}")
    return row.model_copy(update={"custom_links": {k: list(v) for k, v in custom_links.items()}})


def _compute_pumps_schema_fingerprint(body: ProjectDocumentV1) -> str:
    return compute_table_schema_fingerprint(body.tables.equipment.pumps.field_defs)


def _read_pumps_field_option_list(body: ProjectDocumentV1, field_key: str) -> list[SingleSelectOption]:
    return read_option_list(body, option_list_key(_PUMPS_TABLE_PATH, field_key))


def _replace_pumps_field_option_list(
    body: ProjectDocumentV1,
    field_key: str,
    options: list[SingleSelectOption],
) -> ProjectDocumentV1:
    return replace_option_list(body, option_list_key(_PUMPS_TABLE_PATH, field_key), options)


def _read_pumps_built_in_option_value(row: object, field_key: str) -> str | None:
    if not isinstance(row, PumpRow):
        raise TypeError(f"expected PumpRow, got {type(row).__name__}")
    if field_key == "device_type":
        return row.device_type
    raise ValueError(f"unknown built-in single-select field: {field_key}")


def _set_pumps_built_in_option_value(row: object, field_key: str, value: str | None) -> object:
    if not isinstance(row, PumpRow):
        raise TypeError(f"expected PumpRow, got {type(row).__name__}")
    if field_key == "device_type":
        return row.model_copy(update={"device_type": value})
    raise ValueError(f"unknown built-in single-select field: {field_key}")


PumpFormulaType = Literal["text", "number", "single_select", "bool"]
PUMPS_TYPED_COLUMN_FORMULA_TYPES: dict[str, PumpFormulaType] = {
    "id": "text",
    "device_type": "single_select",
    "phase": "number",
    "link": "text",
    "notes": "text",
}


def _read_pumps_field_for_formula(row: object, field_key: str) -> object | None:
    if not isinstance(row, PumpRow):
        return None
    if field_key in row.custom_values:
        return row.custom_values[field_key]
    value = getattr(row, field_key, None)
    if value is None:
        return None
    if isinstance(value, list):
        return ", ".join(str(v) for v in value)
    if isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def _pumps_field_type_for_formula(field_key: str) -> PumpFormulaType | None:
    return PUMPS_TYPED_COLUMN_FORMULA_TYPES.get(field_key)


def _apply_pumps_schema_mutation(
    body: ProjectDocumentV1,
    mutation: FieldSchemaMutation,
    actor_user_id: str,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    from features.project_document.schema_mutations import apply_schema_mutation

    return apply_schema_mutation(
        body,
        mutation,
        actor_user_id=actor_user_id,
        capability=pumps_field_registry,
    )


def _validate_pumps_schema_mutation(
    body: ProjectDocumentV1,
    mutation: FieldSchemaMutation,
) -> None:
    from features.project_document.schema_mutations import validate_schema_mutation

    validate_schema_mutation(
        body,
        mutation,
        capability=pumps_field_registry,
    )


pumps_field_registry = TableFieldRegistry(
    field_keys=PUMPS_BUILT_IN_FIELD_KEYS,
    option_list_namespace_prefix="equipment.pumps",
    table_path=_PUMPS_TABLE_PATH,
    read_field_defs=_read_pumps_field_defs,
    replace_field_defs=_replace_pumps_field_defs,
    read_row_custom_values=_read_pump_row_custom_values,
    set_row_custom_values=_set_pump_row_custom_values,
    read_row_links=_read_pump_row_links,
    set_row_links=_set_pump_row_links,
    compute_schema_fingerprint=_compute_pumps_schema_fingerprint,
    apply_schema_mutation=_apply_pumps_schema_mutation,
    validate_schema_mutation=_validate_pumps_schema_mutation,
    read_field_option_list=_read_pumps_field_option_list,
    replace_field_option_list=_replace_pumps_field_option_list,
    built_in_option_key_by_field_key={"device_type": PUMP_DEVICE_TYPE_OPTION_KEY},
    required_field_keys=frozenset(),
    read_built_in_option_value=_read_pumps_built_in_option_value,
    set_built_in_option_value=_set_pumps_built_in_option_value,
    field_value_for_formula=_read_pumps_field_for_formula,
    field_type_for_formula=_pumps_field_type_for_formula,  # type: ignore[arg-type]
    attach_computed_overlay=default_attach_computed_overlay,
)


pumps_contract = TableContract(
    name=PUMPS_TABLE_NAME,
    schema_slug="pump",
    schema_model=PumpRow,
    replace_request_model=PumpsSliceReplaceRequest,
    build_response=pumps_response,
    apply_replace=apply_pumps_replace,
    extract_rows=extract_pumps_envelope,
    extract_diff_value=extract_pumps_diff_value,
    table_path=_PUMPS_TABLE_PATH,
    field_registry=pumps_field_registry,
)
