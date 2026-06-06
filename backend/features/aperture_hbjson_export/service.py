"""HBJSON ``WindowConstruction`` export for the Apertures feature.

Each aperture-element becomes a ``WindowConstruction`` with one
``EnergyWindowMaterialSimpleGlazSys`` material whose ``u_factor`` is
the per-element ISO 10077-1 value from Phase 09 and whose ``shgc`` is
the element's glazing ``g_value`` (V1 default ``0.5`` if null).

The output dict shape is the minimal stable subset of honeybee_energy's
``WindowConstruction.to_dict()`` — type / identifier / materials — that
``WindowConstruction.from_dict()`` accepts on the Rhino / honeybee_ph
consumer side. The optional ``properties`` / ``display_name`` / etc.
fields are intentionally omitted: honeybee_energy generates per-call
random ``ref`` ids inside ``properties``, which would make the payload
non-deterministic. ``from_dict`` treats those fields as optional.

VT (visible transmittance) is hardcoded to ``0.6`` until a real VT
catalog field exists (PRD §17; V1 parity).

Identifier construction:

    f"{escape(aperture.name)}_C{element.column_span[0]}_R{element.row_span[0]}"

Two elements that escape to the same identifier are a hard error —
the caller must rename one aperture.
"""

from __future__ import annotations

from typing import Any

from features.aperture_hbjson_export.identifiers import (
    detect_collisions,
    escape_hbjson_identifier,
)
from features.aperture_u_value.service import calculate_aperture_u_values
from features.project_document.document import (
    ApertureElement,
    ApertureTypeEntry,
    ProjectDocumentV1,
)
from features.shared.errors import api_error

_DEFAULT_VT = 0.6
_DEFAULT_SHGC = 0.5  # V1 fallback when glazing.g_value is null.


def export_aperture_window_constructions(body: ProjectDocumentV1) -> dict[str, dict[str, Any]]:
    """Return ``{escaped_identifier: WindowConstruction.to_dict()}`` for the
    apertures table of a document body. See ``export_apertures`` for the
    lower-level entry point that callers can use with a bare list."""

    return export_apertures(body.tables.apertures)


def export_apertures(apertures: list[ApertureTypeEntry]) -> dict[str, dict[str, Any]]:
    """Lower-level entry point that operates on an apertures list directly.

    Raises ``aperture_hbjson_identifier_collision`` (422) if any two
    elements would emit the same identifier, naming both source
    apertures in the detail.
    """

    identifiers: list[tuple[str, str]] = []
    payloads: dict[str, dict[str, Any]] = {}

    for entry in apertures:
        escaped_name = escape_hbjson_identifier(entry.name)
        u_values = calculate_aperture_u_values(entry)
        u_by_element = {e.element_id: e.u_value_w_m2k for e in u_values.elements}

        for element in entry.elements:
            ident = _element_identifier(escaped_name, element)
            identifiers.append((ident, entry.name))
            payloads[ident] = _build_construction_dict(
                identifier=ident,
                u_factor=u_by_element.get(element.id, 0.0),
                shgc=_glazing_shgc(element),
                vt=_DEFAULT_VT,
            )

    collisions = detect_collisions(identifiers)
    if collisions:
        raise api_error(
            422,
            "aperture_hbjson_identifier_collision",
            "Two aperture elements would export with the same Honeybee identifier. Rename one of the apertures.",
            {"collisions": [c.model_dump() for c in collisions]},
        )

    return payloads


def _element_identifier(escaped_aperture_name: str, element: ApertureElement) -> str:
    column = element.column_span[0]
    row = element.row_span[0]
    return f"{escaped_aperture_name}_C{column}_R{row}"


def _glazing_shgc(element: ApertureElement) -> float:
    if element.glazing is None or element.glazing.g_value is None:
        return _DEFAULT_SHGC
    return element.glazing.g_value


def _build_construction_dict(
    *,
    identifier: str,
    u_factor: float,
    shgc: float,
    vt: float,
) -> dict[str, Any]:
    material: dict[str, Any] = {
        "type": "EnergyWindowMaterialSimpleGlazSys",
        "identifier": f"{identifier}_GlazSys",
        "u_factor": round(u_factor, 4),
        "shgc": round(shgc, 4),
        "vt": vt,
    }
    return {
        "type": "WindowConstruction",
        "identifier": identifier,
        "materials": [material],
    }
