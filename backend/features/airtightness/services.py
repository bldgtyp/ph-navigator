# -*- Python Version: 3.11 -*-

import logging

from honeybee.model import Model
from honeybee_ph.space import Space
from PHX.from_HBJSON.cleanup import _get_room_exposed_face_area, merge_infiltrations
from PHX.from_HBJSON.create_variant import get_infiltration_at_50Pa

logger = logging.getLogger(__name__)


def get_model_airtightness_data(_hb_model: Model) -> dict:
    """Calculates airtightness data for a Honeybee model."""
    logger.info(f"get_model_airtightness_data({_hb_model.display_name=})")

    # Figure out what the effective whole-model infiltration rate is.
    hb_infiltration = merge_infiltrations(list(_hb_model.rooms))

    spaces: list[Space] = [sp for room in _hb_model.rooms for sp in room.properties.ph.spaces]
    weighted_net_floor_area_m2 = sum(sp.weighted_floor_area for sp in spaces)
    m3h_per_m2_at_50Pa = get_infiltration_at_50Pa(hb_infiltration.flow_per_exterior_area)
    envelope_area_m2 = sum(_get_room_exposed_face_area(rm) for rm in _hb_model.rooms)
    total_flow_m3_hr_at_50Pa = m3h_per_m2_at_50Pa * envelope_area_m2
    net_volume_m3 = sum(sp.net_volume for sp in spaces)
    n_50 = total_flow_m3_hr_at_50Pa / net_volume_m3

    return {
        "floor_area_m2": weighted_net_floor_area_m2,
        "envelope_area_m2": envelope_area_m2,
        "net_volume_m3": net_volume_m3,
        "n_50_ACH": n_50,
        "q_50_m3_hr_m2": m3h_per_m2_at_50Pa,
        "air_leakage_m3_hr": total_flow_m3_hr_at_50Pa,
    }
