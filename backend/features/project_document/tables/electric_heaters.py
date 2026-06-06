"""Electric Heaters table contract for the project document registry."""

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
    ElectricHeaterRow,
    ElectricHeatersTableEnvelope,
    ProjectDocumentV1,
)
from features.project_document.models import ProjectDocumentSource
from features.project_document.tables._built_in_seeds import built_in_field_def
from features.project_document.tables.contracts import TableContract
from features.project_document.validation import validate_document

ELECTRIC_HEATERS_TABLE_NAME = "electric_heaters"


ELECTRIC_HEATERS_BUILT_IN_FIELD_DEFS: tuple[TableFieldDef, ...] = (
    built_in_field_def(
        field_key=RESERVED_FIELD_KEY_RECORD_ID,
        display_name="Tag",
        field_type=CustomFieldType.short_text,
        description="Equipment schedule tag.",
    ),
    built_in_field_def(field_key="name", display_name="Name", field_type=CustomFieldType.short_text),
    built_in_field_def(field_key="model", display_name="Model", field_type=CustomFieldType.short_text),
    built_in_field_def(field_key="manufacturer", display_name="Manufacturer", field_type=CustomFieldType.short_text),
    built_in_field_def(field_key="watt", display_name="Watt", field_type=CustomFieldType.number),
    built_in_field_def(field_key="url", display_name="URL", field_type=CustomFieldType.url),
    built_in_field_def(field_key="notes", display_name="Notes", field_type=CustomFieldType.long_text),
)

ELECTRIC_HEATERS_BUILT_IN_FIELD_KEYS: tuple[str, ...] = tuple(f.field_key for f in ELECTRIC_HEATERS_BUILT_IN_FIELD_DEFS)

assert any(f.field_key == RESERVED_FIELD_KEY_RECORD_ID for f in ELECTRIC_HEATERS_BUILT_IN_FIELD_DEFS), (
    "Electric Heaters built-in seed must contain a record_id FieldDef"
)


class ElectricHeatersSliceReplaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    electric_heaters: list[ElectricHeaterRow]
    field_defs: list[TableFieldDef] = Field(default_factory=list)
    single_select_options: dict[str, list[object]] = Field(default_factory=dict)


class ElectricHeatersSliceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    electric_heaters: list[ElectricHeaterRow]
    field_defs: list[TableFieldDef]
    single_select_options: dict[str, list[object]]


def apply_electric_heaters_replace(body: ProjectDocumentV1, payload: BaseModel) -> ProjectDocumentV1:
    electric_heaters_payload = cast(ElectricHeatersSliceReplaceRequest, payload)
    if (
        body.tables.equipment.electric_heaters.rows == electric_heaters_payload.electric_heaters
        and body.tables.equipment.electric_heaters.field_defs == electric_heaters_payload.field_defs
    ):
        return body

    next_electric_heaters_envelope = ElectricHeatersTableEnvelope(
        field_defs=electric_heaters_payload.field_defs,
        rows=electric_heaters_payload.electric_heaters,
    )
    next_equipment = body.tables.equipment.model_copy(update={"electric_heaters": next_electric_heaters_envelope})
    next_tables = body.tables.model_copy(update={"equipment": next_equipment})
    next_body = body.model_copy(update={"tables": next_tables})
    return validate_document(next_body.model_dump(mode="json"))


def electric_heaters_response(
    project_id: UUID,
    version_id: UUID,
    source: ProjectDocumentSource,
    version_etag: str,
    draft_etag: str | None,
    body: ProjectDocumentV1,
) -> ElectricHeatersSliceResponse:
    return ElectricHeatersSliceResponse(
        project_id=project_id,
        version_id=version_id,
        source=source,
        version_etag=version_etag,
        draft_etag=draft_etag,
        electric_heaters=body.tables.equipment.electric_heaters.rows,
        field_defs=body.tables.equipment.electric_heaters.field_defs,
        single_select_options={},
    )


def extract_electric_heaters_envelope(body: ProjectDocumentV1) -> dict[str, object]:
    return {
        "field_defs": [field.model_dump(mode="json") for field in body.tables.equipment.electric_heaters.field_defs],
        "rows": [heater.model_dump(mode="json") for heater in body.tables.equipment.electric_heaters.rows],
    }


def extract_electric_heaters_diff_value(body: ProjectDocumentV1) -> dict[str, object]:
    return {"electric_heaters": extract_electric_heaters_envelope(body)}


electric_heaters_contract = TableContract(
    name=ELECTRIC_HEATERS_TABLE_NAME,
    schema_slug="electric-heater",
    schema_model=ElectricHeaterRow,
    replace_request_model=ElectricHeatersSliceReplaceRequest,
    build_response=electric_heaters_response,
    apply_replace=apply_electric_heaters_replace,
    extract_rows=extract_electric_heaters_envelope,
    extract_diff_value=extract_electric_heaters_diff_value,
    table_path=("equipment", "electric_heaters"),
    field_registry=None,
)
