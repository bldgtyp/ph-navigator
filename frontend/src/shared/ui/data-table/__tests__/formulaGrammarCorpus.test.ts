// Parity tests driving the TS parser against the shared corpus at
// `backend/tests/fixtures/formula_grammar_corpus.json`. The Python suite
// at `backend/tests/test_project_document_formula_grammar.py` runs the
// same cases; CI fails on the first divergence.

import { describe, expect, it } from "vitest";

import corpus from "@fixtures/formula_grammar_corpus.json";
import { astToJson } from "../lib/formula/ast";
import {
  FormulaParseError,
  FormulaResourceLimitError,
  FormulaUnsupportedFunctionError,
} from "../lib/formula/errors";
import { parse } from "../lib/formula/parser";

interface RepeatSpec {
  kind: "repeat";
  unit: string;
  count: number;
  trailer?: string;
}
interface BalancedParensSpec {
  kind: "balanced_parens";
  depth: number;
  core: string;
}
interface ManyFieldRefsSpec {
  kind: "many_field_refs";
  count: number;
  trailer?: string;
}
type SourceSpec = RepeatSpec | BalancedParensSpec | ManyFieldRefsSpec;

interface ExpectedError {
  type:
    | "FormulaParseError"
    | "FormulaResourceLimitError"
    | "FormulaUnsupportedFunctionError";
  limit_name?: string;
  function_name?: string;
}

interface GrammarCase {
  name: string;
  source?: string;
  source_spec?: SourceSpec;
  expected_ast?: unknown;
  expected_error?: ExpectedError;
}

interface CorpusShape {
  cases: GrammarCase[];
}

function expandSource(testCase: GrammarCase): string {
  if (testCase.source !== undefined) return testCase.source;
  const spec = testCase.source_spec;
  if (spec === undefined) {
    throw new Error(`case '${testCase.name}' missing source/source_spec`);
  }
  switch (spec.kind) {
    case "repeat":
      return spec.unit.repeat(spec.count) + (spec.trailer ?? "");
    case "balanced_parens":
      return "(".repeat(spec.depth) + spec.core + ")".repeat(spec.depth);
    case "many_field_refs": {
      let refs = "";
      for (let i = 0; i < spec.count; i++) refs += `{F${i}}+`;
      return refs + (spec.trailer ?? "0");
    }
  }
}

function astEqual(actual: unknown, expected: unknown): boolean {
  if (
    typeof expected === "object" &&
    expected !== null &&
    !Array.isArray(expected)
  ) {
    if (
      typeof actual !== "object" ||
      actual === null ||
      Array.isArray(actual)
    ) {
      return false;
    }
    const eObj = expected as Record<string, unknown>;
    const aObj = actual as Record<string, unknown>;
    const eKeys = Object.keys(eObj).sort();
    const aKeys = Object.keys(aObj).sort();
    if (eKeys.length !== aKeys.length) return false;
    for (let i = 0; i < eKeys.length; i++) {
      if (eKeys[i] !== aKeys[i]) return false;
    }
    return eKeys.every((k) => astEqual(aObj[k], eObj[k]));
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false;
    if (actual.length !== expected.length) return false;
    return expected.every((e, i) => astEqual(actual[i], e));
  }
  if (typeof expected === "boolean" || typeof actual === "boolean") {
    return expected === actual;
  }
  if (typeof expected === "number" && typeof actual === "number") {
    return expected === actual;
  }
  return expected === actual;
}

const cases = (corpus as CorpusShape).cases;

describe("formula grammar corpus parity", () => {
  for (const testCase of cases) {
    it(testCase.name, () => {
      const source = expandSource(testCase);

      if (testCase.expected_ast !== undefined) {
        const ast = parse(source);
        const actual = astToJson(ast);
        expect(
          astEqual(actual, testCase.expected_ast),
          `AST mismatch for '${testCase.name}'\n  expected: ${JSON.stringify(
            testCase.expected_ast,
          )}\n  actual:   ${JSON.stringify(actual)}`,
        ).toBe(true);
        return;
      }

      const expectedError = testCase.expected_error;
      if (expectedError === undefined) {
        throw new Error(
          `case '${testCase.name}' missing expected_ast/expected_error`,
        );
      }

      let thrown: unknown;
      try {
        parse(source);
      } catch (err) {
        thrown = err;
      }

      expect(thrown, `expected error for '${testCase.name}'`).toBeDefined();

      switch (expectedError.type) {
        case "FormulaParseError":
          expect(thrown).toBeInstanceOf(FormulaParseError);
          break;
        case "FormulaResourceLimitError":
          expect(thrown).toBeInstanceOf(FormulaResourceLimitError);
          if (expectedError.limit_name !== undefined) {
            expect(
              (thrown as FormulaResourceLimitError).limit_name,
            ).toBe(expectedError.limit_name);
          }
          break;
        case "FormulaUnsupportedFunctionError":
          expect(thrown).toBeInstanceOf(FormulaUnsupportedFunctionError);
          if (expectedError.function_name !== undefined) {
            expect(
              (thrown as FormulaUnsupportedFunctionError).function_name,
            ).toBe(expectedError.function_name);
          }
          break;
      }
    });
  }
});
