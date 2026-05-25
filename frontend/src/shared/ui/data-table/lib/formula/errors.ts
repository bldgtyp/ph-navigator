// Parser / resolver / cycle-detection error classes.
// Mirror of `backend/features/project_document/formula/errors.py`. These
// are *internal* JS exceptions raised by `parse`, `resolveRefs`, and
// `detectCycles`. The REST/MCP boundary translates them into the
// `custom_field_formula_*` error envelopes the popover already handles.

export type FormulaResourceLimitName =
  | "source_length"
  | "ast_node_count"
  | "ast_depth"
  | "dep_count"
  | "output_length"
  | "per_row_budget";

export class FormulaParseError extends Error {
  readonly name = "FormulaParseError";
  readonly offset: number;
  readonly source: string;

  constructor(message: string, offset: number, source: string) {
    super(message);
    this.offset = offset;
    this.source = source;
  }
}

export class FormulaResourceLimitError extends Error {
  readonly name = "FormulaResourceLimitError";
  readonly limit_name: FormulaResourceLimitName;
  readonly actual: number;
  readonly max_value: number;

  constructor(limitName: FormulaResourceLimitName, actual: number, maxValue: number) {
    super(`formula ${limitName} limit exceeded: ${actual}/${maxValue}`);
    this.limit_name = limitName;
    this.actual = actual;
    this.max_value = maxValue;
  }
}

export class FormulaUnsupportedFunctionError extends Error {
  readonly name = "FormulaUnsupportedFunctionError";
  readonly function_name: string;
  readonly available: readonly string[];

  constructor(functionName: string, available: readonly string[]) {
    super(`unsupported formula function: '${functionName}'`);
    this.function_name = functionName;
    this.available = available;
  }
}

export class FormulaMissingRefError extends Error {
  readonly name = "FormulaMissingRefError";
  readonly display_name: string;

  constructor(displayName: string) {
    super(`missing formula field reference: '${displayName}'`);
    this.display_name = displayName;
  }
}

export class FormulaCycleError extends Error {
  readonly name = "FormulaCycleError";
  readonly cycle_path: readonly string[];

  constructor(cyclePath: readonly string[]) {
    super(`formula cycle: ${cyclePath.join(" -> ")}`);
    this.cycle_path = cyclePath;
  }
}
