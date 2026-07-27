"""Membrane-layer predicate shared by the thermal engine and the geometry commands.

A membrane layer is one whose every assigned segment carries a material in
the catalog's ``membrane`` category — WRBs, vapour-control layers,
self-adhered flashings, paints. See ``MEMBRANE_CATEGORY_ID`` for why the
category exists and what excluding it from the R calculation buys.

This lives in its own module rather than in ``thermal.py`` because it is not
only a thermal concern: ``commands/layers.py`` enforces the single-segment
rule from it, and both must agree on what counts as a membrane layer.
"""

from __future__ import annotations

from collections.abc import Mapping

from starlette import status

from features.catalogs.materials.models import MEMBRANE_CATEGORY_ID
from features.project_document.document import (
    Assembly,
    AssemblyLayer,
    AssemblySegment,
    ProjectMaterial,
)
from features.shared.errors import api_error


def assigned_materials(
    layer: AssemblyLayer,
    materials_by_id: Mapping[str, ProjectMaterial],
) -> list[tuple[AssemblySegment, ProjectMaterial]]:
    """Segments of this layer that resolve to a real material, paired with it."""
    return [
        (segment, material)
        for segment in layer.segments
        if segment.project_material_id is not None
        and (material := materials_by_id.get(segment.project_material_id)) is not None
    ]


def is_membrane_material(material: ProjectMaterial) -> bool:
    """Does this material belong to the membrane category?

    ``ProjectMaterial.category`` is a free string at the document layer — it
    can arrive from the catalog, an HBJSON import, or a hand-typed field — so
    match case- and whitespace-insensitively rather than on an exact literal.
    A hand-typed "Membrane" must not silently behave differently.
    """
    return material.category.strip().casefold() == MEMBRANE_CATEGORY_ID


MEMBRANE_SINGLE_SEGMENT_ERROR = "membrane_layer_single_segment"


def is_membrane_layer(
    layer: AssemblyLayer,
    materials_by_id: Mapping[str, ProjectMaterial],
) -> bool:
    """Is every assigned segment in this layer a membrane / sheet good?

    "Every assigned segment", not "any": a layer that mixes a membrane with a
    real material still behaves like an ordinary layer rather than silently
    dropping the real material's R. Membrane layers are single-segment by
    construction (enforced in ``commands/layers.py``), so the distinction only
    guards documents built before that rule or written by hand.

    An unassigned layer is not a membrane layer — it is simply incomplete.
    """
    assigned = assigned_materials(layer, materials_by_id)
    return bool(assigned) and all(is_membrane_material(material) for _, material in assigned)


def total_thickness_mm(
    assembly: Assembly,
    materials_by_id: Mapping[str, ProjectMaterial],
) -> float:
    """Assembly build-up thickness, excluding membrane layers.

    Membranes are left out because their thickness is the one number in the
    assembly that answers to nothing the user can see or check. It does not
    move the drawing (a membrane gets a fixed band, not its real height), it
    does not move the U-value (membranes carry no R), and it does not move the
    condensation result (``sd`` is read from the material, not ``mu * d``). So
    a membrane thickness edit used to shift this total while every other
    number and the section itself stayed put.

    The cost is honest and small: a real 1.5 mm peel-and-stick or 3 mm EPDM no
    longer counts toward build-up depth. That is worth less than a total the
    user can reconcile against the layers in front of them — and it makes this
    agree with the PHPP export, which already drops membrane rows entirely.
    """
    return sum(layer.thickness_mm for layer in assembly.layers if not is_membrane_layer(layer, materials_by_id))


MEMBRANE_DEFAULT_THICKNESS_MM = 1.0


def _default_new_layer_thickness_mm() -> float:
    """The thickness a freshly added layer arrives at.

    Read off ``AddLayerCommand`` rather than restated, because the snap below
    tests equality against it: a second literal would let the two drift, and the
    failure would be silent — the snap would simply stop firing.
    """
    from features.envelope.models import AddLayerCommand

    default = AddLayerCommand.model_fields["thickness_mm"].default
    return float(default)


DEFAULT_NEW_LAYER_THICKNESS_MM = _default_new_layer_thickness_mm()


def should_snap_membrane_thickness(
    layer: AssemblyLayer,
    materials_by_id: Mapping[str, ProjectMaterial],
) -> bool:
    """Has this layer just become a membrane while still at the layer default?

    Membranes are two orders of magnitude thinner than a default layer, and the
    canvas cannot show the mistake because a membrane draws in a fixed band — a
    forgotten 100 mm WRB looks exactly like a correct one. So it is corrected on
    assignment, when the membrane-ness first becomes known.

    "Still at the default" stands in for "never edited", which is a sentinel,
    not a fact the document records. The cost is real but narrow: a membrane the
    user deliberately set to exactly the default thickness would be snapped to
    1 mm anyway. Recording an explicit unset/edited state on the layer is the
    fix if that ever bites; it needs a document schema change, so it is not one
    to make casually.
    """
    return is_membrane_layer(layer, materials_by_id) and layer.thickness_mm == DEFAULT_NEW_LAYER_THICKNESS_MM


def require_single_segment_for_membrane(layer: AssemblyLayer) -> None:
    """Guard the "membranes take exactly one segment" rule at its two entry points.

    A layer becomes a membrane layer by *material assignment*, not only by
    ``add_segment`` — so blocking the add alone left a reachable back door:
    assign a membrane to each segment of an ordinary two-segment layer and you
    land a two-segment membrane layer through the normal picker. Worse, the
    section then hides the width controls for both, so the widths that no
    longer mean anything also can no longer be fixed.

    Callers invoke this *before* the change lands, with the layer as it will be
    once the membrane is in it.
    """
    if len(layer.segments) > 1:
        raise api_error(
            status.HTTP_409_CONFLICT,
            MEMBRANE_SINGLE_SEGMENT_ERROR,
            "Membranes are continuous, so they only go in a layer with a single segment.",
            {"layer_id": layer.id, "segment_count": len(layer.segments)},
        )
