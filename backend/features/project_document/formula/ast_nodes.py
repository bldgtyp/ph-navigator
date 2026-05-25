"""Discriminated-union AST node dataclasses + JSON round-trip helpers.

`field_id` on `FieldRef` is populated only after `resolve_refs` runs
against the table's field registry — the parser produces nodes with
`field_id=None`. Stored ASTs on `CustomFieldDef.config["ast"]` are
resolved; in-flight parsed ASTs in the editor (live preview, submit
draft) carry the unresolved form until the server resolves them.

JSON serialization is anchored by the `kind` discriminator and uses
plain dicts (no Pydantic models) so the shared corpus can compare
`expected_ast` payloads byte-for-byte across Python and TypeScript.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal, cast

BinaryOperator = Literal["+", "-", "*", "/", "%", "=", "!=", "<", "<=", ">", ">=", "and", "or"]
UnaryOperator = Literal["-", "not"]
LiteralValue = str | float | bool | None
LiteralInferredType = Literal["text", "number", "bool", "null"]


@dataclass(frozen=True, slots=True)
class Literal_:  # noqa: N801 — `Literal` clashes with typing alias used elsewhere
    kind: Literal["literal"]
    # `null` is encoded as `None`; bools are `True`/`False`; numbers are
    # floats; strings are str.
    value: LiteralValue
    inferred_type: LiteralInferredType


@dataclass(frozen=True, slots=True)
class FieldRef:
    kind: Literal["field_ref"]
    display_name: str
    field_id: str | None  # populated by resolve_refs


@dataclass(frozen=True, slots=True)
class FuncCall:
    kind: Literal["func_call"]
    name: str
    args: tuple[FormulaAST, ...]


@dataclass(frozen=True, slots=True)
class BinaryOp:
    kind: Literal["binary_op"]
    op: BinaryOperator
    left: FormulaAST
    right: FormulaAST


@dataclass(frozen=True, slots=True)
class UnaryOp:
    kind: Literal["unary_op"]
    op: UnaryOperator
    operand: FormulaAST


@dataclass(frozen=True, slots=True)
class IfExpr:
    kind: Literal["if"]
    condition: FormulaAST
    then_branch: FormulaAST
    else_branch: FormulaAST


# Re-exported name; `Literal_` ends in `_` only to avoid clashing with
# `typing.Literal` inside this module's annotations.
LiteralNode = Literal_

FormulaAST = Literal_ | FieldRef | FuncCall | BinaryOp | UnaryOp | IfExpr


def ast_to_json(node: FormulaAST) -> dict[str, object]:
    if isinstance(node, Literal_):
        return {"kind": "literal", "value": node.value, "inferred_type": node.inferred_type}
    if isinstance(node, FieldRef):
        return {"kind": "field_ref", "display_name": node.display_name, "field_id": node.field_id}
    if isinstance(node, FuncCall):
        return {"kind": "func_call", "name": node.name, "args": [ast_to_json(a) for a in node.args]}
    if isinstance(node, BinaryOp):
        return {"kind": "binary_op", "op": node.op, "left": ast_to_json(node.left), "right": ast_to_json(node.right)}
    if isinstance(node, UnaryOp):
        return {"kind": "unary_op", "op": node.op, "operand": ast_to_json(node.operand)}
    if isinstance(node, IfExpr):
        return {
            "kind": "if",
            "condition": ast_to_json(node.condition),
            "then_branch": ast_to_json(node.then_branch),
            "else_branch": ast_to_json(node.else_branch),
        }
    raise TypeError(f"unknown AST node: {type(node).__name__}")


def ast_from_json(payload: object) -> FormulaAST:
    if not isinstance(payload, Mapping):
        raise ValueError(f"AST payload must be a dict, got {type(payload).__name__}")
    data = cast(Mapping[str, object], payload)
    kind = data.get("kind")
    if kind == "literal":
        return Literal_(
            kind="literal",
            value=cast(LiteralValue, data["value"]),
            inferred_type=cast(LiteralInferredType, data["inferred_type"]),
        )
    if kind == "field_ref":
        return FieldRef(
            kind="field_ref",
            display_name=str(data["display_name"]),
            field_id=cast(str | None, data.get("field_id")),
        )
    if kind == "func_call":
        raw_args = data.get("args") or []
        if not isinstance(raw_args, list):
            raise ValueError("func_call args must be a list")
        return FuncCall(
            kind="func_call",
            name=str(data["name"]),
            args=tuple(ast_from_json(a) for a in raw_args),
        )
    if kind == "binary_op":
        return BinaryOp(
            kind="binary_op",
            op=cast(BinaryOperator, data["op"]),
            left=ast_from_json(data["left"]),
            right=ast_from_json(data["right"]),
        )
    if kind == "unary_op":
        return UnaryOp(
            kind="unary_op",
            op=cast(UnaryOperator, data["op"]),
            operand=ast_from_json(data["operand"]),
        )
    if kind == "if":
        return IfExpr(
            kind="if",
            condition=ast_from_json(data["condition"]),
            then_branch=ast_from_json(data["then_branch"]),
            else_branch=ast_from_json(data["else_branch"]),
        )
    raise ValueError(f"unknown AST kind: {kind!r}")
