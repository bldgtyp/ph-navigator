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

from dataclasses import dataclass
from typing import Literal, Union


@dataclass(frozen=True, slots=True)
class Literal_:  # noqa: N801 — `Literal` clashes with typing alias used elsewhere
    kind: Literal["literal"]
    # `null` is encoded as `None`; bools are `True`/`False`; numbers are
    # floats; strings are str.
    value: str | float | bool | None
    inferred_type: Literal["text", "number", "bool", "null"]


@dataclass(frozen=True, slots=True)
class FieldRef:
    kind: Literal["field_ref"]
    display_name: str
    field_id: str | None  # populated by resolve_refs


@dataclass(frozen=True, slots=True)
class FuncCall:
    kind: Literal["func_call"]
    name: str
    args: tuple["FormulaAST", ...]


@dataclass(frozen=True, slots=True)
class BinaryOp:
    kind: Literal["binary_op"]
    op: Literal[
        "+", "-", "*", "/", "%",
        "=", "!=", "<", "<=", ">", ">=",
        "and", "or",
    ]
    left: "FormulaAST"
    right: "FormulaAST"


@dataclass(frozen=True, slots=True)
class UnaryOp:
    kind: Literal["unary_op"]
    op: Literal["-", "not"]
    operand: "FormulaAST"


@dataclass(frozen=True, slots=True)
class IfExpr:
    kind: Literal["if"]
    condition: "FormulaAST"
    then_branch: "FormulaAST"
    else_branch: "FormulaAST"


# Re-exported name; `Literal_` ends in `_` only to avoid clashing with
# `typing.Literal` inside this module's annotations.
LiteralNode = Literal_

FormulaAST = Union[Literal_, FieldRef, FuncCall, BinaryOp, UnaryOp, IfExpr]


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
    if not isinstance(payload, dict):
        raise ValueError(f"AST payload must be a dict, got {type(payload).__name__}")
    kind = payload.get("kind")
    if kind == "literal":
        return Literal_(kind="literal", value=payload["value"], inferred_type=payload["inferred_type"])  # type: ignore[arg-type]
    if kind == "field_ref":
        return FieldRef(kind="field_ref", display_name=str(payload["display_name"]), field_id=payload.get("field_id"))  # type: ignore[arg-type]
    if kind == "func_call":
        raw_args = payload.get("args") or []
        return FuncCall(
            kind="func_call",
            name=str(payload["name"]),
            args=tuple(ast_from_json(a) for a in raw_args),
        )
    if kind == "binary_op":
        return BinaryOp(
            kind="binary_op",
            op=payload["op"],  # type: ignore[arg-type]
            left=ast_from_json(payload["left"]),
            right=ast_from_json(payload["right"]),
        )
    if kind == "unary_op":
        return UnaryOp(
            kind="unary_op",
            op=payload["op"],  # type: ignore[arg-type]
            operand=ast_from_json(payload["operand"]),
        )
    if kind == "if":
        return IfExpr(
            kind="if",
            condition=ast_from_json(payload["condition"]),
            then_branch=ast_from_json(payload["then_branch"]),
            else_branch=ast_from_json(payload["else_branch"]),
        )
    raise ValueError(f"unknown AST kind: {kind!r}")
