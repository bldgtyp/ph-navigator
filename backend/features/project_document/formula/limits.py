"""Hard resource limits for formula parse / evaluate (plan-13 D17 / D23).

Single source of truth. The TypeScript port reads parallel constants
from `frontend/.../lib/formula/limits.ts`; a small parity test asserts
the two language files agree.
"""

from __future__ import annotations

# Maximum length, in characters, of a formula's user-facing source.
SOURCE_LENGTH_MAX = 1024

# Maximum number of AST nodes in a parsed formula (sum across all
# expression and call sub-trees).
AST_NODE_COUNT_MAX = 256

# Maximum nesting depth of the AST.
AST_DEPTH_MAX = 24

# Maximum number of distinct field references in one formula.
DEP_COUNT_MAX = 16

# Maximum length, in characters, of a successful formula's string result.
OUTPUT_LENGTH_MAX = 8000

# Per-row evaluation budget expressed as a deterministic count of AST
# nodes evaluated. Naming intentionally separates "budget" from a
# wall-clock millisecond figure: corpus parity requires every evaluator
# run on the same AST + row to terminate identically, which a
# wall-clock timer cannot guarantee.
PER_ROW_FUSE_MAX = 1024
