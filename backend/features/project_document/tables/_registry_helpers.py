"""Shared helpers for FieldDef-capable table registries."""

from __future__ import annotations

from typing import Any, Literal, cast

from pydantic import BaseModel

from features.project_document.custom_fields import CustomValue, TableFieldDef
from features.project_document.document import ProjectDocumentV1, SingleSelectOption
from features.project_document.options import option_list_key, read_option_list, replace_option_list
from features.project_document.rows import RowWithCustomFields
from features.project_document.tables._fingerprint import compute_table_schema_fingerprint
from features.project_document.tables.contracts import (
    TableFieldRegistry,
    default_attach_computed_overlay,
    read_table_envelope,
    replace_table_envelope,
    table_path_option_namespace,
)

FormulaType = Literal["text", "number", "single_select", "bool"]


def custom_option_lists_for_table(
    body: ProjectDocumentV1,
    table_path: tuple[str, ...],
) -> dict[str, list[SingleSelectOption]]:
    prefix = option_list_key(table_path, "cf_")
    return {key: options for key, options in body.single_select_options.items() if key.startswith(prefix)}


def coerce_custom_option_list_extras(
    model: BaseModel,
    *,
    table_path: tuple[str, ...],
    table_label: str,
) -> dict[str, list[SingleSelectOption]]:
    prefix = option_list_key(table_path, "cf_")
    extras = getattr(model, "__pydantic_extra__", None) or {}
    coerced: dict[str, list[SingleSelectOption]] = {}
    for key, raw_value in extras.items():
        if not key.startswith(prefix):
            raise ValueError(
                f"Unsupported option key in {table_label} slice payload: {key!r} "
                f"(only built-in keys and `{prefix}*` are accepted)"
            )
        if not isinstance(raw_value, list):
            raise ValueError(f"Option list for {key!r} must be a list")
        coerced[key] = [SingleSelectOption.model_validate(option) for option in raw_value]
    if coerced:
        model.__pydantic_extra__ = coerced
    return coerced


def make_field_registry(
    *,
    field_keys: tuple[str, ...],
    table_path: tuple[str, ...],
    row_model: type[RowWithCustomFields],
    built_in_option_key_by_field_key: dict[str, str] | None = None,
    built_in_formula_types: dict[str, FormulaType] | None = None,
    option_editable_builtin_field_keys: frozenset[str] = frozenset(),
    field_type_locked_keys: frozenset[str] = frozenset(),
) -> TableFieldRegistry:
    """Build the standard registry for a FieldDef envelope table."""

    option_key_by_field_key = built_in_option_key_by_field_key or {}
    formula_types = built_in_formula_types or {}
    registry_holder: dict[str, TableFieldRegistry] = {}

    def read_field_defs(body: ProjectDocumentV1) -> list[TableFieldDef]:
        envelope = cast(Any, read_table_envelope(body, table_path))
        return list(envelope.field_defs)

    def replace_field_defs(body: ProjectDocumentV1, field_defs: list[TableFieldDef]) -> ProjectDocumentV1:
        envelope = cast(Any, read_table_envelope(body, table_path))
        next_envelope = envelope.model_copy(update={"field_defs": list(field_defs)})
        return replace_table_envelope(body, table_path, next_envelope)

    def read_row_custom_values(row: object) -> dict[str, CustomValue]:
        typed_row = _expect_row(row_model, row)
        return typed_row.custom_values

    def set_row_custom_values(row: object, custom_values: dict[str, CustomValue]) -> object:
        typed_row = _expect_row(row_model, row)
        return typed_row.model_copy(update={"custom_values": dict(custom_values)})

    def read_row_links(row: object) -> dict[str, list[str]]:
        typed_row = _expect_row(row_model, row)
        return typed_row.custom_links

    def set_row_links(row: object, custom_links: dict[str, list[str]]) -> object:
        typed_row = _expect_row(row_model, row)
        return typed_row.model_copy(update={"custom_links": {key: list(value) for key, value in custom_links.items()}})

    def compute_schema_fingerprint(body: ProjectDocumentV1) -> str:
        return compute_table_schema_fingerprint(read_field_defs(body))

    def read_field_option_list(body: ProjectDocumentV1, field_key: str) -> list[SingleSelectOption]:
        return read_option_list(body, option_list_key(table_path, field_key))

    def replace_field_option_list(
        body: ProjectDocumentV1,
        field_key: str,
        options: list[SingleSelectOption],
    ) -> ProjectDocumentV1:
        return replace_option_list(body, option_list_key(table_path, field_key), options)

    def read_built_in_option_value(row: object, field_key: str) -> str | None:
        typed_row = _expect_row(row_model, row)
        if field_key not in option_key_by_field_key:
            raise ValueError(f"unknown built-in single-select field: {field_key}")
        value = getattr(typed_row, field_key)
        return value if isinstance(value, str) else None

    def set_built_in_option_value(row: object, field_key: str, value: str | None) -> object:
        typed_row = _expect_row(row_model, row)
        if field_key not in option_key_by_field_key:
            raise ValueError(f"unknown built-in single-select field: {field_key}")
        return typed_row.model_copy(update={field_key: value})

    def field_value_for_formula(row: object, field_key: str) -> object | None:
        if not isinstance(row, row_model):
            return None
        if field_key in row.custom_values:
            return row.custom_values[field_key]
        value = getattr(row, field_key, None)
        if value is None:
            return None
        if isinstance(value, list):
            return ", ".join(str(item) for item in value)
        if isinstance(value, (str, int, float, bool)):
            return value
        return str(value)

    def field_type_for_formula(field_key: str) -> FormulaType | None:
        return formula_types.get(field_key)

    def apply_schema_mutation(
        body: ProjectDocumentV1,
        mutation: object,
        actor_user_id: str,
    ) -> tuple[ProjectDocumentV1, dict[str, object]]:
        from features.project_document.schema_mutations import FieldSchemaMutation, apply_schema_mutation

        return apply_schema_mutation(
            body,
            cast(FieldSchemaMutation, mutation),
            actor_user_id=actor_user_id,
            capability=registry_holder["registry"],
        )

    def validate_schema_mutation(body: ProjectDocumentV1, mutation: object) -> None:
        from features.project_document.schema_mutations import FieldSchemaMutation, validate_schema_mutation

        validate_schema_mutation(
            body,
            cast(FieldSchemaMutation, mutation),
            capability=registry_holder["registry"],
        )

    registry = TableFieldRegistry(
        field_keys=field_keys,
        option_list_namespace_prefix=table_path_option_namespace(table_path),
        table_path=table_path,
        read_field_defs=read_field_defs,
        replace_field_defs=replace_field_defs,
        read_row_custom_values=read_row_custom_values,
        set_row_custom_values=set_row_custom_values,
        read_row_links=read_row_links,
        set_row_links=set_row_links,
        compute_schema_fingerprint=compute_schema_fingerprint,
        apply_schema_mutation=apply_schema_mutation,  # type: ignore[arg-type]
        validate_schema_mutation=validate_schema_mutation,  # type: ignore[arg-type]
        read_field_option_list=read_field_option_list,
        replace_field_option_list=replace_field_option_list,
        built_in_option_key_by_field_key=dict(option_key_by_field_key),
        required_field_keys=frozenset(),
        read_built_in_option_value=read_built_in_option_value,
        set_built_in_option_value=set_built_in_option_value,
        field_value_for_formula=field_value_for_formula,
        field_type_for_formula=field_type_for_formula,  # type: ignore[arg-type]
        attach_computed_overlay=default_attach_computed_overlay,
        option_editable_builtin_field_keys=option_editable_builtin_field_keys,
        field_type_locked_keys=field_type_locked_keys,
    )
    registry_holder["registry"] = registry
    return registry


def _expect_row(row_model: type[RowWithCustomFields], row: object) -> RowWithCustomFields:
    if not isinstance(row, row_model):
        raise TypeError(f"expected {row_model.__name__}, got {type(row).__name__}")
    return row
