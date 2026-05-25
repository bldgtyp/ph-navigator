// Discriminated-union AST node interfaces + JSON round-trip helpers.
// Mirror of `backend/features/project_document/formula/ast_nodes.py`.
// The `kind` discriminator values are the wire contract: the shared
// corpus's `expected_ast` payloads round-trip byte-for-byte through
// `astToJson` / `astFromJson` on both sides.

export type InferredLiteralType = "text" | "number" | "bool" | "null";

export interface LiteralNode {
  kind: "literal";
  value: string | number | boolean | null;
  inferred_type: InferredLiteralType;
}

export interface FieldRefNode {
  kind: "field_ref";
  display_name: string;
  field_id: string | null; // populated by resolveRefs
}

export interface FuncCallNode {
  kind: "func_call";
  name: string;
  args: FormulaAST[];
}

export type BinaryOp =
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "and"
  | "or";

export interface BinaryOpNode {
  kind: "binary_op";
  op: BinaryOp;
  left: FormulaAST;
  right: FormulaAST;
}

export type UnaryOp = "-" | "not";

export interface UnaryOpNode {
  kind: "unary_op";
  op: UnaryOp;
  operand: FormulaAST;
}

export interface IfExprNode {
  kind: "if";
  condition: FormulaAST;
  then_branch: FormulaAST;
  else_branch: FormulaAST;
}

export type FormulaAST =
  | LiteralNode
  | FieldRefNode
  | FuncCallNode
  | BinaryOpNode
  | UnaryOpNode
  | IfExprNode;

export function astToJson(node: FormulaAST): Record<string, unknown> {
  switch (node.kind) {
    case "literal":
      return { kind: "literal", value: node.value, inferred_type: node.inferred_type };
    case "field_ref":
      return {
        kind: "field_ref",
        display_name: node.display_name,
        field_id: node.field_id,
      };
    case "func_call":
      return {
        kind: "func_call",
        name: node.name,
        args: node.args.map(astToJson),
      };
    case "binary_op":
      return {
        kind: "binary_op",
        op: node.op,
        left: astToJson(node.left),
        right: astToJson(node.right),
      };
    case "unary_op":
      return {
        kind: "unary_op",
        op: node.op,
        operand: astToJson(node.operand),
      };
    case "if":
      return {
        kind: "if",
        condition: astToJson(node.condition),
        then_branch: astToJson(node.then_branch),
        else_branch: astToJson(node.else_branch),
      };
  }
}

export function astFromJson(payload: unknown): FormulaAST {
  if (typeof payload !== "object" || payload === null) {
    throw new Error(`AST payload must be an object, got ${typeof payload}`);
  }
  const obj = payload as Record<string, unknown>;
  const kind = obj.kind;
  switch (kind) {
    case "literal":
      return {
        kind: "literal",
        value: obj.value as string | number | boolean | null,
        inferred_type: obj.inferred_type as InferredLiteralType,
      };
    case "field_ref":
      return {
        kind: "field_ref",
        display_name: String(obj.display_name),
        field_id: (obj.field_id ?? null) as string | null,
      };
    case "func_call": {
      const rawArgs = (obj.args ?? []) as unknown[];
      return {
        kind: "func_call",
        name: String(obj.name),
        args: rawArgs.map(astFromJson),
      };
    }
    case "binary_op":
      return {
        kind: "binary_op",
        op: obj.op as BinaryOp,
        left: astFromJson(obj.left),
        right: astFromJson(obj.right),
      };
    case "unary_op":
      return {
        kind: "unary_op",
        op: obj.op as UnaryOp,
        operand: astFromJson(obj.operand),
      };
    case "if":
      return {
        kind: "if",
        condition: astFromJson(obj.condition),
        then_branch: astFromJson(obj.then_branch),
        else_branch: astFromJson(obj.else_branch),
      };
    default:
      throw new Error(`unknown AST kind: ${String(kind)}`);
  }
}
