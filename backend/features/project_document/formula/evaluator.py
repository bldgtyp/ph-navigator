"""Authoritative Python evaluator for resolved formula ASTs.

Semantics anchored by plan-13 §3 D22 / D25 / D26 and codified by
`backend/tests/fixtures/formula_evaluator_corpus.json`. The TS port
in `frontend/.../lib/formula/evaluator.ts` must agree byte-for-byte on
every corpus case.

Non-finite outputs (Infinity, NaN) are *never* propagated — overflow
and underflow surface as the structured `EvalError("type_mismatch")`.
The evaluator therefore returns a discriminated union, not a raw
Python value.

Document/table overlay helpers live in `document_evaluator.py`; this
module stays focused on single-cell AST evaluation.
"""

from __future__ import annotations

import math
from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

from features.project_document.formula.ast_nodes import (
    BinaryOp,
    FieldRef,
    FormulaAST,
    FuncCall,
    IfExpr,
    Literal_,
    UnaryOp,
)
from features.project_document.formula.limits import (
    OUTPUT_LENGTH_MAX,
    PER_ROW_FUSE_MAX,
)

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
    if op == "&":
        return _to_concat_text(left) + _to_concat_text(right)
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


def _to_concat_text(value: object) -> str:
    if value is None:
        return ""
    text = _to_text(value)
    if text is None:
        raise _EvalErrorSignal("type_mismatch")
    return text


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
