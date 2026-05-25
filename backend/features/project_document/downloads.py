"""Project-document JSON download helpers."""

from __future__ import annotations

from uuid import UUID

from features.project_document.store import get_saved_document
from features.project_document.tables import get_table_contract
from features.projects.access import ProjectAccess


def table_download_body(version_id: UUID, table_name: str, access: ProjectAccess) -> dict[str, object]:
    """Return the table's download body.

    For custom-field-capable tables (Rooms) the value is the
    `{custom_fields, rows}` envelope; bare-row tables (window_types)
    still emit a list. Callers and tests must accept both shapes.
    """
    contract = get_table_contract(table_name)
    document = get_saved_document(version_id, access)
    return {contract.name: contract.extract_rows(document)}
