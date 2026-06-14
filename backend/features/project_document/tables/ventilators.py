"""Ventilators / ERVs table contract for the project document registry."""

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
    VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY,
    VENTILATOR_OPTION_KEYS,
    ProjectDocumentV1,
    SingleSelectOption,
    VentilatorRow,
    VentilatorsTableEnvelope,
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

VENTILATORS_TABLE_NAME = "ventilators"
_VENTILATORS_TABLE_PATH: tuple[str, ...] = ("equipment", "ervs")


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
VENTILATORS_TYPED_COLUMN_FORMULA_TYPES: dict[str, FormulaType] = {
    "id": "text",
    "inside_outside": "single_select",
    "url": "text",
    "notes": "text",
}

assert any(f.field_key == RESERVED_FIELD_KEY_RECORD_ID for f in VENTILATORS_BUILT_IN_FIELD_DEFS), (
    "Ventilators built-in seed must contain a record_id FieldDef"
)


class VentilatorsSliceOptions(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    ventilators_inside_outside: list[SingleSelectOption] = Field(alias=VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY)

    @model_validator(mode="after")
    def _validate_namespaced_extras(self) -> VentilatorsSliceOptions:
        coerce_custom_option_list_extras(self, table_path=_VENTILATORS_TABLE_PATH, table_label=VENTILATORS_TABLE_NAME)
        return self

    def by_option_key(self) -> dict[str, list[SingleSelectOption]]:
        return {VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY: self.ventilators_inside_outside}

    def custom_option_lists(self) -> dict[str, list[SingleSelectOption]]:
        return dict(self.__pydantic_extra__ or {})


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
    rows_computed: dict[str, dict[str, object]] = Field(default_factory=dict)


def apply_ventilators_replace(body: ProjectDocumentV1, payload: BaseModel) -> ProjectDocumentV1:
    ventilators_payload = cast(VentilatorsSliceReplaceRequest, payload)
    ventilator_options = ventilators_payload.single_select_options.by_option_key()
    custom_option_lists = ventilators_payload.single_select_options.custom_option_lists()
    if (
        body.tables.equipment.ervs.rows == ventilators_payload.ventilators
        and body.tables.equipment.ervs.field_defs == ventilators_payload.field_defs
        and all(body.single_select_options.get(key, []) == ventilator_options[key] for key in VENTILATOR_OPTION_KEYS)
        and all(body.single_select_options.get(key, []) == value for key, value in custom_option_lists.items())
    ):
        return body

    options = dict(body.single_select_options)
    for key in VENTILATOR_OPTION_KEYS:
        options[key] = ventilator_options[key]
    for key, value in custom_option_lists.items():
        options[key] = value
    next_ventilators_envelope = VentilatorsTableEnvelope(
        field_defs=ventilators_payload.field_defs,
        rows=ventilators_payload.ventilators,
    )
    next_equipment = body.tables.equipment.model_copy(update={"ervs": next_ventilators_envelope})

    # Cross-table cascade: any HP indoor unit whose `linked_erv_unit_id`
    # pointed at a removed ventilator gets the link cleared, so the
    # document still validates after the ERV row vanishes. Silent — no
    # preview, no dialog. The strict-referential-integrity validator in
    # `document.py` is the only thing that blocks a save with a
    # *dangling* link; legitimate deletes never trip it.
    prior_ids = {row.id for row in body.tables.equipment.ervs.rows}
    next_ids = {row.id for row in ventilators_payload.ventilators}
    removed_ids = prior_ids - next_ids
    if removed_ids:
        heat_pumps = next_equipment.heat_pumps
        cascaded_indoor_units = [
            row.model_copy(update={"linked_erv_unit_id": None}) if row.linked_erv_unit_id in removed_ids else row
            for row in heat_pumps.indoor_units
        ]
        if cascaded_indoor_units != list(heat_pumps.indoor_units):
            next_equipment = next_equipment.model_copy(
                update={
                    "heat_pumps": heat_pumps.model_copy(update={"indoor_units": cascaded_indoor_units}),
                }
            )

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
    from features.project_document.formula import evaluate_table_formulas

    return VentilatorsSliceResponse(
        project_id=project_id,
        version_id=version_id,
        source=source,
        version_etag=version_etag,
        draft_etag=draft_etag,
        ventilators=body.tables.equipment.ervs.rows,
        field_defs=body.tables.equipment.ervs.field_defs,
        single_select_options={
            VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY: body.single_select_options[VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY],
            **custom_option_lists_for_table(body, _VENTILATORS_TABLE_PATH),
        },
        rows_computed=evaluate_table_formulas(ventilators_field_registry, body),
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


ventilators_field_registry = make_field_registry(
    field_keys=VENTILATORS_BUILT_IN_FIELD_KEYS,
    table_path=_VENTILATORS_TABLE_PATH,
    row_model=VentilatorRow,
    built_in_option_key_by_field_key={"inside_outside": VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY},
    built_in_formula_types=VENTILATORS_TYPED_COLUMN_FORMULA_TYPES,
)


ventilators_contract = TableContract(
    name=VENTILATORS_TABLE_NAME,
    schema_slug="ventilator",
    schema_model=VentilatorRow,
    replace_request_model=VentilatorsSliceReplaceRequest,
    build_response=ventilators_response,
    apply_replace=apply_ventilators_replace,
    extract_rows=extract_ventilators_envelope,
    extract_diff_value=extract_ventilators_diff_value,
    table_path=_VENTILATORS_TABLE_PATH,
    field_registry=ventilators_field_registry,
)
