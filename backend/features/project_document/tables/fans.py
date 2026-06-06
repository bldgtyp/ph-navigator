"""Fans table contract for the project document registry."""

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
    FAN_OPTION_KEYS,
    FAN_TYPE_OPTION_KEY,
    FanRow,
    FansTableEnvelope,
    ProjectDocumentV1,
    SingleSelectOption,
)
from features.project_document.models import ProjectDocumentSource
from features.project_document.tables._built_in_seeds import built_in_field_def
from features.project_document.tables.contracts import TableContract
from features.project_document.validation import validate_document

FANS_TABLE_NAME = "fans"


FANS_BUILT_IN_FIELD_DEFS: tuple[TableFieldDef, ...] = (
    built_in_field_def(
        field_key=RESERVED_FIELD_KEY_RECORD_ID,
        display_name="Tag",
        field_type=CustomFieldType.short_text,
        description="Equipment schedule tag.",
    ),
    built_in_field_def(field_key="name", display_name="Name", field_type=CustomFieldType.short_text),
    built_in_field_def(field_key="quantity", display_name="Quantity", field_type=CustomFieldType.number, default=1),
    built_in_field_def(field_key="fan_type", display_name="Type", field_type=CustomFieldType.single_select),
    built_in_field_def(field_key="model", display_name="Model", field_type=CustomFieldType.short_text),
    built_in_field_def(field_key="manufacturer", display_name="Manufacturer", field_type=CustomFieldType.short_text),
    built_in_field_def(
        field_key="annual_runtime_min_yr",
        display_name="Annual Runtime (Mins / Year)",
        field_type=CustomFieldType.number,
        description="Annual runtime in minutes per year.",
    ),
    built_in_field_def(
        field_key="airflow_m3h",
        display_name="Airflow",
        field_type=CustomFieldType.number,
        config={
            "units": {
                "mode": "fixed",
                "unit_type": "airflow",
                "si_unit": "m3_h",
                "ip_unit": "cfm",
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
    built_in_field_def(field_key="url", display_name="URL", field_type=CustomFieldType.url),
    built_in_field_def(field_key="notes", display_name="Notes", field_type=CustomFieldType.long_text),
    built_in_field_def(field_key="datasheet_asset_ids", display_name="Datasheet", field_type=CustomFieldType.long_text),
)

FANS_BUILT_IN_FIELD_KEYS: tuple[str, ...] = tuple(f.field_key for f in FANS_BUILT_IN_FIELD_DEFS)

assert any(f.field_key == RESERVED_FIELD_KEY_RECORD_ID for f in FANS_BUILT_IN_FIELD_DEFS), (
    "Fans built-in seed must contain a record_id FieldDef"
)


class FansSliceOptions(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    fans_type: list[SingleSelectOption] = Field(alias=FAN_TYPE_OPTION_KEY)

    def by_option_key(self) -> dict[str, list[SingleSelectOption]]:
        return {FAN_TYPE_OPTION_KEY: self.fans_type}


class FansSliceReplaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fans: list[FanRow]
    single_select_options: FansSliceOptions
    field_defs: list[TableFieldDef] = Field(default_factory=list)


class FansSliceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    fans: list[FanRow]
    field_defs: list[TableFieldDef]
    single_select_options: dict[str, list[SingleSelectOption]]


def apply_fans_replace(body: ProjectDocumentV1, payload: BaseModel) -> ProjectDocumentV1:
    fans_payload = cast(FansSliceReplaceRequest, payload)
    fan_options = fans_payload.single_select_options.by_option_key()
    if (
        body.tables.equipment.fans.rows == fans_payload.fans
        and body.tables.equipment.fans.field_defs == fans_payload.field_defs
        and all(body.single_select_options.get(key, []) == fan_options[key] for key in FAN_OPTION_KEYS)
    ):
        return body

    options = dict(body.single_select_options)
    for key in FAN_OPTION_KEYS:
        options[key] = fan_options[key]
    next_fans_envelope = FansTableEnvelope(
        field_defs=fans_payload.field_defs,
        rows=fans_payload.fans,
    )
    next_equipment = body.tables.equipment.model_copy(update={"fans": next_fans_envelope})
    next_tables = body.tables.model_copy(update={"equipment": next_equipment})
    next_body = body.model_copy(update={"tables": next_tables, "single_select_options": options})
    return validate_document(next_body.model_dump(mode="json"))


def fans_response(
    project_id: UUID,
    version_id: UUID,
    source: ProjectDocumentSource,
    version_etag: str,
    draft_etag: str | None,
    body: ProjectDocumentV1,
) -> FansSliceResponse:
    return FansSliceResponse(
        project_id=project_id,
        version_id=version_id,
        source=source,
        version_etag=version_etag,
        draft_etag=draft_etag,
        fans=body.tables.equipment.fans.rows,
        field_defs=body.tables.equipment.fans.field_defs,
        single_select_options={FAN_TYPE_OPTION_KEY: body.single_select_options[FAN_TYPE_OPTION_KEY]},
    )


def extract_fans_envelope(body: ProjectDocumentV1) -> dict[str, object]:
    return {
        "field_defs": [field.model_dump(mode="json") for field in body.tables.equipment.fans.field_defs],
        "rows": [fan.model_dump(mode="json") for fan in body.tables.equipment.fans.rows],
    }


def extract_fans_diff_value(body: ProjectDocumentV1) -> dict[str, object]:
    return {
        "fans": extract_fans_envelope(body),
        "single_select_options": {
            FAN_TYPE_OPTION_KEY: [
                option.model_dump(mode="json") for option in body.single_select_options[FAN_TYPE_OPTION_KEY]
            ]
        },
    }


fans_contract = TableContract(
    name=FANS_TABLE_NAME,
    schema_slug="fan",
    schema_model=FanRow,
    replace_request_model=FansSliceReplaceRequest,
    build_response=fans_response,
    apply_replace=apply_fans_replace,
    extract_rows=extract_fans_envelope,
    extract_diff_value=extract_fans_diff_value,
    table_path=("equipment", "fans"),
    field_registry=None,
)
