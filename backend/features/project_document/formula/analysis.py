"""Formula AST analysis helpers shared by mutations and table seeds."""

from __future__ import annotations

from features.project_document.formula.ast_nodes import (
    BinaryOp,
    FieldAccess,
    FieldRef,
    FuncCall,
    IfExpr,
    LinkedFromRef,
    LinkedRef,
    Literal_,
    UnaryOp,
)

__all__ = ["count_ast_nodes", "infer_result_type"]


def count_ast_nodes(node: object) -> int:
    if isinstance(node, (Literal_, FieldRef, LinkedRef, LinkedFromRef)):
        return 1
    if isinstance(node, FieldAccess):
        return 1 + count_ast_nodes(node.target)
    if isinstance(node, UnaryOp):
        return 1 + count_ast_nodes(node.operand)
    if isinstance(node, BinaryOp):
        return 1 + count_ast_nodes(node.left) + count_ast_nodes(node.right)
    if isinstance(node, IfExpr):
        return (
            1 + count_ast_nodes(node.condition) + count_ast_nodes(node.then_branch) + count_ast_nodes(node.else_branch)
        )
    if isinstance(node, FuncCall):
        return 1 + sum(count_ast_nodes(arg) for arg in node.args)
    return 1


def infer_result_type(node: object) -> str:
    """Best-effort static result type used for downstream filter operators."""
    if isinstance(node, Literal_):
        return node.inferred_type
    if isinstance(node, UnaryOp):
        if node.op == "-":
            return "number"
        if node.op == "not":
            return "bool"
    if isinstance(node, BinaryOp):
        if node.op == "&":
            return "text"
        if node.op in ("+", "-", "*", "/", "%"):
            return "number"
        if node.op in ("=", "!=", "<", "<=", ">", ">=", "and", "or"):
            return "bool"
    if isinstance(node, IfExpr):
        then_t = infer_result_type(node.then_branch)
        else_t = infer_result_type(node.else_branch)
        return then_t if then_t == else_t else "text"
    if isinstance(node, FuncCall):
        if node.name in ("count", "sum", "avg"):
            return "number"
        if node.name in ("upper", "lower", "trim", "replace", "substring", "concat", "text"):
            return "text"
        if node.name in ("len", "number"):
            return "number"
    if isinstance(node, (LinkedRef, LinkedFromRef, FieldAccess)):
        return "number" if isinstance(node, FieldAccess) else "text"
    return "text"
