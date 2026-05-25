"""Field-ref resolution + cycle detection for formula ASTs.

The parser produces `FieldRef(display_name=..., field_id=None)`.
`resolve_refs` walks the AST against a snapshot of the table's field
registry (core + custom) and returns a new AST whose every `FieldRef`
carries a resolved `field_id`. `detect_cycles` runs a DFS over the
dep graph; both helpers raise the matching internal exception from
`errors.py`, which the schema-mutation service translates into the
`custom_field_formula_*` REST envelope.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

from features.project_document.custom_fields import normalize_display_name
from features.project_document.formula.ast_nodes import (
    BinaryOp,
    FieldRef,
    FormulaAST,
    FuncCall,
    IfExpr,
    Literal_,
    UnaryOp,
    ast_from_json,
)
from features.project_document.formula.errors import (
    FormulaCycleError,
    FormulaMissingRefError,
)

if TYPE_CHECKING:
    from features.project_document.custom_fields import CustomFieldDef
    from features.project_document.document import ProjectDocumentV1
    from features.project_document.tables.contracts import CustomFieldCapability


@dataclass(frozen=True, slots=True)
class FieldRegistryEntry:
    field_id: str
    display_name: str
    origin: Literal["core", "custom"]
    field_type: Literal["text", "number", "single_select", "formula", "bool"]


def build_field_registry(
    capability: "CustomFieldCapability",
    body: "ProjectDocumentV1",
) -> tuple[FieldRegistryEntry, ...]:
    """Snapshot the resolvable refs for this table at this moment.

    Core fields come first (in `core_field_keys` order), followed by
    custom fields in declared order. Custom formula fields are
    included so the cycle detector can see them.
    """
    entries: list[FieldRegistryEntry] = []

    core_type_lookup = getattr(capability, "core_field_type_for_formula", None)
    for core_key in capability.core_field_keys:
        core_type = "text"
        if core_type_lookup is not None:
            mapped = core_type_lookup(core_key)
            if mapped is not None:
                core_type = mapped
        # Use the human-readable display name where known, falling
        # back to the python attribute key.
        display_name = _core_display_name_for(capability, core_key)
        entries.append(
            FieldRegistryEntry(
                field_id=core_key,
                display_name=display_name,
                origin="core",
                field_type=core_type,  # type: ignore[arg-type]
            )
        )

    for cf in capability.read_custom_fields(body):
        entries.append(
            FieldRegistryEntry(
                field_id=cf.id,
                display_name=cf.display_name,
                origin="custom",
                field_type=_formula_facing_field_type(cf.field_type.value),
            )
        )
    return tuple(entries)


def _core_display_name_for(capability: "CustomFieldCapability", key: str) -> str:
    """Map a core python attribute key to a human-readable label.

    Pairs `core_field_keys` and `core_display_names` index-wise where
    they exist; otherwise returns the key itself."""
    core_keys = capability.core_field_keys
    core_names = capability.core_display_names
    if len(core_names) == len(core_keys):
        for k, n in zip(core_keys, core_names, strict=False):
            if k == key:
                return n
    return key


def _formula_facing_field_type(
    field_type: str,
) -> Literal["text", "number", "single_select", "formula", "bool"]:
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


def _resolve_walk(
    node: FormulaAST, by_name: Mapping[str, FieldRegistryEntry]
) -> FormulaAST:
    if isinstance(node, Literal_):
        return node
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
        if isinstance(node, Literal_):
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


def resolve_stored_ast(
    field: "CustomFieldDef",
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
