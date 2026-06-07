"""`apply_aperture_command` — single dispatch entry point for aperture edits.

Mirrors the `mutations/dispatcher.py` shape (handler lookup → handler →
final `validate_document`) so the audit envelope and validation contract
stay aligned across the schema-mutation and aperture-command surfaces.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import cast

from starlette import status

from features.project_document.aperture_commands.handlers.dimensions import (
    apply_add_column,
    apply_add_row,
    apply_delete_column,
    apply_delete_row,
    apply_edit_dimension,
)
from features.project_document.aperture_commands.handlers.element import (
    apply_set_element_name,
    apply_set_element_operation,
)
from features.project_document.aperture_commands.handlers.manufacturer_filters import (
    apply_set_manufacturer_filters,
)
from features.project_document.aperture_commands.handlers.merge_split import (
    apply_merge_elements,
    apply_split_element,
)
from features.project_document.aperture_commands.handlers.paste import (
    apply_paste_assignment,
)
from features.project_document.aperture_commands.handlers.picks import (
    apply_pick_frame,
    apply_pick_glazing,
)
from features.project_document.aperture_commands.handlers.refresh import (
    apply_refresh_ref_from_catalog,
)
from features.project_document.aperture_commands.handlers.sidebar import (
    apply_create_aperture_type,
    apply_delete_aperture_type,
    apply_duplicate_aperture_type,
    apply_rename_aperture_type,
)
from features.project_document.aperture_commands.models import ApertureCommand
from features.project_document.apertures.factories import DefaultsCatalogReader
from features.project_document.document import ProjectDocumentV1
from features.project_document.validation import validate_document
from features.shared.errors import api_error

_Handler = Callable[
    [ProjectDocumentV1, ApertureCommand, str, DefaultsCatalogReader],
    tuple[ProjectDocumentV1, dict[str, object]],
]

_HANDLERS: dict[str, _Handler] = {
    "createApertureType": cast(_Handler, apply_create_aperture_type),
    "renameApertureType": cast(_Handler, apply_rename_aperture_type),
    "duplicateApertureType": cast(_Handler, apply_duplicate_aperture_type),
    "deleteApertureType": cast(_Handler, apply_delete_aperture_type),
    "setElementName": cast(_Handler, apply_set_element_name),
    "setElementOperation": cast(_Handler, apply_set_element_operation),
    "editDimension": cast(_Handler, apply_edit_dimension),
    "addRow": cast(_Handler, apply_add_row),
    "addColumn": cast(_Handler, apply_add_column),
    "deleteRow": cast(_Handler, apply_delete_row),
    "deleteColumn": cast(_Handler, apply_delete_column),
    "pickFrame": cast(_Handler, apply_pick_frame),
    "pickGlazing": cast(_Handler, apply_pick_glazing),
    "mergeElements": cast(_Handler, apply_merge_elements),
    "splitElement": cast(_Handler, apply_split_element),
    "pasteAssignment": cast(_Handler, apply_paste_assignment),
    "setManufacturerFilters": cast(_Handler, apply_set_manufacturer_filters),
    "refreshRefFromCatalog": cast(_Handler, apply_refresh_ref_from_catalog),
}

# Commands declared in the union but intentionally not wired up.
_NOT_IMPLEMENTED_KINDS: frozenset[str] = frozenset({"editFieldOverride"})


def apply_aperture_command(
    body: ProjectDocumentV1,
    command: ApertureCommand,
    *,
    actor_user_id: str,
    catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    kind = command.kind  # type: ignore[union-attr]
    if kind in _NOT_IMPLEMENTED_KINDS:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "aperture_command_not_implemented",
            "This aperture command is reserved but its handler ships in a later phase.",
            {"kind": kind},
        )
    handler = _HANDLERS.get(kind)
    if handler is None:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "aperture_command_unsupported_kind",
            "Unknown aperture command kind.",
            {"kind": kind},
        )
    next_body, audit = handler(body, command, actor_user_id, catalog)
    validated = validate_document(next_body.model_dump(mode="json"))
    return validated, audit
