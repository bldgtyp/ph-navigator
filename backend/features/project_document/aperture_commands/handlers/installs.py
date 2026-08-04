"""Install-assignment handlers: setElementInstall, applyInstallToApertures,
copyElementInstalls.

All three write the per-side ``installs`` slots introduced by
aperture-psi-install phase 01. Assignments are only meaningful on
**perimeter** edges of **glazed** elements — interior (mulled) sides are
derived Ψ=0 (D-3) and are rejected on direct assignment / skipped by the
bulk paths. ``install_type_id=None`` clears a slot back to inheriting the
project Default row.
"""

from __future__ import annotations

from starlette import status

from features.project_document.aperture_commands.handlers._shared import (
    build_audit,
    find_element,
    find_entry,
    replace_aperture,
    replace_element,
    require_glazed_element,
)
from features.project_document.aperture_commands.models import (
    APERTURE_SIDES,
    ApplyInstallToApertures,
    CopyElementInstalls,
    SetElementInstall,
)
from features.project_document.apertures.edge_classification import classify_element_edges
from features.project_document.apertures.factories import DefaultsCatalogReader
from features.project_document.document import (
    ApertureElement,
    ApertureElementInstalls,
    ApertureTypeEntry,
    ProjectDocumentV1,
)
from features.shared.errors import api_error


def apply_set_element_install(
    body: ProjectDocumentV1,
    command: SetElementInstall,
    actor_user_id: str,
    _catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    aperture_idx, aperture = find_entry(body, command.aperture_type_id)
    element_idx, element = find_element(aperture, command.element_id)
    require_glazed_element(element, action="setElementInstall")
    _require_known_install_type(body, command.install_type_id)
    if classify_element_edges(aperture)[(element.id, command.side)] == "interior":
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "aperture_install_side_is_interior",
            "Interior (mulled) edges are derived Psi=0 and cannot carry an install assignment.",
            {"element_id": element.id, "side": command.side},
        )
    previous = getattr(element.installs, command.side)
    next_installs = element.installs.model_copy(update={command.side: command.install_type_id})
    next_element = element.model_copy(update={"installs": next_installs})
    next_body = replace_element(body, aperture_idx, aperture, element_idx, next_element)
    return next_body, build_audit(
        "setElementInstall",
        actor_user_id,
        aperture_type_id=aperture.id,
        element_id=element.id,
        side=command.side,
        previous_install_type_id=previous,
        install_type_id=command.install_type_id,
        affects_u_value=False,
    )


def apply_install_to_apertures(
    body: ProjectDocumentV1,
    command: ApplyInstallToApertures,
    actor_user_id: str,
    _catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    _require_known_install_type(body, command.install_type_id)
    unique_ids = list(dict.fromkeys(command.aperture_ids))
    next_body = body
    for aperture_id in unique_ids:
        aperture_idx, aperture = find_entry(next_body, aperture_id)
        next_aperture = _apply_uniform_install(aperture, command.install_type_id)
        next_body = replace_aperture(next_body, aperture_idx, next_aperture)
    return next_body, build_audit(
        "applyInstallToApertures",
        actor_user_id,
        aperture_ids=unique_ids,
        install_type_id=command.install_type_id,
        affects_u_value=False,
    )


def apply_copy_element_installs(
    body: ProjectDocumentV1,
    command: CopyElementInstalls,
    actor_user_id: str,
    _catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    _, source = find_entry(body, command.source_aperture_id)
    if command.source_aperture_id in command.target_aperture_ids:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "aperture_installs_copy_target_is_source",
            "A copy target may not be the source aperture.",
            {"source_aperture_id": command.source_aperture_id},
        )
    source_signature = _grid_signature(source)
    installs_by_position = {(element.row_span, element.column_span): element.installs for element in source.elements}
    unique_targets = list(dict.fromkeys(command.target_aperture_ids))
    next_body = body
    for target_id in unique_targets:
        target_idx, target = find_entry(next_body, target_id)
        if _grid_signature(target) != source_signature:
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "aperture_installs_copy_grid_mismatch",
                "Install assignments can only be copied between apertures with identical grids.",
                {"source_aperture_id": source.id, "target_aperture_id": target_id},
            )
        next_elements = [
            element.model_copy(
                update={"installs": installs_by_position[(element.row_span, element.column_span)].model_copy()}
            )
            for element in target.elements
        ]
        next_body = replace_aperture(next_body, target_idx, target.model_copy(update={"elements": next_elements}))
    return next_body, build_audit(
        "copyElementInstalls",
        actor_user_id,
        source_aperture_id=source.id,
        target_aperture_ids=unique_targets,
        affects_u_value=False,
    )


def _grid_signature(aperture: ApertureTypeEntry) -> tuple[tuple[int, ...], ...]:
    """Position-and-kind fingerprint deciding whether installs copy 1:1.

    Two apertures share a signature when their grids have the same
    dimension counts and their elements tile the same spans with the same
    kinds — exact mm dimensions may differ (a wider instance of the same
    layout still receives the same install pattern).
    """
    element_cells = tuple(
        sorted(
            (*element.row_span, *element.column_span, 1 if element.kind == "glazed" else 0)
            for element in aperture.elements
        )
    )
    return (
        (len(aperture.row_heights_mm), len(aperture.column_widths_mm)),
        *element_cells,
    )


def _apply_uniform_install(aperture: ApertureTypeEntry, install_type_id: str | None) -> ApertureTypeEntry:
    classes = classify_element_edges(aperture)
    next_elements: list[ApertureElement] = []
    for element in aperture.elements:
        if element.kind != "glazed":
            next_elements.append(element)
            continue
        slots = {
            side: install_type_id if classes[(element.id, side)] == "perimeter" else None for side in APERTURE_SIDES
        }
        next_elements.append(element.model_copy(update={"installs": ApertureElementInstalls(**slots)}))
    return aperture.model_copy(update={"elements": next_elements})


def _require_known_install_type(body: ProjectDocumentV1, install_type_id: str | None) -> None:
    if install_type_id is None:
        return
    if any(row.id == install_type_id for row in body.tables.aperture_install_types.rows):
        return
    raise api_error(
        status.HTTP_404_NOT_FOUND,
        "aperture_install_type_not_found",
        "No install type matches the requested id.",
        {"install_type_id": install_type_id},
    )


__all__ = [
    "apply_copy_element_installs",
    "apply_install_to_apertures",
    "apply_set_element_install",
]
