"""Custom-field formula grammar, evaluator, and resolution (Phase 4).

Public surface used by `schema_mutations.SetFormulaMutation` dispatch,
`document.validate_document_references`, and the `evaluate_table_formulas`
helper consumed by read-overlay paths (downloads, slice responses, MCP
`get_table`).

The grammar and semantics are pinned by `plan-13` §3 D22–D26 and
§4.4. The evaluator is byte-for-byte equivalent to the TypeScript port
in `frontend/.../lib/formula/`; the shared corpora at
`backend/tests/fixtures/formula_grammar_corpus.json` and
`formula_evaluator_corpus.json` are the parity contract.
"""

from features.project_document.formula.analysis import (
    count_ast_nodes,
    infer_result_type,
)
from features.project_document.formula.ast_nodes import (
    BinaryOp,
    FieldRef,
    FormulaAST,
    FuncCall,
    IfExpr,
    Literal,
    UnaryOp,
    ast_from_json,
    ast_to_json,
)
from features.project_document.formula.errors import (
    FormulaCycleError,
    FormulaMissingRefError,
    FormulaParseError,
    FormulaResourceLimitError,
    FormulaUnsupportedFunctionError,
)
from features.project_document.formula.evaluator import (
    EvalError,
    EvalFuse,
    EvalResult,
    EvalSuccess,
    evaluate,
    evaluate_table_formulas,
)
from features.project_document.formula.limits import (
    AST_DEPTH_MAX,
    AST_NODE_COUNT_MAX,
    DEP_COUNT_MAX,
    OUTPUT_LENGTH_MAX,
    PER_ROW_FUSE_MAX,
    SOURCE_LENGTH_MAX,
)
from features.project_document.formula.parser import parse
from features.project_document.formula.resolver import (
    FieldRegistryEntry,
    build_field_registry,
    detect_cycles,
    formula_facing_field_type,
    resolve_refs,
)

__all__ = [
    "AST_DEPTH_MAX",
    "AST_NODE_COUNT_MAX",
    "BinaryOp",
    "DEP_COUNT_MAX",
    "EvalError",
    "EvalFuse",
    "EvalResult",
    "EvalSuccess",
    "FieldRef",
    "FieldRegistryEntry",
    "FormulaAST",
    "FormulaCycleError",
    "FormulaMissingRefError",
    "FormulaParseError",
    "FormulaResourceLimitError",
    "FormulaUnsupportedFunctionError",
    "FuncCall",
    "IfExpr",
    "Literal",
    "OUTPUT_LENGTH_MAX",
    "PER_ROW_FUSE_MAX",
    "SOURCE_LENGTH_MAX",
    "UnaryOp",
    "ast_from_json",
    "ast_to_json",
    "build_field_registry",
    "count_ast_nodes",
    "detect_cycles",
    "evaluate",
    "evaluate_table_formulas",
    "formula_facing_field_type",
    "infer_result_type",
    "parse",
    "resolve_refs",
]
