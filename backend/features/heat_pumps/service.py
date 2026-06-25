"""Service rules for the Heat Pumps equipment slice.

Heat-pump writes and reads go through the generic registered-contract path (the
four leaf `TableContract`s) and the shared write spine — exactly like every other
equipment table. The only heat-pump-specific server surface left is the Phius
export, which needs a read-only view of the assembled slice; everything else
(add / replace / delete, the delete-cascade, the dry-run preview, option editing)
is a generic `TableContract` capability (see `tables/dependent_links.py` and the
`editOptions` schema mutation).
"""

from __future__ import annotations

from uuid import UUID

from starlette import status

from database import connection
from features.heat_pumps import repository
from features.heat_pumps.models import HeatPumpsTableSlice
from features.project_document.service import get_current_document_view
from features.projects.access import ProjectAccess
from features.shared.errors import api_error


def active_version_id_for_project(project_id: UUID) -> UUID:
    with connection() as conn:
        version_id = repository.get_active_version_id(conn, project_id)
    if version_id is None:
        raise api_error(
            status.HTTP_404_NOT_FOUND,
            "project_active_version_not_found",
            "Active project version not found.",
        )
    return version_id


def read_slice(version_id: UUID, access: ProjectAccess) -> HeatPumpsTableSlice:
    """Read-only view of the heat-pump slice for downstream computations (e.g. Phius export)."""

    return get_current_document_view(version_id, access).body.tables.equipment.heat_pumps
