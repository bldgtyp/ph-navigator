"""Parser / resolver / cycle-detection exception types.

These are *internal* Python exceptions raised by `parse`, `resolve_refs`,
and `detect_cycles`. The schema-mutation service translates them to
`api_error(..., custom_field_formula_*, ...)` envelopes at the REST /
MCP boundary; the evaluator's user-facing error tier is the structured
`EvalError(code=...)` value, not these exceptions.
"""

from __future__ import annotations

from typing import Literal


class FormulaParseError(Exception):
    """Raised by the parser when the source violates the grammar."""

    def __init__(self, message: str, offset: int, source: str) -> None:
        super().__init__(message)
        self.message = message
        self.offset = offset
        self.source = source


class FormulaResourceLimitError(Exception):
    """Raised at parse time when a D23 limit is breached."""

    LimitName = Literal[
        "source_length",
        "ast_node_count",
        "ast_depth",
        "dep_count",
        "output_length",
        "per_row_budget",
    ]

    def __init__(self, limit_name: LimitName, actual: int, max_value: int) -> None:
        super().__init__(f"formula {limit_name} limit exceeded: {actual}/{max_value}")
        self.limit_name = limit_name
        self.actual = actual
        self.max_value = max_value


class FormulaUnsupportedFunctionError(Exception):
    """Raised at parse time on an unknown function name."""

    def __init__(
        self,
        function_name: str,
        available: tuple[str, ...],
        *,
        error_code: str = "custom_field_formula_unsupported_function",
    ) -> None:
        super().__init__(f"unsupported formula function: {function_name!r}")
        self.function_name = function_name
        self.available = available
        self.error_code = error_code


class FormulaInvalidLinkedArgError(Exception):
    """Raised when linked/linked_from arguments violate the Phase 3 grammar."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class FormulaMissingRefError(Exception):
    """Raised at resolve time when a {Display Name} ref does not resolve."""

    def __init__(self, display_name: str) -> None:
        super().__init__(f"missing formula field reference: {display_name!r}")
        self.display_name = display_name


class FormulaCycleError(Exception):
    """Raised at commit time when the formula dep graph contains a cycle."""

    def __init__(self, cycle_path: tuple[str, ...]) -> None:
        super().__init__(f"formula cycle: {' -> '.join(cycle_path)}")
        self.cycle_path = cycle_path
