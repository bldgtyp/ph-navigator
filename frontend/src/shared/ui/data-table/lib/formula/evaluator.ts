// Live in-grid evaluator for resolved formula ASTs.
// Mirror of `backend/features/project_document/formula/evaluator.py`.
// Semantics anchored by plan-13 D22 / D25 / D26 and codified by the
// shared corpus at `backend/tests/fixtures/formula_evaluator_corpus.json`.
//
// The backend evaluator is authoritative for downloads / MCP reads; the
// browser evaluator is an optimisation for live render and the popover's
// preview pane. CI fails on the first byte of divergence between them.

import { FormulaAST } from "./ast";
import { OUTPUT_LENGTH_MAX, PER_ROW_FUSE_MAX } from "./limits";

export type EvalErrorCode =
  | "div_by_zero"
  | "type_mismatch"
  | "missing_ref"
  | "fuse_tripped"
  | "output_too_long";

export type EvalValue = string | number | boolean | null;

export type EvalResult = { ok: true; value: EvalValue } | { ok: false; code: EvalErrorCode };

export interface EvalFuse {
  nodesEvaluated: number;
  maxNodes: number;
}

export function createFuse(maxNodes = PER_ROW_FUSE_MAX): EvalFuse {
  return { nodesEvaluated: 0, maxNodes };
}

export type RowAccessor = (fieldId: string) => unknown;

export interface EvaluateOptions {
  fuse?: EvalFuse;
  outputLengthMax?: number;
}

class EvalErrorSignal extends Error {
  readonly code: EvalErrorCode;
  constructor(code: EvalErrorCode) {
    super(code);
    this.code = code;
  }
}

interface State {
  rowAccessor: RowAccessor;
  fuse: EvalFuse;
  outputLengthMax: number;
}

export function evaluate(
  ast: FormulaAST,
  rowAccessor: RowAccessor,
  options: EvaluateOptions = {},
): EvalResult {
  const state: State = {
    rowAccessor,
    fuse: options.fuse ?? createFuse(),
    outputLengthMax: options.outputLengthMax ?? OUTPUT_LENGTH_MAX,
  };
  try {
    const value = evalNode(ast, state);
    if (typeof value === "string" && value.length > state.outputLengthMax) {
      return { ok: false, code: "output_too_long" };
    }
    return { ok: true, value: value as EvalValue };
  } catch (err) {
    if (err instanceof EvalErrorSignal) {
      return { ok: false, code: err.code };
    }
    throw err;
  }
}

// --------------------------------------------------------------------------
// Helpers — match Python parity exactly. Do not substitute JS `%`, JS
// numeric formatting, or JS truthiness rules; each helper isolates the
// corpus contract from engine drift.
// --------------------------------------------------------------------------

function bumpFuse(state: State): void {
  state.fuse.nodesEvaluated++;
  if (state.fuse.nodesEvaluated > state.fuse.maxNodes) {
    throw new EvalErrorSignal("fuse_tripped");
  }
}

function fmod(a: number, b: number): number {
  // Sign-of-dividend modulo, matching Python's `math.fmod`. Caller has
  // already rejected b === 0. JS `%` happens to use sign-of-dividend
  // semantics too, but isolating it as a helper makes the parity
  // intent explicit (and survives any future engine drift).
  return a - Math.trunc(a / b) * b;
}

function guardFinite(value: number): number {
  if (!Number.isFinite(value)) {
    throw new EvalErrorSignal("type_mismatch");
  }
  return value;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

function truthy(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (value === false) return false;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value !== "";
  return true;
}

function eq(left: unknown, right: unknown): boolean {
  if (left === null && right === null) return true;
  if (left === null || right === null) return false;
  if (typeof left === "boolean" && typeof right === "boolean") return left === right;
  if (typeof left === "boolean" || typeof right === "boolean") return false;
  if (isNumber(left) && isNumber(right)) return left === right;
  if (typeof left === "string" && typeof right === "string") return left === right;
  return false;
}

function compare(left: unknown, right: unknown, op: "<" | "<=" | ">" | ">="): boolean {
  if (typeof left === "boolean" || typeof right === "boolean") {
    throw new EvalErrorSignal("type_mismatch");
  }
  let a: number | string;
  let b: number | string;
  if (isNumber(left) && isNumber(right)) {
    a = left;
    b = right;
  } else if (typeof left === "string" && typeof right === "string") {
    a = left;
    b = right;
  } else {
    throw new EvalErrorSignal("type_mismatch");
  }
  switch (op) {
    case "<":
      return (a as never) < (b as never);
    case "<=":
      return (a as never) <= (b as never);
    case ">":
      return (a as never) > (b as never);
    case ">=":
      return (a as never) >= (b as never);
  }
}

function coerceStringArg(value: unknown): string {
  // AirTable parity: null arg → "" in string functions; other
  // non-string types raise type_mismatch.
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  throw new EvalErrorSignal("type_mismatch");
}

function argAsInt(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") {
    throw new EvalErrorSignal("type_mismatch");
  }
  if (!isNumber(value)) {
    throw new EvalErrorSignal("type_mismatch");
  }
  if (!Number.isInteger(value)) {
    throw new EvalErrorSignal("type_mismatch");
  }
  return value;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return null;
  if (isNumber(value)) return guardFinite(value);
  if (typeof value === "string") {
    const stripped = value.trim();
    if (stripped === "") return null;
    const parsed = Number(stripped);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
  }
  return null;
}

function toText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (isNumber(value)) return formatNumber(value);
  if (typeof value === "string") return value;
  return null;
}

function toConcatText(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = toText(value);
  if (text === null) {
    throw new EvalErrorSignal("type_mismatch");
  }
  return text;
}

function formatNumber(value: number): string {
  // Deterministic number-to-text format pinned by the shared corpus.
  // Matches Python `_format_number`:
  //   - 0 / -0       → "0"
  //   - integer < 1e16 → "<n>" (no trailing ".0")
  //   - everything else → Number.toString() (matches Python repr for
  //     the values the corpus exercises; if a future corpus case
  //     reveals divergence, fix the formatter, not the corpus).
  if (!Number.isFinite(value)) {
    throw new EvalErrorSignal("type_mismatch");
  }
  if (value === 0) return "0";
  if (Number.isInteger(value) && Math.abs(value) < 1e16) {
    return String(value);
  }
  return String(value);
}

function substring(args: unknown[]): string {
  const s = coerceStringArg(args[0]);
  const start = argAsInt(args[1]);
  if (start === null) return "";
  let end: number;
  if (args.length >= 3) {
    const endVal = argAsInt(args[2]);
    if (endVal === null) return "";
    end = endVal;
  } else {
    end = s.length;
  }
  // 1-indexed, inclusive end (D24).
  if (start < 1 || end < 1) {
    throw new EvalErrorSignal("type_mismatch");
  }
  const startIdx = Math.max(1, Math.min(start, s.length));
  const endIdx = Math.max(1, Math.min(end, s.length));
  if (startIdx > endIdx) return "";
  return s.slice(startIdx - 1, endIdx);
}

// --------------------------------------------------------------------------
// Node dispatch
// --------------------------------------------------------------------------

function evalNode(node: FormulaAST, state: State): unknown {
  bumpFuse(state);
  switch (node.kind) {
    case "literal":
      return node.value;
    case "field_ref": {
      if (node.field_id === null) {
        throw new EvalErrorSignal("missing_ref");
      }
      return state.rowAccessor(node.field_id) ?? null;
    }
    case "unary_op": {
      const operand = evalNode(node.operand, state);
      if (node.op === "-") {
        if (operand === null || operand === undefined) return null;
        if (typeof operand === "boolean" || !isNumber(operand)) {
          throw new EvalErrorSignal("type_mismatch");
        }
        return guardFinite(-operand);
      }
      // not
      if (operand === null || operand === undefined) return null;
      return !truthy(operand);
    }
    case "binary_op":
      return evalBinary(node, state);
    case "if": {
      const cond = evalNode(node.condition, state);
      if (cond === null || cond === undefined) return null;
      if (truthy(cond)) return evalNode(node.then_branch, state);
      return evalNode(node.else_branch, state);
    }
    case "func_call":
      return evalCall(node, state);
  }
}

function evalBinary(node: Extract<FormulaAST, { kind: "binary_op" }>, state: State): unknown {
  const op = node.op;
  if (op === "and") {
    const left = evalNode(node.left, state);
    if (left === null || left === undefined) return null;
    if (!truthy(left)) return false;
    const right = evalNode(node.right, state);
    if (right === null || right === undefined) return null;
    return truthy(right);
  }
  if (op === "or") {
    const left = evalNode(node.left, state);
    if (left === null || left === undefined) return null;
    if (truthy(left)) return true;
    const right = evalNode(node.right, state);
    if (right === null || right === undefined) return null;
    return truthy(right);
  }

  const left = evalNode(node.left, state);
  const right = evalNode(node.right, state);
  if (op === "=") return eq(left, right);
  if (op === "!=") return !eq(left, right);
  if (op === "&") return toConcatText(left) + toConcatText(right);

  // Null propagation for arithmetic and ordering comparisons.
  if (left === null || left === undefined || right === null || right === undefined) {
    return null;
  }

  if (op === "+" || op === "-" || op === "*" || op === "/" || op === "%") {
    if (typeof left === "string" && op === "+") {
      // Strings concatenate only via explicit `concat` (AirTable parity).
      throw new EvalErrorSignal("type_mismatch");
    }
    if (typeof left === "boolean" || typeof right === "boolean") {
      throw new EvalErrorSignal("type_mismatch");
    }
    if (!isNumber(left) || !isNumber(right)) {
      throw new EvalErrorSignal("type_mismatch");
    }
    const a = left;
    const b = right;
    switch (op) {
      case "+":
        return guardFinite(a + b);
      case "-":
        return guardFinite(a - b);
      case "*":
        return guardFinite(a * b);
      case "/":
        if (b === 0) throw new EvalErrorSignal("div_by_zero");
        return guardFinite(a / b);
      case "%":
        if (b === 0) throw new EvalErrorSignal("div_by_zero");
        return guardFinite(fmod(a, b));
    }
  }

  if (op === "<" || op === "<=" || op === ">" || op === ">=") {
    return compare(left, right, op);
  }

  throw new EvalErrorSignal("type_mismatch");
}

function evalCall(node: Extract<FormulaAST, { kind: "func_call" }>, state: State): unknown {
  const args = node.args.map((arg) => evalNode(arg, state));
  switch (node.name) {
    case "concat":
      return args.map(coerceStringArg).join("");
    case "upper":
      return coerceStringArg(args[0]).toUpperCase();
    case "lower":
      return coerceStringArg(args[0]).toLowerCase();
    case "trim":
      return coerceStringArg(args[0]).trim();
    case "len":
      return coerceStringArg(args[0]).length;
    case "replace": {
      const haystack = coerceStringArg(args[0]);
      const needle = coerceStringArg(args[1]);
      const replacement = coerceStringArg(args[2]);
      if (needle === "") return haystack;
      return haystack.split(needle).join(replacement);
    }
    case "substring":
      return substring(args);
    case "number":
      return toNumber(args[0]);
    case "text":
      return toText(args[0]);
    default:
      throw new EvalErrorSignal("type_mismatch");
  }
}
