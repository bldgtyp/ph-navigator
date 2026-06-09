"""`setFormula` dispatcher with parse / resolve / cycle-check translation.

Calls the `formula/` sub-package and translates each typed exception
into a `features.shared.errors.api_error`. The translation helpers are
module-private; the only public entry point is `apply_set_formula`.

AST analysis helpers live in `formula.analysis` so table seed builders
can use them without importing mutation dispatchers at module import.
"""

from __future__ import annotations

from starlette import status

from features.project_document.custom_fields import CustomFieldType
from features.project_document.document import ProjectDocumentV1
from features.project_document.formula import (
    FormulaAST,
    FormulaCycleError,
    FormulaInvalidLinkedArgError,
    FormulaMissingRefError,
    FormulaParseError,
    FormulaResourceLimitError,
    FormulaUnsupportedFunctionError,
    ast_from_json,
    ast_to_json,
    build_field_registry,
    detect_cycles,
    parse,
    resolve_refs,
)
from features.project_document.formula.analysis import count_ast_nodes, infer_result_type
from features.project_document.formula.resolver import collect_field_refs
from features.project_document.mutations.guards import find_field
from features.project_document.mutations.models import SetFormulaMutation
from features.project_document.tables.contracts import TableFieldRegistry
from features.shared.errors import api_error

__all__ = ["apply_set_formula", "count_ast_nodes", "infer_result_type"]


def _raise_formula_parse_error(exc: FormulaParseError, field_id: str) -> None:
    raise api_error(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "custom_field_formula_parse_error",
        f"Couldn't parse the formula: {exc.message} (position {exc.offset}).",
        {
            "field_id": field_id,
            "parse_error": exc.message,
            "offset": exc.offset,
            "source": exc.source,
        },
    )


def _raise_formula_resource_limit(exc: FormulaResourceLimitError, field_id: str) -> None:
    raise api_error(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "custom_field_formula_resource_limit",
        f"Formula exceeds {exc.limit_name} limit ({exc.actual}/{exc.max_value}). "
        "Simplify the expression and try again.",
        {
            "field_id": field_id,
            "limit_name": exc.limit_name,
            "actual": exc.actual,
            "max": exc.max_value,
        },
    )


def _raise_formula_unsupported_function(exc: FormulaUnsupportedFunctionError, field_id: str) -> None:
    available = sorted(exc.available)
    raise api_error(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "custom_field_formula_unsupported_function",
        f"Function {exc.function_name!r} is not supported. Available: " + ", ".join(available) + ".",
        {
            "field_id": field_id,
            "function_name": exc.function_name,
            "available_functions": available,
        },
    )


def _raise_formula_missing_ref(
    exc: FormulaMissingRefError,
    field_id: str,
    missing_ref_id: str | None = None,
) -> None:
    raise api_error(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "custom_field_formula_missing_ref",
        f"Formula references a field that doesn't exist in this table: {exc.display_name}.",
        {
            "field_id": field_id,
            "missing_ref_display_name": exc.display_name,
            "missing_ref_id": missing_ref_id,
        },
    )


def _raise_formula_cycle(exc: FormulaCycleError, field_id: str) -> None:
    raise api_error(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "custom_field_formula_cycle",
        f"This formula creates a cycle: {' -> '.join(exc.cycle_path)}. Remove the loop and try again.",
        {
            "field_id": field_id,
            "cycle_path": list(exc.cycle_path),
        },
    )


def apply_set_formula(
    body: ProjectDocumentV1,
    mutation: SetFormulaMutation,
    capability: TableFieldRegistry,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    current_fields = capability.read_field_defs(body)
    index, existing = find_field(current_fields, mutation.field_id, mutation.table_key)
    if existing.field_type is not CustomFieldType.formula:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "custom_field_invalid_field_id",
            "setFormula target is not a formula field.",
            {
                "field_id": mutation.field_id,
                "table_key": mutation.table_key,
                "reason": "field_type_not_formula",
            },
        )

    # Parse.
    try:
        ast = parse(mutation.source)
    except FormulaParseError as exc:
        _raise_formula_parse_error(exc, mutation.field_id)
        raise  # pragma: no cover — _raise_* always raises
    except FormulaResourceLimitError as exc:
        _raise_formula_resource_limit(exc, mutation.field_id)
        raise  # pragma: no cover
    except FormulaUnsupportedFunctionError as exc:
        _raise_formula_unsupported_function(exc, mutation.field_id)
        raise  # pragma: no cover
    except FormulaInvalidLinkedArgError as exc:
        _raise_formula_parse_error(FormulaParseError(exc.message, 0, mutation.source), mutation.field_id)
        raise  # pragma: no cover

    # Resolve refs against the current registry.
    registry = build_field_registry(capability, body)
    try:
        resolved = resolve_refs(ast, registry)
    except FormulaMissingRefError as exc:
        _raise_formula_missing_ref(exc, mutation.field_id)
        raise  # pragma: no cover

    # Cycle-check against every other formula field's stored AST.
    asts_by_id: dict[str, FormulaAST] = {}
    for f in current_fields:
        if f.field_key == mutation.field_id:
            continue
        if f.field_type is not CustomFieldType.formula:
            continue
        stored = f.config.get("ast")
        if stored is None:
            continue
        try:
            asts_by_id[f.field_key] = ast_from_json(stored)
        except (ValueError, TypeError):
            # Skip malformed stored ASTs — the per-row evaluator will
            # surface missing_ref at read time.
            continue

    try:
        detect_cycles(mutation.field_id, resolved, asts_by_id)
    except FormulaCycleError as exc:
        _raise_formula_cycle(exc, mutation.field_id)
        raise  # pragma: no cover

    deps = collect_field_refs(resolved)
    new_config: dict[str, object] = {
        "source": mutation.source,
        "ast": ast_to_json(resolved),
        "deps": deps,
        "result_type": infer_result_type(resolved),
    }

    next_field = existing.model_copy(update={"config": new_config})
    next_fields = list(current_fields)
    next_fields[index] = next_field
    next_body = capability.replace_field_defs(body, next_fields)

    audit: dict[str, object] = {
        "kind": "setFormula",
        "table_key": mutation.table_key,
        "field_id": mutation.field_id,
        "source_length": len(mutation.source),
        "ast_node_count": count_ast_nodes(resolved),
        "deps": deps,
    }
    return next_body, audit
