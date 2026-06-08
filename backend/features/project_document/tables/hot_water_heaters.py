"""Hot Water Heaters table contract for the project document registry."""

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
    HOT_WATER_HEATER_OPTION_KEYS,
    HOT_WATER_HEATER_TYPE_OPTION_KEY,
    HotWaterHeaterRow,
    HotWaterHeatersTableEnvelope,
    ProjectDocumentV1,
    SingleSelectOption,
)
from features.project_document.models import ProjectDocumentSource
from features.project_document.tables._built_in_seeds import built_in_field_def
from features.project_document.tables.contracts import TableContract
from features.project_document.validation import validate_document

HOT_WATER_HEATERS_TABLE_NAME = "hot_water_heaters"


HOT_WATER_HEATERS_BUILT_IN_FIELD_DEFS: tuple[TableFieldDef, ...] = (
    built_in_field_def(
        field_key=RESERVED_FIELD_KEY_RECORD_ID,
        display_name="Tag",
        field_type=CustomFieldType.short_text,
        description="Equipment schedule tag.",
    ),
    built_in_field_def(field_key="name", display_name="Name", field_type=CustomFieldType.short_text),
    built_in_field_def(field_key="quantity", display_name="Quantity", field_type=CustomFieldType.number, default=1),
    built_in_field_def(field_key="heater_type", display_name="Type", field_type=CustomFieldType.single_select),
    built_in_field_def(field_key="model", display_name="Model", field_type=CustomFieldType.short_text),
    built_in_field_def(field_key="manufacturer", display_name="Manufacturer", field_type=CustomFieldType.short_text),
    built_in_field_def(
        field_key="size_l",
        display_name="Size",
        field_type=CustomFieldType.number,
        config={
            "units": {
                "mode": "fixed",
                "unit_type": "volume_liters",
                "si_unit": "l",
                "ip_unit": "gal",
                "precision_si": 1,
                "precision_ip": 1,
            }
        },
    ),
    built_in_field_def(
        field_key="temperature_c",
        display_name="Temperatur",
        field_type=CustomFieldType.number,
        config={
            "units": {
                "mode": "fixed",
                "unit_type": "temperature",
                "si_unit": "c",
                "ip_unit": "f",
                "precision_si": 1,
                "precision_ip": 1,
            }
        },
    ),
    built_in_field_def(field_key="amps", display_name="Amps", field_type=CustomFieldType.number),
    built_in_field_def(field_key="volts", display_name="Volts", field_type=CustomFieldType.number),
    built_in_field_def(field_key="phase", display_name="Phase", field_type=CustomFieldType.number),
    built_in_field_def(
        field_key="power_factor",
        display_name="Power Factor",
        field_type=CustomFieldType.number,
        default=0.8,
    ),
    built_in_field_def(field_key="watts", display_name="Watts", field_type=CustomFieldType.number),
    built_in_field_def(field_key="uef", display_name="UEF", field_type=CustomFieldType.number),
    built_in_field_def(field_key="url", display_name="URL", field_type=CustomFieldType.url),
    built_in_field_def(field_key="notes", display_name="Notes", field_type=CustomFieldType.long_text),
    built_in_field_def(field_key="datasheet_asset_ids", display_name="Datasheet", field_type=CustomFieldType.long_text),
)

HOT_WATER_HEATERS_BUILT_IN_FIELD_KEYS: tuple[str, ...] = tuple(
    f.field_key for f in HOT_WATER_HEATERS_BUILT_IN_FIELD_DEFS
)

assert any(f.field_key == RESERVED_FIELD_KEY_RECORD_ID for f in HOT_WATER_HEATERS_BUILT_IN_FIELD_DEFS), (
    "Hot Water Heaters built-in seed must contain a record_id FieldDef"
)


class HotWaterHeatersSliceOptions(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    hot_water_heaters_type: list[SingleSelectOption] = Field(alias=HOT_WATER_HEATER_TYPE_OPTION_KEY)

    def by_option_key(self) -> dict[str, list[SingleSelectOption]]:
        return {HOT_WATER_HEATER_TYPE_OPTION_KEY: self.hot_water_heaters_type}


class HotWaterHeatersSliceReplaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    hot_water_heaters: list[HotWaterHeaterRow]
    single_select_options: HotWaterHeatersSliceOptions
    field_defs: list[TableFieldDef] = Field(default_factory=list)


class HotWaterHeatersSliceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    hot_water_heaters: list[HotWaterHeaterRow]
    field_defs: list[TableFieldDef]
    single_select_options: dict[str, list[SingleSelectOption]]


def apply_hot_water_heaters_replace(body: ProjectDocumentV1, payload: BaseModel) -> ProjectDocumentV1:
    hot_water_heaters_payload = cast(HotWaterHeatersSliceReplaceRequest, payload)
    hot_water_heater_options = hot_water_heaters_payload.single_select_options.by_option_key()
    if (
        body.tables.equipment.hot_water_heaters.rows == hot_water_heaters_payload.hot_water_heaters
        and body.tables.equipment.hot_water_heaters.field_defs == hot_water_heaters_payload.field_defs
        and all(
            body.single_select_options.get(key, []) == hot_water_heater_options[key]
            for key in HOT_WATER_HEATER_OPTION_KEYS
        )
    ):
        return body

    options = dict(body.single_select_options)
    for key in HOT_WATER_HEATER_OPTION_KEYS:
        options[key] = hot_water_heater_options[key]
    next_hot_water_heaters_envelope = HotWaterHeatersTableEnvelope(
        field_defs=hot_water_heaters_payload.field_defs,
        rows=hot_water_heaters_payload.hot_water_heaters,
    )
    next_equipment = body.tables.equipment.model_copy(update={"hot_water_heaters": next_hot_water_heaters_envelope})
    next_tables = body.tables.model_copy(update={"equipment": next_equipment})
    next_body = body.model_copy(update={"tables": next_tables, "single_select_options": options})
    return validate_document(next_body.model_dump(mode="json"))


def hot_water_heaters_response(
    project_id: UUID,
    version_id: UUID,
    source: ProjectDocumentSource,
    version_etag: str,
    draft_etag: str | None,
    body: ProjectDocumentV1,
) -> HotWaterHeatersSliceResponse:
    return HotWaterHeatersSliceResponse(
        project_id=project_id,
        version_id=version_id,
        source=source,
        version_etag=version_etag,
        draft_etag=draft_etag,
        hot_water_heaters=body.tables.equipment.hot_water_heaters.rows,
        field_defs=body.tables.equipment.hot_water_heaters.field_defs,
        single_select_options={
            HOT_WATER_HEATER_TYPE_OPTION_KEY: body.single_select_options[HOT_WATER_HEATER_TYPE_OPTION_KEY]
        },
    )


def extract_hot_water_heaters_envelope(body: ProjectDocumentV1) -> dict[str, object]:
    return {
        "field_defs": [field.model_dump(mode="json") for field in body.tables.equipment.hot_water_heaters.field_defs],
        "rows": [heater.model_dump(mode="json") for heater in body.tables.equipment.hot_water_heaters.rows],
    }


def extract_hot_water_heaters_diff_value(body: ProjectDocumentV1) -> dict[str, object]:
    return {
        "hot_water_heaters": extract_hot_water_heaters_envelope(body),
        "single_select_options": {
            HOT_WATER_HEATER_TYPE_OPTION_KEY: [
                option.model_dump(mode="json")
                for option in body.single_select_options[HOT_WATER_HEATER_TYPE_OPTION_KEY]
            ]
        },
    }


hot_water_heaters_contract = TableContract(
    name=HOT_WATER_HEATERS_TABLE_NAME,
    schema_slug="hot-water-heater",
    schema_model=HotWaterHeaterRow,
    replace_request_model=HotWaterHeatersSliceReplaceRequest,
    build_response=hot_water_heaters_response,
    apply_replace=apply_hot_water_heaters_replace,
    extract_rows=extract_hot_water_heaters_envelope,
    extract_diff_value=extract_hot_water_heaters_diff_value,
    table_path=("equipment", "hot_water_heaters"),
    field_registry=None,
)
