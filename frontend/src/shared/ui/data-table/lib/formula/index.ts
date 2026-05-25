// Public surface of the frontend formula module. Mirror of
// `backend/features/project_document/formula/__init__.py`.

export {
  astFromJson,
  astToJson,
} from "./ast";
export type {
  BinaryOp,
  BinaryOpNode,
  FieldRefNode,
  FormulaAST,
  FuncCallNode,
  IfExprNode,
  InferredLiteralType,
  LiteralNode,
  UnaryOp,
  UnaryOpNode,
} from "./ast";

export {
  FormulaCycleError,
  FormulaMissingRefError,
  FormulaParseError,
  FormulaResourceLimitError,
  FormulaUnsupportedFunctionError,
} from "./errors";
export type { FormulaResourceLimitName } from "./errors";

export {
  createFuse,
  evaluate,
} from "./evaluator";
export type {
  EvalErrorCode,
  EvalFuse,
  EvalResult,
  EvalValue,
  EvaluateOptions,
  RowAccessor,
} from "./evaluator";

export {
  AST_DEPTH_MAX,
  AST_NODE_COUNT_MAX,
  DEP_COUNT_MAX,
  OUTPUT_LENGTH_MAX,
  PER_ROW_FUSE_MAX,
  SOURCE_LENGTH_MAX,
} from "./limits";

export {
  ALLOWED_FUNCTIONS,
  parse,
  tokenize,
} from "./parser";

export {
  collectFieldRefs,
  resolveRefs,
} from "./resolver";
export type {
  FieldFormulaType,
  FieldOrigin,
  FieldRegistryEntry,
} from "./resolver";

export { TokenKind } from "./tokens";
export type { Token, TokenValue } from "./tokens";

export {
  COMPUTED_ERROR_MESSAGES,
  isComputedErrorValue,
} from "./computedValues";
export type { ComputedCellValue } from "./computedValues";

export { rebuildSourceFromStoredAst } from "./displayName";
