"""Shared contract type for project-document table handlers."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from uuid import UUID

from pydantic import BaseModel, ValidationError
from starlette import status

from features.project_document.custom_fields import CustomFieldDef, CustomValue
from features.project_document.document import ProjectDocumentV1
from features.project_document.models import ProjectDocumentSource
from features.shared.errors import api_error


@dataclass(frozen=True)
class CustomFieldCapability:
    """Per-table custom-field accessors for the schema-editor surface.

    Plan-13 §4.3.1: every custom-field-capable table registers its
    accessors here so generic routes / services never branch by
    `table_name`. Phase-2 schema mutations and the schema fingerprint
    consult this block.

    `core_field_keys` is the canonical tuple of python attribute names
    on the row model (used for formula refs and the field-key registry).
    `core_display_names` is the parallel tuple of header labels used by
    the duplicate-name uniqueness check (D5).
    """

    core_field_keys: tuple[str, ...]
    core_display_names: tuple[str, ...]
    option_list_namespace_prefix: str
    read_custom_fields: Callable[[ProjectDocumentV1], list[CustomFieldDef]]
    replace_custom_fields: Callable[[ProjectDocumentV1, list[CustomFieldDef]], ProjectDocumentV1]
    read_row_custom: Callable[[object], dict[str, CustomValue]]
    set_row_custom: Callable[[object, dict[str, CustomValue]], object]
    compute_schema_fingerprint: Callable[[ProjectDocumentV1], str]
    # Phase 2 will add `apply_schema_mutation` and `validate_schema_mutation`.


@dataclass(frozen=True)
class TableContract:
    """Per-table behavior used by generic document/draft/table routes."""

    name: str
    schema_slug: str
    schema_model: type[BaseModel]
    replace_request_model: type[BaseModel]
    build_response: Callable[[UUID, UUID, ProjectDocumentSource, str, str | None, ProjectDocumentV1], BaseModel]
    apply_replace: Callable[[ProjectDocumentV1, BaseModel], ProjectDocumentV1]
    # Plan-13 §4.1: custom-field-capable tables (e.g. Rooms) return the
    # `{custom_fields, rows}` envelope as a dict; other tables still
    # return a bare row list. Callers (downloads, MCP `get_table`,
    # diff) must accept both shapes.
    extract_rows: Callable[[ProjectDocumentV1], object]
    extract_diff_value: Callable[[ProjectDocumentV1], object]
    # JSON document path, including nested paths like ("equipment", "ervs").
    # Phase 5 fan-out reads this without branching on `name`.
    table_path: tuple[str, ...] = ()
    # None on tables that have not opted into custom fields (plan-13 §4.3.1).
    custom_fields: CustomFieldCapability | None = None

    def parse_replace_payload(self, raw_payload: object) -> BaseModel:
        try:
            return self.replace_request_model.model_validate(raw_payload)
        except ValidationError as exc:
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "validation_error",
                "Table payload failed validation.",
                {"errors": [str(error["msg"]) for error in exc.errors()]},
            ) from exc
