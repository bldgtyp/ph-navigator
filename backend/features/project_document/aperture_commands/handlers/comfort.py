"""Thermal-comfort parameter & flag command handlers for apertures (#72)."""

from __future__ import annotations

from starlette import status

from features.project_document.aperture_commands.handlers._shared import (
    build_audit,
    find_element,
    find_entry,
    replace_aperture,
    replace_element,
)
from features.project_document.aperture_commands.models import (
    SetApertureComfortParams,
    SetElementComfortFlags,
)
from features.project_document.document import ProjectDocumentV1
from features.shared.errors import api_error


def apply_set_aperture_comfort_params(
    body: ProjectDocumentV1,
    command: SetApertureComfortParams,
    actor_user_id: str,
    _catalog: object,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    idx, entry = find_entry(body, command.aperture_type_id)
    updates: dict[str, object] = {}
    if "sill_height_mm" in command.model_fields_set:
        updates["sill_height_mm"] = command.sill_height_mm

    next_entry = entry.model_copy(update=updates) if updates else entry
    next_body = replace_aperture(body, idx, next_entry)
    return next_body, build_audit(
        "setApertureComfortParams",
        actor_user_id,
        aperture_type_id=entry.id,
        fields=sorted(updates.keys()),
        affects_u_value=False,
    )


def apply_set_element_comfort_flags(
    body: ProjectDocumentV1,
    command: SetElementComfortFlags,
    actor_user_id: str,
    _catalog: object,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    entry_idx, entry = find_entry(body, command.aperture_type_id)
    el_idx, element = find_element(entry, command.element_id)
    if element.kind == "void":
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "aperture_comfort_void_element",
            "Void elements cannot carry thermal-comfort flags.",
            {"element_id": element.id},
        )

    comfort_exempt = command.comfort_exempt if "comfort_exempt" in command.model_fields_set else element.comfort_exempt
    comfort_exempt_reason = (
        command.comfort_exempt_reason
        if "comfort_exempt_reason" in command.model_fields_set
        else element.comfort_exempt_reason
    )
    if not comfort_exempt:
        comfort_exempt_reason = None
    elif comfort_exempt_reason is None:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "aperture_comfort_exempt_reason_required",
            "An exemption reason is required when marking a lite comfort-exempt.",
            {"element_id": element.id},
        )

    perimeter_heat = (
        command.perimeter_heat_within_3ft
        if "perimeter_heat_within_3ft" in command.model_fields_set
        else element.perimeter_heat_within_3ft
    )
    raw_note = (
        command.perimeter_heat_note
        if "perimeter_heat_note" in command.model_fields_set
        else element.perimeter_heat_note
    )
    perimeter_note = raw_note.strip() if isinstance(raw_note, str) else None
    perimeter_note = perimeter_note or None
    if not perimeter_heat:
        perimeter_note = None
    elif perimeter_note is None:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "aperture_comfort_perimeter_note_required",
            "A note describing the perimeter heating source is required.",
            {"element_id": element.id},
        )

    nfrc_u = (
        command.nfrc_whole_window_u_w_m2k
        if "nfrc_whole_window_u_w_m2k" in command.model_fields_set
        else element.nfrc_whole_window_u_w_m2k
    )
    raw_nfrc_note = (
        command.nfrc_standard_size_note
        if "nfrc_standard_size_note" in command.model_fields_set
        else element.nfrc_standard_size_note
    )
    nfrc_note = raw_nfrc_note.strip() if isinstance(raw_nfrc_note, str) else None
    nfrc_note = nfrc_note or None

    next_element = element.model_copy(
        update={
            "comfort_exempt": comfort_exempt,
            "comfort_exempt_reason": comfort_exempt_reason,
            "perimeter_heat_within_3ft": perimeter_heat,
            "perimeter_heat_note": perimeter_note,
            "nfrc_whole_window_u_w_m2k": nfrc_u,
            "nfrc_standard_size_note": nfrc_note,
        }
    )
    next_body = replace_element(body, entry_idx, entry, el_idx, next_element)
    return next_body, build_audit(
        "setElementComfortFlags",
        actor_user_id,
        aperture_type_id=entry.id,
        element_id=element.id,
        comfort_exempt=comfort_exempt,
        perimeter_heat_within_3ft=perimeter_heat,
        affects_u_value=False,
    )
