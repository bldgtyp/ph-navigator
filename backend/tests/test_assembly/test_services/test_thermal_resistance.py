# -*- Python Version: 3.11 -*-

"""
Tests for thermal resistance calculations.

These tests verify the Passive House method implementation which averages
the Parallel-Path and Isothermal-Planes methods from ASHRAE Handbook Chapter 27.

Test assemblies are loaded from test_assemblies.json which contains fully-defined
HB-JSON constructions including heterogeneous layers.

Test cases are derived from ASHRAE Handbook - Fundamentals, Chapter 27 examples.
"""

import json
from pathlib import Path

import pytest
from sqlalchemy.orm import Session

from db_entities.assembly import Assembly
from features.assembly.services.assembly import create_new_empty_assembly_on_project, get_assembly_by_id
from features.assembly.services.assembly_from_hbjson import (
    create_assembly_from_hb_construction,
    get_multiple_hb_constructions_from_hbjson,
)
from features.assembly.services.material import create_new_material
from features.assembly.services.thermal_resistance import (
    _calculate_path_area_fraction,
    _calculate_steel_stud_equivalent_conductivity,
    _validate_assembly,
    calculate_effective_r_value,
)

# Path to test fixtures
FIXTURES_DIR = Path(__file__).parent


def load_test_assemblies_json() -> dict:
    """Load the test_assemblies.json fixture file."""
    filepath = FIXTURES_DIR / "test_assemblies.json"
    with open(filepath) as f:
        return json.load(f)


def create_test_materials(session: Session) -> dict:
    """Create all materials needed for the test assemblies.

    Material IDs must match the 'ph_nav' external identifiers in test_assemblies.json.
    The HB-JSON import looks up materials by this ID first.
    """
    materials = {}

    # EPS (Type I) - used in Tests 1, 2, 3
    materials["eps"] = create_new_material(
        db=session,
        id="recjNQbv0Rhrn9F6m",  # ph_nav ID from JSON
        name="EPS (Type I)",
        category="Insulation",
        argb_color="174,207,232",
        conductivity_w_mk=0.0389415,
        emissivity=0.9,
        density_kg_m3=12,
        specific_heat_j_kgk=840,
    )

    # OSB - used in Test 2
    materials["osb"] = create_new_material(
        db=session,
        id="recwJx7zuC8gMt4KL",
        name="OSB",
        category="Sheathing",
        argb_color="247,210,125",
        conductivity_w_mk=0.129805,
        emissivity=0.9,
        density_kg_m3=595,
        specific_heat_j_kgk=1400,
    )

    # Brick (Common) - used in Test 2
    materials["brick"] = create_new_material(
        db=session,
        id="recLvowryB5t8JCYQ",
        name="Brick (Common)",
        category="Masonry",
        argb_color="240,240,240",
        conductivity_w_mk=0.719986,
        emissivity=0.9,
        density_kg_m3=1670,
        specific_heat_j_kgk=840,
    )

    # Wood Coniferous (Softwood) - used in Tests 3, 4
    materials["wood"] = create_new_material(
        db=session,
        id="recfzCbZnxFRjwT18",
        name="Wood Coniferous (Softwood)",
        category="Framing",
        argb_color="255,130,0",
        conductivity_w_mk=0.14019,
        emissivity=0.9,
        density_kg_m3=400,
        specific_heat_j_kgk=1400,
    )

    # Vinyl Siding - used in Test 4
    materials["vinyl_siding"] = create_new_material(
        db=session,
        id="rec1RsModWDgShJqM",
        name="Vinyl Siding",
        category="Cladding",
        argb_color="200,200,200",
        conductivity_w_mk=0.17,
        emissivity=0.9,
        density_kg_m3=1400,
        specific_heat_j_kgk=1000,
    )

    # GWB (Densglas Sheathing) - used in Test 4
    materials["gwb_densglas"] = create_new_material(
        db=session,
        id="recPbx5MBHEUBx52s",
        name="GWB (Densglas Sheathing)",
        category="Sheathing",
        argb_color="235,180,80",
        conductivity_w_mk=0.12807,
        emissivity=0.9,
        density_kg_m3=750,
        specific_heat_j_kgk=870,
    )

    # Fiberglass Batt - used in Tests 4, 5
    materials["fiberglass"] = create_new_material(
        db=session,
        id="recABVMLyY8dEO6rP",
        name="Fiberglass Batt",
        category="Insulation",
        argb_color="255,255,140",
        conductivity_w_mk=0.0449991,
        emissivity=0.9,
        density_kg_m3=12,
        specific_heat_j_kgk=840,
    )

    # GWB (Typ) - used in Tests 4, 5
    materials["gwb"] = create_new_material(
        db=session,
        id="rec6z4HroOVH8TrgI",
        name="GWB (Typ)",
        category="Board",
        argb_color="185,200,195",
        conductivity_w_mk=0.16961,
        emissivity=0.9,
        density_kg_m3=850,
        specific_heat_j_kgk=870,
    )

    # XPS - used in Test 5
    materials["xps"] = create_new_material(
        db=session,
        id="recidOHsT0i3oFbyF",
        name="XPS",
        category="Insulation",
        argb_color="232,189,174",
        conductivity_w_mk=0.0288514,
        emissivity=0.9,
        density_kg_m3=40,
        specific_heat_j_kgk=1500,
    )

    # Plywood (USA) - used in Test 5
    materials["plywood"] = create_new_material(
        db=session,
        id="rec0bboLpOoOLIvQk",
        name="Plywood (USA)",
        category="Sheathing",
        argb_color="148,148,73",
        conductivity_w_mk=0.11942,
        emissivity=0.9,
        density_kg_m3=470,
        specific_heat_j_kgk=1400,
    )

    return materials


def load_assembly_from_json(session: Session, bt_number: str, assembly_name: str) -> Assembly:
    """Load a specific assembly from test_assemblies.json by name.

    Args:
        session: Database session
        bt_number: Project BT number
        assembly_name: Name/identifier of the assembly in the JSON

    Returns:
        The created Assembly object
    """
    data = load_test_assemblies_json()
    if assembly_name not in data:
        available = list(data.keys())
        raise ValueError(f"Assembly '{assembly_name}' not found. Available: {available}")

    hb_constructions = get_multiple_hb_constructions_from_hbjson({assembly_name: data[assembly_name]})
    if not hb_constructions:
        raise ValueError(f"No valid construction found for {assembly_name}")

    return create_assembly_from_hb_construction(session, bt_number, hb_constructions[0])


# -----------------------------------------------------------------------------
# Conductivity constants (from test_assemblies.json)
# -----------------------------------------------------------------------------
K_EPS = 0.0389415
K_OSB = 0.129805
K_BRICK = 0.719986
K_WOOD = 0.14019
K_FIBERGLASS = 0.0449991
K_GWB = 0.16961
K_VINYL = 0.17
K_GWB_DENSGLAS = 0.12807
K_XPS = 0.0288514
K_PLYWOOD = 0.11942


class TestHomogeneousAssemblies:
    """
    Test cases for assemblies with only single-segment (homogeneous) layers.

    For homogeneous assemblies, both Parallel-Path and Isothermal-Planes
    methods should give identical results: R_total = sum(thickness/conductivity)
    """

    def test_single_layer_homogeneous(self, session: Session, create_test_project):
        """
        Test 1 - Single-Layer Homogeneous:
        - 200mm EPS insulation (k=0.0389415 W/m-K)

        Expected R = 0.2m / 0.0389415 = 5.136 m2-K/W
        """
        create_test_project(db=session, username="user1", project_name="Project 1")
        create_test_materials(session)

        assembly = load_assembly_from_json(session, "1234", "Test 1 - Single-Layer Homogeneous")
        result = calculate_effective_r_value(assembly)

        assert result.is_valid is True
        assert result.warnings == []

        # Expected R-value
        expected_r = 0.2 / K_EPS  # ~5.136 m2-K/W

        # Both methods should give identical results for homogeneous layers
        assert result.r_parallel_path_si == pytest.approx(expected_r, rel=0.01)
        assert result.r_isothermal_planes_si == pytest.approx(expected_r, rel=0.01)
        assert result.r_effective_si == pytest.approx(expected_r, rel=0.01)
        assert result.u_effective_si == pytest.approx(1.0 / expected_r, rel=0.01)

    def test_multi_layer_homogeneous(self, session: Session, create_test_project):
        """
        Test 2 - Multi-Layer Homogeneous:
        - Layer 1: 50mm EPS (k=0.0389415) -> R = 1.284
        - Layer 2: 20mm OSB (k=0.129805) -> R = 0.154
        - Layer 3: 30mm Brick (k=0.719986) -> R = 0.042

        Total R = 1.284 + 0.154 + 0.042 = 1.480 m2-K/W
        """
        create_test_project(db=session, username="user1", project_name="Project 1")
        create_test_materials(session)

        assembly = load_assembly_from_json(session, "1234", "Test 2 - Multi-Layer Homogeneous")
        result = calculate_effective_r_value(assembly)

        assert result.is_valid is True

        # Calculate expected R-value
        r1 = 0.05 / K_EPS  # ~1.284
        r2 = 0.02 / K_OSB  # ~0.154
        r3 = 0.03 / K_BRICK  # ~0.042
        expected_r = r1 + r2 + r3  # ~1.480 m2-K/W

        # Both methods should give identical results for homogeneous layers
        assert result.r_parallel_path_si == pytest.approx(expected_r, rel=0.01)
        assert result.r_isothermal_planes_si == pytest.approx(expected_r, rel=0.01)
        assert result.r_effective_si == pytest.approx(expected_r, rel=0.01)


class TestHeterogeneousAssemblies:
    """
    Test cases for assemblies with multi-segment (heterogeneous) layers.

    Heterogeneous layers have multiple materials side-by-side, requiring
    the Parallel-Path and Isothermal-Planes calculation methods.
    """

    def test_simple_heterogeneous(self, session: Session, create_test_project):
        """
        Test 3 - Simple Heterogeneous:
        Single layer (100mm) with multiple segments:
        - EPS segments (43% - columns 0, 2 with widths 0.3 each)
        - Wood segment (14% - column 1 with width 0.1)

        The layer has a "hybrid" effective conductivity calculated from
        the segment fractions.
        """
        create_test_project(db=session, username="user1", project_name="Project 1")
        create_test_materials(session)

        assembly = load_assembly_from_json(session, "1234", "Test 3 - Simple Heterogeneous")
        result = calculate_effective_r_value(assembly)

        assert result.is_valid is True

        # For a single heterogeneous layer, parallel-path and isothermal
        # methods should give the same result
        assert result.r_parallel_path_si > 0
        assert result.r_isothermal_planes_si > 0

        # Effective R should be the average of both methods
        expected_effective = (result.r_parallel_path_si + result.r_isothermal_planes_si) / 2
        assert result.r_effective_si == pytest.approx(expected_effective, rel=0.001)

    def test_wood_stud_wall(self, session: Session, create_test_project):
        """
        Test 4 - Wood Stud Wall (typical wood frame construction):
        - Layer 1: Vinyl Siding, 18mm (homogeneous)
        - Layer 2: GWB Sheathing, 20mm (homogeneous)
        - Layer 3: Stud cavity, 90mm (heterogeneous: fiberglass + wood studs)
        - Layer 4: GWB, 13mm (homogeneous)

        The stud cavity has wood studs at specific spacing with fiberglass between.
        """
        create_test_project(db=session, username="user1", project_name="Project 1")
        create_test_materials(session)

        assembly = load_assembly_from_json(session, "1234", "Test 4 - Wood Stud Wall")
        result = calculate_effective_r_value(assembly)

        assert result.is_valid is True

        # Verify we get positive R values
        assert result.r_parallel_path_si > 0
        assert result.r_isothermal_planes_si > 0

        # For multi-layer assemblies with heterogeneous layers,
        # Parallel-Path typically gives slightly different result than Isothermal-Planes
        # Effective R should be the average
        expected_effective = (result.r_parallel_path_si + result.r_isothermal_planes_si) / 2
        assert result.r_effective_si == pytest.approx(expected_effective, rel=0.001)

        # U-value should be inverse of R
        assert result.u_effective_si == pytest.approx(1.0 / result.r_effective_si, rel=0.001)


class TestSteelStudAssembly:
    """Test case for steel stud wall assembly with special handling."""

    def test_steel_stud_wall(self, session: Session, create_test_project):
        """
        Test 5 - Steel Stud Wall:
        - Layer 1: XPS, 76mm (homogeneous continuous insulation)
        - Layer 2: Plywood, 20mm (homogeneous)
        - Layer 3: Steel stud cavity, 90mm (with thermal bridging factor)
        - Layer 4: GWB, 13mm (homogeneous)

        Steel stud layers have special handling due to thermal bridging.
        The AISI S250-21 calculation accounts for heat flow through steel studs.
        """
        create_test_project(db=session, username="user1", project_name="Project 1")
        create_test_materials(session)

        assembly = load_assembly_from_json(session, "1234", "Test 5 - Steel Stud Wall")
        result = calculate_effective_r_value(assembly)

        assert result.is_valid is True

        # Verify assembly is recognized as steel stud
        assert assembly.is_steel_stud_assembly is True

        # Verify we get positive R values
        assert result.r_parallel_path_si > 0
        assert result.r_isothermal_planes_si > 0

        # Effective R should be the average
        expected_effective = (result.r_parallel_path_si + result.r_isothermal_planes_si) / 2
        assert result.r_effective_si == pytest.approx(expected_effective, rel=0.001)

        # U-value should be inverse of R
        assert result.u_effective_si == pytest.approx(1.0 / result.r_effective_si, rel=0.001)

        # Calculate what R-value would be WITHOUT steel stud correction
        # (using raw fiberglass conductivity 0.0449991 W/m-K)
        r_xps = 0.076 / K_XPS  # ~2.634 m2-K/W
        r_plywood = 0.02 / K_PLYWOOD  # ~0.167 m2-K/W
        r_fiberglass_raw = 0.09 / K_FIBERGLASS  # ~2.0 m2-K/W (no bridging)
        r_gwb = 0.013 / K_GWB  # ~0.077 m2-K/W
        r_without_bridging = r_xps + r_plywood + r_fiberglass_raw + r_gwb  # ~4.88 m2-K/W

        # With steel stud thermal bridging, the R-value should be LOWER
        # because steel conducts heat much better than fiberglass insulation
        assert result.r_effective_si < r_without_bridging, (
            f"Steel stud R-value ({result.r_effective_si:.4f}) should be lower than "
            f"R-value without bridging ({r_without_bridging:.4f})"
        )

    def test_steel_stud_equivalent_conductivity(self, session: Session, create_test_project):
        """
        Verify the steel stud equivalent conductivity calculation.

        For the Test 5 assembly (XPS + Plywood + Steel stud cavity + GWB),
        the equivalent conductivity of the stud cavity should be higher
        than the raw fiberglass insulation conductivity due to thermal bridging.
        """
        create_test_project(db=session, username="user1", project_name="Project 1")
        create_test_materials(session)

        assembly = load_assembly_from_json(session, "1234", "Test 5 - Steel Stud Wall")

        # Get the equivalent conductivity
        eq_conductivity = _calculate_steel_stud_equivalent_conductivity(assembly)

        # Raw fiberglass conductivity is 0.0449991 W/m-K
        # With steel stud thermal bridging, the equivalent conductivity should be HIGHER
        assert eq_conductivity > K_FIBERGLASS, (
            f"Equivalent conductivity ({eq_conductivity:.6f}) should be higher than "
            f"raw fiberglass ({K_FIBERGLASS:.6f}) due to steel thermal bridging"
        )

        # The equivalent conductivity should be in a reasonable range
        # (typically 1.5x to 2.5x the raw insulation conductivity for steel studs)
        assert (
            eq_conductivity < K_FIBERGLASS * 3.0
        ), f"Equivalent conductivity ({eq_conductivity:.6f}) is unexpectedly high"


class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_empty_assembly_returns_invalid(self, session: Session, create_test_project):
        """Assembly with no layers should return invalid result."""
        create_test_project(db=session, username="user1", project_name="Project 1")

        empty_assembly = create_new_empty_assembly_on_project(db=session, name="Empty Assembly", bt_number="1234")

        result = calculate_effective_r_value(empty_assembly)

        assert result.is_valid is False
        assert "no layers" in result.warnings[0].lower()
        assert result.r_effective_si == 0.0

    def test_zero_thickness_layer_returns_invalid(self, session: Session, create_test_project):
        """Layer with zero thickness should return invalid result."""
        create_test_project(db=session, username="user1", project_name="Project 1")
        assembly = get_assembly_by_id(session, 1)

        # Set layer thickness to zero
        assembly.layers[0].thickness_mm = 0.0
        session.commit()
        session.refresh(assembly)

        result = calculate_effective_r_value(assembly)

        assert result.is_valid is False
        assert any("zero" in w.lower() or "thickness" in w.lower() for w in result.warnings)

    def test_zero_conductivity_returns_invalid(self, session: Session, create_test_project):
        """Material with zero conductivity should return invalid result."""
        create_test_project(db=session, username="user1", project_name="Project 1")
        assembly = get_assembly_by_id(session, 1)

        # Set conductivity to zero
        assembly.layers[0].segments[0].material.conductivity_w_mk = 0.0
        session.commit()
        session.refresh(assembly)

        result = calculate_effective_r_value(assembly)

        assert result.is_valid is False
        assert any("conductivity" in w.lower() for w in result.warnings)

    def test_negative_thickness_returns_invalid(self, session: Session, create_test_project):
        """Layer with negative thickness should return invalid result."""
        create_test_project(db=session, username="user1", project_name="Project 1")
        assembly = get_assembly_by_id(session, 1)

        # Set layer thickness to negative
        assembly.layers[0].thickness_mm = -50.0
        session.commit()
        session.refresh(assembly)

        result = calculate_effective_r_value(assembly)

        assert result.is_valid is False


class TestUnitConversions:
    """Test that SI units are correctly used throughout."""

    def test_r_value_units_are_si(self, session: Session, create_test_project):
        """
        Verify R-values are in m2-K/W (SI units).

        Test 1 assembly: 200mm EPS (k=0.0389415)
        Expected R = 0.2 / 0.0389415 = 5.136 m2-K/W (SI)
        """
        create_test_project(db=session, username="user1", project_name="Project 1")
        create_test_materials(session)

        assembly = load_assembly_from_json(session, "1234", "Test 1 - Single-Layer Homogeneous")
        result = calculate_effective_r_value(assembly)

        # Expected R in SI units
        expected_r_si = 0.2 / K_EPS

        assert result.r_effective_si == pytest.approx(expected_r_si, rel=0.01)

        # Verify U-value is correct (inverse of R)
        assert result.u_effective_si == pytest.approx(1.0 / expected_r_si, rel=0.01)


class TestInternalFunctions:
    """Test internal calculation functions directly."""

    def test_path_area_fraction_single_segment_layers(self, session: Session, create_test_project):
        """Path area fraction for single-segment layers should be 1.0."""
        create_test_project(db=session, username="user1", project_name="Project 1")
        assembly = get_assembly_by_id(session, 1)

        layers = assembly.layers
        path = (0,)  # First (only) segment of each layer

        area_fraction = _calculate_path_area_fraction(layers, path)

        assert area_fraction == pytest.approx(1.0, rel=0.001)

    def test_validate_assembly_valid(self, session: Session, create_test_project):
        """Valid assembly should return no warnings."""
        create_test_project(db=session, username="user1", project_name="Project 1")
        assembly = get_assembly_by_id(session, 1)

        warnings = _validate_assembly(assembly)

        assert warnings == []
