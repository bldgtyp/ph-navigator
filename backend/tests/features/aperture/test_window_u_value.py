# -*- Python Version: 3.11 -*-

"""
Tests for window U-value (U-w) calculations per ISO 10077-1:2006.

Test cases include:
1. Standard window (1.23m × 1.48m) per ISO 10077-1:2006 Annex F
2. Simple single-element windows with uniform frames
3. Corner area calculations (45° split method)
4. Multi-element windows (grids)
5. Edge cases and error handling

Reference: ISO 10077-1:2006, Equation 1
    U_w = (Σ A_g·U_g + Σ A_f·U_f + Σ l_g·Ψ_g) / (Σ A_g + Σ A_f)
"""

import pytest
from sqlalchemy.orm import Session

from db_entities.aperture.aperture import Aperture
from db_entities.aperture.aperture_element import ApertureElement
from db_entities.aperture.aperture_frame import ApertureElementFrame
from db_entities.aperture.aperture_glazing import ApertureElementGlazing
from db_entities.aperture.frame_type import ApertureFrameType
from db_entities.aperture.glazing_type import ApertureGlazingType
from db_entities.app.project import Project
from db_entities.app.user import User
from features.aperture.services.window_u_value import (
    _U_VALUE_CACHE,
    FrameData,
    _calculate_element,
    _generate_u_value_cache_key,
    _side_frame_heat_loss,
    _side_spacer_heat_loss,
    calculate_aperture_u_value,
)
from features.auth.services import get_password_hash


def create_test_aperture(
    test_db: Session,
    row_heights_mm: list[float],
    column_widths_mm: list[float],
    frame_width_mm: float = 100.0,
    frame_u_value: float = 1.0,
    frame_psi_g: float = 0.04,
    glazing_u_value: float = 1.0,
    name: str = "Test Window",
) -> Aperture:
    """Create a test aperture with specified dimensions and properties."""
    # Create user and project
    user = User(
        username=f"test_user_{name}",
        email=f"test_{name}@example.com",
        hashed_password=get_password_hash("test123"),
    )
    test_db.add(user)
    test_db.flush()

    project = Project(
        name="Test Window Project",
        bt_number=f"WIN_{name[:3]}",
        owner_id=user.id,
    )
    test_db.add(project)
    test_db.flush()

    # Create frame type
    frame_type = ApertureFrameType(
        id=f"frame_type_{name}",
        name="Test Frame Type",
        width_mm=frame_width_mm,
        u_value_w_m2k=frame_u_value,
        psi_g_w_mk=frame_psi_g,
    )
    test_db.add(frame_type)
    test_db.flush()

    # Create glazing type
    glazing_type = ApertureGlazingType(
        id=f"glazing_type_{name}",
        name="Test Glazing Type",
        u_value_w_m2k=glazing_u_value,
        g_value=0.5,
    )
    test_db.add(glazing_type)
    test_db.flush()

    # Create aperture
    aperture = Aperture(
        name=name,
        project_id=project.id,
        row_heights_mm=row_heights_mm,
        column_widths_mm=column_widths_mm,
    )
    test_db.add(aperture)
    test_db.flush()

    # Create elements for each cell in the grid (0-indexed)
    num_rows = len(row_heights_mm)
    num_cols = len(column_widths_mm)

    for row in range(num_rows):
        for col in range(num_cols):
            # Create frames for each element
            frame_top = ApertureElementFrame(name=f"Top_{row}_{col}", frame_type_id=frame_type.id)
            frame_right = ApertureElementFrame(name=f"Right_{row}_{col}", frame_type_id=frame_type.id)
            frame_bottom = ApertureElementFrame(name=f"Bottom_{row}_{col}", frame_type_id=frame_type.id)
            frame_left = ApertureElementFrame(name=f"Left_{row}_{col}", frame_type_id=frame_type.id)
            test_db.add_all([frame_top, frame_right, frame_bottom, frame_left])
            test_db.flush()

            # Create glazing
            glazing = ApertureElementGlazing(
                name=f"Glazing_{row}_{col}",
                glazing_type_id=glazing_type.id,
            )
            test_db.add(glazing)
            test_db.flush()

            # Create element
            element = ApertureElement(
                name=f"Element_{row}_{col}",
                aperture_id=aperture.id,
                row_number=row,
                column_number=col,
                row_span=1,
                col_span=1,
                frame_top_id=frame_top.id,
                frame_right_id=frame_right.id,
                frame_bottom_id=frame_bottom.id,
                frame_left_id=frame_left.id,
                glazing_id=glazing.id,
            )
            test_db.add(element)

    test_db.commit()
    test_db.refresh(aperture)

    return aperture


class TestISOStandardWindow:
    """
    Test cases using the ISO 10077-1:2006 standard window size (1.23m × 1.48m).

    This is the reference window size from Annex F of the standard.
    """

    def test_standard_window_dimensions(self, test_db: Session):
        """
        Test Case 1: Standard Window (1.23m × 1.48m)

        Based on ISO 10077-1:2006 Annex F standard window size:

        Window: 1.23m wide × 1.48m tall
        Frame: 100mm width all sides, U_f = 1.2 W/m²K, Ψ_g = 0.04 W/mK
        Glazing: U_g = 0.7 W/m²K

        Manual Calculation:
        - Interior width: 1.23 - 0.1 - 0.1 = 1.03m
        - Interior height: 1.48 - 0.1 - 0.1 = 1.28m
        - Glazing area: 1.03 × 1.28 = 1.3184 m²
        - Window area: 1.23 × 1.48 = 1.8204 m²
        - Frame area: 1.8204 - 1.3184 = 0.502 m²
        - Glazing perimeter: 2 × (1.03 + 1.28) = 4.62m

        Heat losses:
        - Q_glazing = 1.3184 × 0.7 = 0.9229 W/K
        - Q_frame = 0.502 × 1.2 = 0.6024 W/K
        - Q_spacer = 4.62 × 0.04 = 0.1848 W/K
        - Q_total = 1.7101 W/K

        U_w = 1.7101 / 1.8204 = 0.939 W/m²K
        """
        aperture = create_test_aperture(
            test_db,
            row_heights_mm=[1480.0],
            column_widths_mm=[1230.0],
            frame_width_mm=100.0,
            frame_u_value=1.2,
            frame_psi_g=0.04,
            glazing_u_value=0.7,
            name="ISO_Standard",
        )

        result = calculate_aperture_u_value(aperture)

        assert result.is_valid is True
        assert result.warnings == []

        # Check areas
        expected_total_area = 1.23 * 1.48  # 1.8204 m²
        expected_glazing_area = 1.03 * 1.28  # 1.3184 m²
        expected_frame_area = expected_total_area - expected_glazing_area  # ~0.502 m²

        assert result.total_area_m2 == pytest.approx(expected_total_area, rel=0.01)
        assert result.glazing_area_m2 == pytest.approx(expected_glazing_area, rel=0.01)
        assert result.frame_area_m2 == pytest.approx(expected_frame_area, rel=0.01)

        # Check heat losses
        expected_q_glazing = expected_glazing_area * 0.7  # ~0.9229 W/K
        expected_q_spacer = 2 * (1.03 + 1.28) * 0.04  # ~0.1848 W/K

        assert result.heat_loss_glazing_w_k == pytest.approx(expected_q_glazing, rel=0.01)
        assert result.heat_loss_spacer_w_k == pytest.approx(expected_q_spacer, rel=0.01)

        # Check U-value (including frame heat loss with corner handling)
        # Note: Frame heat loss includes corner area split, so we verify U-value directly
        expected_u_value = 0.939  # W/m²K from manual calculation
        assert result.u_value_w_m2k == pytest.approx(expected_u_value, rel=0.02)

        # Verify calculation metadata
        assert result.calculation_method == "ISO 10077-1:2006"
        assert result.includes_psi_install is False


class TestSimpleWindows:
    """Test cases for simple single-element windows."""

    def test_simple_1m_square_window(self, test_db: Session):
        """
        Test a simple 1m × 1m window with uniform frame properties.

        Window: 1.0m × 1.0m
        Frame: 100mm width all sides, U_f = 1.0 W/m²K, Ψ_g = 0.04 W/mK
        Glazing: U_g = 1.0 W/m²K

        Interior dimensions: 0.8m × 0.8m
        Glazing area: 0.64 m²
        Window area: 1.0 m²
        Frame area: 0.36 m²
        Glazing perimeter: 3.2m
        """
        aperture = create_test_aperture(
            test_db,
            row_heights_mm=[1000.0],
            column_widths_mm=[1000.0],
            frame_width_mm=100.0,
            frame_u_value=1.0,
            frame_psi_g=0.04,
            glazing_u_value=1.0,
            name="Simple_1m",
        )

        result = calculate_aperture_u_value(aperture)

        assert result.is_valid is True

        # Expected areas
        assert result.total_area_m2 == pytest.approx(1.0, rel=0.01)
        assert result.glazing_area_m2 == pytest.approx(0.64, rel=0.01)
        assert result.frame_area_m2 == pytest.approx(0.36, rel=0.01)

        # Expected heat losses
        expected_q_glazing = 0.64 * 1.0  # 0.64 W/K
        expected_q_spacer = 3.2 * 0.04  # 0.128 W/K

        assert result.heat_loss_glazing_w_k == pytest.approx(expected_q_glazing, rel=0.01)
        assert result.heat_loss_spacer_w_k == pytest.approx(expected_q_spacer, rel=0.01)

    def test_wide_frame_window(self, test_db: Session):
        """Test window with wider frames (150mm)."""
        aperture = create_test_aperture(
            test_db,
            row_heights_mm=[1000.0],
            column_widths_mm=[1000.0],
            frame_width_mm=150.0,
            frame_u_value=1.0,
            frame_psi_g=0.04,
            glazing_u_value=1.0,
            name="Wide_Frame",
        )

        result = calculate_aperture_u_value(aperture)

        assert result.is_valid is True

        # Interior dimensions: 0.7m × 0.7m
        expected_glazing_area = 0.7 * 0.7  # 0.49 m²
        expected_frame_area = 1.0 - expected_glazing_area  # 0.51 m²

        assert result.glazing_area_m2 == pytest.approx(expected_glazing_area, rel=0.01)
        assert result.frame_area_m2 == pytest.approx(expected_frame_area, rel=0.01)


class TestCornerAreaCalculation:
    """Test the 45° corner split method for frame areas."""

    def test_corner_area_calculation(self):
        """Test that corner areas are split 50/50 between adjacent sides."""
        # Create frame data
        frame_top = FrameData(width_m=0.1, u_value_w_m2k=1.0, psi_glazing_w_mk=0.04)
        frame_left = FrameData(width_m=0.1, u_value_w_m2k=1.0, psi_glazing_w_mk=0.04)
        frame_right = FrameData(width_m=0.1, u_value_w_m2k=1.0, psi_glazing_w_mk=0.04)

        # For a window with 0.8m interior width:
        # Top frame center area = 0.1 × 0.8 = 0.08 m²
        # Top frame corners = (0.1 × 0.1)/2 + (0.1 × 0.1)/2 = 0.01 m²
        # Total top frame area = 0.08 + 0.01 = 0.09 m²

        interior_width = 0.8
        heat_loss = _side_frame_heat_loss(frame_top, frame_left, frame_right, interior_width)

        # Heat loss = area × U-value
        expected_area = 0.08 + 0.01  # 0.09 m²
        expected_heat_loss = expected_area * 1.0  # 0.09 W/K

        assert heat_loss == pytest.approx(expected_heat_loss, rel=0.01)


class TestSpacerCalculation:
    """Test spacer (psi-glazing) heat loss calculations."""

    def test_spacer_heat_loss(self):
        """Test spacer heat loss calculation."""
        frame = FrameData(width_m=0.1, u_value_w_m2k=1.0, psi_glazing_w_mk=0.04)
        interior_length = 0.8

        heat_loss = _side_spacer_heat_loss(frame, interior_length)

        expected = 0.8 * 0.04  # 0.032 W/K
        assert heat_loss == pytest.approx(expected, rel=0.01)


class TestMultiElementWindows:
    """Test windows with multiple elements (grids)."""

    def test_2x2_grid_window(self, test_db: Session):
        """
        Test a 2×2 grid window.

        Total size: 2m × 2m (four 1m × 1m elements)
        """
        aperture = create_test_aperture(
            test_db,
            row_heights_mm=[1000.0, 1000.0],
            column_widths_mm=[1000.0, 1000.0],
            frame_width_mm=100.0,
            frame_u_value=1.0,
            frame_psi_g=0.04,
            glazing_u_value=1.0,
            name="Grid_2x2",
        )

        result = calculate_aperture_u_value(aperture)

        assert result.is_valid is True

        # Total window area: 4 × 1.0 = 4.0 m²
        assert result.total_area_m2 == pytest.approx(4.0, rel=0.01)

        # Each element has glazing area of 0.64 m²
        expected_glazing_area = 4 * 0.64  # 2.56 m²
        assert result.glazing_area_m2 == pytest.approx(expected_glazing_area, rel=0.01)

    def test_3x1_horizontal_strip(self, test_db: Session):
        """Test a 3×1 horizontal strip window."""
        aperture = create_test_aperture(
            test_db,
            row_heights_mm=[1000.0],
            column_widths_mm=[1000.0, 1000.0, 1000.0],
            frame_width_mm=100.0,
            frame_u_value=1.0,
            frame_psi_g=0.04,
            glazing_u_value=1.0,
            name="Strip_3x1",
        )

        result = calculate_aperture_u_value(aperture)

        assert result.is_valid is True

        # Total window area: 3 × 1.0 = 3.0 m²
        assert result.total_area_m2 == pytest.approx(3.0, rel=0.01)


class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_aperture_with_no_elements(self, test_db: Session):
        """Aperture with no elements should return invalid result."""
        user = User(
            username="test_no_elem",
            email="no_elem@example.com",
            hashed_password=get_password_hash("test123"),
        )
        test_db.add(user)
        test_db.flush()

        project = Project(name="Test", bt_number="NO_ELEM", owner_id=user.id)
        test_db.add(project)
        test_db.flush()

        aperture = Aperture(
            name="Empty Window",
            project_id=project.id,
            row_heights_mm=[1000.0],
            column_widths_mm=[1000.0],
        )
        test_db.add(aperture)
        test_db.commit()
        test_db.refresh(aperture)

        result = calculate_aperture_u_value(aperture)

        assert result.is_valid is False
        assert len(result.warnings) > 0
        assert result.u_value_w_m2k == 0.0

    def test_element_missing_frame(self, test_db: Session):
        """Element with missing frame should be skipped."""
        user = User(
            username="test_no_frame",
            email="no_frame@example.com",
            hashed_password=get_password_hash("test123"),
        )
        test_db.add(user)
        test_db.flush()

        project = Project(name="Test", bt_number="NO_FRAME", owner_id=user.id)
        test_db.add(project)
        test_db.flush()

        glazing_type = ApertureGlazingType(
            id="glazing_no_frame",
            name="Test Glazing",
            u_value_w_m2k=1.0,
            g_value=0.5,
        )
        test_db.add(glazing_type)
        test_db.flush()

        aperture = Aperture(
            name="Window Missing Frame",
            project_id=project.id,
            row_heights_mm=[1000.0],
            column_widths_mm=[1000.0],
        )
        test_db.add(aperture)
        test_db.flush()

        glazing = ApertureElementGlazing(name="Glazing", glazing_type_id=glazing_type.id)
        test_db.add(glazing)
        test_db.flush()

        # Create element with only some frames (0-indexed)
        element = ApertureElement(
            name="Partial Element",
            aperture_id=aperture.id,
            row_number=0,
            column_number=0,
            glazing_id=glazing.id,
            # frame_top_id is None
            # frame_right_id is None
            # etc.
        )
        test_db.add(element)
        test_db.commit()
        test_db.refresh(aperture)

        result = calculate_aperture_u_value(aperture)

        assert result.is_valid is False
        assert len(result.warnings) > 0

    def test_very_small_window(self, test_db: Session):
        """Test a very small window (200mm × 200mm with 50mm frames)."""
        aperture = create_test_aperture(
            test_db,
            row_heights_mm=[200.0],
            column_widths_mm=[200.0],
            frame_width_mm=50.0,
            frame_u_value=1.0,
            frame_psi_g=0.04,
            glazing_u_value=1.0,
            name="Tiny_Window",
        )

        result = calculate_aperture_u_value(aperture)

        assert result.is_valid is True

        # Interior: 100mm × 100mm = 0.01 m²
        assert result.glazing_area_m2 == pytest.approx(0.01, rel=0.01)
        assert result.total_area_m2 == pytest.approx(0.04, rel=0.01)

    def test_frames_larger_than_window(self, test_db: Session):
        """Window where frames are too large should return invalid."""
        aperture = create_test_aperture(
            test_db,
            row_heights_mm=[200.0],
            column_widths_mm=[200.0],
            frame_width_mm=150.0,  # 150mm on each side = 300mm total > 200mm window
            frame_u_value=1.0,
            frame_psi_g=0.04,
            glazing_u_value=1.0,
            name="Too_Large_Frames",
        )

        result = calculate_aperture_u_value(aperture)

        # Interior dimensions would be negative
        assert result.is_valid is False


class TestResultProperties:
    """Test that result contains correct metadata."""

    def test_result_metadata(self, test_db: Session):
        """Verify result contains correct calculation metadata."""
        aperture = create_test_aperture(
            test_db,
            row_heights_mm=[1000.0],
            column_widths_mm=[1000.0],
            name="Metadata_Test",
        )

        result = calculate_aperture_u_value(aperture)

        assert result.calculation_method == "ISO 10077-1:2006"
        assert result.includes_psi_install is False
        assert isinstance(result.warnings, list)
        assert isinstance(result.is_valid, bool)

    def test_u_value_reasonable_range(self, test_db: Session):
        """U-value should be within a reasonable physical range."""
        aperture = create_test_aperture(
            test_db,
            row_heights_mm=[1000.0],
            column_widths_mm=[1000.0],
            frame_width_mm=100.0,
            frame_u_value=1.0,
            frame_psi_g=0.04,
            glazing_u_value=1.0,
            name="Range_Test",
        )

        result = calculate_aperture_u_value(aperture)

        assert result.is_valid is True
        # Typical window U-values range from ~0.5 to ~5.0 W/m²K
        assert 0.1 < result.u_value_w_m2k < 10.0


class TestUValueCache:
    """Test content-addressable caching for U-value calculations."""

    def test_cache_key_is_deterministic(self, test_db: Session):
        """Same aperture should generate the same cache key."""
        aperture = create_test_aperture(
            test_db,
            row_heights_mm=[1000.0],
            column_widths_mm=[1000.0],
            name="Cache_Key_Test",
        )

        key1 = _generate_u_value_cache_key(aperture)
        key2 = _generate_u_value_cache_key(aperture)

        assert key1 == key2
        assert len(key1) == 16  # Should be truncated to 16 chars

    def test_cache_key_changes_with_dimensions(self, test_db: Session):
        """Different dimensions should produce different cache keys."""
        aperture1 = create_test_aperture(
            test_db,
            row_heights_mm=[1000.0],
            column_widths_mm=[1000.0],
            name="Cache_Dim_1",
        )
        aperture2 = create_test_aperture(
            test_db,
            row_heights_mm=[1200.0],
            column_widths_mm=[1000.0],
            name="Cache_Dim_2",
        )

        key1 = _generate_u_value_cache_key(aperture1)
        key2 = _generate_u_value_cache_key(aperture2)

        assert key1 != key2

    def test_cache_key_changes_with_frame_properties(self, test_db: Session):
        """Different frame properties should produce different cache keys."""
        aperture1 = create_test_aperture(
            test_db,
            row_heights_mm=[1000.0],
            column_widths_mm=[1000.0],
            frame_u_value=1.0,
            name="Cache_Frame_1",
        )
        aperture2 = create_test_aperture(
            test_db,
            row_heights_mm=[1000.0],
            column_widths_mm=[1000.0],
            frame_u_value=1.5,
            name="Cache_Frame_2",
        )

        key1 = _generate_u_value_cache_key(aperture1)
        key2 = _generate_u_value_cache_key(aperture2)

        assert key1 != key2

    def test_cache_returns_cached_result(self, test_db: Session):
        """Second call with same inputs should return cached result."""
        # Clear the cache first
        _U_VALUE_CACHE.clear()

        aperture = create_test_aperture(
            test_db,
            row_heights_mm=[1000.0],
            column_widths_mm=[1000.0],
            name="Cache_Hit_Test",
        )

        # First call - should compute and cache
        result1 = calculate_aperture_u_value(aperture)

        # Verify cache has entry
        cache_key = _generate_u_value_cache_key(aperture)
        assert _U_VALUE_CACHE[cache_key] is not None

        # Second call - should hit cache
        result2 = calculate_aperture_u_value(aperture)

        # Results should be identical
        assert result1.u_value_w_m2k == result2.u_value_w_m2k
        assert result1.total_area_m2 == result2.total_area_m2

    def test_cache_miss_on_different_inputs(self, test_db: Session):
        """Different inputs should not hit cache."""
        # Clear the cache first
        _U_VALUE_CACHE.clear()

        aperture1 = create_test_aperture(
            test_db,
            row_heights_mm=[1000.0],
            column_widths_mm=[1000.0],
            glazing_u_value=1.0,
            name="Cache_Miss_1",
        )
        aperture2 = create_test_aperture(
            test_db,
            row_heights_mm=[1000.0],
            column_widths_mm=[1000.0],
            glazing_u_value=0.7,
            name="Cache_Miss_2",
        )

        # Calculate for first aperture
        result1 = calculate_aperture_u_value(aperture1)

        # Calculate for second aperture - should compute, not use cache
        result2 = calculate_aperture_u_value(aperture2)

        # Results should be different due to different glazing U-value
        assert result1.u_value_w_m2k != result2.u_value_w_m2k
