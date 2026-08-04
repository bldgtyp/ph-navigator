"""Per-element handlers: name, operation, and glazed/void kind.

The name and operation handlers landed in Phase 01 because the sidebar already
exposes element-name editing as part of the per-element card; the
operation editor (Phase 07) consumes ``setElementOperation`` later but
the wire shape was fixed early so the MCP surface did not churn.
``setElementKind`` joins them for void elements in Phase 2.
"""

from __future__ import annotations

from starlette import status

from features.project_document.aperture_commands.handlers._shared import (
    build_audit,
    find_element,
    find_elements,
    find_entry,
    replace_aperture,
    replace_element,
    require_glazed_element,
)
from features.project_document.aperture_commands.models import (
    SetElementKind,
    SetElementName,
    SetElementOperation,
)
from features.project_document.apertures.factories import DefaultsCatalogReader
from features.project_document.document import (
    ApertureElementFrames,
    ApertureElementInstalls,
    ProjectDocumentV1,
)
from features.shared.errors import api_error


def apply_set_element_name(
    body: ProjectDocumentV1,
    command: SetElementName,
    actor_user_id: str,
    _catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    aperture_idx, aperture = find_entry(body, command.aperture_type_id)
    element_idx, element = find_element(aperture, command.element_id)
    new_name = command.new_name.strip()
    if not new_name:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "aperture_element_name_empty",
            "Aperture element name must not be empty.",
            {"element_id": element.id},
        )
    updated = element.model_copy(update={"name": new_name})
    next_body = replace_element(body, aperture_idx, aperture, element_idx, updated)
    return next_body, build_audit(
        "setElementName",
        actor_user_id,
        aperture_type_id=aperture.id,
        element_id=element.id,
        previous_name=element.name,
        new_name=updated.name,
        affects_u_value=False,
    )


def apply_set_element_operation(
    body: ProjectDocumentV1,
    command: SetElementOperation,
    actor_user_id: str,
    _catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    aperture_idx, aperture = find_entry(body, command.aperture_type_id)
    element_idx, element = find_element(aperture, command.element_id)
    require_glazed_element(element, action="setElementOperation")
    updated = element.model_copy(update={"operation": command.operation})
    next_body = replace_element(body, aperture_idx, aperture, element_idx, updated)
    op_payload = command.operation.model_dump(mode="json") if command.operation is not None else None
    previous = element.operation.model_dump(mode="json") if element.operation is not None else None
    return next_body, build_audit(
        "setElementOperation",
        actor_user_id,
        aperture_type_id=aperture.id,
        element_id=element.id,
        previous_operation=previous,
        new_operation=op_payload,
        # Phase 07: operation changes never invalidate the U-Value
        # cache (PRD §14). Emitting this explicitly so the Phase 09
        # content-hash skip-list is self-documenting from audit.
        affects_u_value=False,
    )


def apply_set_element_kind(
    body: ProjectDocumentV1,
    command: SetElementKind,
    actor_user_id: str,
    _catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    aperture_idx, aperture = find_entry(body, command.aperture_type_id)
    targets = find_elements(aperture, command.element_ids)
    changed_ids = list(dict.fromkeys(element.id for _, element in targets if element.kind != command.element_kind))
    changed_id_set = set(changed_ids)

    next_body = body
    if changed_ids:
        next_elements = []
        for element in aperture.elements:
            if element.id not in changed_id_set:
                next_elements.append(element)
                continue
            updates: dict[str, object] = {"kind": command.element_kind}
            if command.element_kind == "void":
                updates.update(
                    {
                        "frames": ApertureElementFrames(),
                        "installs": ApertureElementInstalls(),
                        "glazing_id": None,
                        "operation": None,
                    }
                )
            next_elements.append(element.model_copy(update=updates))
        next_aperture = aperture.model_copy(update={"elements": next_elements})
        next_body = replace_aperture(body, aperture_idx, next_aperture)
    return next_body, build_audit(
        "setElementKind",
        actor_user_id,
        aperture_type_id=aperture.id,
        element_ids=list(command.element_ids),
        changed_element_ids=changed_ids,
        element_kind=command.element_kind,
        affects_u_value=True,
    )
