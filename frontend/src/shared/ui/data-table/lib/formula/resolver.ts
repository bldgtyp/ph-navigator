// Field-ref resolution for in-editor live preview.
// Mirror of `backend/features/project_document/formula/resolver.py`.
// Cycle detection is NOT mirrored here — the backend rejects cycles at
// commit time and the read-overlay path is server-side. The browser
// resolver is used inside the field-config formula section only, so the preview
// can flag missing refs before submit.

import { FieldRefNode, FormulaAST, FuncCallNode } from "./ast";
import { FormulaMissingRefError } from "./errors";

export type FieldOrigin = "core" | "custom";
export type FieldFormulaType = "text" | "number" | "single_select" | "formula" | "bool";

export interface FieldRegistryEntry {
  field_id: string;
  display_name: string;
  origin: FieldOrigin;
  field_type: FieldFormulaType;
}

function normalizeDisplayName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

export function resolveRefs(ast: FormulaAST, registry: Iterable<FieldRegistryEntry>): FormulaAST {
  const byName = new Map<string, FieldRegistryEntry>();
  for (const entry of registry) {
    byName.set(normalizeDisplayName(entry.display_name), entry);
  }
  return walk(ast, byName);
}

function walk(node: FormulaAST, byName: ReadonlyMap<string, FieldRegistryEntry>): FormulaAST {
  switch (node.kind) {
    case "literal":
      return node;
    case "field_ref": {
      const key = normalizeDisplayName(node.display_name);
      const entry = byName.get(key);
      if (entry === undefined) {
        throw new FormulaMissingRefError(node.display_name);
      }
      const resolved: FieldRefNode = {
        kind: "field_ref",
        display_name: node.display_name,
        field_id: entry.field_id,
      };
      return resolved;
    }
    case "func_call": {
      const resolved: FuncCallNode = {
        kind: "func_call",
        name: node.name,
        args: node.args.map((arg) => walk(arg, byName)),
      };
      return resolved;
    }
    case "binary_op":
      return {
        kind: "binary_op",
        op: node.op,
        left: walk(node.left, byName),
        right: walk(node.right, byName),
      };
    case "unary_op":
      return {
        kind: "unary_op",
        op: node.op,
        operand: walk(node.operand, byName),
      };
    case "if":
      return {
        kind: "if",
        condition: walk(node.condition, byName),
        then_branch: walk(node.then_branch, byName),
        else_branch: walk(node.else_branch, byName),
      };
  }
}

export function collectFieldRefs(ast: FormulaAST): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  function visit(node: FormulaAST): void {
    switch (node.kind) {
      case "literal":
        return;
      case "field_ref":
        if (node.field_id !== null && !seen.has(node.field_id)) {
          seen.add(node.field_id);
          out.push(node.field_id);
        }
        return;
      case "func_call":
        node.args.forEach(visit);
        return;
      case "binary_op":
        visit(node.left);
        visit(node.right);
        return;
      case "unary_op":
        visit(node.operand);
        return;
      case "if":
        visit(node.condition);
        visit(node.then_branch);
        visit(node.else_branch);
        return;
    }
  }
  visit(ast);
  return out;
}
