"""The ASTM E2178 check on an assembly's designated air-barrier face.

The designation says *where* the air barrier is; the material's air permeance
says *whether* it qualifies. Neither is worth much alone — together they catch
a real design-time error: "the layer you called the air barrier does not meet
the air-barrier material criterion."

Explicitly outside the condensation calculation. ISO 13788 ignores air leakage
entirely, so nothing here may reach that engine (`PRD.md` §5, decision D-11).
"""

from __future__ import annotations

from collections.abc import Mapping

from features.envelope.models import AirBarrierStatus
from features.project_document.document import Assembly, ProjectMaterial

# ASTM E2178 air-barrier *material* criterion, in the reporting unit:
# 0.02 L/(s·m²) at 75 Pa — the published 0.004 cfm/ft² threshold in SI.
AIR_BARRIER_MATERIAL_CRITERION_L_S_M2_AT_75PA = 0.02


def air_barrier_status(
    assembly: Assembly,
    materials_by_id: Mapping[str, ProjectMaterial],
) -> AirBarrierStatus | None:
    """Evaluate the designated face, or ``None`` when nothing is designated.

    "Unknown" is a distinct outcome from "passes". A face whose material has
    no recorded permeance has not been shown to qualify, and saying so is the
    point — implying a pass from missing data is exactly the failure this
    check exists to prevent.
    """
    designation = assembly.air_barrier
    if designation is None:
        return None

    layer = next((candidate for candidate in assembly.layers if candidate.id == designation.layer_id), None)
    if layer is None:
        # The document validator rejects a dangling designation at save time,
        # so this is defence in depth for direct calls.
        return AirBarrierStatus(state="unknown", layer_id=designation.layer_id, face=designation.face)

    permeances = [
        material.air_permeance_l_s_m2_at_75pa
        for segment in layer.segments
        if segment.project_material_id is not None
        and (material := materials_by_id.get(segment.project_material_id)) is not None
    ]
    recorded = [value for value in permeances if value is not None]
    if not recorded or len(recorded) < len(permeances) or not permeances:
        # Any unrecorded material on the face leaves the face unproven — the
        # leakiest material governs, so one blank is enough to withhold a pass.
        return AirBarrierStatus(state="unknown", layer_id=designation.layer_id, face=designation.face)

    # The worst material on the face governs: air finds the leakiest path.
    worst = max(recorded)
    return AirBarrierStatus(
        state="pass" if worst <= AIR_BARRIER_MATERIAL_CRITERION_L_S_M2_AT_75PA else "fail",
        layer_id=designation.layer_id,
        face=designation.face,
        air_permeance_l_s_m2_at_75pa=worst,
        criterion_l_s_m2_at_75pa=AIR_BARRIER_MATERIAL_CRITERION_L_S_M2_AT_75PA,
    )
