"""Shared contract type for project-document table handlers."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal
from uuid import UUID

from pydantic import BaseModel, ValidationError
from starlette import status

from features.project_document.custom_fields import CustomFieldDef, CustomValue
from features.project_document.document import ProjectDocumentV1, SingleSelectOption
from features.project_document.models import ProjectDocumentSource
from features.shared.errors import api_error

if TYPE_CHECKING:
    # Forward reference: schema_mutations.py imports this module for
    # `CustomFieldCapability` so the typed callable on the dataclass
    # cannot import the DTO union eagerly.
    from features.project_document.schema_mutations import FieldSchemaMutation


@dataclass(frozen=True)
class CustomFieldCapability:
    """Per-table custom-field accessors for the schema-editor surface.

    Every custom-field-capable table registers its accessors here so
    generic routes / services never branch by `table_name`.

    `core_field_keys` is the canonical tuple of python attribute names
    on the row model (used for formula refs and the field-key registry);
    `core_display_names` is the parallel tuple of header labels used by
    the duplicate-name uniqueness check.
    """

    core_field_keys: tuple[str, ...]
    core_display_names: tuple[str, ...]
    option_list_namespace_prefix: str
    # Registered contract path (e.g. `("rooms",)`) used to derive the
    # `<table_path>.<field_id>` option-list namespace key.
    table_path: tuple[str, ...]
    read_custom_fields: Callable[[ProjectDocumentV1], list[CustomFieldDef]]
    replace_custom_fields: Callable[[ProjectDocumentV1, list[CustomFieldDef]], ProjectDocumentV1]
    # read_row_custom returns the row's live `custom` mapping — callers
    # must not mutate the result. Pass a fresh dict to set_row_custom.
    read_row_custom: Callable[[object], dict[str, CustomValue]]
    set_row_custom: Callable[[object, dict[str, CustomValue]], object]
    compute_schema_fingerprint: Callable[[ProjectDocumentV1], str]
    # Schema-editor surface. Hooks raise `api_error` on rejection so
    # REST and MCP share one envelope. `actor_user_id` on apply is
    # stamped onto added / duplicated `CustomFieldDef.created_by`;
    # the fixture/dev path passes `None` and is never routed here.
    apply_schema_mutation: Callable[
        [ProjectDocumentV1, FieldSchemaMutation, str],
        tuple[ProjectDocumentV1, dict[str, object]],
    ]
    validate_schema_mutation: Callable[
        [ProjectDocumentV1, FieldSchemaMutation],
        None,
    ]
    # Namespaced option-list helpers for custom single_select fields
    # (`<table_path>.<cf_id>`).
    read_field_option_list: Callable[
        [ProjectDocumentV1, str],
        list[SingleSelectOption],
    ]
    replace_field_option_list: Callable[
        [ProjectDocumentV1, str, list[SingleSelectOption]],
        ProjectDocumentV1,
    ]
    # Core single-select editing surface.
    core_option_key_by_field_id: dict[str, str]
    required_core_select_fields: frozenset[str]
    read_core_option_value: Callable[[object, str], str | None]
    set_core_option_value: Callable[[object, str, str | None], object]
    # Phase 4 formula accessors. `core_field_value_for_formula` returns
    # a core field's value for the row indexed by its python attribute
    # key; the evaluator reads only through this callable so cross-
    # table fan-out (Phase 5) needs no evaluator changes.
    # `core_field_type_for_formula` returns the evaluator-facing type
    # ("text" / "number" / "single_select") of a core field, used by
    # the field registry; returns None for keys the formula grammar
    # should treat as opaque (e.g. list-valued or struct-valued core
    # fields).
    core_field_value_for_formula: Callable[[object, str], object | None]
    core_field_type_for_formula: Callable[
        [str],
        Literal["text", "number", "single_select", "bool"] | None,
    ]
    # Read-overlay attach helper (plan-17 P4.4). Default
    # implementation lives in `contracts.default_attach_computed_overlay`;
    # tables override only when their wire shape is non-dict rows.
    attach_computed_overlay: Callable[
        [list[dict[str, object]], dict[str, dict[str, object]]],
        list[dict[str, object]],
    ]


def default_attach_computed_overlay(
    rows: list[dict[str, object]],
    overlay: dict[str, dict[str, object]],
) -> list[dict[str, object]]:
    """Attach `row["computed"] = overlay.get(row.id, {})` on every row.

    Used by every custom-field-capable contract whose download / slice
    response emits a list of row dicts. Tables that emit non-dict rows
    can override with a custom helper.
    """
    out: list[dict[str, object]] = []
    for row in rows:
        row_id = str(row.get("id", ""))
        next_row = dict(row)
        next_row["computed"] = overlay.get(row_id, {})
        out.append(next_row)
    return out


@dataclass(frozen=True)
class TableContract:
    """Per-table behavior used by generic document/draft/table routes."""

    name: str
    schema_slug: str
    schema_model: type[BaseModel]
    replace_request_model: type[BaseModel]
    build_response: Callable[[UUID, UUID, ProjectDocumentSource, str, str | None, ProjectDocumentV1], BaseModel]
    apply_replace: Callable[[ProjectDocumentV1, BaseModel], ProjectDocumentV1]
    # Custom-field-capable tables return the `{custom_fields, rows}`
    # envelope as a dict; other tables return a bare row list. Callers
    # (downloads, MCP `get_table`, diff) must accept both shapes.
    extract_rows: Callable[[ProjectDocumentV1], object]
    extract_diff_value: Callable[[ProjectDocumentV1], object]
    # JSON document path, e.g. ("equipment", "ervs"). Generic routes
    # read this without branching on `name`.
    table_path: tuple[str, ...] = ()
    # None on tables that have not opted into custom fields.
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
