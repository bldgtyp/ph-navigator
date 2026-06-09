"""Authoritative Python evaluator for resolved formula ASTs.

Semantics anchored by plan-13 §3 D22 / D25 / D26 and codified by
`backend/tests/fixtures/formula_evaluator_corpus.json`. The TS port
in `frontend/.../lib/formula/evaluator.ts` must agree byte-for-byte on
every corpus case.

Non-finite outputs (Infinity, NaN) are *never* propagated — overflow
and underflow surface as the structured `EvalError("type_mismatch")`.
The evaluator therefore returns a discriminated union, not a raw
Python value.

`evaluate_table_formulas` is the high-level read-overlay helper used
by P4.4's downloads / slice responses / MCP reads.
"""

from __future__ import annotations

import math
from collections.abc import Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

from features.project_document.custom_fields import CustomFieldType
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
from features.project_document.formula.limits import (
    OUTPUT_LENGTH_MAX,
    PER_ROW_FUSE_MAX,
)
from features.project_document.formula.resolver import iter_formula_registries
from features.project_document.inverse_view import (
    build_inverse_links,
    build_snapshot_row_ids,
    row_link_ids_for_field,
    source_link_key,
    target_table_path_for_link_field,
)

if TYPE_CHECKING:
    from features.project_document.custom_fields import TableFieldDef
    from features.project_document.document import ProjectDocumentV1
    from features.project_document.tables.contracts import TableFieldRegistry

EvalValue = str | int | float | bool | None


@dataclass(slots=True)
class EvalFuse:
    nodes_evaluated: int = 0
    max_nodes: int = PER_ROW_FUSE_MAX


@dataclass(frozen=True, slots=True)
class EvalSuccess:
    value: EvalValue


EvalErrorCode = Literal[
    "div_by_zero",
    "type_mismatch",
    "missing_ref",
    "fuse_tripped",
    "output_too_long",
]


@dataclass(frozen=True, slots=True)
class EvalError:
    code: EvalErrorCode


EvalResult = EvalSuccess | EvalError


# --------------------------------------------------------------------------
# Public helpers
# --------------------------------------------------------------------------


def evaluate(
    ast: FormulaAST,
    row_accessor: Callable[[str], object | None],
    *,
    fuse: EvalFuse | None = None,
    output_length_max: int = OUTPUT_LENGTH_MAX,
) -> EvalResult:
    """Evaluate a resolved AST against a row.

    `row_accessor(field_id)` returns the raw stored value for the field
    in the current row, or `None` when the field is unset or the id
    does not resolve (the latter surfaces as `missing_ref`).
    """
    state = _State(row_accessor, fuse or EvalFuse(), output_length_max)
    try:
        value = _eval_node(ast, state)
    except _EvalErrorSignal as exc:
        return EvalError(code=exc.code)
    if isinstance(value, str) and len(value) > output_length_max:
        return EvalError(code="output_too_long")
    if not (value is None or isinstance(value, (str, int, float, bool))):
        return EvalError(code="type_mismatch")
    return EvalSuccess(value=value)


def _fmod(a: float, b: float) -> float:
    """Sign-of-dividend modulo matching Python's `math.fmod` (and the
    TS `_fmod` helper). Caller has already rejected the b == 0 case."""
    return math.fmod(a, b)


# --------------------------------------------------------------------------
# Per-eval state
# --------------------------------------------------------------------------


class _EvalErrorSignal(Exception):
    """Internal short-circuit; carries an `EvalErrorCode`."""

    __slots__ = ("code",)

    def __init__(self, code: EvalErrorCode) -> None:
        super().__init__(code)
        self.code = code


@dataclass(slots=True)
class _State:
    row_accessor: Callable[[str], object | None]
    fuse: EvalFuse
    output_length_max: int


def _bump_fuse(state: _State) -> None:
    _bump_eval_fuse(state.fuse)


def _bump_eval_fuse(fuse: EvalFuse) -> None:
    fuse.nodes_evaluated += 1
    if fuse.nodes_evaluated > fuse.max_nodes:
        raise _EvalErrorSignal("fuse_tripped")


# --------------------------------------------------------------------------
# Node dispatch
# --------------------------------------------------------------------------


def _eval_node(node: FormulaAST, state: _State) -> object:
    _bump_fuse(state)
    if isinstance(node, Literal_):
        return node.value
    if isinstance(node, FieldRef):
        if node.field_id is None:
            raise _EvalErrorSignal("missing_ref")
        return state.row_accessor(node.field_id)
    if isinstance(node, UnaryOp):
        operand = _eval_node(node.operand, state)
        if node.op == "-":
            if operand is None:
                return None
            if isinstance(operand, bool) or not isinstance(operand, (int, float)):
                raise _EvalErrorSignal("type_mismatch")
            result = -float(operand)
            return _guard_finite(result)
        if node.op == "not":
            if operand is None:
                return None
            return not _truthy(operand)
        raise _EvalErrorSignal("type_mismatch")
    if isinstance(node, BinaryOp):
        return _eval_binary(node, state)
    if isinstance(node, IfExpr):
        cond = _eval_node(node.condition, state)
        if cond is None:
            return None
        if _truthy(cond):
            return _eval_node(node.then_branch, state)
        return _eval_node(node.else_branch, state)
    if isinstance(node, FuncCall):
        return _eval_call(node, state)
    raise _EvalErrorSignal("type_mismatch")


def _eval_binary(node: BinaryOp, state: _State) -> object:
    op = node.op
    if op == "and":
        left = _eval_node(node.left, state)
        if left is None:
            return None
        if not _truthy(left):
            return False
        right = _eval_node(node.right, state)
        if right is None:
            return None
        return _truthy(right)
    if op == "or":
        left = _eval_node(node.left, state)
        if left is None:
            return None
        if _truthy(left):
            return True
        right = _eval_node(node.right, state)
        if right is None:
            return None
        return _truthy(right)

    left = _eval_node(node.left, state)
    right = _eval_node(node.right, state)
    if op == "=":
        return _eq(left, right)
    if op == "!=":
        return not _eq(left, right)
    if left is None or right is None:
        # Null propagation for arithmetic and ordering comparisons.
        if op in ("<", "<=", ">", ">="):
            return None
        return None

    if op in ("+", "-", "*", "/", "%"):
        if isinstance(left, str) and op == "+":
            # Strings concatenate with + only via the explicit `concat`
            # function in this grammar; reject implicit string '+' to
            # match AirTable.
            raise _EvalErrorSignal("type_mismatch")
        if isinstance(left, bool) or isinstance(right, bool):
            raise _EvalErrorSignal("type_mismatch")
        if not isinstance(left, (int, float)) or not isinstance(right, (int, float)):
            raise _EvalErrorSignal("type_mismatch")
        a = float(left)
        b = float(right)
        if op == "+":
            return _guard_finite(a + b)
        if op == "-":
            return _guard_finite(a - b)
        if op == "*":
            return _guard_finite(a * b)
        if op == "/":
            if b == 0.0:
                raise _EvalErrorSignal("div_by_zero")
            return _guard_finite(a / b)
        if op == "%":
            if b == 0.0:
                raise _EvalErrorSignal("div_by_zero")
            return _guard_finite(_fmod(a, b))

    if op in ("<", "<=", ">", ">="):
        return _compare(left, right, op)

    raise _EvalErrorSignal("type_mismatch")


def _eq(left: object, right: object) -> bool:
    if left is None and right is None:
        return True
    if left is None or right is None:
        return False
    if isinstance(left, bool) and isinstance(right, bool):
        return left == right
    if isinstance(left, bool) or isinstance(right, bool):
        # Bool only compares equal to itself, not to numeric 0/1.
        return False
    if isinstance(left, (int, float)) and isinstance(right, (int, float)):
        return float(left) == float(right)
    if isinstance(left, str) and isinstance(right, str):
        return left == right
    return False


def _compare(left: object, right: object, op: str) -> bool:
    if isinstance(left, bool) or isinstance(right, bool):
        raise _EvalErrorSignal("type_mismatch")
    if isinstance(left, (int, float)) and isinstance(right, (int, float)):
        left_number = float(left)
        right_number = float(right)
        if op == "<":
            return left_number < right_number
        if op == "<=":
            return left_number <= right_number
        if op == ">":
            return left_number > right_number
        if op == ">=":
            return left_number >= right_number
        raise _EvalErrorSignal("type_mismatch")
    if isinstance(left, str) and isinstance(right, str):
        # Unicode code-point ordering — Python default for strings.
        if op == "<":
            return left < right
        if op == "<=":
            return left <= right
        if op == ">":
            return left > right
        if op == ">=":
            return left >= right
    raise _EvalErrorSignal("type_mismatch")


def _truthy(value: object) -> bool:
    if value is None or value is False:
        return False
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value != ""
    return True


def _guard_finite(value: float) -> float:
    if math.isnan(value) or math.isinf(value):
        raise _EvalErrorSignal("type_mismatch")
    return value


# --------------------------------------------------------------------------
# Functions
# --------------------------------------------------------------------------


def _coerce_string_arg(value: object) -> str:
    """AirTable parity: null arg → "" in string functions; other
    non-string types raise type_mismatch."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    raise _EvalErrorSignal("type_mismatch")


def _eval_call(node: FuncCall, state: _State) -> object:
    args = [_eval_node(arg, state) for arg in node.args]
    name = node.name
    if name == "concat":
        parts = [_coerce_string_arg(a) for a in args]
        return "".join(parts)
    if name == "upper":
        return _coerce_string_arg(args[0]).upper()
    if name == "lower":
        return _coerce_string_arg(args[0]).lower()
    if name == "trim":
        return _coerce_string_arg(args[0]).strip()
    if name == "len":
        return float(len(_coerce_string_arg(args[0])))
    if name == "replace":
        haystack = _coerce_string_arg(args[0])
        needle = _coerce_string_arg(args[1])
        repl = _coerce_string_arg(args[2])
        if needle == "":
            return haystack
        return haystack.replace(needle, repl)
    if name == "substring":
        return _substring(args)
    if name == "number":
        return _to_number(args[0])
    if name == "text":
        return _to_text(args[0])
    raise _EvalErrorSignal("type_mismatch")


def _substring(args: list[object]) -> str:
    s = _coerce_string_arg(args[0])
    start = _arg_as_int(args[1])
    if start is None:
        return ""
    if len(args) >= 3:
        end = _arg_as_int(args[2])
        if end is None:
            return ""
    else:
        end = len(s)
    # 1-indexed, inclusive end (D24).
    if start < 1 or end < 1:
        # Negative indices not supported in v1; surface at evaluate time.
        raise _EvalErrorSignal("type_mismatch")
    start_idx = max(1, min(start, len(s)))
    end_idx = max(1, min(end, len(s)))
    if start_idx > end_idx:
        return ""
    # Convert to Python's 0-indexed exclusive-end slice.
    return s[start_idx - 1 : end_idx]


def _arg_as_int(value: object) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool):
        raise _EvalErrorSignal("type_mismatch")
    if not isinstance(value, (int, float)):
        raise _EvalErrorSignal("type_mismatch")
    f = float(value)
    if not f.is_integer():
        raise _EvalErrorSignal("type_mismatch")
    return int(f)


def _to_number(value: object) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return _guard_finite(float(value))
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None
        try:
            return _guard_finite(float(stripped))
        except (ValueError, _EvalErrorSignal):
            return None
    return None


def _to_text(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return _format_number(float(value))
    if isinstance(value, str):
        return value
    return None


def _format_number(value: float) -> str:
    """Deterministic number-to-text format pinned by the corpus.

    Integer-valued floats render without a trailing ".0"; fractional
    floats use Python's `repr`, which matches V8's
    `Number.prototype.toString` for the corpus subset (the corpus pins
    every edge case we exercise).
    """
    number = float(value)
    if math.isnan(number) or math.isinf(number):
        raise _EvalErrorSignal("type_mismatch")
    if number == 0:
        return "0"
    if number.is_integer() and abs(number) < 1e16:
        return str(int(number))
    return repr(number)


# --------------------------------------------------------------------------
# Read-overlay helper
# --------------------------------------------------------------------------


def evaluate_table_formulas(
    capability: TableFieldRegistry,
    body: ProjectDocumentV1,
) -> dict[str, dict[str, object]]:
    """Return `{row_id: {field_key: encoded_value}}` for every formula
    field on this table.

    Topologically sorts formula deps so a formula referring to another
    formula sees the upstream computed value. Formula-to-formula
    cycles (which `validate_document_references` rejects at commit
    time, but a hand-edited document could carry) are encoded per
    cell as `{"error": "missing_ref"}`.
    """
    return evaluate_document_formulas(body).get(capability.table_path, {})


def evaluate_document_formulas(body: ProjectDocumentV1) -> dict[tuple[str, ...], dict[str, dict[str, object]]]:
    """Return computed formula overlays for every formula-capable table.

    This is the Phase 3 evaluator boundary: it can satisfy ordinary
    same-table formulas and linked-row rollups from one shared cache, so
    cross-table formula dependencies see computed upstream values.
    """

    contexts = _formula_contexts(body)
    if not any(ctx.formula_fields for ctx in contexts.values()):
        return {table_path: {row_id: {} for row_id in ctx.rows_by_id} for table_path, ctx in contexts.items()}
    out: dict[tuple[str, ...], dict[str, dict[str, object]]] = {
        table_path: {row_id: {} for row_id in ctx.rows_by_id} for table_path, ctx in contexts.items()
    }
    state = _DocumentEvalState(
        contexts=contexts,
        snapshot_row_ids=build_snapshot_row_ids(body),
        inverse_links=build_inverse_links(body),
        computed=out,
        in_progress=set(),
    )
    for table_path, ctx in contexts.items():
        for row_id in ctx.rows_by_id:
            for field_key in ctx.formula_fields:
                try:
                    _compute_formula_cell(state, table_path, row_id, field_key)
                except _EvalErrorSignal:
                    continue
    return out


def _read_envelope_rows(capability: TableFieldRegistry, body: ProjectDocumentV1) -> list[object]:
    envelope: object = body.tables
    for path_part in capability.table_path:
        envelope = getattr(envelope, path_part)
    rows = getattr(envelope, "rows", None)
    if rows is None:
        return []
    return list(rows)


@dataclass(slots=True)
class _FormulaTableContext:
    capability: TableFieldRegistry
    rows_by_id: dict[str, object]
    field_defs_by_key: dict[str, TableFieldDef]
    formula_fields: dict[str, TableFieldDef]
    ast_by_key: dict[str, FormulaAST]
    parse_error_keys: set[str]


@dataclass(slots=True)
class _RowRef:
    table_path: tuple[str, ...]
    row_id: str
    row: object


@dataclass(slots=True)
class _DocumentEvalState:
    contexts: dict[tuple[str, ...], _FormulaTableContext]
    snapshot_row_ids: dict[tuple[str, ...], frozenset[str]]
    inverse_links: dict[tuple[str, ...], dict[str, dict[str, list[str]]]]
    computed: dict[tuple[str, ...], dict[str, dict[str, object]]]
    in_progress: set[tuple[tuple[str, ...], str, str]]


def _formula_contexts(body: ProjectDocumentV1) -> dict[tuple[str, ...], _FormulaTableContext]:
    contexts: dict[tuple[str, ...], _FormulaTableContext] = {}
    for capability in _formula_registries():
        rows = _read_envelope_rows(capability, body)
        rows_by_id = {row_id: row for row in rows if (row_id := str(getattr(row, "id", "")))}
        field_defs = capability.read_field_defs(body)
        field_defs_by_key = {field.field_key: field for field in field_defs}
        formula_fields = {field.field_key: field for field in field_defs if field.field_type is CustomFieldType.formula}
        ast_by_key: dict[str, FormulaAST] = {}
        parse_error_keys: set[str] = set()
        for field_key, field in formula_fields.items():
            ast_payload = field.config.get("ast")
            if ast_payload is None:
                parse_error_keys.add(field_key)
                continue
            try:
                ast_by_key[field_key] = ast_from_json(ast_payload)
            except (ValueError, TypeError):
                parse_error_keys.add(field_key)
        contexts[capability.table_path] = _FormulaTableContext(
            capability=capability,
            rows_by_id=rows_by_id,
            field_defs_by_key=field_defs_by_key,
            formula_fields=formula_fields,
            ast_by_key=ast_by_key,
            parse_error_keys=parse_error_keys,
        )
    return contexts


def _formula_registries() -> tuple[TableFieldRegistry, ...]:
    return iter_formula_registries()


def _compute_formula_cell(
    state: _DocumentEvalState,
    table_path: tuple[str, ...],
    row_id: str,
    field_key: str,
) -> object:
    computed = state.computed.setdefault(table_path, {}).setdefault(row_id, {})
    if field_key in computed:
        stored = computed[field_key]
        if isinstance(stored, dict) and "error" in stored:
            raise _EvalErrorSignal("missing_ref")
        return stored
    cell_key = (table_path, row_id, field_key)
    if cell_key in state.in_progress:
        computed[field_key] = {"error": "missing_ref"}
        raise _EvalErrorSignal("missing_ref")
    ctx = state.contexts[table_path]
    if field_key in ctx.parse_error_keys:
        computed[field_key] = {"error": "missing_ref"}
        raise _EvalErrorSignal("missing_ref")
    ast = ctx.ast_by_key.get(field_key)
    if ast is None:
        computed[field_key] = {"error": "missing_ref"}
        raise _EvalErrorSignal("missing_ref")
    row = ctx.rows_by_id[row_id]
    state.in_progress.add(cell_key)
    try:
        value = _eval_doc_node(ast, state, _RowRef(table_path=table_path, row_id=row_id, row=row), EvalFuse())
    except _EvalErrorSignal as exc:
        computed[field_key] = {"error": exc.code}
        raise
    finally:
        state.in_progress.discard(cell_key)
    if isinstance(value, str) and len(value) > OUTPUT_LENGTH_MAX:
        computed[field_key] = {"error": "output_too_long"}
        raise _EvalErrorSignal("output_too_long")
    if not (value is None or isinstance(value, (str, int, float, bool))):
        computed[field_key] = {"error": "type_mismatch"}
        raise _EvalErrorSignal("type_mismatch")
    computed[field_key] = value
    return value


def _eval_doc_node(node: FormulaAST, state: _DocumentEvalState, current: _RowRef, fuse: EvalFuse) -> object:
    _bump_eval_fuse(fuse)
    if isinstance(node, (LinkedRef, LinkedFromRef)):
        return _resolve_link_rows(node, state, current)
    if isinstance(node, FieldAccess):
        target = _eval_doc_node(node.target, state, current, fuse)
        if not isinstance(target, list):
            raise _EvalErrorSignal("type_mismatch")
        row_refs = [item for item in target if isinstance(item, _RowRef)]
        if len(row_refs) != len(target):
            raise _EvalErrorSignal("type_mismatch")
        return [_read_field_value(state, row_ref, node.field_key) for row_ref in row_refs]
    if isinstance(node, FieldRef):
        if node.field_id is None:
            raise _EvalErrorSignal("missing_ref")
        return _read_field_value(state, current, node.field_id)
    if isinstance(node, Literal_):
        return node.value
    if isinstance(node, UnaryOp):
        return _eval_doc_unary(node, state, current, fuse)
    if isinstance(node, BinaryOp):
        return _eval_doc_binary(node, state, current, fuse)
    if isinstance(node, IfExpr):
        cond = _eval_doc_node(node.condition, state, current, fuse)
        if cond is None:
            return None
        branch = node.then_branch if _truthy(cond) else node.else_branch
        return _eval_doc_node(branch, state, current, fuse)
    if isinstance(node, FuncCall):
        return _eval_doc_call(node, state, current, fuse)
    raise _EvalErrorSignal("type_mismatch")


def _eval_doc_unary(node: UnaryOp, state: _DocumentEvalState, current: _RowRef, fuse: EvalFuse) -> object:
    operand = _eval_doc_node(node.operand, state, current, fuse)
    if node.op == "-":
        if operand is None:
            return None
        if isinstance(operand, bool) or not isinstance(operand, (int, float)):
            raise _EvalErrorSignal("type_mismatch")
        return _guard_finite(-float(operand))
    if node.op == "not":
        if operand is None:
            return None
        return not _truthy(operand)
    raise _EvalErrorSignal("type_mismatch")


def _eval_doc_binary(node: BinaryOp, state: _DocumentEvalState, current: _RowRef, fuse: EvalFuse) -> object:
    op = node.op
    if op == "and":
        left = _eval_doc_node(node.left, state, current, fuse)
        if left is None:
            return None
        if not _truthy(left):
            return False
        right = _eval_doc_node(node.right, state, current, fuse)
        return None if right is None else _truthy(right)
    if op == "or":
        left = _eval_doc_node(node.left, state, current, fuse)
        if left is None:
            return None
        if _truthy(left):
            return True
        right = _eval_doc_node(node.right, state, current, fuse)
        return None if right is None else _truthy(right)

    left = _eval_doc_node(node.left, state, current, fuse)
    right = _eval_doc_node(node.right, state, current, fuse)
    if op == "=":
        return _eq(left, right)
    if op == "!=":
        return not _eq(left, right)
    if left is None or right is None:
        return None
    if op in ("+", "-", "*", "/", "%"):
        if isinstance(left, str) and op == "+":
            raise _EvalErrorSignal("type_mismatch")
        if isinstance(left, bool) or isinstance(right, bool):
            raise _EvalErrorSignal("type_mismatch")
        if not isinstance(left, (int, float)) or not isinstance(right, (int, float)):
            raise _EvalErrorSignal("type_mismatch")
        a = float(left)
        b = float(right)
        if op == "+":
            return _guard_finite(a + b)
        if op == "-":
            return _guard_finite(a - b)
        if op == "*":
            return _guard_finite(a * b)
        if b == 0.0:
            raise _EvalErrorSignal("div_by_zero")
        if op == "/":
            return _guard_finite(a / b)
        return _guard_finite(_fmod(a, b))
    if op in ("<", "<=", ">", ">="):
        return _compare(left, right, op)
    raise _EvalErrorSignal("type_mismatch")


def _eval_doc_call(node: FuncCall, state: _DocumentEvalState, current: _RowRef, fuse: EvalFuse) -> object:
    if node.name in ("count", "sum", "avg"):
        arg = _eval_doc_node(node.args[0], state, current, fuse)
        if not isinstance(arg, list):
            raise _EvalErrorSignal("type_mismatch")
        if node.name == "count":
            return float(len(arg))
        total = 0.0
        numeric_count = 0
        for value in arg:
            numeric_value = _to_number(value)
            if numeric_value is None:
                continue
            total += numeric_value
            numeric_count += 1
        if node.name == "sum":
            return _guard_finite(total)
        if numeric_count == 0:
            return None
        return _guard_finite(total / numeric_count)
    args = [_eval_doc_node(arg, state, current, fuse) for arg in node.args]
    if node.name == "concat":
        return "".join(_coerce_string_arg(arg) for arg in args)
    if node.name == "upper":
        return _coerce_string_arg(args[0]).upper()
    if node.name == "lower":
        return _coerce_string_arg(args[0]).lower()
    if node.name == "trim":
        return _coerce_string_arg(args[0]).strip()
    if node.name == "len":
        return float(len(_coerce_string_arg(args[0])))
    if node.name == "replace":
        haystack = _coerce_string_arg(args[0])
        needle = _coerce_string_arg(args[1])
        replacement = _coerce_string_arg(args[2])
        return haystack if needle == "" else haystack.replace(needle, replacement)
    if node.name == "substring":
        return _substring(args)
    if node.name == "number":
        return _to_number(args[0])
    if node.name == "text":
        return _to_text(args[0])
    raise _EvalErrorSignal("type_mismatch")


def _read_field_value(state: _DocumentEvalState, row_ref: _RowRef, field_key: str) -> object | None:
    ctx = state.contexts[row_ref.table_path]
    if field_key in ctx.formula_fields:
        return _compute_formula_cell(state, row_ref.table_path, row_ref.row_id, field_key)
    custom_values = ctx.capability.read_row_custom_values(row_ref.row)
    if field_key in custom_values:
        return custom_values[field_key]
    return ctx.capability.field_value_for_formula(row_ref.row, field_key)


def _resolve_link_rows(
    node: LinkedRef | LinkedFromRef,
    state: _DocumentEvalState,
    current: _RowRef,
) -> list[_RowRef]:
    if isinstance(node, LinkedRef):
        current_ctx = state.contexts[current.table_path]
        field = current_ctx.field_defs_by_key.get(node.field_key)
        if field is None or field.field_type is not CustomFieldType.linked_record:
            raise _EvalErrorSignal("missing_ref")
        target_path = target_table_path_for_link_field(field)
        if target_path is None:
            raise _EvalErrorSignal("missing_ref")
        target_ctx = state.contexts.get(target_path)
        if target_ctx is None:
            raise _EvalErrorSignal("missing_ref")
        target_ids = state.snapshot_row_ids.get(target_path, frozenset())
        links = row_link_ids_for_field(_row_link_mapping(current_ctx.capability, current.row), field)
        return [
            _RowRef(table_path=target_path, row_id=target_id, row=target_ctx.rows_by_id[target_id])
            for target_id in links
            if target_id in target_ids and target_id in target_ctx.rows_by_id
        ]

    source_ctx = state.contexts.get(node.source_table_path)
    if source_ctx is None:
        raise _EvalErrorSignal("missing_ref")
    field = source_ctx.field_defs_by_key.get(node.source_field_key)
    if field is None or field.field_type is not CustomFieldType.linked_record:
        raise _EvalErrorSignal("missing_ref")
    if target_table_path_for_link_field(field) != current.table_path:
        raise _EvalErrorSignal("missing_ref")
    source_key = source_link_key(node.source_table_path, node.source_field_key)
    source_ids = state.inverse_links.get(current.table_path, {}).get(current.row_id, {}).get(source_key, [])
    snapshot_source_ids = state.snapshot_row_ids.get(node.source_table_path, frozenset())
    return [
        _RowRef(table_path=node.source_table_path, row_id=source_id, row=source_ctx.rows_by_id[source_id])
        for source_id in source_ids
        if source_id in snapshot_source_ids and source_id in source_ctx.rows_by_id
    ]


def _row_link_mapping(capability: TableFieldRegistry, row: object) -> dict[str, object]:
    return {"custom_links": capability.read_row_links(row)}


def _topo_order_formulas(formula_fields: list[TableFieldDef]) -> list[str]:
    """Return formula `field_key`s in dependency order.

    Each formula's `config["deps"]` is the resolved id list. Non-formula
    deps don't need ordering; formula→formula deps must be evaluated
    upstream first. Cycles are not expected here (rejected at commit
    time); on detection we degrade gracefully by appending whatever
    remains and letting the per-row evaluator surface
    `missing_ref` for the cycle.
    """
    by_key = {f.field_key: f for f in formula_fields}
    deps_by_key: dict[str, list[str]] = {}
    for f in formula_fields:
        raw_deps = f.config.get("deps") or []
        if isinstance(raw_deps, list):
            deps_by_key[f.field_key] = [d for d in raw_deps if isinstance(d, str) and d in by_key]
        else:
            deps_by_key[f.field_key] = []

    visited: set[str] = set()
    in_progress: set[str] = set()
    order: list[str] = []

    def visit(key: str) -> None:
        if key in visited:
            return
        if key in in_progress:
            return  # cycle — bail; eval will surface missing_ref
        in_progress.add(key)
        for dep in deps_by_key.get(key, []):
            visit(dep)
        in_progress.discard(key)
        visited.add(key)
        order.append(key)

    for f in formula_fields:
        visit(f.field_key)
    return order
