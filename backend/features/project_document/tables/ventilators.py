"""Ventilators / ERVs table contract for the project document registry."""

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
    VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY,
    VENTILATOR_OPTION_KEYS,
    ProjectDocumentV1,
    SingleSelectOption,
    VentilatorRow,
    VentilatorsTableEnvelope,
)
from features.project_document.models import ProjectDocumentSource
from features.project_document.tables._built_in_seeds import built_in_field_def
from features.project_document.tables.contracts import TableContract
from features.project_document.validation import validate_document

VENTILATORS_TABLE_NAME = "ventilators"


VENTILATORS_BUILT_IN_FIELD_DEFS: tuple[TableFieldDef, ...] = (
    built_in_field_def(
        field_key=RESERVED_FIELD_KEY_RECORD_ID,
        display_name="Tag",
        field_type=CustomFieldType.short_text,
        description="Equipment schedule tag.",
    ),
    built_in_field_def(field_key="name", display_name="Name", field_type=CustomFieldType.short_text),
    built_in_field_def(
        field_key="airflow_rate_m3h",
        display_name="Airflow Rate",
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
    built_in_field_def(field_key="model", display_name="Model", field_type=CustomFieldType.short_text),
    built_in_field_def(field_key="manufacturer", display_name="Manufacturer", field_type=CustomFieldType.short_text),
    built_in_field_def(
        field_key="heat_recovery_percent", display_name="Heat Recovery %", field_type=CustomFieldType.number
    ),
    built_in_field_def(
        field_key="moisture_recovery_percent",
        display_name="Moisture Recovery %",
        field_type=CustomFieldType.number,
    ),
    built_in_field_def(
        field_key="electrical_efficiency_wh_m3",
        display_name="Electrical Efficiency",
        field_type=CustomFieldType.number,
        config={
            "units": {
                "mode": "fixed",
                "unit_type": "electric_efficiency",
                "si_unit": "wh_m3",
                "ip_unit": "w_cfm",
                "precision_si": 2,
                "precision_ip": 2,
            }
        },
    ),
    built_in_field_def(
        field_key="filter_merv_rating", display_name="Filter MERV Rating", field_type=CustomFieldType.number
    ),
    built_in_field_def(
        field_key="inside_outside",
        display_name="Inside / Outside",
        field_type=CustomFieldType.single_select,
    ),
    built_in_field_def(field_key="url", display_name="URL", field_type=CustomFieldType.url),
    built_in_field_def(field_key="notes", display_name="Notes", field_type=CustomFieldType.long_text),
)

VENTILATORS_BUILT_IN_FIELD_KEYS: tuple[str, ...] = tuple(f.field_key for f in VENTILATORS_BUILT_IN_FIELD_DEFS)

assert any(f.field_key == RESERVED_FIELD_KEY_RECORD_ID for f in VENTILATORS_BUILT_IN_FIELD_DEFS), (
    "Ventilators built-in seed must contain a record_id FieldDef"
)


class VentilatorsSliceOptions(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    ventilators_inside_outside: list[SingleSelectOption] = Field(alias=VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY)

    def by_option_key(self) -> dict[str, list[SingleSelectOption]]:
        return {VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY: self.ventilators_inside_outside}


class VentilatorsSliceReplaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ventilators: list[VentilatorRow]
    single_select_options: VentilatorsSliceOptions
    field_defs: list[TableFieldDef] = Field(default_factory=list)


class VentilatorsSliceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    ventilators: list[VentilatorRow]
    field_defs: list[TableFieldDef]
    single_select_options: dict[str, list[SingleSelectOption]]


def apply_ventilators_replace(body: ProjectDocumentV1, payload: BaseModel) -> ProjectDocumentV1:
    ventilators_payload = cast(VentilatorsSliceReplaceRequest, payload)
    ventilator_options = ventilators_payload.single_select_options.by_option_key()
    if (
        body.tables.equipment.ervs.rows == ventilators_payload.ventilators
        and body.tables.equipment.ervs.field_defs == ventilators_payload.field_defs
        and all(body.single_select_options.get(key, []) == ventilator_options[key] for key in VENTILATOR_OPTION_KEYS)
    ):
        return body

    options = dict(body.single_select_options)
    for key in VENTILATOR_OPTION_KEYS:
        options[key] = ventilator_options[key]
    next_ventilators_envelope = VentilatorsTableEnvelope(
        field_defs=ventilators_payload.field_defs,
        rows=ventilators_payload.ventilators,
    )
    next_equipment = body.tables.equipment.model_copy(update={"ervs": next_ventilators_envelope})
    next_tables = body.tables.model_copy(update={"equipment": next_equipment})
    next_body = body.model_copy(update={"tables": next_tables, "single_select_options": options})
    return validate_document(next_body.model_dump(mode="json"))


def ventilators_response(
    project_id: UUID,
    version_id: UUID,
    source: ProjectDocumentSource,
    version_etag: str,
    draft_etag: str | None,
    body: ProjectDocumentV1,
) -> VentilatorsSliceResponse:
    return VentilatorsSliceResponse(
        project_id=project_id,
        version_id=version_id,
        source=source,
        version_etag=version_etag,
        draft_etag=draft_etag,
        ventilators=body.tables.equipment.ervs.rows,
        field_defs=body.tables.equipment.ervs.field_defs,
        single_select_options={
            VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY: body.single_select_options[VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY]
        },
    )


def extract_ventilators_envelope(body: ProjectDocumentV1) -> dict[str, object]:
    return {
        "field_defs": [field.model_dump(mode="json") for field in body.tables.equipment.ervs.field_defs],
        "rows": [ventilator.model_dump(mode="json") for ventilator in body.tables.equipment.ervs.rows],
    }


def extract_ventilators_diff_value(body: ProjectDocumentV1) -> dict[str, object]:
    return {
        "ventilators": extract_ventilators_envelope(body),
        "single_select_options": {
            VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY: [
                option.model_dump(mode="json")
                for option in body.single_select_options[VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY]
            ],
        },
    }


ventilators_contract = TableContract(
    name=VENTILATORS_TABLE_NAME,
    schema_slug="ventilator",
    schema_model=VentilatorRow,
    replace_request_model=VentilatorsSliceReplaceRequest,
    build_response=ventilators_response,
    apply_replace=apply_ventilators_replace,
    extract_rows=extract_ventilators_envelope,
    extract_diff_value=extract_ventilators_diff_value,
    table_path=("equipment", "ervs"),
    field_registry=None,
)
