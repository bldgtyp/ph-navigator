"""Appliances table contract for the project document registry."""

from __future__ import annotations

from typing import cast
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from features.project_document.custom_fields import (
    RESERVED_FIELD_KEY_RECORD_ID,
    CustomFieldType,
    TableFieldDef,
)
from features.project_document.document import (
    APPLIANCE_ENERGY_STAR_OPTION_KEY,
    APPLIANCE_OPTION_KEYS,
    APPLIANCE_TYPE_OPTION_KEY,
    ApplianceRow,
    AppliancesTableEnvelope,
    ProjectDocumentV1,
    SingleSelectOption,
)
from features.project_document.models import ProjectDocumentSource
from features.project_document.tables._built_in_seeds import built_in_field_def
from features.project_document.tables.contracts import TableContract
from features.project_document.validation import validate_document

APPLIANCES_TABLE_NAME = "appliances"


APPLIANCES_BUILT_IN_FIELD_DEFS: tuple[TableFieldDef, ...] = (
    built_in_field_def(
        field_key=RESERVED_FIELD_KEY_RECORD_ID,
        display_name="Tag",
        field_type=CustomFieldType.short_text,
        description="Equipment schedule tag.",
    ),
    built_in_field_def(field_key="appliance_type", display_name="Type", field_type=CustomFieldType.single_select),
    built_in_field_def(field_key="name", display_name="Name", field_type=CustomFieldType.short_text),
    built_in_field_def(field_key="quantity", display_name="Quantity", field_type=CustomFieldType.number, default=1),
    built_in_field_def(field_key="model", display_name="Model", field_type=CustomFieldType.short_text),
    built_in_field_def(field_key="manufacturer", display_name="Manufacturer", field_type=CustomFieldType.short_text),
    built_in_field_def(field_key="energy_star", display_name="EnergyStar", field_type=CustomFieldType.single_select),
    built_in_field_def(
        field_key="capacity_m3",
        display_name="Capacity",
        field_type=CustomFieldType.number,
        config={
            "units": {
                "mode": "fixed",
                "unit_type": "volume",
                "si_unit": "m3",
                "ip_unit": "ft3",
                "precision_si": 3,
                "precision_ip": 1,
            }
        },
    ),
    built_in_field_def(field_key="cef", display_name="CEF", field_type=CustomFieldType.number),
    built_in_field_def(field_key="imef", display_name="IMEF", field_type=CustomFieldType.number),
    built_in_field_def(field_key="mef", display_name="MEF", field_type=CustomFieldType.number),
    built_in_field_def(field_key="annual_energy_kwh", display_name="Annual Energy", field_type=CustomFieldType.number),
    built_in_field_def(field_key="url", display_name="URL", field_type=CustomFieldType.url),
    built_in_field_def(field_key="datasheet_asset_ids", display_name="Datasheet", field_type=CustomFieldType.long_text),
    built_in_field_def(field_key="notes", display_name="Notes", field_type=CustomFieldType.long_text),
)

APPLIANCES_BUILT_IN_FIELD_KEYS: tuple[str, ...] = tuple(f.field_key for f in APPLIANCES_BUILT_IN_FIELD_DEFS)

assert any(f.field_key == RESERVED_FIELD_KEY_RECORD_ID for f in APPLIANCES_BUILT_IN_FIELD_DEFS), (
    "Appliances built-in seed must contain a record_id FieldDef"
)


class AppliancesSliceOptions(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    appliances_type: list[SingleSelectOption] = Field(alias=APPLIANCE_TYPE_OPTION_KEY)
    appliances_energy_star: list[SingleSelectOption] = Field(alias=APPLIANCE_ENERGY_STAR_OPTION_KEY)

    def by_option_key(self) -> dict[str, list[SingleSelectOption]]:
        return {
            APPLIANCE_TYPE_OPTION_KEY: self.appliances_type,
            APPLIANCE_ENERGY_STAR_OPTION_KEY: self.appliances_energy_star,
        }


class AppliancesSliceReplaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    appliances: list[ApplianceRow]
    single_select_options: AppliancesSliceOptions
    field_defs: list[TableFieldDef] = Field(default_factory=list)


class AppliancesSliceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    appliances: list[ApplianceRow]
    field_defs: list[TableFieldDef]
    single_select_options: dict[str, list[SingleSelectOption]]


def apply_appliances_replace(body: ProjectDocumentV1, payload: BaseModel) -> ProjectDocumentV1:
    appliances_payload = cast(AppliancesSliceReplaceRequest, payload)
    appliance_options = appliances_payload.single_select_options.by_option_key()
    if (
        body.tables.equipment.appliances.rows == appliances_payload.appliances
        and body.tables.equipment.appliances.field_defs == appliances_payload.field_defs
        and all(body.single_select_options.get(key, []) == appliance_options[key] for key in APPLIANCE_OPTION_KEYS)
    ):
        return body

    options = dict(body.single_select_options)
    for key in APPLIANCE_OPTION_KEYS:
        options[key] = appliance_options[key]
    next_appliances_envelope = AppliancesTableEnvelope(
        field_defs=appliances_payload.field_defs,
        rows=appliances_payload.appliances,
    )
    next_equipment = body.tables.equipment.model_copy(update={"appliances": next_appliances_envelope})
    next_tables = body.tables.model_copy(update={"equipment": next_equipment})
    next_body = body.model_copy(update={"tables": next_tables, "single_select_options": options})
    return validate_document(next_body.model_dump(mode="json"))


def appliances_response(
    project_id: UUID,
    version_id: UUID,
    source: ProjectDocumentSource,
    version_etag: str,
    draft_etag: str | None,
    body: ProjectDocumentV1,
) -> AppliancesSliceResponse:
    return AppliancesSliceResponse(
        project_id=project_id,
        version_id=version_id,
        source=source,
        version_etag=version_etag,
        draft_etag=draft_etag,
        appliances=body.tables.equipment.appliances.rows,
        field_defs=body.tables.equipment.appliances.field_defs,
        single_select_options={
            APPLIANCE_TYPE_OPTION_KEY: body.single_select_options[APPLIANCE_TYPE_OPTION_KEY],
            APPLIANCE_ENERGY_STAR_OPTION_KEY: body.single_select_options[APPLIANCE_ENERGY_STAR_OPTION_KEY],
        },
    )


def extract_appliances_envelope(body: ProjectDocumentV1) -> dict[str, object]:
    return {
        "field_defs": [field.model_dump(mode="json") for field in body.tables.equipment.appliances.field_defs],
        "rows": [appliance.model_dump(mode="json") for appliance in body.tables.equipment.appliances.rows],
    }


def extract_appliances_diff_value(body: ProjectDocumentV1) -> dict[str, object]:
    return {
        "appliances": extract_appliances_envelope(body),
        "single_select_options": {
            key: [option.model_dump(mode="json") for option in body.single_select_options[key]]
            for key in APPLIANCE_OPTION_KEYS
        },
    }


appliances_contract = TableContract(
    name=APPLIANCES_TABLE_NAME,
    schema_slug="appliance",
    schema_model=ApplianceRow,
    replace_request_model=AppliancesSliceReplaceRequest,
    build_response=appliances_response,
    apply_replace=apply_appliances_replace,
    extract_rows=extract_appliances_envelope,
    extract_diff_value=extract_appliances_diff_value,
    table_path=("equipment", "appliances"),
    field_registry=None,
)
