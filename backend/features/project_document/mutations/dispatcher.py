"""`apply_schema_mutation` / `validate_schema_mutation` dispatcher.

Routes a typed `FieldSchemaMutation` to the matching per-kind handler
through a `kind` -> handler lookup, then re-validates the resulting
document. Adding a new mutation kind means writing its handler in the
appropriate `*_ops.py` module and adding one entry to `_HANDLERS`.

`validate_document` is intentionally imported into this module
(rather than referenced through a deeper path) so tests can
monkey-patch it on the dispatcher module to assert it's called on
every applied mutation.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import cast

from starlette import status

from features.project_document.document import ProjectDocumentV1
from features.project_document.mutations.bundle import apply_edit_field_bundle
from features.project_document.mutations.field_ops import (
    apply_add_field,
    apply_delete_field,
    apply_duplicate_field,
    apply_rename_field,
    apply_set_description,
)
from features.project_document.mutations.formula_ops import apply_set_formula
from features.project_document.mutations.guards import check_stale_fingerprint
from features.project_document.mutations.models import FieldSchemaMutation
from features.project_document.mutations.options_ops import apply_edit_options
from features.project_document.mutations.type_conversion import apply_change_type
from features.project_document.tables.contracts import TableFieldRegistry
from features.project_document.validation import validate_document
from features.shared.errors import api_error

__all__ = ["apply_schema_mutation", "validate_schema_mutation"]

_VALIDATE_ONLY_ACTOR = "__validate_only__"

# Handler signature: every dispatcher accepts the body, the (already
# discriminated) mutation, the actor user id, and the table's
# `TableFieldRegistry`. Handlers that don't need the actor accept it
# anyway so dispatch is uniform.
_Handler = Callable[
    [ProjectDocumentV1, FieldSchemaMutation, str, TableFieldRegistry],
    tuple[ProjectDocumentV1, dict[str, object]],
]


def _add_field(body, mut, actor, cap):  # type: ignore[no-untyped-def]
    return apply_add_field(body, mut, actor, cap)


def _rename_field(body, mut, _actor, cap):  # type: ignore[no-untyped-def]
    return apply_rename_field(body, mut, cap)


def _delete_field(body, mut, _actor, cap):  # type: ignore[no-untyped-def]
    return apply_delete_field(body, mut, cap)


def _duplicate_field(body, mut, actor, cap):  # type: ignore[no-untyped-def]
    return apply_duplicate_field(body, mut, actor, cap)


def _set_description(body, mut, _actor, cap):  # type: ignore[no-untyped-def]
    return apply_set_description(body, mut, cap)


def _edit_options(body, mut, _actor, cap):  # type: ignore[no-untyped-def]
    return apply_edit_options(body, mut, cap)


def _change_type(body, mut, _actor, cap):  # type: ignore[no-untyped-def]
    return apply_change_type(body, mut, cap)


def _set_formula(body, mut, _actor, cap):  # type: ignore[no-untyped-def]
    return apply_set_formula(body, mut, cap)


def _edit_field_bundle(body, mut, _actor, cap):  # type: ignore[no-untyped-def]
    return apply_edit_field_bundle(body, mut, cap)


_HANDLERS: dict[str, _Handler] = {
    "addField": cast(_Handler, _add_field),
    "renameField": cast(_Handler, _rename_field),
    "deleteField": cast(_Handler, _delete_field),
    "duplicateField": cast(_Handler, _duplicate_field),
    "setDescription": cast(_Handler, _set_description),
    "editOptions": cast(_Handler, _edit_options),
    "changeType": cast(_Handler, _change_type),
    "setFormula": cast(_Handler, _set_formula),
    "editFieldBundle": cast(_Handler, _edit_field_bundle),
}


def apply_schema_mutation(
    body: ProjectDocumentV1,
    mutation: FieldSchemaMutation,
    *,
    actor_user_id: str,
    capability: TableFieldRegistry,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    """Apply one `FieldSchemaMutation` to `body`, return (next_body, audit).

    Rejections raise `features.shared.errors.api_error`; no partial body
    is produced. Final `validate_document` ensures any per-table check
    that slipped past the preflight surfaces here.
    """
    check_stale_fingerprint(body, mutation, capability)

    handler = _HANDLERS.get(mutation.kind)
    if handler is None:
        # Defensive — every discriminator branch is registered above; this
        # only fires if the union grows without a matching dispatcher.
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "custom_field_unsupported_mutation",
            "Unknown custom-field mutation kind.",
            {"kind": mutation.kind},
        )

    next_body, audit = handler(body, mutation, actor_user_id, capability)
    validated = validate_document(next_body.model_dump(mode="json"))
    return validated, audit


def validate_schema_mutation(
    body: ProjectDocumentV1,
    mutation: FieldSchemaMutation,
    *,
    capability: TableFieldRegistry,
) -> None:
    """Run schema-mutation preflight without committing the result.

    Delegating to `apply_schema_mutation` keeps dry-run validation in
    lockstep with the write path.
    """
    apply_schema_mutation(
        body,
        mutation,
        actor_user_id=_VALIDATE_ONLY_ACTOR,
        capability=capability,
    )
