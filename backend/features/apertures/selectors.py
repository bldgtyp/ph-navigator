"""Pure read-model selectors over aperture product tables."""

from __future__ import annotations

from features.apertures.models import (
    ProjectFrameRead,
    ProjectFrameUseSite,
    ProjectGlazingRead,
    ProjectGlazingUseSite,
)
from features.project_document.aperture_commands.models import APERTURE_SIDES
from features.project_document.document import ProjectDocumentV1


def build_apertures_read_parts(body: ProjectDocumentV1) -> tuple[list[ProjectGlazingRead], list[ProjectFrameRead]]:
    """Build report-page read DTOs from one pass over aperture elements."""
    use_sites_by_glazing: dict[str, list[ProjectGlazingUseSite]] = {}
    use_sites_by_frame: dict[str, list[ProjectFrameUseSite]] = {}

    for aperture in body.tables.apertures:
        for element in aperture.elements:
            if element.glazing_id is not None:
                use_sites_by_glazing.setdefault(element.glazing_id, []).append(
                    ProjectGlazingUseSite(
                        aperture_type_id=aperture.id,
                        aperture_type_name=aperture.name,
                        element_id=element.id,
                        element_name=element.name,
                    )
                )
            for side in APERTURE_SIDES:
                frame_id = getattr(element.frames, side)
                if frame_id is None:
                    continue
                use_sites_by_frame.setdefault(frame_id, []).append(
                    ProjectFrameUseSite(
                        aperture_type_id=aperture.id,
                        aperture_type_name=aperture.name,
                        element_id=element.id,
                        element_name=element.name,
                        side=side,
                    )
                )

    glazings = [
        ProjectGlazingRead(
            **glazing.model_dump(mode="python"),
            use_sites=use_sites_by_glazing.get(glazing.id, []),
        )
        for glazing in body.tables.project_glazings
    ]
    frames = [
        ProjectFrameRead(
            **frame.model_dump(mode="python"),
            use_sites=use_sites_by_frame.get(frame.id, []),
        )
        for frame in body.tables.project_frames
    ]
    return glazings, frames
