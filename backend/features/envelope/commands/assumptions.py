"""Commands over the document's versioned calculation assumptions.

These are project-wide settings rather than per-element edits, but they are
still document state: they must travel with a saved version, because a
version's U-values are only meaningful alongside the convention that produced
them.
"""

from __future__ import annotations

from starlette import status

from features.envelope.models import SetThermalStandardCommand
from features.envelope.surface_film_store import (
    SurfaceFilmTableUnavailableError,
    surface_film_table,
)
from features.project_document.document import ProjectDocumentV1
from features.shared.errors import api_error


def set_thermal_standard(
    body: ProjectDocumentV1,
    command: SetThermalStandardCommand,
) -> ProjectDocumentV1:
    """Switch the project's surface-film convention.

    Rejects a standard with no published table *here*, at the write, rather
    than letting it be stored and then fail on every subsequent thermal
    request. The document should never name a convention this deployment
    cannot actually calculate.
    """
    try:
        surface_film_table(command.thermal_standard)
    except SurfaceFilmTableUnavailableError as error:
        raise api_error(
            status.HTTP_409_CONFLICT,
            "surface_film_table_unavailable",
            "That thermal standard has no published surface-film table on this deployment.",
            {"thermal_standard": command.thermal_standard},
        ) from error

    assumptions = body.tables.resolved_assumptions().model_copy(
        update={"thermal_standard": command.thermal_standard},
    )
    return body.model_copy(update={"tables": body.tables.model_copy(update={"assumptions": assumptions})})
