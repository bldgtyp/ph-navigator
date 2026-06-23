"""Apply handler for HBJSON construction import (PRD §6 step 2)."""

from __future__ import annotations

from typing import Any

from psycopg import Connection

from features.envelope.hbjson_import import parse_or_422
from features.envelope.import_planning import build_import_plan
from features.envelope.models import ImportEnvelopeConstructionsCommand
from features.project_document.document import ProjectDocumentV1


def import_envelope_constructions(
    conn: Connection[Any],
    body: ProjectDocumentV1,
    command: ImportEnvelopeConstructionsCommand,
) -> ProjectDocumentV1:
    """Re-run the previewed import plan and return the mutated draft body.

    The whole file is parsed, matched, and validated before any write; the
    plan's single ``replace_materials_and_assemblies`` makes the apply
    all-or-nothing (no half-applied imports, unlike V1).
    """
    library = parse_or_422(command.file, current_schema_version=body.schema_version)
    plan = build_import_plan(conn, body, library, command.resolutions)
    return plan.next_body
