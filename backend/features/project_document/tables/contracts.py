"""Shared contract type for project-document table handlers (v3).

Phase 1b: `CustomFieldCapability` reshaped into `TableFieldRegistry`.
"Core vs custom" is no longer a meaningful distinction at the data
layer — every field on the table is a persisted `TableFieldDef`. The
registry's accessors read/write through `(field_defs, custom_values)`
on each table, namespaced single-select option lists, and
schema-mutation hooks.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, ValidationError
from starlette import status

from features.project_document.custom_fields import CustomValue, TableFieldDef
from features.project_document.document import ProjectDocumentV1, SingleSelectOption
from features.project_document.models import ProjectDocumentSource
from features.shared.errors import api_error

if TYPE_CHECKING:
    # Forward reference: schema_mutations.py imports this module for
    # `TableFieldRegistry` so the typed callable on the dataclass
    # cannot import the DTO union eagerly.
    from features.project_document.schema_mutations import FieldSchemaMutation

UnitQuantity = Literal["length", "conductivity", "density", "specific_heat"]


class TableRowsResponse(BaseModel):
    """Generic `{rows}` response envelope for non-FieldDef table contracts."""

    model_config = ConfigDict(extra="forbid")

    project_id: UUID
    version_id: UUID
    source: ProjectDocumentSource
    version_etag: str
    draft_etag: str | None
    rows: list[dict[str, object]]


@dataclass(frozen=True)
class TableFieldRegistry:
    """Per-table field-config accessors for the schema-editor surface.

    Every field-config-capable table registers its accessors here so
    generic routes / services never branch by `table_name`.

    `field_keys` is the canonical ordered tuple of `field_key`s
    declared by the feature seed (built-ins + their order). It drives
    the schema fingerprint's built-in slice.

    `required_field_keys` lists built-in single-select fields where
    delete-to-clear is rejected by the option-edit pipeline (must use
    explicit replacement).
    """

    # Ordered tuple of built-in field_keys declared by the feature seed.
    # Used by the fingerprint algorithm and the field-key registry.
    field_keys: tuple[str, ...]
    option_list_namespace_prefix: str
    # Registered contract path (e.g. `("rooms",)`) used to derive the
    # `<table_path>.<field_key>` option-list namespace key.
    table_path: tuple[str, ...]
    read_field_defs: Callable[[ProjectDocumentV1], list[TableFieldDef]]
    replace_field_defs: Callable[[ProjectDocumentV1, list[TableFieldDef]], ProjectDocumentV1]
    # read_row_custom_values returns the row's live `custom_values`
    # mapping — callers must not mutate the result. Pass a fresh dict
    # to set_row_custom_values.
    read_row_custom_values: Callable[[object], dict[str, CustomValue]]
    set_row_custom_values: Callable[[object, dict[str, CustomValue]], object]
    compute_schema_fingerprint: Callable[[ProjectDocumentV1], str]
    # Schema-editor surface. Hooks raise `api_error` on rejection so
    # REST and MCP share one envelope. `actor_user_id` on apply is
    # stamped onto added / duplicated `TableFieldDef.created_by`;
    # the fixture/dev path passes `None` and is never routed here.
    apply_schema_mutation: Callable[
        [ProjectDocumentV1, FieldSchemaMutation, str],
        tuple[ProjectDocumentV1, dict[str, object]],
    ]
    validate_schema_mutation: Callable[
        [ProjectDocumentV1, FieldSchemaMutation],
        None,
    ]
    # Namespaced option-list helpers for single_select fields
    # (`<table_path>.<field_key>`). Works for both built-in single-
    # selects (e.g. `rooms.floor_level`) and custom single-selects
    # (`rooms.cf_*`).
    read_field_option_list: Callable[
        [ProjectDocumentV1, str],
        list[SingleSelectOption],
    ]
    replace_field_option_list: Callable[
        [ProjectDocumentV1, str, list[SingleSelectOption]],
        ProjectDocumentV1,
    ]
    # Built-in single-select editing surface (typed columns like
    # `floor_level`, `building_zone`). For built-ins whose field_type is
    # mutable (and thus values live in `custom_values`), the schema
    # mutation surface reaches into the bag directly.
    built_in_option_key_by_field_key: dict[str, str]
    required_field_keys: frozenset[str]
    # Read/write a built-in single-select's typed column value (used by
    # the option-edit cascade for locked-type built-in single_selects).
    read_built_in_option_value: Callable[[object, str], str | None]
    set_built_in_option_value: Callable[[object, str, str | None], object]
    # Formula accessors. `field_value_for_formula` returns the row's
    # value for a given `field_key`, reading through typed columns OR
    # `custom_values` based on the persisted FieldDef's `field_type`.
    # `field_type_for_formula` returns the evaluator-facing type
    # ("text" / "number" / "single_select" / "bool") of a field;
    # returns None for keys the formula grammar should treat as opaque.
    field_value_for_formula: Callable[[object, str], object | None]
    field_type_for_formula: Callable[
        [str],
        Literal["text", "number", "single_select", "bool"] | None,
    ]
    # Read-overlay attach helper (plan-17 P4.4). Default implementation
    # lives in `contracts.default_attach_computed_overlay`; tables
    # override only when their wire shape is non-dict rows.
    attach_computed_overlay: Callable[
        [list[dict[str, object]], dict[str, dict[str, object]]],
        list[dict[str, object]],
    ]
    # Built-in field_keys whose `field_type` is locked from user edits
    # (PRD §P4.1, §P5). The frontend renders these as
    # `locked: ["field_type", ...]` on the layered seed and disables
    # the type picker; the backend's schema-mutation surface enforces
    # the same rule defense-in-depth so MCP / hand-crafted writes can't
    # bypass the frontend lock. Custom fields and unlocked built-ins
    # never appear here. Defaults to empty so contracts that haven't
    # declared any field_type-locked built-ins (e.g. pre-registry
    # tables) don't need to opt in. Must be last to keep the
    # default-after-non-default dataclass ordering rule satisfied.
    field_type_locked_keys: frozenset[str] = frozenset()


# Back-compat alias for callers still importing the v2 name. Remove
# once every callsite has migrated.
CustomFieldCapability = TableFieldRegistry


def default_attach_computed_overlay(
    rows: list[dict[str, object]],
    overlay: dict[str, dict[str, object]],
) -> list[dict[str, object]]:
    """Attach `row["computed"] = overlay.get(row.id, {})` on every row."""
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
    # Field-config-capable tables return the `{field_defs, rows}`
    # envelope as a dict; other tables return a bare row list. Callers
    # (downloads, MCP `get_table`, diff) must accept both shapes.
    extract_rows: Callable[[ProjectDocumentV1], object]
    extract_diff_value: Callable[[ProjectDocumentV1], object]
    # JSON document path, e.g. ("equipment", "ervs"). Generic routes
    # read this without branching on `name`.
    table_path: tuple[str, ...] = ()
    # None on tables that have not opted into the field registry.
    field_registry: TableFieldRegistry | None = None
    # Non-persisted frontend hints for PHN-defined physical fields.
    unit_fields: dict[str, UnitQuantity] | None = None

    @property
    def custom_fields(self) -> TableFieldRegistry | None:
        """Back-compat alias for callers still reading `.custom_fields`.

        New code should read `.field_registry` directly. Remove this
        alias once every callsite has migrated.
        """
        return self.field_registry

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
