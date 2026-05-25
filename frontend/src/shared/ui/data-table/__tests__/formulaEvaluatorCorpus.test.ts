// Parity tests driving the TS evaluator against the shared corpus at
// `backend/tests/fixtures/formula_evaluator_corpus.json`. The Python
// suite at `backend/tests/test_project_document_formula_evaluator.py`
// runs the same cases; CI fails on the first byte of divergence.

import { describe, expect, it } from "vitest";

import corpus from "@fixtures/formula_evaluator_corpus.json";
import {
  BinaryOpNode,
  FieldRefNode,
  FormulaAST,
  FuncCallNode,
  IfExprNode,
  UnaryOpNode,
} from "../lib/formula/ast";
import { EvalErrorCode, evaluate } from "../lib/formula/evaluator";
import { parse } from "../lib/formula/parser";

type ExpectedResult =
  | { ok: true; value: string | number | boolean | null }
  | { ok: false; code: EvalErrorCode };

interface EvaluatorCase {
  name: string;
  source: string;
  row?: Record<string, unknown>;
  resolve_drop?: string[];
  expected: ExpectedResult;
}

interface CorpusShape {
  cases: EvaluatorCase[];
}

function normalize(displayName: string): string {
  return displayName.trim().toLocaleLowerCase();
}

function resolveForTest(ast: FormulaAST, drop: Set<string>): FormulaAST {
  switch (ast.kind) {
    case "literal":
      return ast;
    case "field_ref": {
      const key = normalize(ast.display_name);
      if (drop.has(ast.display_name) || drop.has(key)) {
        return ast; // field_id stays null -> evaluator yields missing_ref
      }
      const resolved: FieldRefNode = {
        kind: "field_ref",
        display_name: ast.display_name,
        field_id: key,
      };
      return resolved;
    }
    case "func_call": {
      const resolved: FuncCallNode = {
        kind: "func_call",
        name: ast.name,
        args: ast.args.map((a) => resolveForTest(a, drop)),
      };
      return resolved;
    }
    case "binary_op": {
      const resolved: BinaryOpNode = {
        kind: "binary_op",
        op: ast.op,
        left: resolveForTest(ast.left, drop),
        right: resolveForTest(ast.right, drop),
      };
      return resolved;
    }
    case "unary_op": {
      const resolved: UnaryOpNode = {
        kind: "unary_op",
        op: ast.op,
        operand: resolveForTest(ast.operand, drop),
      };
      return resolved;
    }
    case "if": {
      const resolved: IfExprNode = {
        kind: "if",
        condition: resolveForTest(ast.condition, drop),
        then_branch: resolveForTest(ast.then_branch, drop),
        else_branch: resolveForTest(ast.else_branch, drop),
      };
      return resolved;
    }
  }
}

function valuesEqual(actual: unknown, expected: unknown): boolean {
  if (actual === null && expected === null) return true;
  if (actual === null || expected === null) return false;
  if (typeof actual === "boolean" || typeof expected === "boolean") {
    return actual === expected;
  }
  if (typeof actual === "number" && typeof expected === "number") {
    return actual === expected;
  }
  return actual === expected;
}

const cases = (corpus as CorpusShape).cases;

describe("formula evaluator corpus parity", () => {
  for (const testCase of cases) {
    it(testCase.name, () => {
      const ast = parse(testCase.source);
      const drop = new Set(testCase.resolve_drop ?? []);
      const resolved = resolveForTest(ast, drop);

      const rowRaw = testCase.row ?? {};
      const row = new Map<string, unknown>();
      for (const [k, v] of Object.entries(rowRaw)) {
        row.set(normalize(k), v);
      }

      const result = evaluate(resolved, (fieldId) => row.get(fieldId) ?? null);

      if (testCase.expected.ok) {
        expect(result.ok, `${testCase.name}: expected ok=true, got ${JSON.stringify(result)}`).toBe(
          true,
        );
        if (result.ok) {
          expect(
            valuesEqual(result.value, testCase.expected.value),
            `${testCase.name} value mismatch: expected ${JSON.stringify(
              testCase.expected.value,
            )}, got ${JSON.stringify(result.value)}`,
          ).toBe(true);
        }
      } else {
        expect(
          result.ok,
          `${testCase.name}: expected ok=false (${testCase.expected.code}), got ${JSON.stringify(result)}`,
        ).toBe(false);
        if (!result.ok) {
          expect(result.code).toBe(testCase.expected.code);
        }
      }
    });
  }
});
