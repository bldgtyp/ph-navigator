"""Synthetic regression cases for empty optional PH electric equipment bags."""

import json
from copy import deepcopy
from pathlib import Path

import pytest

from features.model_viewer.extraction import ModelParseError, extract_model_data, parse_hb_model

FIXTURE = Path(__file__).parent / "fixtures" / "ph_nav_v2_example.hbjson"


@pytest.mark.parametrize("owner", ["program", "room"])
@pytest.mark.parametrize("ph_type", ["ElectricEquipmentPhProperties", "ElectricEquipmentPhPropertiesAbridged"])
def test_type_only_equipment_extension_uses_empty_default(owner: str, ph_type: str) -> None:
    hbjson = json.loads(FIXTURE.read_text())
    program = hbjson["properties"]["energy"]["program_types"][0]
    equipment = deepcopy(program["electric_equipment"])
    equipment["properties"]["ph"] = {"type": ph_type}
    if owner == "program":
        program["electric_equipment"] = equipment
    else:
        hbjson["rooms"][0]["properties"]["energy"]["electric_equipment"] = equipment
    original = deepcopy(hbjson)
    baseline = extract_model_data(parse_hb_model(json.loads(FIXTURE.read_text())))
    model = parse_hb_model(hbjson)
    assert extract_model_data(model) == baseline
    assert hbjson == original


def test_equipment_patch_restored_on_parse_failure() -> None:
    hbjson = json.loads(FIXTURE.read_text())
    equipment = hbjson["properties"]["energy"]["program_types"][0]["electric_equipment"]
    equipment["properties"]["ph"] = {"type": "ElectricEquipmentPhProperties"}
    equipment["schedule"] = "missing-synthetic-schedule"
    original = deepcopy(hbjson)
    with pytest.raises(ModelParseError, match="missing-synthetic-schedule"):
        parse_hb_model(hbjson)
    assert hbjson == original


def test_populated_equipment_extension_is_not_discarded() -> None:
    hbjson = json.loads(FIXTURE.read_text())
    equipment = hbjson["properties"]["energy"]["program_types"][0]["electric_equipment"]
    equipment["properties"]["ph"] = {"type": "ElectricEquipmentPhProperties", "unknown_data": 1}
    original = deepcopy(hbjson)
    with pytest.raises(ModelParseError, match="equipment_collection"):
        parse_hb_model(hbjson)
    assert hbjson == original
