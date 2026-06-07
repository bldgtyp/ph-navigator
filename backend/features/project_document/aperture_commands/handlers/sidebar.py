"""Sidebar-level handlers: create / rename / duplicate / delete an aperture type.

Sidebar gestures are the entry point for almost every other command —
nothing else can happen until at least one aperture type exists, so
these handlers ship first and stay the simplest. Naming is
case-insensitive trimmed (matching the document validator) so a "Type A"
already in the list blocks "  type a  ".
"""

from __future__ import annotations

import uuid

from starlette import status

from features.project_document.aperture_commands.handlers._shared import (
    build_audit,
    find_entry,
)
from features.project_document.aperture_commands.models import (
    CreateApertureType,
    DeleteApertureType,
    DuplicateApertureType,
    RenameApertureType,
)
from features.project_document.apertures.factories import (
    DefaultsCatalogReader,
    build_default_aperture_type,
)
from features.project_document.custom_fields import normalize_display_name
from features.project_document.document import (
    ApertureElement,
    ApertureTypeEntry,
    ProjectDocumentV1,
)
from features.shared.errors import api_error

DEFAULT_NEW_NAME = "Unnamed Aperture Type"


def apply_create_aperture_type(
    body: ProjectDocumentV1,
    command: CreateApertureType,
    actor_user_id: str,
    catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    name = _autoname(body, command.proposed_name)
    entry = build_default_aperture_type(catalog, name=name)
    next_apertures = [*body.tables.apertures, entry]
    next_body = body.model_copy(update={"tables": body.tables.model_copy(update={"apertures": next_apertures})})
    return next_body, build_audit("createApertureType", actor_user_id, aperture_type_id=entry.id, name=entry.name)


def apply_rename_aperture_type(
    body: ProjectDocumentV1,
    command: RenameApertureType,
    actor_user_id: str,
    _catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    new_name = command.new_name.strip()
    target_idx, target = find_entry(body, command.aperture_type_id)
    normalized_new = normalize_display_name(new_name)
    for other_idx, other in enumerate(body.tables.apertures):
        if other_idx == target_idx:
            continue
        if normalize_display_name(other.name) == normalized_new:
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "aperture_name_collision",
                "Another aperture type already uses this name.",
                {"aperture_type_id": other.id, "name": other.name},
            )
    updated = target.model_copy(update={"name": new_name})
    next_apertures = list(body.tables.apertures)
    next_apertures[target_idx] = updated
    next_body = body.model_copy(update={"tables": body.tables.model_copy(update={"apertures": next_apertures})})
    return next_body, build_audit(
        "renameApertureType",
        actor_user_id,
        aperture_type_id=updated.id,
        previous_name=target.name,
        new_name=updated.name,
    )


def apply_duplicate_aperture_type(
    body: ProjectDocumentV1,
    command: DuplicateApertureType,
    actor_user_id: str,
    _catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    _, source = find_entry(body, command.aperture_type_id)
    proposed = command.new_name or f"{source.name} (copy)"
    new_name = _autoname(body, proposed)
    new_id = f"apt_{_short_uuid()}"
    cloned_elements = [
        ApertureElement.model_validate(
            element.model_copy(update={"id": f"aptel_{_short_uuid()}"}).model_dump(mode="json")
        )
        for element in source.elements
    ]
    duplicate = ApertureTypeEntry(
        id=new_id,
        name=new_name,
        row_heights_mm=list(source.row_heights_mm),
        column_widths_mm=list(source.column_widths_mm),
        elements=cloned_elements,
    )
    next_apertures = [*body.tables.apertures, duplicate]
    next_body = body.model_copy(update={"tables": body.tables.model_copy(update={"apertures": next_apertures})})
    return next_body, build_audit(
        "duplicateApertureType",
        actor_user_id,
        aperture_type_id=duplicate.id,
        source_aperture_type_id=source.id,
        name=duplicate.name,
    )


def apply_delete_aperture_type(
    body: ProjectDocumentV1,
    command: DeleteApertureType,
    actor_user_id: str,
    _catalog: DefaultsCatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    target_idx, target = find_entry(body, command.aperture_type_id)
    next_apertures = [*body.tables.apertures[:target_idx], *body.tables.apertures[target_idx + 1 :]]
    next_body = body.model_copy(update={"tables": body.tables.model_copy(update={"apertures": next_apertures})})
    return next_body, build_audit(
        "deleteApertureType",
        actor_user_id,
        aperture_type_id=target.id,
        name=target.name,
    )


def _autoname(body: ProjectDocumentV1, proposed: str | None) -> str:
    base = (proposed or DEFAULT_NEW_NAME).strip() or DEFAULT_NEW_NAME
    existing_by_norm = {normalize_display_name(entry.name): entry.name for entry in body.tables.apertures}
    if normalize_display_name(base) not in existing_by_norm:
        return base
    # On collision, suffix-search starts from the existing entry's
    # display casing so "type a" against an existing "Type A" becomes
    # "Type A (2)" rather than "type a (2)".
    canonical_base = existing_by_norm[normalize_display_name(base)]
    suffix = 2
    while True:
        candidate = f"{canonical_base} ({suffix})"
        if normalize_display_name(candidate) not in existing_by_norm:
            return candidate
        suffix += 1


def _short_uuid() -> str:
    return uuid.uuid4().hex[:12]
