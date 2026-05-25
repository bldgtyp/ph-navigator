// Walks a stored AST against the live registry and re-emits the
// source string with each field ref's *current* display name. Field
// refs are stored by id, so renames absorb silently on next open.
// The serialiser parenthesises every binary/unary subexpression to
// guarantee round-trip through `parse()`; the resulting source can be
// more verbose than the user's original.

import type { FormulaAST } from "./ast";
import type { FieldRegistryEntry } from "./resolver";

export function rebuildSourceFromStoredAst(
  ast: FormulaAST,
  fieldRegistry: ReadonlyArray<FieldRegistryEntry>,
): string {
  const byId = new Map<string, FieldRegistryEntry>();
  for (const entry of fieldRegistry) byId.set(entry.field_id, entry);
  return serialise(ast, byId);
}

function serialise(node: FormulaAST, byId: ReadonlyMap<string, FieldRegistryEntry>): string {
  switch (node.kind) {
    case "literal":
      return serialiseLiteral(node.value);
    case "field_ref": {
      const current = node.field_id ? byId.get(node.field_id) : undefined;
      const displayName = current?.display_name ?? node.display_name;
      return `{${displayName}}`;
    }
    case "func_call":
      return `${node.name}(${node.args.map((arg) => serialise(arg, byId)).join(", ")})`;
    case "binary_op":
      return `(${serialise(node.left, byId)} ${node.op} ${serialise(node.right, byId)})`;
    case "unary_op":
      return node.op === "not"
        ? `(not ${serialise(node.operand, byId)})`
        : `(-${serialise(node.operand, byId)})`;
    case "if":
      return `if(${serialise(node.condition, byId)}, ${serialise(node.then_branch, byId)}, ${serialise(node.else_branch, byId)})`;
  }
}

function serialiseLiteral(value: string | number | boolean | null): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}
