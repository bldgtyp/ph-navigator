"""Parity tests driving the Python parser against the shared corpus.

The corpus at `backend/tests/fixtures/formula_grammar_corpus.json` is
the contract between the Python parser
(`features/project_document/formula/parser.py`) and the TypeScript port
in `frontend/src/shared/ui/data-table/lib/formula/parser.ts`. The
TypeScript tests under
`frontend/src/shared/ui/data-table/__tests__/formulaGrammarCorpus.test.ts`
run the same cases against the TS parser; CI fails on the first
divergence.

`source_spec` lets long resource-limit sources stay compact in the
fixture file. Both this driver and the TS one must agree on the
expansion rules.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

import pytest

from features.project_document.formula.ast_nodes import (
    FormulaAST,
    ast_to_json,
)
from features.project_document.formula.errors import (
    FormulaParseError,
    FormulaResourceLimitError,
    FormulaUnsupportedFunctionError,
)
from features.project_document.formula.parser import parse

CORPUS_PATH = Path(__file__).parent / "fixtures" / "formula_grammar_corpus.json"


def _expand_source(case: dict[str, Any]) -> str:
    if "source" in case:
        return case["source"]
    spec = case["source_spec"]
    kind = spec["kind"]
    if kind == "repeat":
        return spec["unit"] * spec["count"] + spec.get("trailer", "")
    if kind == "balanced_parens":
        return "(" * spec["depth"] + spec["core"] + ")" * spec["depth"]
    if kind == "many_field_refs":
        refs = "".join(f"{{F{i}}}+" for i in range(spec["count"]))
        return refs + spec.get("trailer", "0")
    raise AssertionError(f"unknown source_spec kind: {kind!r}")


def _load_cases() -> list[dict[str, Any]]:
    payload = json.loads(CORPUS_PATH.read_text())
    return payload["cases"]


def _ast_equal(actual: Any, expected: Any) -> bool:
    """Logical equality across JSON-encoded ASTs.

    Numbers compare via Python's `==` (so 2 from JSON and 2.0 from the
    parser match); everything else is structural."""
    if isinstance(expected, dict):
        if not isinstance(actual, dict):
            return False
        if expected.keys() != actual.keys():
            return False
        return all(_ast_equal(actual[k], expected[k]) for k in expected)
    if isinstance(expected, list):
        if not isinstance(actual, list):
            return False
        if len(actual) != len(expected):
            return False
        return all(_ast_equal(a, e) for a, e in zip(actual, expected, strict=True))
    if isinstance(expected, bool) or isinstance(actual, bool):
        return expected is actual
    if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
        return float(expected) == float(actual)
    return expected == actual


CASES = _load_cases()


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_grammar_corpus_case(case: dict[str, Any]) -> None:
    source = _expand_source(case)

    if "expected_ast" in case:
        ast = parse(source)
        actual_json = ast_to_json(ast)
        expected = case["expected_ast"]
        assert _ast_equal(actual_json, expected), (
            f"AST mismatch for {case['name']!r}\n  expected: {expected}\n  actual:   {actual_json}"
        )
        return

    expected_error = case["expected_error"]
    expected_type = expected_error["type"]
    type_by_name = {
        "FormulaParseError": FormulaParseError,
        "FormulaResourceLimitError": FormulaResourceLimitError,
        "FormulaUnsupportedFunctionError": FormulaUnsupportedFunctionError,
    }
    exc_class = type_by_name[expected_type]
    with pytest.raises(exc_class) as excinfo:
        parse(source)

    if expected_type == "FormulaResourceLimitError":
        exc = cast(FormulaResourceLimitError, excinfo.value)
        assert exc.limit_name == expected_error["limit_name"], (
            f"limit_name mismatch for {case['name']!r}: "
            f"expected {expected_error['limit_name']!r}, "
            f"got {exc.limit_name!r}"
        )
    if expected_type == "FormulaUnsupportedFunctionError":
        exc = cast(FormulaUnsupportedFunctionError, excinfo.value)
        assert exc.function_name == expected_error["function_name"]


def test_corpus_has_no_orphan_keys() -> None:
    """Guard against typos in the corpus shape — every case must declare
    exactly one of `source` / `source_spec` and exactly one of
    `expected_ast` / `expected_error`."""
    for case in CASES:
        has_source = "source" in case
        has_spec = "source_spec" in case
        assert has_source ^ has_spec, f"{case['name']!r} must have exactly one of source/source_spec"
        has_ast = "expected_ast" in case
        has_err = "expected_error" in case
        assert has_ast ^ has_err, f"{case['name']!r} must have exactly one of expected_ast/expected_error"


def _walk_ast_with_field_ids(ast: FormulaAST) -> FormulaAST:
    """Synthetic resolver used by other suites (kept here as a shared
    helper so the evaluator test driver doesn't redefine it).

    Returns a new AST in which every `FieldRef.field_id` equals
    `display_name.strip().casefold()`. This matches what the evaluator
    test driver uses to look up row values.
    """
    from features.project_document.formula.ast_nodes import (
        BinaryOp,
        FieldRef,
        FuncCall,
        IfExpr,
        Literal_,
        UnaryOp,
    )

    if isinstance(ast, Literal_):
        return ast
    if isinstance(ast, FieldRef):
        return FieldRef(
            kind="field_ref",
            display_name=ast.display_name,
            field_id=ast.display_name.strip().casefold(),
        )
    if isinstance(ast, FuncCall):
        return FuncCall(
            kind="func_call",
            name=ast.name,
            args=tuple(_walk_ast_with_field_ids(a) for a in ast.args),
        )
    if isinstance(ast, BinaryOp):
        return BinaryOp(
            kind="binary_op",
            op=ast.op,
            left=_walk_ast_with_field_ids(ast.left),
            right=_walk_ast_with_field_ids(ast.right),
        )
    if isinstance(ast, UnaryOp):
        return UnaryOp(
            kind="unary_op",
            op=ast.op,
            operand=_walk_ast_with_field_ids(ast.operand),
        )
    if isinstance(ast, IfExpr):
        return IfExpr(
            kind="if",
            condition=_walk_ast_with_field_ids(ast.condition),
            then_branch=_walk_ast_with_field_ids(ast.then_branch),
            else_branch=_walk_ast_with_field_ids(ast.else_branch),
        )
    raise TypeError(f"unknown AST node: {type(ast).__name__}")
