"""Field-ref resolution + cycle detection for formula ASTs.

The parser produces `FieldRef(display_name=..., field_id=None)`.
`resolve_refs` walks the AST against a snapshot of the table's
persisted FieldDef list and returns a new AST whose every `FieldRef`
carries a resolved `field_id`. `detect_cycles` runs a DFS over the
dep graph; both helpers raise the matching internal exception from
`errors.py`, which the schema-mutation service translates into the
`custom_field_formula_*` REST envelope.

Locked-type built-in fields resolve their formula-facing type through
the registry's `field_type_for_formula` hook; mutable-type built-ins
and customs resolve theirs from the FieldDef's own `field_type`.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

from features.project_document.custom_fields import CustomFieldType, normalize_display_name
from features.project_document.formula.ast_nodes import (
    BinaryOp,
    FieldAccess,
    FieldRef,
    FormulaAST,
    FuncCall,
    IfExpr,
    LinkedFromRef,
    LinkedRef,
    Literal_,
    UnaryOp,
    ast_from_json,
)
from features.project_document.formula.errors import (
    FormulaCycleError,
    FormulaMissingRefError,
    FormulaTargetFieldNotLinkedError,
    FormulaUnknownTargetTableError,
)

if TYPE_CHECKING:
    from features.project_document.custom_fields import TableFieldDef
    from features.project_document.document import ProjectDocumentV1
    from features.project_document.tables.contracts import TableFieldRegistry


@dataclass(frozen=True, slots=True)
class FieldRegistryEntry:
    field_id: str
    display_name: str
    origin: Literal["built_in", "custom"]
    field_type: Literal["text", "number", "single_select", "formula", "bool"]


FormulaFieldId = tuple[tuple[str, ...], str]


@dataclass(frozen=True, slots=True)
class _FormulaTableContext:
    table_path: tuple[str, ...]
    fields_by_key: dict[str, TableFieldDef]
    registry: TableFieldRegistry


def iter_formula_registries() -> tuple[TableFieldRegistry, ...]:
    from features.project_document.tables.pumps import pumps_field_registry
    from features.project_document.tables.registry import iter_table_contracts

    registries: list[TableFieldRegistry] = []
    seen_paths: set[tuple[str, ...]] = set()
    for contract in iter_table_contracts():
        registry = contract.field_registry
        if registry is None or registry.table_path in seen_paths:
            continue
        seen_paths.add(registry.table_path)
        registries.append(registry)

    if pumps_field_registry.table_path not in seen_paths:
        registries.append(pumps_field_registry)
    return tuple(registries)


def build_field_registry(
    capability: TableFieldRegistry,
    body: ProjectDocumentV1,
) -> tuple[FieldRegistryEntry, ...]:
    """Snapshot the resolvable refs for this table at this moment.

    Walks the unified `read_field_defs(body)` list in declared order.
    Locked-type built-ins resolve their formula type through
    `field_type_for_formula`; other entries resolve theirs from the
    FieldDef's own `field_type`. Custom formula fields are included so
    the cycle detector can see them.
    """
    entries: list[FieldRegistryEntry] = []
    typed_column_type_lookup = capability.field_type_for_formula
    for field in capability.read_field_defs(body):
        typed_column_type = typed_column_type_lookup(field.field_key)
        if typed_column_type is not None:
            formula_type: Literal["text", "number", "single_select", "formula", "bool"] = typed_column_type
        else:
            formula_type = formula_facing_field_type(field.field_type.value)
        entries.append(
            FieldRegistryEntry(
                field_id=field.field_key,
                display_name=field.display_name,
                origin=field.origin,
                field_type=formula_type,
            )
        )
    return tuple(entries)


def formula_facing_field_type(
    field_type: str,
) -> Literal["text", "number", "single_select", "formula", "bool"]:
    """Map a stored `CustomFieldType` value to the evaluator-facing
    type used by `FieldRegistryEntry.field_type`. Public so seed
    builders (e.g. `tables/rooms.py::_build_rooms_record_id_seed`)
    can reuse the same mapping instead of inlining it."""
    if field_type in ("short_text", "long_text", "url"):
        return "text"
    if field_type == "number":
        return "number"
    if field_type == "single_select":
        return "single_select"
    if field_type == "formula":
        return "formula"
    return "text"


def resolve_refs(
    ast: FormulaAST,
    registry: Iterable[FieldRegistryEntry],
) -> FormulaAST:
    """Walk `ast` and populate `field_id` on every `FieldRef`.

    Lookup is case-insensitive + whitespace-trimmed against the
    registry's `display_name`. Raises `FormulaMissingRefError` if any
    ref does not resolve.
    """
    by_name: dict[str, FieldRegistryEntry] = {}
    for entry in registry:
        key = normalize_display_name(entry.display_name)
        by_name[key] = entry
    return _resolve_walk(ast, by_name)


def _resolve_walk(node: FormulaAST, by_name: Mapping[str, FieldRegistryEntry]) -> FormulaAST:
    if isinstance(node, (Literal_, LinkedRef, LinkedFromRef)):
        return node
    if isinstance(node, FieldAccess):
        return FieldAccess(kind="field_access", target=_resolve_walk(node.target, by_name), field_key=node.field_key)
    if isinstance(node, FieldRef):
        key = normalize_display_name(node.display_name)
        entry = by_name.get(key)
        if entry is None:
            raise FormulaMissingRefError(node.display_name)
        return FieldRef(
            kind="field_ref",
            display_name=node.display_name,
            field_id=entry.field_id,
        )
    if isinstance(node, FuncCall):
        return FuncCall(
            kind="func_call",
            name=node.name,
            args=tuple(_resolve_walk(a, by_name) for a in node.args),
        )
    if isinstance(node, BinaryOp):
        return BinaryOp(
            kind="binary_op",
            op=node.op,
            left=_resolve_walk(node.left, by_name),
            right=_resolve_walk(node.right, by_name),
        )
    if isinstance(node, UnaryOp):
        return UnaryOp(
            kind="unary_op",
            op=node.op,
            operand=_resolve_walk(node.operand, by_name),
        )
    if isinstance(node, IfExpr):
        return IfExpr(
            kind="if",
            condition=_resolve_walk(node.condition, by_name),
            then_branch=_resolve_walk(node.then_branch, by_name),
            else_branch=_resolve_walk(node.else_branch, by_name),
        )
    raise TypeError(f"unknown AST node: {type(node).__name__}")


def collect_field_refs(ast: FormulaAST) -> list[str]:
    """Return distinct resolved `field_id`s referenced by `ast`."""
    out: list[str] = []
    seen: set[str] = set()

    def walk(node: FormulaAST) -> None:
        if isinstance(node, (Literal_, LinkedRef, LinkedFromRef)):
            return
        if isinstance(node, FieldAccess):
            walk(node.target)
            return
        if isinstance(node, FieldRef):
            if node.field_id is not None and node.field_id not in seen:
                seen.add(node.field_id)
                out.append(node.field_id)
            return
        if isinstance(node, FuncCall):
            for a in node.args:
                walk(a)
            return
        if isinstance(node, BinaryOp):
            walk(node.left)
            walk(node.right)
            return
        if isinstance(node, UnaryOp):
            walk(node.operand)
            return
        if isinstance(node, IfExpr):
            walk(node.condition)
            walk(node.then_branch)
            walk(node.else_branch)
            return

    walk(ast)
    return out


def detect_cycles(
    field_id: str,
    ast: FormulaAST,
    asts_by_field_id: Mapping[str, FormulaAST],
) -> None:
    """DFS the dep graph rooted at `field_id`. Raise `FormulaCycleError`
    on the first cycle, with `cycle_path` listing ids in cycle order.

    `asts_by_field_id` maps every *other* formula field's id to its
    resolved AST; `ast` is the candidate AST for `field_id` (which is
    not yet stored in the document).
    """
    all_asts = dict(asts_by_field_id)
    all_asts[field_id] = ast

    in_progress: list[str] = []
    in_progress_set: set[str] = set()
    fully_visited: set[str] = set()

    def visit(node_id: str) -> None:
        if node_id in fully_visited:
            return
        if node_id in in_progress_set:
            # Compose cycle: slice from the first occurrence onward.
            start = in_progress.index(node_id)
            cycle = tuple(in_progress[start:] + [node_id])
            raise FormulaCycleError(cycle)
        in_progress.append(node_id)
        in_progress_set.add(node_id)
        node_ast = all_asts.get(node_id)
        if node_ast is not None:
            for dep in collect_field_refs(node_ast):
                if dep in all_asts:
                    visit(dep)
        in_progress.pop()
        in_progress_set.discard(node_id)
        fully_visited.add(node_id)

    visit(field_id)


def validate_document_formula_graph(body: ProjectDocumentV1) -> tuple[FormulaFieldId, ...]:
    """Validate linked formula refs and return a document-level topo order.

    Missing `{Display Name}` refs keep the pre-existing behavior: they
    are skipped during document validation and surface per row at read
    time. Linked primitives are schema-shaped, so invalid table/field
    targets fail validation before read overlays run.
    """
    contexts = _formula_table_contexts(body)
    asts_by_id: dict[FormulaFieldId, FormulaAST] = {}
    for table_path, ctx in contexts.items():
        registry = build_field_registry(ctx.registry, body)
        for field in ctx.fields_by_key.values():
            if field.field_type is not CustomFieldType.formula:
                continue
            ast = resolve_stored_ast(field, registry)
            if ast is not None:
                asts_by_id[(table_path, field.field_key)] = ast

    graph: dict[FormulaFieldId, set[FormulaFieldId]] = {field_id: set() for field_id in asts_by_id}
    for field_id, ast in asts_by_id.items():
        deps = _collect_document_formula_deps(ast, field_id[0], contexts)
        graph[field_id].update(dep for dep in deps if dep in asts_by_id)

    return _toposort_or_raise(graph)


def resolve_stored_ast(
    field: TableFieldDef,
    registry: Iterable[FieldRegistryEntry],
) -> FormulaAST | None:
    """Re-resolve a stored formula's AST against the current registry.

    Returns the resolved AST on success, or `None` if any ref no
    longer resolves (the evaluator surfaces this as `missing_ref` per
    row at read time)."""
    ast_payload = field.config.get("ast")
    if ast_payload is None:
        return None
    try:
        ast = ast_from_json(ast_payload)
    except (ValueError, TypeError):
        return None
    try:
        return resolve_refs(ast, registry)
    except FormulaMissingRefError:
        return None


def _formula_table_contexts(body: ProjectDocumentV1) -> dict[tuple[str, ...], _FormulaTableContext]:
    contexts: dict[tuple[str, ...], _FormulaTableContext] = {}
    for registry in iter_formula_registries():
        contexts[registry.table_path] = _FormulaTableContext(
            table_path=registry.table_path,
            fields_by_key={field.field_key: field for field in registry.read_field_defs(body)},
            registry=registry,
        )
    return contexts


def _collect_document_formula_deps(
    ast: FormulaAST,
    current_table_path: tuple[str, ...],
    contexts: Mapping[tuple[str, ...], _FormulaTableContext],
) -> set[FormulaFieldId]:
    out: set[FormulaFieldId] = set()

    def walk(node: FormulaAST) -> None:
        if isinstance(node, Literal_):
            return
        if isinstance(node, FieldRef):
            if node.field_id is not None:
                out.add((current_table_path, node.field_id))
            return
        if isinstance(node, LinkedRef):
            _linked_ref_target_path(node, current_table_path, contexts)
            return
        if isinstance(node, LinkedFromRef):
            _validate_linked_from_ref(node, current_table_path, contexts)
            return
        if isinstance(node, FieldAccess):
            target_path = _rowset_result_table_path(node.target, current_table_path, contexts)
            target_ctx = contexts.get(target_path)
            if target_ctx is None:
                raise FormulaUnknownTargetTableError(target_path)
            if node.field_key not in target_ctx.fields_by_key:
                raise FormulaMissingRefError(node.field_key)
            out.add((target_path, node.field_key))
            walk(node.target)
            return
        if isinstance(node, FuncCall):
            for arg in node.args:
                walk(arg)
            return
        if isinstance(node, BinaryOp):
            walk(node.left)
            walk(node.right)
            return
        if isinstance(node, UnaryOp):
            walk(node.operand)
            return
        if isinstance(node, IfExpr):
            walk(node.condition)
            walk(node.then_branch)
            walk(node.else_branch)
            return

    walk(ast)
    return out


def _rowset_result_table_path(
    node: FormulaAST,
    current_table_path: tuple[str, ...],
    contexts: Mapping[tuple[str, ...], _FormulaTableContext],
) -> tuple[str, ...]:
    if isinstance(node, LinkedRef):
        return _linked_ref_target_path(node, current_table_path, contexts)
    if isinstance(node, LinkedFromRef):
        _validate_linked_from_ref(node, current_table_path, contexts)
        return node.source_table_path
    raise FormulaTargetFieldNotLinkedError(current_table_path, getattr(node, "field_key", ""), current_table_path)


def _linked_ref_target_path(
    node: LinkedRef,
    current_table_path: tuple[str, ...],
    contexts: Mapping[tuple[str, ...], _FormulaTableContext],
) -> tuple[str, ...]:
    current_ctx = contexts.get(current_table_path)
    if current_ctx is None:
        raise FormulaUnknownTargetTableError(current_table_path)
    field = current_ctx.fields_by_key.get(node.field_key)
    if field is None or field.field_type is not CustomFieldType.linked_record:
        raise FormulaTargetFieldNotLinkedError(current_table_path, node.field_key, current_table_path)
    target_path = _target_table_path(field)
    if target_path is None or target_path not in contexts:
        raise FormulaUnknownTargetTableError(target_path or ())
    return target_path


def _validate_linked_from_ref(
    node: LinkedFromRef,
    current_table_path: tuple[str, ...],
    contexts: Mapping[tuple[str, ...], _FormulaTableContext],
) -> None:
    source_ctx = contexts.get(node.source_table_path)
    if source_ctx is None:
        raise FormulaUnknownTargetTableError(node.source_table_path)
    field = source_ctx.fields_by_key.get(node.source_field_key)
    if field is None or field.field_type is not CustomFieldType.linked_record:
        raise FormulaTargetFieldNotLinkedError(node.source_table_path, node.source_field_key, current_table_path)
    if _target_table_path(field) != current_table_path:
        raise FormulaTargetFieldNotLinkedError(node.source_table_path, node.source_field_key, current_table_path)


def _target_table_path(field: TableFieldDef) -> tuple[str, ...] | None:
    raw = field.config.get("target_table_path")
    if not isinstance(raw, list | tuple):
        return None
    path: list[str] = []
    for segment in raw:
        if not isinstance(segment, str) or not segment:
            return None
        path.append(segment)
    return tuple(path)


def _toposort_or_raise(graph: Mapping[FormulaFieldId, set[FormulaFieldId]]) -> tuple[FormulaFieldId, ...]:
    incoming_count = {node: 0 for node in graph}
    dependents: dict[FormulaFieldId, set[FormulaFieldId]] = {node: set() for node in graph}
    for node, deps in graph.items():
        for dep in deps:
            incoming_count[node] += 1
            dependents.setdefault(dep, set()).add(node)

    ready = sorted((node for node, count in incoming_count.items() if count == 0), key=_format_formula_id)
    ordered: list[FormulaFieldId] = []
    while ready:
        node = ready.pop(0)
        ordered.append(node)
        for dependent in sorted(dependents.get(node, set()), key=_format_formula_id):
            incoming_count[dependent] -= 1
            if incoming_count[dependent] == 0:
                ready.append(dependent)

    if len(ordered) != len(graph):
        raise FormulaCycleError(_find_cycle_path(graph))
    return tuple(ordered)


def _find_cycle_path(graph: Mapping[FormulaFieldId, set[FormulaFieldId]]) -> tuple[str, ...]:
    visiting: list[FormulaFieldId] = []
    visiting_set: set[FormulaFieldId] = set()
    visited: set[FormulaFieldId] = set()

    def visit(node: FormulaFieldId) -> tuple[str, ...] | None:
        if node in visited:
            return None
        if node in visiting_set:
            start = visiting.index(node)
            return tuple(_format_formula_id(item) for item in [*visiting[start:], node])
        visiting.append(node)
        visiting_set.add(node)
        for dep in sorted(graph.get(node, set()), key=_format_formula_id):
            cycle = visit(dep)
            if cycle is not None:
                return cycle
        visiting.pop()
        visiting_set.discard(node)
        visited.add(node)
        return None

    for node in sorted(graph, key=_format_formula_id):
        cycle = visit(node)
        if cycle is not None:
            return cycle
    return ()


def _format_formula_id(field_id: FormulaFieldId) -> str:
    table_path, field_key = field_id
    return ".".join((*table_path, field_key))
