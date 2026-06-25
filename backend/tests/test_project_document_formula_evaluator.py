"""Parity tests driving the Python evaluator against the shared corpus.

`backend/tests/fixtures/formula_evaluator_corpus.json` is the contract
between the Python evaluator (`features/project_document/formula/
evaluator.py::evaluate`) and the TypeScript port at
`frontend/src/shared/ui/data-table/lib/formula/evaluator.ts`. The TS
suite under
`frontend/src/shared/ui/data-table/__tests__/formulaEvaluatorCorpus.test.ts`
runs the same cases; CI fails on the first byte of divergence.

Refs are resolved by mapping `display_name.strip().casefold()` to
itself as the synthetic `field_id`, so a row dict keyed by lowercase
display name drives the lookups. Cases may list `resolve_drop` to
leave specific refs unresolved (testing `missing_ref`).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

import pytest

import features.project_document.formula.document_evaluator as document_evaluator
from features.project_document.formula.ast_nodes import (
    BinaryOp,
    FieldRef,
    FormulaAST,
    FuncCall,
    IfExpr,
    Literal_,
    UnaryOp,
)
from features.project_document.formula.evaluator import (
    EvalError,
    EvalSuccess,
    evaluate,
)
from features.project_document.formula.parser import parse
from features.projects.models import CreateProjectRequest
from features.projects.service import empty_project_document

CORPUS_PATH = Path(__file__).parent / "fixtures" / "formula_evaluator_corpus.json"


def _normalize(display_name: str) -> str:
    return display_name.strip().casefold()


def _resolve_for_test(ast: FormulaAST, drop: set[str]) -> FormulaAST:
    if isinstance(ast, Literal_):
        return ast
    if isinstance(ast, FieldRef):
        key = _normalize(ast.display_name)
        if ast.display_name in drop or key in drop:
            return ast  # field_id stays None -> evaluator yields missing_ref
        return FieldRef(
            kind="field_ref",
            display_name=ast.display_name,
            field_id=key,
        )
    if isinstance(ast, FuncCall):
        return FuncCall(
            kind="func_call",
            name=ast.name,
            args=tuple(_resolve_for_test(a, drop) for a in ast.args),
        )
    if isinstance(ast, BinaryOp):
        return BinaryOp(
            kind="binary_op",
            op=ast.op,
            left=_resolve_for_test(ast.left, drop),
            right=_resolve_for_test(ast.right, drop),
        )
    if isinstance(ast, UnaryOp):
        return UnaryOp(
            kind="unary_op",
            op=ast.op,
            operand=_resolve_for_test(ast.operand, drop),
        )
    if isinstance(ast, IfExpr):
        return IfExpr(
            kind="if",
            condition=_resolve_for_test(ast.condition, drop),
            then_branch=_resolve_for_test(ast.then_branch, drop),
            else_branch=_resolve_for_test(ast.else_branch, drop),
        )
    raise TypeError(f"unknown AST node: {type(ast).__name__}")


def _values_equal(actual: Any, expected: Any) -> bool:
    if actual is None and expected is None:
        return True
    if actual is None or expected is None:
        return False
    if isinstance(actual, bool) or isinstance(expected, bool):
        return actual is expected
    if isinstance(actual, (int, float)) and isinstance(expected, (int, float)):
        return float(actual) == float(expected)
    return actual == expected


CASES = json.loads(CORPUS_PATH.read_text())["cases"]


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_evaluator_corpus_case(case: dict[str, Any]) -> None:
    ast = parse(case["source"])
    drop = set(case.get("resolve_drop", []))
    resolved = _resolve_for_test(ast, drop)

    row_raw: dict[str, Any] = case.get("row", {})
    row = {_normalize(k): v for k, v in row_raw.items()}

    def accessor(field_id: str) -> Any:
        return row.get(field_id)

    result = evaluate(resolved, accessor)
    expected = case["expected"]

    if expected["ok"]:
        assert isinstance(result, EvalSuccess), (
            f"{case['name']!r}: expected EvalSuccess, got EvalError({result.code!r})"
            if isinstance(result, EvalError)
            else f"{case['name']!r}: expected EvalSuccess, got {result!r}"
        )
        assert _values_equal(result.value, expected["value"]), (
            f"{case['name']!r} value mismatch: expected {expected['value']!r}, got {result.value!r}"
        )
    else:
        assert isinstance(result, EvalError), (
            f"{case['name']!r}: expected EvalError({expected['code']!r}), got {result!r}"
        )
        assert result.code == expected["code"], (
            f"{case['name']!r} error code mismatch: expected {expected['code']!r}, got {result.code!r}"
        )


def test_document_formula_overlay_cache_reuses_whole_document_eval(monkeypatch: pytest.MonkeyPatch) -> None:
    body = empty_project_document(
        CreateProjectRequest(
            name="t",
            bt_number="1",
            cert_programs=[],
            phius_number=None,
            phius_dropbox_url=None,
        )
    )
    calls = 0
    original = document_evaluator._formula_contexts

    def wrapped_formula_contexts(*args: Any, **kwargs: Any):
        nonlocal calls
        calls += 1
        return original(*args, **kwargs)

    monkeypatch.setattr(document_evaluator, "_formula_contexts", wrapped_formula_contexts)

    document_evaluator.reset_formula_overlay_cache()
    first = document_evaluator.evaluate_document_formulas(body)
    second = document_evaluator.evaluate_document_formulas(body)

    assert first is second
    assert calls == 1


def test_document_formula_overlay_cache_ignores_recycled_id_collision() -> None:
    """A stale entry under a recycled `id(body)` must not be served to a
    different document. Python reuses ids of freed objects, so an active
    cache (set by the request middleware and leaking across direct calls)
    could otherwise return another document's overlay."""

    body = empty_project_document(
        CreateProjectRequest(
            name="t",
            bt_number="1",
            cert_programs=[],
            phius_number=None,
            phius_dropbox_url=None,
        )
    )

    document_evaluator.reset_formula_overlay_cache()
    cache = document_evaluator._DOCUMENT_FORMULA_CACHE.get()
    assert cache is not None
    # Plant a poisoned entry under this body's id, paired with a *different*
    # object — exactly what an id recycled from a freed document looks like.
    sentinel = {("equipment", "pumps"): {"STALE_ROW": {}}}
    cache[id(body)] = cast("Any", (object(), sentinel))

    result = document_evaluator.evaluate_document_formulas(body)

    assert result is not sentinel
    assert "STALE_ROW" not in result.get(("equipment", "pumps"), {})
