"""Thermal Bridges table contract for the project document registry."""

from __future__ import annotations

from typing import cast
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from features.project_document.custom_fields import (
    RESERVED_FIELD_KEY_RECORD_ID,
    CustomFieldType,
    TableFieldDef,
)
from features.project_document.document import (
    THERMAL_BRIDGE_OPTION_KEYS,
    THERMAL_BRIDGE_TYPE_OPTION_KEY,
    ProjectDocumentV1,
    SingleSelectOption,
    ThermalBridgeRow,
    ThermalBridgesTableEnvelope,
)
from features.project_document.models import ProjectDocumentSource
from features.project_document.tables._built_in_seeds import built_in_field_def
from features.project_document.tables._registry_helpers import (
    FormulaType,
    coerce_custom_option_list_extras,
    custom_option_lists_for_table,
    make_field_registry,
)
from features.project_document.tables.contracts import TableContract
from features.project_document.validation import validate_document

THERMAL_BRIDGES_TABLE_NAME = "thermal_bridges"
_THERMAL_BRIDGES_TABLE_PATH: tuple[str, ...] = (THERMAL_BRIDGES_TABLE_NAME,)


THERMAL_BRIDGES_BUILT_IN_FIELD_DEFS: tuple[TableFieldDef, ...] = (
    built_in_field_def(
        field_key=RESERVED_FIELD_KEY_RECORD_ID,
        display_name="Tag",
        field_type=CustomFieldType.short_text,
        description="Thermal bridge schedule tag.",
    ),
    built_in_field_def(field_key="name", display_name="Name", field_type=CustomFieldType.short_text),
    built_in_field_def(field_key="sheet_name", display_name="Sheet Name", field_type=CustomFieldType.short_text),
    built_in_field_def(
        field_key="drawing_number",
        display_name="Drawing Number",
        field_type=CustomFieldType.short_text,
    ),
    built_in_field_def(
        field_key="psi_value_w_mk",
        display_name="Psi-Value",
        field_type=CustomFieldType.number,
        config={
            "units": {
                "mode": "fixed",
                "unit_type": "conductivity",
                "si_unit": "w_m_k",
                "ip_unit": "btu_h_ft_f",
                "precision_si": 3,
                "precision_ip": 4,
            }
        },
        description="Linear thermal transmittance in W/(m-K).",
    ),
    built_in_field_def(
        field_key="frsi_value",
        display_name="fRSI Value",
        field_type=CustomFieldType.number,
        description="Interior surface-temperature factor; valid range is 0.0 to 1.0.",
    ),
    built_in_field_def(field_key="thermal_bridge_type", display_name="Type", field_type=CustomFieldType.single_select),
    built_in_field_def(
        field_key="pdf_report_asset_ids",
        display_name="PDF Report",
        field_type=CustomFieldType.long_text,
    ),
    built_in_field_def(field_key="notes", display_name="Notes", field_type=CustomFieldType.long_text),
)

THERMAL_BRIDGES_BUILT_IN_FIELD_KEYS: tuple[str, ...] = tuple(f.field_key for f in THERMAL_BRIDGES_BUILT_IN_FIELD_DEFS)
THERMAL_BRIDGES_TYPED_COLUMN_FORMULA_TYPES: dict[str, FormulaType] = {
    "id": "text",
    "thermal_bridge_type": "single_select",
    "pdf_report_asset_ids": "text",
    "notes": "text",
}

assert any(f.field_key == RESERVED_FIELD_KEY_RECORD_ID for f in THERMAL_BRIDGES_BUILT_IN_FIELD_DEFS), (
    "Thermal Bridges built-in seed must contain a record_id FieldDef"
)


class ThermalBridgesSliceOptions(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    thermal_bridges_type: list[SingleSelectOption] = Field(alias=THERMAL_BRIDGE_TYPE_OPTION_KEY)

    @model_validator(mode="after")
    def _validate_namespaced_extras(self) -> ThermalBridgesSliceOptions:
        coerce_custom_option_list_extras(
            self,
            table_path=_THERMAL_BRIDGES_TABLE_PATH,
            table_label=THERMAL_BRIDGES_TABLE_NAME,
        )
        return self

    def by_option_key(self) -> dict[str, list[SingleSelectOption]]:
        return {THERMAL_BRIDGE_TYPE_OPTION_KEY: self.thermal_bridges_type}

    def custom_option_lists(self) -> dict[str, list[SingleSelectOption]]:
        return dict(self.__pydantic_extra__ or {})


class ThermalBridgesSliceReplaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    thermal_bridges: list[ThermalBridgeRow]
    single_select_options: ThermalBridgesSliceOptions
    field_defs: list[TableFieldDef] = Field(default_factory=list)


class ThermalBridgesSliceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    thermal_bridges: list[ThermalBridgeRow]
    field_defs: list[TableFieldDef]
    single_select_options: dict[str, list[SingleSelectOption]]
    rows_computed: dict[str, dict[str, object]] = Field(default_factory=dict)


def apply_thermal_bridges_replace(body: ProjectDocumentV1, payload: BaseModel) -> ProjectDocumentV1:
    thermal_bridges_payload = cast(ThermalBridgesSliceReplaceRequest, payload)
    thermal_bridge_options = thermal_bridges_payload.single_select_options.by_option_key()
    custom_option_lists = thermal_bridges_payload.single_select_options.custom_option_lists()
    if (
        body.tables.thermal_bridges.rows == thermal_bridges_payload.thermal_bridges
        and body.tables.thermal_bridges.field_defs == thermal_bridges_payload.field_defs
        and all(
            body.single_select_options.get(key, []) == thermal_bridge_options[key] for key in THERMAL_BRIDGE_OPTION_KEYS
        )
        and all(body.single_select_options.get(key, []) == value for key, value in custom_option_lists.items())
    ):
        return body

    options = dict(body.single_select_options)
    for key in THERMAL_BRIDGE_OPTION_KEYS:
        options[key] = thermal_bridge_options[key]
    for key, value in custom_option_lists.items():
        options[key] = value
    next_thermal_bridges = ThermalBridgesTableEnvelope(
        field_defs=thermal_bridges_payload.field_defs,
        rows=thermal_bridges_payload.thermal_bridges,
    )
    next_tables = body.tables.model_copy(update={"thermal_bridges": next_thermal_bridges})
    next_body = body.model_copy(update={"tables": next_tables, "single_select_options": options})
    return validate_document(next_body.model_dump(mode="json"))


def thermal_bridges_response(
    project_id: UUID,
    version_id: UUID,
    source: ProjectDocumentSource,
    version_etag: str,
    draft_etag: str | None,
    body: ProjectDocumentV1,
) -> ThermalBridgesSliceResponse:
    from features.project_document.formula import evaluate_table_formulas

    return ThermalBridgesSliceResponse(
        project_id=project_id,
        version_id=version_id,
        source=source,
        version_etag=version_etag,
        draft_etag=draft_etag,
        thermal_bridges=body.tables.thermal_bridges.rows,
        field_defs=body.tables.thermal_bridges.field_defs,
        single_select_options={
            THERMAL_BRIDGE_TYPE_OPTION_KEY: body.single_select_options[THERMAL_BRIDGE_TYPE_OPTION_KEY],
            **custom_option_lists_for_table(body, _THERMAL_BRIDGES_TABLE_PATH),
        },
        rows_computed=evaluate_table_formulas(thermal_bridges_field_registry, body),
    )


def extract_thermal_bridges_envelope(body: ProjectDocumentV1) -> dict[str, object]:
    return {
        "field_defs": [field.model_dump(mode="json") for field in body.tables.thermal_bridges.field_defs],
        "rows": [row.model_dump(mode="json") for row in body.tables.thermal_bridges.rows],
    }


def extract_thermal_bridges_diff_value(body: ProjectDocumentV1) -> dict[str, object]:
    return {
        "thermal_bridges": extract_thermal_bridges_envelope(body),
        "single_select_options": {
            THERMAL_BRIDGE_TYPE_OPTION_KEY: [
                option.model_dump(mode="json") for option in body.single_select_options[THERMAL_BRIDGE_TYPE_OPTION_KEY]
            ],
        },
    }


thermal_bridges_field_registry = make_field_registry(
    field_keys=THERMAL_BRIDGES_BUILT_IN_FIELD_KEYS,
    table_path=_THERMAL_BRIDGES_TABLE_PATH,
    row_model=ThermalBridgeRow,
    built_in_option_key_by_field_key={"thermal_bridge_type": THERMAL_BRIDGE_TYPE_OPTION_KEY},
    built_in_formula_types=THERMAL_BRIDGES_TYPED_COLUMN_FORMULA_TYPES,
)


thermal_bridges_contract = TableContract(
    name=THERMAL_BRIDGES_TABLE_NAME,
    schema_slug="thermal-bridge",
    schema_model=ThermalBridgeRow,
    replace_request_model=ThermalBridgesSliceReplaceRequest,
    build_response=thermal_bridges_response,
    apply_replace=apply_thermal_bridges_replace,
    extract_rows=extract_thermal_bridges_envelope,
    extract_diff_value=extract_thermal_bridges_diff_value,
    table_path=_THERMAL_BRIDGES_TABLE_PATH,
    field_registry=thermal_bridges_field_registry,
)
