# -*- Python Version: 3.11 -*-

"""Convert Aperture data to Honeybee-Energy WindowConstruction objects.

Each aperture element becomes a WindowConstruction with a single
EnergyWindowMaterialSimpleGlazSys material. The material's u_factor is the
element's overall window U-value (ISO 10077-1), and the shgc comes from
the element's glazing g-value.

This mirrors the assembly → OpaqueConstruction pattern in
features/assembly/services/to_hbe_construction.py.
"""

import json
import logging

from db_entities.aperture.aperture import Aperture
from db_entities.aperture.aperture_element import ApertureElement
from features.aperture.services.aperture import get_apertures_by_project_bt
from features.aperture.services.window_u_value import calculate_aperture_u_value
from honeybee_energy.construction.window import WindowConstruction
from honeybee_energy.material.glazing import EnergyWindowMaterialSimpleGlazSys
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# Default visible transmittance (matching GH reference code)
_DEFAULT_VT = 0.6


def _element_identifier(aperture_name: str, element: ApertureElement) -> str:
    """Build a unique identifier for an aperture element.

    Format: "{aperture_name}_C{col}_R{row}"
    """
    return f"{aperture_name}_C{element.column_number}_R{element.row_number}"


def convert_aperture_element_to_hbe_window_construction(
    aperture_name: str,
    element: ApertureElement,
    element_u_value: float,
) -> WindowConstruction | None:
    """Convert a single aperture element to an HB-Energy WindowConstruction.

    Returns None if the element has no glazing type assigned.
    """
    if element.glazing is None or element.glazing.glazing_type is None:
        logger.warning(
            f"Element {element.id} has no glazing type, skipping HB conversion"
        )
        return None

    identifier = _element_identifier(aperture_name, element)
    g_value = element.glazing.glazing_type.g_value

    material = EnergyWindowMaterialSimpleGlazSys(
        identifier=f"{identifier}_GlazSys",
        u_factor=element_u_value,
        shgc=g_value,
        vt=_DEFAULT_VT,
    )

    return WindowConstruction(identifier=identifier, materials=[material])


def convert_apertures_to_hbe_window_constructions(
    apertures: list[Aperture],
) -> list[WindowConstruction]:
    """Convert all apertures to HB-Energy WindowConstruction objects.

    For each aperture, calculates per-element U-values using the existing
    ISO 10077-1 service, then creates a WindowConstruction for each element.
    """
    logger.info(
        f"convert_apertures_to_hbe_window_constructions([{len(apertures)}] apertures)"
    )

    constructions: list[WindowConstruction] = []
    for aperture in apertures:
        u_value_result = calculate_aperture_u_value(aperture)

        if not u_value_result.is_valid:
            logger.warning(
                f"Aperture '{aperture.name}' U-value invalid "
                f"({u_value_result.warnings}), skipping"
            )
            continue

        # Build a lookup from element_id → element U-value
        element_u_values = {
            calc.element_id: calc.u_value_w_m2k
            for calc in u_value_result.element_calculations
        }

        for element in aperture.elements:
            u_value = element_u_values.get(element.id)
            if u_value is None:
                logger.warning(
                    f"No U-value for element {element.id} in aperture "
                    f"'{aperture.name}', skipping"
                )
                continue

            construction = convert_aperture_element_to_hbe_window_construction(
                aperture.name, element, u_value
            )
            if construction is not None:
                constructions.append(construction)

    return constructions


def get_all_project_window_constructions_as_hbjson_string(db: Session, bt_number: str) -> str:
    """Return all project window constructions as HB-Energy WindowConstruction JSON.

    Returns a JSON string: {"identifier": {WindowConstruction.to_dict()}, ...}
    """
    logger.info(f"get_all_project_window_constructions_as_hbjson_string({bt_number=})")

    apertures = get_apertures_by_project_bt(db, bt_number)
    hbe_constructions = convert_apertures_to_hbe_window_constructions(apertures)

    return json.dumps(
        {c.identifier: c.to_dict() for c in hbe_constructions}
    )
