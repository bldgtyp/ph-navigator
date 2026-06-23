"""Dispatch registry for semantic envelope commands."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, cast

from psycopg import Connection
from starlette import status

from features.envelope.commands import assemblies, layers, materials
from features.envelope.models import EnvelopeCommand
from features.project_document.document import ProjectDocumentV1
from features.shared.errors import api_error

CommandHandler = Callable[[Connection[Any], ProjectDocumentV1, Any], ProjectDocumentV1]


def apply_command(conn: Connection[Any], body: ProjectDocumentV1, command: EnvelopeCommand) -> ProjectDocumentV1:
    handler = _COMMAND_HANDLERS.get(command.kind)
    if handler is None:
        # Pydantic rejects unknown kinds at the route boundary; this preserves a typed 422 if bypassed.
        raise api_error(status.HTTP_422_UNPROCESSABLE_CONTENT, "unknown_envelope_command", "Unknown envelope command.")
    return handler(conn, body, command)


def _body_only(handler: Callable[[ProjectDocumentV1, Any], ProjectDocumentV1]) -> CommandHandler:
    def wrapped(_conn: Connection[Any], body: ProjectDocumentV1, command: Any) -> ProjectDocumentV1:
        return handler(body, command)

    return wrapped


_COMMAND_HANDLERS: dict[str, CommandHandler] = {
    "create_assembly": _body_only(assemblies.create_assembly),
    "rename_assembly": _body_only(assemblies.rename_assembly),
    "update_assembly_type": _body_only(assemblies.update_assembly_type),
    "duplicate_assembly": _body_only(assemblies.duplicate_assembly),
    "delete_assembly": _body_only(assemblies.delete_assembly),
    "add_layer": _body_only(layers.add_layer),
    "update_layer_thickness": _body_only(layers.update_layer_thickness),
    "delete_layer": _body_only(layers.delete_layer),
    "add_segment": _body_only(layers.add_segment),
    "update_segment": _body_only(layers.update_segment),
    "delete_segment": _body_only(layers.delete_segment),
    "flip_orientation": _body_only(assemblies.flip_orientation),
    "flip_layers": _body_only(assemblies.flip_layers),
    "flip_segments": _body_only(assemblies.flip_segments),
    "paste_assignment": _body_only(materials.paste_assignment),
    "pick_project_material": _body_only(materials.pick_project_material),
    "pick_catalog_material": cast(CommandHandler, materials.pick_catalog_material),
    "hand_enter_material": _body_only(materials.hand_enter_material),
    "update_project_material": _body_only(materials.update_project_material),
    "update_segment_use_site_notes": _body_only(layers.update_segment_use_site_notes),
    "detach_segment_material": _body_only(materials.detach_segment_material),
    "remove_unused_project_materials": _body_only(materials.remove_unused_project_materials),
    "remove_project_material": _body_only(materials.remove_project_material),
    "refresh_project_material_from_catalog": cast(CommandHandler, materials.refresh_project_material_from_catalog),
}
