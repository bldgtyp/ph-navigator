// Shared parse + classify pipeline for the in-editor formula state.
// Both create-field and edit-field formula sections consume this
// so wording and error tiers stay in lockstep.

import type { FormulaAST } from "./ast";
import {
  FormulaMissingRefError,
  FormulaParseError,
  FormulaResourceLimitError,
  FormulaUnsupportedFunctionError,
} from "./errors";
import { parse } from "./parser";
import { collectFieldRefs, resolveRefs, type FieldRegistryEntry } from "./resolver";

export type LocalFormulaState =
  | { kind: "empty" }
  | { kind: "ok"; ast: FormulaAST; deps: ReadonlyArray<string> }
  | { kind: "missing_ref"; display_name: string }
  | { kind: "cycle"; field_id: string }
  | { kind: "parse_error"; message: string; offset: number }
  | { kind: "resource_limit"; limit: string; actual: number; max: number }
  | { kind: "unsupported_function"; name: string; available: ReadonlyArray<string> };

export type ParseFormulaOptions = {
  // When set, a resolved AST referencing this id is reported as a
  // cycle (self-reference). Omit during add-field, where the new
  // field's id isn't part of the user's mental model yet.
  excludeSelfRefId?: string;
};

export function parseFormulaSource(
  source: string,
  registry: ReadonlyArray<FieldRegistryEntry>,
  options: ParseFormulaOptions = {},
): LocalFormulaState {
  if (source.trim() === "") return { kind: "empty" };
  let ast: FormulaAST;
  try {
    ast = parse(source);
  } catch (err) {
    if (err instanceof FormulaParseError) {
      return { kind: "parse_error", message: err.message, offset: err.offset };
    }
    if (err instanceof FormulaResourceLimitError) {
      return {
        kind: "resource_limit",
        limit: err.limit_name,
        actual: err.actual,
        max: err.max_value,
      };
    }
    if (err instanceof FormulaUnsupportedFunctionError) {
      return { kind: "unsupported_function", name: err.function_name, available: err.available };
    }
    throw err;
  }
  let resolved: FormulaAST;
  try {
    resolved = resolveRefs(ast, registry);
  } catch (err) {
    if (err instanceof FormulaMissingRefError) {
      return { kind: "missing_ref", display_name: err.display_name };
    }
    throw err;
  }
  const deps = collectFieldRefs(resolved);
  if (options.excludeSelfRefId && deps.includes(options.excludeSelfRefId)) {
    return { kind: "cycle", field_id: options.excludeSelfRefId };
  }
  return { kind: "ok", ast: resolved, deps };
}

export function formatLocalFormulaError(state: LocalFormulaState): string | null {
  switch (state.kind) {
    case "empty":
    case "ok":
      return null;
    case "parse_error":
      return `Couldn't parse the formula: ${state.message} (position ${state.offset}).`;
    case "resource_limit":
      return `Formula exceeds ${state.limit} limit (${state.actual}/${state.max}). Simplify the expression and try again.`;
    case "unsupported_function":
      return `Function '${state.name}' is not supported. Available: ${state.available.join(", ")}.`;
    case "missing_ref":
      return `Formula references a field that doesn't exist in this table: ${state.display_name}.`;
    case "cycle":
      return "This formula references itself, which would create a cycle.";
  }
}
