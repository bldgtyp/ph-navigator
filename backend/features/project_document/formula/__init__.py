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
    FieldAccess,
    FieldRef,
    FormulaAST,
    FuncCall,
    IfExpr,
    LinkedFromRef,
    LinkedRef,
    Literal,
    UnaryOp,
    ast_from_json,
    ast_to_json,
)
from features.project_document.formula.document_evaluator import (
    evaluate_table_formulas,
    overlay_cell_value,
    reset_formula_overlay_cache,
)
from features.project_document.formula.errors import (
    FormulaCycleError,
    FormulaInvalidLinkedArgError,
    FormulaMissingRefError,
    FormulaParseError,
    FormulaResourceLimitError,
    FormulaTargetFieldNotLinkedError,
    FormulaUnknownTargetTableError,
    FormulaUnsupportedFunctionError,
)
from features.project_document.formula.evaluator import (
    EvalError,
    EvalFuse,
    EvalResult,
    EvalSuccess,
    evaluate,
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
    validate_document_formula_graph,
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
    "FieldAccess",
    "FieldRegistryEntry",
    "FormulaAST",
    "FormulaCycleError",
    "FormulaInvalidLinkedArgError",
    "FormulaMissingRefError",
    "FormulaParseError",
    "FormulaResourceLimitError",
    "FormulaTargetFieldNotLinkedError",
    "FormulaUnsupportedFunctionError",
    "FormulaUnknownTargetTableError",
    "FuncCall",
    "IfExpr",
    "LinkedFromRef",
    "LinkedRef",
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
    "overlay_cell_value",
    "parse",
    "resolve_refs",
    "reset_formula_overlay_cache",
    "validate_document_formula_graph",
]
