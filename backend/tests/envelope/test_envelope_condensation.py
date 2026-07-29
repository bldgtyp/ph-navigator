"""Pure ISO 13788 condensation engine tests.

All material properties in this module are synthetic. The reference-wall
fixture was also entered into a local copy of the PHI workbook; no licensed
material dataset values are copied into this repository.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import pytest

from features.climate.record import (
    ClimateData,
    ClimateLocation,
    ClimateMonthlyRadiation,
    ClimateMonthlyTemps,
    ClimateRecord,
)
from features.envelope.boundary_conditions import ISO_6946_TABLE
from features.envelope.condensation import (
    CondensationSettings,
    calculate_assembly_condensation,
    condensation_input_hash,
    saturation_pressure_pa,
    saturation_temperature_c,
)
from features.project_document.document import (
    Assembly,
    AssemblyLayer,
    AssemblyOrientation,
    AssemblySegment,
    AssemblyType,
    ExteriorCondition,
    ProjectMaterial,
)

_FIXTURE_DIR = Path(__file__).parents[1] / "fixtures" / "condensation"


def _climate(
    air_c: list[float] | None = None,
    dewpoint_c: list[float] | None = None,
) -> ClimateRecord:
    air = air_c or [-5.0, -3.0, 2.0, 8.0, 14.0, 19.0, 23.0, 22.0, 17.0, 10.0, 4.0, -2.0]
    dewpoint = dewpoint_c or [-8.0, -6.0, -2.0, 3.0, 8.0, 13.0, 17.0, 16.0, 12.0, 5.0, 0.0, -5.0]
    zeros = [0.0] * 12
    return ClimateRecord(
        display_name="Synthetic monthly climate",
        location=ClimateLocation(latitude=40.0, longitude=-74.0),
        climate=ClimateData(
            monthly_temps=ClimateMonthlyTemps(
                air_c=air,
                dewpoint_c=dewpoint,
                sky_c=air,
                ground_c=air,
            ),
            monthly_radiation=ClimateMonthlyRadiation(
                north=zeros,
                east=zeros,
                south=zeros,
                west=zeros,
                glob=zeros,
            ),
        ),
    )


def _material(
    material_id: str,
    *,
    name: str | None = None,
    category: str = "insulation",
    conductivity: float | None = 0.04,
    mu: float | None = 5.0,
    sd_m: float | None = None,
) -> ProjectMaterial:
    return ProjectMaterial(
        id=material_id,
        name=name or material_id.removeprefix("pmat_").replace("_", " ").title(),
        category=category,
        conductivity_w_mk=conductivity,
        vapor_diffusion_resistance_mu=mu,
        vapor_sd_equivalent_m=sd_m,
    )


def _layer(
    index: int,
    material_ids: str | list[str],
    *,
    thickness_mm: float = 100.0,
    widths_mm: list[float] | None = None,
) -> AssemblyLayer:
    ids = [material_ids] if isinstance(material_ids, str) else material_ids
    widths = widths_mm or [600.0] * len(ids)
    return AssemblyLayer(
        id=f"lyr_{index}",
        order=index,
        thickness_mm=thickness_mm,
        segments=[
            AssemblySegment(
                id=f"seg_{index}_{segment_index}",
                order=segment_index,
                width_mm=width,
                project_material_id=material_id,
            )
            for segment_index, (material_id, width) in enumerate(zip(ids, widths, strict=True))
        ],
    )


def _assembly(
    layers: list[AssemblyLayer] | None = None,
    *,
    assembly_type: AssemblyType = "wall",
    exterior_condition: ExteriorCondition = "outdoor_air",
    orientation: AssemblyOrientation = "first_layer_outside",
) -> Assembly:
    return Assembly(
        id="asm_condensation",
        name="Synthetic condensation assembly",
        type=assembly_type,
        orientation=orientation,
        exterior_condition=exterior_condition,
        layers=layers
        or [
            _layer(0, "pmat_outer", thickness_mm=20.0),
            _layer(1, "pmat_insulation", thickness_mm=180.0),
            _layer(2, "pmat_inner", thickness_mm=13.0),
        ],
    )


def _reference_materials() -> dict[str, ProjectMaterial]:
    return {
        "pmat_outer": _material(
            "pmat_outer",
            category="masonry",
            conductivity=0.18,
            mu=20.0,
        ),
        "pmat_insulation": _material(
            "pmat_insulation",
            conductivity=0.04,
            mu=2.0,
        ),
        "pmat_inner": _material(
            "pmat_inner",
            category="board",
            conductivity=0.25,
            mu=8.0,
        ),
    }


def _load_reference_wall_golden() -> dict[str, Any]:
    return json.loads((_FIXTURE_DIR / "phi_reference_wall.json").read_text())


def test_reference_wall_matches_locally_recalculated_phi_workbook_golden() -> None:
    fixture = _load_reference_wall_golden()
    climate = fixture["climate"]
    result = calculate_assembly_condensation(
        _assembly(),
        _reference_materials(),
        _climate(climate["air_c"], climate["dewpoint_c"]),
        ISO_6946_TABLE,
        CondensationSettings(
            interior_climate_model="fixed_setpoint",
            setpoint_temp_c=climate["interior_temp_c"],
            setpoint_rh=climate["interior_rh"],
        ),
    )
    expected = fixture["expected_january_to_december"]

    assert [month.moisture_change_g_m2 for month in result.monthly] == pytest.approx(
        expected["gc_g_m2"],
        abs=1.0e-6,
    )
    assert [month.accumulated_moisture_g_m2 for month in result.monthly] == pytest.approx(
        expected["ma_g_m2"],
        abs=1.0e-6,
    )
    assert [month.condensing_interface_count for month in result.monthly] == expected["interface_count"]
    assert [month.surface_condensation_clear for month in result.monthly] == expected["surface_condensation_clear"]
    assert [month.mold_growth_clear for month in result.monthly] == expected["mold_growth_clear"]
    assert [month.frsi_clear for month in result.monthly] == expected["frsi_clear"]
    assert result.verdict == expected["verdict"]
    assert result.peak_accumulated_moisture_g_m2 == pytest.approx(
        expected["peak_ma_g_m2"],
        abs=1.0e-6,
    )
    assert result.final_accumulated_moisture_g_m2 == pytest.approx(
        expected["final_ma_g_m2"],
        abs=1.0e-6,
    )


def test_roof_profile_offset_matches_locally_recalculated_phi_workbook_golden() -> None:
    fixture = _load_reference_wall_golden()
    climate = fixture["climate"]
    result = calculate_assembly_condensation(
        _assembly(assembly_type="roof"),
        _reference_materials(),
        _climate(climate["air_c"], climate["dewpoint_c"]),
        ISO_6946_TABLE,
        CondensationSettings(
            interior_climate_model="fixed_setpoint",
            setpoint_temp_c=climate["interior_temp_c"],
            setpoint_rh=climate["interior_rh"],
        ),
    )
    expected = fixture["expected_roof_january_to_december"]

    assert [month.moisture_change_g_m2 for month in result.monthly] == pytest.approx(
        expected["gc_g_m2"],
        abs=1.0e-6,
    )
    assert [month.accumulated_moisture_g_m2 for month in result.monthly] == pytest.approx(
        expected["ma_g_m2"],
        abs=1.0e-6,
    )
    assert [month.condensing_interface_count for month in result.monthly] == expected["interface_count"]
    assert result.verdict == expected["verdict"]
    assert result.peak_accumulated_moisture_g_m2 == pytest.approx(
        expected["peak_ma_g_m2"],
        abs=1.0e-6,
    )


@pytest.mark.parametrize("temperature_c", [-25.0, -0.01, 0.0, 20.0, 35.0])
def test_saturation_pressure_inverse_covers_water_and_ice_branches(
    temperature_c: float,
) -> None:
    pressure = saturation_pressure_pa(temperature_c)

    assert pressure > 0
    assert saturation_temperature_c(pressure) == pytest.approx(temperature_c)


@pytest.mark.parametrize("pressure_pa", [0.0, -1.0, math.inf, math.nan])
def test_saturation_temperature_rejects_invalid_pressure(pressure_pa: float) -> None:
    with pytest.raises(ValueError, match="finite positive"):
        saturation_temperature_c(pressure_pa)


def test_settings_zero_config_defaults_are_versioned_method_defaults() -> None:
    settings = CondensationSettings()

    assert settings.interior_climate_model == "iso13788_continental"
    assert settings.occupancy_class == "normal"
    assert settings.ma_limit_g_m2 == 200


def test_reference_wall_returns_complete_monthly_profiles_and_masonry_caveat() -> None:
    result = calculate_assembly_condensation(
        _assembly(),
        _reference_materials(),
        _climate(),
        ISO_6946_TABLE,
    )

    assert result.status.model_dump() == {
        "state": "screened",
        "is_complete": True,
        "flags": [],
    }
    assert result.verdict in {"d1", "d2", "d3", "d4"}
    assert len(result.monthly) == 12
    assert [month.month for month in result.monthly] == list(range(1, 13))
    assert all(len(month.nodes) == 4 for month in result.monthly)
    assert result.rsi_m2k_w == pytest.approx(0.13)
    assert result.rse_m2k_w == pytest.approx(0.04)
    assert [caveat.code for caveat in result.caveats] == ["high_storage_masonry"]
    assert result.criteria is not None
    assert {
        result.criteria.surface_condensation.code,
        result.criteria.mold_growth.code,
        result.criteria.frsi.code,
        result.criteria.interstitial.code,
    } == {
        "surface_condensation",
        "mold_growth",
        "frsi",
        "interstitial",
    }


def test_input_hash_covers_material_vapor_data_and_ignores_unreferenced_materials() -> None:
    assembly = _assembly()
    materials = _reference_materials()
    baseline = condensation_input_hash(
        assembly,
        materials,
        _climate(),
        ISO_6946_TABLE,
        CondensationSettings(),
    )
    changed = {
        **materials,
        "pmat_outer": materials["pmat_outer"].model_copy(update={"vapor_diffusion_resistance_mu": 21.0}),
    }
    with_unreferenced = {
        **materials,
        "pmat_unused": _material("pmat_unused", mu=100.0),
    }

    assert (
        condensation_input_hash(
            assembly,
            changed,
            _climate(),
            ISO_6946_TABLE,
            CondensationSettings(),
        )
        != baseline
    )
    assert (
        condensation_input_hash(
            assembly,
            with_unreferenced,
            _climate(),
            ISO_6946_TABLE,
            CondensationSettings(),
        )
        == baseline
    )


def test_direct_sd_wins_over_mu_times_thickness() -> None:
    assembly = _assembly([_layer(0, "pmat_direct", thickness_mm=100.0)])
    direct = _material("pmat_direct", conductivity=0.1, mu=500.0, sd_m=0.5)

    result = calculate_assembly_condensation(
        assembly,
        {direct.id: direct},
        _climate(),
        ISO_6946_TABLE,
    )

    assert result.status.state == "screened"
    assert all(month.nodes[-1].cumulative_sd_m == pytest.approx(0.5) for month in result.monthly)


def test_membrane_uses_direct_sd_and_contributes_zero_thermal_resistance() -> None:
    assembly = _assembly(
        [
            _layer(0, "pmat_outer", thickness_mm=20.0),
            _layer(1, "pmat_membrane", thickness_mm=1.0),
            _layer(2, "pmat_inner", thickness_mm=100.0),
        ]
    )
    materials = {
        "pmat_outer": _material("pmat_outer", conductivity=0.2, mu=10.0),
        "pmat_membrane": _material(
            "pmat_membrane",
            category="membrane",
            conductivity=None,
            mu=None,
            sd_m=15.0,
        ),
        "pmat_inner": _material("pmat_inner", conductivity=0.04, mu=3.0),
    }

    thin = calculate_assembly_condensation(assembly, materials, _climate(), ISO_6946_TABLE)
    thick = calculate_assembly_condensation(
        assembly.model_copy(
            update={
                "layers": [
                    assembly.layers[0],
                    assembly.layers[1].model_copy(update={"thickness_mm": 20.0}),
                    assembly.layers[2],
                ]
            }
        ),
        materials,
        _climate(),
        ISO_6946_TABLE,
    )

    assert thin.status.state == "screened"
    assert all(month.nodes[2].cumulative_sd_m == pytest.approx(15.2) for month in thin.monthly)
    assert [node.temperature_c for node in thin.monthly[0].nodes] == pytest.approx(
        [node.temperature_c for node in thick.monthly[0].nodes]
    )
    assert [node.vapor_pressure_pa for node in thin.monthly[0].nodes] == pytest.approx(
        [node.vapor_pressure_pa for node in thick.monthly[0].nodes]
    )


def test_membrane_dominated_wall_matches_locally_recalculated_phi_workbook_golden() -> None:
    assembly = _assembly(
        [
            _layer(0, "pmat_outer", thickness_mm=20.0),
            _layer(1, "pmat_insulation", thickness_mm=180.0),
            _layer(2, "pmat_membrane", thickness_mm=1.0),
            _layer(3, "pmat_inner", thickness_mm=13.0),
        ]
    )
    materials = {
        **_reference_materials(),
        "pmat_membrane": _material(
            "pmat_membrane",
            category="membrane",
            conductivity=None,
            mu=None,
            sd_m=15.0,
        ),
    }

    result = calculate_assembly_condensation(
        assembly,
        materials,
        _climate(),
        ISO_6946_TABLE,
        CondensationSettings(
            interior_climate_model="fixed_setpoint",
            setpoint_temp_c=20.0,
            setpoint_rh=0.5,
        ),
    )

    # The local workbook case represents the direct 15 m sd with a 1 mm,
    # near-zero-R synthetic sheet. Both implementations return no gc or Ma.
    assert result.verdict == "d1"
    assert [month.moisture_change_g_m2 for month in result.monthly] == [0.0] * 12
    assert [month.accumulated_moisture_g_m2 for month in result.monthly] == [0.0] * 12
    assert [month.condensing_interface_count for month in result.monthly] == [0] * 12


def test_membrane_without_direct_sd_blocks_even_when_mu_exists() -> None:
    assembly = _assembly(
        [
            _layer(0, "pmat_membrane", thickness_mm=1.0),
            _layer(1, "pmat_inner", thickness_mm=100.0),
        ]
    )
    materials = {
        "pmat_membrane": _material(
            "pmat_membrane",
            category="membrane",
            conductivity=None,
            mu=100.0,
        ),
        "pmat_inner": _material("pmat_inner"),
    }

    result = calculate_assembly_condensation(assembly, materials, _climate(), ISO_6946_TABLE)

    assert result.status.state == "blocked"
    assert "missing_membrane_sd" in result.status.flags
    assert result.monthly == []


def test_missing_ordinary_vapor_data_blocks() -> None:
    material = _material("pmat_missing_vapor", mu=None, sd_m=None)
    result = calculate_assembly_condensation(
        _assembly([_layer(0, material.id)]),
        {material.id: material},
        _climate(),
        ISO_6946_TABLE,
    )

    assert result.status.state == "blocked"
    assert result.status.flags == ["missing_vapor_data"]


def test_air_layer_uses_iso_sd_exemption() -> None:
    material = _material(
        "pmat_air",
        category="air_horizontal_heat_flow",
        conductivity=0.18,
        mu=None,
        sd_m=None,
    )
    result = calculate_assembly_condensation(
        _assembly([_layer(0, material.id, thickness_mm=50.0)]),
        {material.id: material},
        _climate(),
        ISO_6946_TABLE,
    )

    assert result.status.state == "screened"
    assert result.monthly[0].nodes[-1].cumulative_sd_m == pytest.approx(0.01)


def test_all_membrane_assembly_blocks_without_crashing() -> None:
    material = _material(
        "pmat_membrane",
        category="membrane",
        conductivity=None,
        mu=None,
        sd_m=10.0,
    )
    result = calculate_assembly_condensation(
        _assembly([_layer(0, material.id, thickness_mm=1.0)]),
        {material.id: material},
        _climate(),
        ISO_6946_TABLE,
    )

    assert result.status.state == "blocked"
    assert "no_thermal_layers" in result.status.flags


def test_zero_total_sd_blocks_before_division() -> None:
    material = _material("pmat_zero_sd", sd_m=0.0)
    result = calculate_assembly_condensation(
        _assembly([_layer(0, material.id)]),
        {material.id: material},
        _climate(),
        ISO_6946_TABLE,
    )

    assert result.status.state == "blocked"
    assert result.status.flags == ["zero_total_sd"]


@pytest.mark.parametrize(
    ("exterior_condition", "expected_flag"),
    [
        ("ground", "ground_not_screened"),
        ("unconditioned_space", "unconditioned_space_not_screened"),
    ],
)
def test_unsupported_boundary_conditions_are_not_screened(
    exterior_condition: ExteriorCondition,
    expected_flag: str,
) -> None:
    result = calculate_assembly_condensation(
        _assembly(exterior_condition=exterior_condition),
        _reference_materials(),
        _climate(),
        ISO_6946_TABLE,
    )

    assert result.status.state == "not_screened"
    assert result.status.flags == [expected_flag]
    assert result.verdict is None
    assert result.monthly == []


def test_dewpoint_above_air_temperature_is_clamped_with_caveat() -> None:
    result = calculate_assembly_condensation(
        _assembly(),
        _reference_materials(),
        _climate(air_c=[5.0] * 12, dewpoint_c=[6.0] * 12),
        ISO_6946_TABLE,
    )

    assert result.status.state == "screened"
    assert "climate_rh_clamped" in {caveat.code for caveat in result.caveats}
    assert all(month.exterior_rh == pytest.approx(1.0) for month in result.monthly)


@pytest.mark.parametrize(
    "settings",
    [
        CondensationSettings(
            interior_climate_model="iso13788_humidity_class",
            setpoint_temp_c=None,
        ),
        CondensationSettings(
            interior_climate_model="fixed_setpoint",
            setpoint_temp_c=21.0,
            setpoint_rh=None,
        ),
    ],
)
def test_incomplete_interior_climate_settings_block(
    settings: CondensationSettings,
) -> None:
    result = calculate_assembly_condensation(
        _assembly(),
        _reference_materials(),
        _climate(),
        ISO_6946_TABLE,
        settings,
    )

    assert result.status.state == "blocked"
    assert result.status.flags == ["invalid_settings"]


def test_fixed_setpoint_controls_every_month() -> None:
    result = calculate_assembly_condensation(
        _assembly(),
        _reference_materials(),
        _climate(),
        ISO_6946_TABLE,
        CondensationSettings(
            interior_climate_model="fixed_setpoint",
            setpoint_temp_c=22.0,
            setpoint_rh=0.5,
        ),
    )

    assert {month.interior_temp_c for month in result.monthly} == {22.0}
    assert all(month.interior_rh == pytest.approx(0.5) for month in result.monthly)


def test_roof_offset_applies_to_profile_not_exterior_vapor_pressure() -> None:
    wall = calculate_assembly_condensation(
        _assembly(),
        _reference_materials(),
        _climate(),
        ISO_6946_TABLE,
    )
    roof = calculate_assembly_condensation(
        _assembly(assembly_type="roof"),
        _reference_materials(),
        _climate(),
        ISO_6946_TABLE,
    )

    assert roof.roof_temperature_offset_k == -2.0
    assert "roof_temperature_offset" in {item.code for item in roof.diagnostics}
    assert roof.monthly[0].exterior_profile_temp_c == pytest.approx(wall.monthly[0].exterior_profile_temp_c - 2.0)
    assert roof.monthly[0].exterior_vapor_pressure_pa == pytest.approx(wall.monthly[0].exterior_vapor_pressure_pa)


def test_ventilated_outer_air_layer_reports_stack_diagnostic() -> None:
    air = _material(
        "pmat_air",
        category="air_horizontal_heat_flow",
        conductivity=0.18,
        mu=None,
        sd_m=None,
    )
    assembly = _assembly(
        [
            _layer(0, air.id, thickness_mm=25.0),
            _layer(1, "pmat_inner", thickness_mm=100.0),
        ],
        exterior_condition="ventilated",
    )
    result = calculate_assembly_condensation(
        assembly,
        {air.id: air, "pmat_inner": _material("pmat_inner")},
        _climate(),
        ISO_6946_TABLE,
    )

    assert "ventilated_stack_convention" in {item.code for item in result.diagnostics}


def test_path_enumeration_caps_at_64_and_uses_widest_segment_fallback() -> None:
    material_ids = [f"pmat_option_{index}" for index in range(3)]
    materials = {
        material_id: _material(material_id, conductivity=0.04 + index * 0.01, mu=2.0 + index)
        for index, material_id in enumerate(material_ids)
    }
    assembly = _assembly([_layer(index, material_ids, widths_mm=[100.0, 200.0, 300.0]) for index in range(4)])

    result = calculate_assembly_condensation(assembly, materials, _climate(), ISO_6946_TABLE)

    assert result.path_count == 81
    assert result.paths_evaluated == 1
    assert result.status.flags == ["path_limit_fallback"]
    assert "path_limit_fallback" in {item.code for item in result.diagnostics}
    assert result.worst_path_id == "seg_0_2|seg_1_2|seg_2_2|seg_3_2"


def test_orientation_reverses_vapor_profile_layer_order() -> None:
    materials = _reference_materials()
    first_out = calculate_assembly_condensation(
        _assembly(),
        materials,
        _climate(),
        ISO_6946_TABLE,
    )
    last_out = calculate_assembly_condensation(
        _assembly(orientation="last_layer_outside"),
        materials,
        _climate(),
        ISO_6946_TABLE,
    )

    assert first_out.monthly[0].nodes[1].outside_layer_id == "lyr_0"
    assert last_out.monthly[0].nodes[1].outside_layer_id == "lyr_2"


def test_verdict_ladder_distinguishes_d1_d2_d3_and_d4() -> None:
    uniform_materials: dict[str, ProjectMaterial] = {
        f"pmat_{suffix}": _material(
            f"pmat_{suffix}",
            conductivity=0.1,
            mu=1.0,
        )
        for suffix in ("a", "b", "c")
    }
    uniform_assembly = _assembly(
        [
            _layer(0, "pmat_a"),
            _layer(1, "pmat_b"),
            _layer(2, "pmat_c"),
        ]
    )
    d1 = calculate_assembly_condensation(
        uniform_assembly,
        uniform_materials,
        _climate(),
        ISO_6946_TABLE,
    )
    d2 = calculate_assembly_condensation(
        _assembly(),
        _reference_materials(),
        _climate(),
        ISO_6946_TABLE,
        CondensationSettings(ma_limit_g_m2=5000.0),
    )
    d3 = calculate_assembly_condensation(
        _assembly(),
        _reference_materials(),
        _climate(),
        ISO_6946_TABLE,
    )
    d4 = calculate_assembly_condensation(
        _assembly(),
        _reference_materials(),
        _climate(air_c=[-10.0] * 12, dewpoint_c=[-10.0] * 12),
        ISO_6946_TABLE,
        CondensationSettings(
            interior_climate_model="fixed_setpoint",
            setpoint_temp_c=20.0,
            setpoint_rh=0.7,
        ),
    )

    assert [d1.verdict, d2.verdict, d3.verdict, d4.verdict] == [
        "d1",
        "d2",
        "d3",
        "d4",
    ]
    assert d4.final_accumulated_moisture_g_m2 is not None
    assert d4.final_accumulated_moisture_g_m2 > 0
    minimum_mass = min(month.accumulated_moisture_g_m2 for month in d4.monthly)
    last_minimum_month = max(
        month.month for month in d4.monthly if month.accumulated_moisture_g_m2 == pytest.approx(minimum_mass)
    )
    assert d4.start_month == last_minimum_month % 12 + 1


def test_summer_reverse_drive_condenses_at_inboard_membrane() -> None:
    materials = {
        "pmat_outer": _material("pmat_outer", conductivity=0.2, mu=2.0),
        "pmat_insulation": _material("pmat_insulation", conductivity=0.04, mu=2.0),
        "pmat_membrane": _material(
            "pmat_membrane",
            category="membrane",
            conductivity=None,
            mu=None,
            sd_m=5.0,
        ),
        "pmat_inner": _material("pmat_inner", conductivity=0.2, mu=5.0),
    }
    assembly = _assembly(
        [
            _layer(0, "pmat_outer", thickness_mm=20.0),
            _layer(1, "pmat_insulation", thickness_mm=150.0),
            _layer(2, "pmat_membrane", thickness_mm=1.0),
            _layer(3, "pmat_inner", thickness_mm=13.0),
        ]
    )
    result = calculate_assembly_condensation(
        assembly,
        materials,
        _climate(),
        ISO_6946_TABLE,
        CondensationSettings(
            interior_climate_model="fixed_setpoint",
            setpoint_temp_c=16.0,
            setpoint_rh=0.5,
        ),
    )

    july = result.monthly[6]
    assert july.exterior_vapor_pressure_pa > july.interior_vapor_pressure_pa
    assert result.verdict == "d2"
    assert result.interfaces[0].outside_layer_id == "lyr_1"
    assert result.interfaces[0].inside_layer_id == "lyr_2"
    assert result.interfaces[0].condensing_months == [7]


def test_multiple_active_interfaces_emit_low_confidence_caveat() -> None:
    materials = {
        f"pmat_{index}": _material(
            f"pmat_{index}",
            conductivity=0.04 if index % 2 == 0 else 0.2,
            mu=10.0 if index == 0 else 1.0,
        )
        for index in range(4)
    }
    assembly = _assembly(
        [
            _layer(
                index,
                f"pmat_{index}",
                thickness_mm=100.0 if index % 2 == 0 else 20.0,
            )
            for index in range(4)
        ]
    )
    result = calculate_assembly_condensation(
        assembly,
        materials,
        _climate(air_c=[-10.0] * 12, dewpoint_c=[-12.0] * 12),
        ISO_6946_TABLE,
        CondensationSettings(
            interior_climate_model="fixed_setpoint",
            setpoint_temp_c=20.0,
            setpoint_rh=0.65,
        ),
    )

    assert max(month.condensing_interface_count for month in result.monthly) == 2
    assert "multiple_condensing_interfaces" in {caveat.code for caveat in result.caveats}
