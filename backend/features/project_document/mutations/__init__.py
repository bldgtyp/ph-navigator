"""Custom-field schema mutations.

Wire contracts live in `models`; the per-kind dispatchers live in
`field_ops`, `options_ops`, `type_conversion`, `formula_ops`, and
`bundle`; shared validation guards live in `guards`; and the
`apply_schema_mutation` / `validate_schema_mutation` entry points
live in `dispatcher`.

This package re-exports the public API used by `drafts.py`, `mcp/`,
the routes layer, and tests. To add a new mutation kind: register
its Pydantic model in `models.py`, write its `apply_*` handler in
the appropriate ops module, and add one entry to `_HANDLERS` in
`dispatcher.py`.
"""

from __future__ import annotations

from features.project_document.mutations.dispatcher import (
    apply_schema_mutation,
    validate_schema_mutation,
)
from features.project_document.mutations.models import (
    AUDIT_KIND_BY_MUTATION,
    CONVERSION_MATRIX,
    TEXT_TO_SINGLE_SELECT_OPTION_CAP,
    AddFieldMutation,
    ChangeTypeMutation,
    ConversionPolicy,
    DeleteFieldMutation,
    DuplicateFieldMutation,
    EditFieldBundleMutation,
    EditOptionsMutation,
    FieldSchemaMutation,
    RenameFieldMutation,
    SetDescriptionMutation,
    SetFormulaMutation,
)

__all__ = [
    "AUDIT_KIND_BY_MUTATION",
    "AddFieldMutation",
    "CONVERSION_MATRIX",
    "ChangeTypeMutation",
    "ConversionPolicy",
    "DeleteFieldMutation",
    "DuplicateFieldMutation",
    "EditFieldBundleMutation",
    "EditOptionsMutation",
    "FieldSchemaMutation",
    "RenameFieldMutation",
    "SetDescriptionMutation",
    "SetFormulaMutation",
    "TEXT_TO_SINGLE_SELECT_OPTION_CAP",
    "apply_schema_mutation",
    "validate_schema_mutation",
]
