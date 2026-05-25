import type { FieldDef } from "../types";
import {
  astFromJson,
  rebuildSourceFromStoredAst,
  type FieldRegistryEntry,
  type FormulaAST,
} from "./formula";

export function formulaSourceFromFieldDef(
  fieldDef: FieldDef,
  fieldRegistry: ReadonlyArray<FieldRegistryEntry>,
): string {
  if (!fieldDef.formula_config) return "";
  let source = fieldDef.formula_config.source ?? "";
  const storedAst = fieldDef.formula_config.ast;
  if (storedAst && fieldRegistry.length > 0) {
    try {
      const ast = astFromJson(storedAst) as FormulaAST;
      source = rebuildSourceFromStoredAst(ast, fieldRegistry);
    } catch {
      // Stored AST did not round-trip; keep the raw source editable.
    }
  }
  return source;
}
