// Hard resource limits for formula parse / evaluate (plan-13 D17 / D23).
// Mirror of `backend/features/project_document/formula/limits.py`; the
// parity test `formulaLimitsParity.test.ts` re-loads the Python file and
// asserts the two languages still agree.

export const SOURCE_LENGTH_MAX = 1024;
export const AST_NODE_COUNT_MAX = 256;
export const AST_DEPTH_MAX = 24;
export const DEP_COUNT_MAX = 16;
export const OUTPUT_LENGTH_MAX = 8000;
export const PER_ROW_FUSE_MAX = 1024;
