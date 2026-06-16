"""Space-Types table contract for the project document registry."""

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
    ProjectDocumentV1,
    SingleSelectOption,
    SpaceTypeRow,
    SpaceTypesTableEnvelope,
)
from features.project_document.inverse_view import attach_inverse_links_overlay, build_inverse_table_view
from features.project_document.models import ProjectDocumentSource
from features.project_document.tables._built_in_seeds import built_in_field_def
from features.project_document.tables._registry_helpers import (
    FormulaType,
    coerce_custom_option_list_extras,
    custom_option_lists_for_table,
    make_field_registry,
)
from features.project_document.tables.contracts import InverseLinkField, TableContract
from features.project_document.validation import validate_document

SPACE_TYPES_TABLE_NAME = "space_types"
_SPACE_TYPES_TABLE_PATH: tuple[str, ...] = (SPACE_TYPES_TABLE_NAME,)


SPACE_TYPES_BUILT_IN_FIELD_DEFS: tuple[TableFieldDef, ...] = (
    built_in_field_def(
        field_key=RESERVED_FIELD_KEY_RECORD_ID,
        display_name="Tag",
        field_type=CustomFieldType.short_text,
        description="Project-specific space type tag.",
    ),
    built_in_field_def(field_key="name", display_name="Name", field_type=CustomFieldType.short_text),
)

SPACE_TYPES_BUILT_IN_FIELD_KEYS: tuple[str, ...] = tuple(f.field_key for f in SPACE_TYPES_BUILT_IN_FIELD_DEFS)
SPACE_TYPES_TYPED_COLUMN_FORMULA_TYPES: dict[str, FormulaType] = {"id": "text"}

assert any(f.field_key == RESERVED_FIELD_KEY_RECORD_ID for f in SPACE_TYPES_BUILT_IN_FIELD_DEFS), (
    "Space-Types built-in seed must contain a record_id FieldDef"
)


class SpaceTypesSliceOptions(BaseModel):
    model_config = ConfigDict(extra="allow")

    @model_validator(mode="after")
    def _validate_namespaced_extras(self) -> SpaceTypesSliceOptions:
        coerce_custom_option_list_extras(
            self,
            table_path=_SPACE_TYPES_TABLE_PATH,
            table_label=SPACE_TYPES_TABLE_NAME,
        )
        return self

    def custom_option_lists(self) -> dict[str, list[SingleSelectOption]]:
        return dict(self.__pydantic_extra__ or {})


class SpaceTypesSliceReplaceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    space_types: list[SpaceTypeRow]
    field_defs: list[TableFieldDef] = Field(default_factory=list)
    single_select_options: SpaceTypesSliceOptions = Field(default_factory=SpaceTypesSliceOptions)


class SpaceTypesSliceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    space_types: list[SpaceTypeRow]
    field_defs: list[TableFieldDef]
    single_select_options: dict[str, list[SingleSelectOption]]
    rows_computed: dict[str, dict[str, object]] = Field(default_factory=dict)
    inverse_links: dict[str, dict[str, list[str]]] = Field(default_factory=dict)
    inverse_link_fields: list[InverseLinkField] = Field(default_factory=list)
    inverse_links_fingerprint: str = ""


def apply_space_types_replace(body: ProjectDocumentV1, payload: BaseModel) -> ProjectDocumentV1:
    space_types_payload = cast(SpaceTypesSliceReplaceRequest, payload)
    custom_option_lists = space_types_payload.single_select_options.custom_option_lists()
    if (
        body.tables.space_types.rows == space_types_payload.space_types
        and body.tables.space_types.field_defs == space_types_payload.field_defs
        and all(body.single_select_options.get(key, []) == value for key, value in custom_option_lists.items())
    ):
        return body

    next_envelope = SpaceTypesTableEnvelope(
        field_defs=space_types_payload.field_defs,
        rows=space_types_payload.space_types,
    )
    options = dict(body.single_select_options)
    for key, value in custom_option_lists.items():
        options[key] = value
    next_tables = body.tables.model_copy(update={"space_types": next_envelope})
    next_body = body.model_copy(update={"tables": next_tables, "single_select_options": options})
    return validate_document(next_body.model_dump(mode="json"))


def space_types_response(
    project_id: UUID,
    version_id: UUID,
    source: ProjectDocumentSource,
    version_etag: str,
    draft_etag: str | None,
    body: ProjectDocumentV1,
) -> SpaceTypesSliceResponse:
    from features.project_document.formula import evaluate_table_formulas

    rows_computed = evaluate_table_formulas(space_types_field_registry, body)
    inverse_view = build_inverse_table_view(body, _SPACE_TYPES_TABLE_PATH)
    return SpaceTypesSliceResponse(
        project_id=project_id,
        version_id=version_id,
        source=source,
        version_etag=version_etag,
        draft_etag=draft_etag,
        space_types=body.tables.space_types.rows,
        field_defs=body.tables.space_types.field_defs,
        single_select_options=custom_option_lists_for_table(body, _SPACE_TYPES_TABLE_PATH),
        rows_computed=rows_computed,
        inverse_links=inverse_view.inverse_links,
        inverse_link_fields=inverse_view.inverse_link_fields,
        inverse_links_fingerprint=inverse_view.fingerprint,
    )


def extract_space_types_envelope(body: ProjectDocumentV1) -> dict[str, object]:
    from features.project_document.formula import evaluate_table_formulas

    overlay = evaluate_table_formulas(space_types_field_registry, body)
    inverse_view = build_inverse_table_view(body, _SPACE_TYPES_TABLE_PATH)
    row_dicts = [space_type.model_dump(mode="json") for space_type in body.tables.space_types.rows]
    rows_with_overlay = space_types_field_registry.attach_computed_overlay(row_dicts, overlay)
    rows_with_overlay = attach_inverse_links_overlay(rows_with_overlay, inverse_view.inverse_links)
    return {
        "field_defs": [field.model_dump(mode="json") for field in body.tables.space_types.field_defs],
        "rows": rows_with_overlay,
        "inverse_link_fields": [field.model_dump(mode="json") for field in inverse_view.inverse_link_fields],
        "inverse_links_fingerprint": inverse_view.fingerprint,
    }


def extract_space_types_diff_value(body: ProjectDocumentV1) -> dict[str, object]:
    return {
        "space_types": extract_space_types_envelope(body),
        "single_select_options": {
            key: [option.model_dump(mode="json") for option in values]
            for key, values in custom_option_lists_for_table(body, _SPACE_TYPES_TABLE_PATH).items()
        },
    }


space_types_field_registry = make_field_registry(
    field_keys=SPACE_TYPES_BUILT_IN_FIELD_KEYS,
    table_path=_SPACE_TYPES_TABLE_PATH,
    row_model=SpaceTypeRow,
    built_in_formula_types=SPACE_TYPES_TYPED_COLUMN_FORMULA_TYPES,
)


space_types_contract = TableContract(
    name=SPACE_TYPES_TABLE_NAME,
    schema_slug="space-type",
    schema_model=SpaceTypeRow,
    replace_request_model=SpaceTypesSliceReplaceRequest,
    build_response=space_types_response,
    apply_replace=apply_space_types_replace,
    extract_rows=extract_space_types_envelope,
    extract_diff_value=extract_space_types_diff_value,
    table_path=_SPACE_TYPES_TABLE_PATH,
    field_registry=space_types_field_registry,
)
