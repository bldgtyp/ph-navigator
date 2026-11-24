"""Unit and route tests for Phius window thermal-comfort screening (#72)."""

from __future__ import annotations

from typing import Literal, cast

import pytest
from fastapi import HTTPException

from features.aperture_u_value.comfort import (
    PHIUS_COMFORT_RULESET,
    U_IP_TO_SI,
    compute_phius_u_max,
    derive_element_head_height_mm,
    evaluate_aperture_thermal_comfort,
)
from features.project_document.aperture_commands.dispatcher import apply_aperture_command
from features.project_document.aperture_commands.models import (
    SetApertureComfortParams,
    SetElementComfortFlags,
)
from features.project_document.apertures.factories import DefaultsCatalogReader
from features.project_document.document import (
    ApertureElement,
    ApertureElementFrames,
    ApertureTypeEntry,
    ProjectDocumentTables,
    ProjectFrame,
    ProjectGlazing,
)
from features.projects.models import CreateProjectRequest
from features.projects.service import empty_project_document
from tests.test_project_document import ORIGIN, create_project, signed_in_client


def _synthetic_tables(
    *,
    frame_u: float = 1.4,
    frame_width_mm: float = 80.0,
    psi_g: float = 0.04,
    glazing_u: float = 0.65,
) -> ProjectDocumentTables:
    frame = ProjectFrame(
        id="pfrm_synth",
        name="Synthetic Frame",
        width_mm=frame_width_mm,
        u_value_w_m2k=frame_u,
        psi_g_w_mk=psi_g,
    )
    glazing = ProjectGlazing(
        id="pglz_synth",
        name="Synthetic Triple",
        u_value_w_m2k=glazing_u,
        g_value=0.45,
    )
    return ProjectDocumentTables(project_frames=[frame], project_glazings=[glazing])


def _glazed(
    element_id: str,
    name: str,
    row_span: tuple[int, int],
    column_span: tuple[int, int],
    *,
    comfort_exempt: bool = False,
    comfort_exempt_reason: Literal["non_regularly_occupied", "ada_door"] | None = None,
    perimeter_heat_within_3ft: bool = False,
    perimeter_heat_note: str | None = None,
) -> ApertureElement:
    return ApertureElement(
        id=element_id,
        name=name,
        row_span=row_span,
        column_span=column_span,
        frames=ApertureElementFrames(
            top="pfrm_synth",
            right="pfrm_synth",
            bottom="pfrm_synth",
            left="pfrm_synth",
        ),
        glazing_id="pglz_synth",
        comfort_exempt=comfort_exempt,
        comfort_exempt_reason=comfort_exempt_reason,
        perimeter_heat_within_3ft=perimeter_heat_within_3ft,
        perimeter_heat_note=perimeter_heat_note,
    )


def test_phius_u_max_formula_and_clamping() -> None:
    # Low head height (1 ft = 304.8 mm): 14.7 - 0.742*1 = 13.958 -> clamped to 13.3 °F.
    # Td = -10 °C = 14 °F -> deltaT_design = 54 °F -> U_max_ip = 13.3 / (0.74 * 54).
    dt_low, u_ip_low, u_si_low = compute_phius_u_max(304.8, -10.0)
    assert dt_low == pytest.approx(13.3)
    expected_ip_low = 13.3 / (0.74 * (68.0 - 14.0))
    assert u_ip_low == pytest.approx(expected_ip_low)
    assert u_si_low == pytest.approx(expected_ip_low * U_IP_TO_SI)

    # Mid head height (8 ft = 2438.4 mm): 14.7 - 0.742*8 = 8.764 °F.
    dt_mid, u_ip_mid, _ = compute_phius_u_max(2438.4, -10.0)
    assert dt_mid == pytest.approx(14.7 - 0.742 * 8.0)
    assert u_ip_mid == pytest.approx(dt_mid / (0.74 * 54.0))

    # Tall / double-height (12 ft = 3657.6 mm >= 11.73 ft): clamped to 6.0 °F floor.
    dt_high, u_ip_high, _ = compute_phius_u_max(3657.6, -10.0)
    assert dt_high == pytest.approx(6.0)
    assert u_ip_high == pytest.approx(6.0 / (0.74 * 54.0))

    # Mild climate (Td >= 68 °F = 20 °C): no heating comfort restriction.
    dt_mild, u_ip_mild, u_si_mild = compute_phius_u_max(2438.4, 21.0)
    assert dt_mild > 0
    assert u_ip_mild is None
    assert u_si_mild is None


def test_head_height_derivation_over_ragged_grid_with_voids_and_spans() -> None:
    # Row 0 = top transom (600 mm), Row 1 = mid (1200 mm), Row 2 = base (1553 mm); sill = 207 mm.
    # Total grid = 3353 mm; top head = 207 + 3353 = 3560 mm (3.56 m).
    entry = ApertureTypeEntry(
        id="apt_storefront",
        name="SF-01",
        sill_height_mm=207.0,
        row_heights_mm=[600.0, 1200.0, 1553.0],
        column_widths_mm=[1000.0, 1000.0],
        elements=[
            _glazed("aptel_transom", "Transom", (0, 0), (0, 1)),
            _glazed("aptel_tall", "Tall Vision", (1, 2), (0, 0)),
            _glazed("aptel_mid", "Mid", (1, 1), (1, 1)),
            ApertureElement(id="aptel_void", name="Empty", kind="void", row_span=(2, 2), column_span=(1, 1)),
        ],
    )
    by_id = {el.id: el for el in entry.elements}
    assert derive_element_head_height_mm(entry, by_id["aptel_transom"]) == pytest.approx(3560.0)
    assert derive_element_head_height_mm(entry, by_id["aptel_tall"]) == pytest.approx(2960.0)
    assert derive_element_head_height_mm(entry, by_id["aptel_mid"]) == pytest.approx(2960.0)


def test_storefront_regression_both_routes_exemptions_and_alternative() -> None:
    # Synthetic storefront geometry (inspired by 3.56 m head height; synthetic U values only).
    tables = _synthetic_tables(frame_u=1.6, frame_width_mm=85.0, psi_g=0.05, glazing_u=0.70)
    entry = ApertureTypeEntry(
        id="apt_sf",
        name="SF-Synth",
        sill_height_mm=207.0,
        row_heights_mm=[500.0, 2853.0],
        column_widths_mm=[1200.0],
        elements=[
            _glazed("aptel_transom", "Top Transom", (0, 0), (0, 0)),
            _glazed("aptel_vision", "Lower Vision", (1, 1), (0, 0)),
        ],
    )
    # Cold NYC-like Td = -10 °C (14 °F): small transom at 3.56 m head has worse frame-to-glass
    # ratio and stricter U_max than the lower vision panel.
    res_proj_only = evaluate_aperture_thermal_comfort(
        entry,
        tables,
        heating_990_db_c=-10.0,
        climate_source_label="JFK Synthetic",
        climate_source_basis="ASHRAE 2021",
    )
    assert res_proj_only.ruleset == PHIUS_COMFORT_RULESET
    assert res_proj_only.state == "fail"
    assert res_proj_only.governing_element_id == "aptel_transom"
    by_el = {el.element_id: el for el in res_proj_only.elements}
    assert by_el["aptel_transom"].state == "fail"
    assert by_el["aptel_transom"].nfrc_route_missing_caveat is True
    assert by_el["aptel_vision"].head_height_mm == pytest.approx(3060.0)

    # Supplying an NFRC standard-size whole-window U that clears the transom's U_max passes it!
    transom_u_max = by_el["aptel_transom"].u_max_w_m2k
    assert transom_u_max is not None
    entry_with_nfrc = entry.model_copy(
        update={
            "nfrc_whole_window_u_w_m2k": round(transom_u_max * 0.90, 4),
            "nfrc_standard_size_note": "2.00 m x 2.00 m",
        }
    )
    res_nfrc = evaluate_aperture_thermal_comfort(
        entry_with_nfrc,
        tables,
        heating_990_db_c=-10.0,
    )
    assert res_nfrc.state == "pass"
    assert res_nfrc.failing_count == 0
    nfrc_transom = next(el for el in res_nfrc.elements if el.element_id == "aptel_transom")
    assert nfrc_transom.governing_route == "nfrc_standard"
    assert nfrc_transom.nfrc_route_missing_caveat is False

    # Marking failing transom with perimeter heating within 3 ft yields `alternative` roll-up.
    alt_entry = entry.model_copy(
        update={
            "elements": [
                _glazed(
                    "aptel_transom",
                    "Top Transom",
                    (0, 0),
                    (0, 0),
                    perimeter_heat_within_3ft=True,
                    perimeter_heat_note="Hydronic trench convector within 18 in.",
                ),
                _glazed("aptel_vision", "Lower Vision", (1, 1), (0, 0)),
            ]
        }
    )
    # Give lower vision a passing glazing so roll-up is `alternative`.
    good_tables = _synthetic_tables(frame_u=0.8, frame_width_mm=60.0, psi_g=0.03, glazing_u=0.50)
    res_alt = evaluate_aperture_thermal_comfort(alt_entry, good_tables, heating_990_db_c=-10.0)
    assert res_alt.state == "alternative"

    # Marking failing transom as exempt (ADA door / transient) clears failure.
    exempt_entry = entry.model_copy(
        update={
            "elements": [
                _glazed(
                    "aptel_transom",
                    "Top Transom",
                    (0, 0),
                    (0, 0),
                    comfort_exempt=True,
                    comfort_exempt_reason="non_regularly_occupied",
                ),
                _glazed("aptel_vision", "Lower Vision", (1, 1), (0, 0)),
            ]
        }
    )
    res_exempt = evaluate_aperture_thermal_comfort(exempt_entry, good_tables, heating_990_db_c=-10.0)
    assert res_exempt.state == "pass"
    assert res_exempt.governing_element_id == "aptel_vision"


def test_blocked_states_missing_sill_and_climate() -> None:
    tables = _synthetic_tables()
    entry_no_sill = ApertureTypeEntry(
        id="apt_nosill",
        name="W-NoSill",
        row_heights_mm=[1500.0],
        column_widths_mm=[1000.0],
        elements=[_glazed("aptel_1", "Lite", (0, 0), (0, 0))],
    )
    res_both = evaluate_aperture_thermal_comfort(entry_no_sill, tables, heating_990_db_c=None)
    assert res_both.state == "blocked"
    assert "missing_sill_height" in res_both.blocked_reasons
    assert "missing_climate_source" in res_both.blocked_reasons

    res_no_sill = evaluate_aperture_thermal_comfort(entry_no_sill, tables, heating_990_db_c=-10.0)
    assert res_no_sill.state == "blocked"
    assert res_no_sill.blocked_reasons == ["missing_sill_height"]


def test_comfort_commands_validate_and_persist() -> None:
    base = empty_project_document(CreateProjectRequest(bt_number="2601", name="Comfort Cmds"))
    entry = ApertureTypeEntry(
        id="apt_1",
        name="W-01",
        row_heights_mm=[1500.0],
        column_widths_mm=[1000.0],
        elements=[_glazed("aptel_1", "Lite 1", (0, 0), (0, 0))],
    )
    synth = _synthetic_tables()
    body = base.model_copy(
        update={
            "tables": base.tables.model_copy(
                update={
                    "apertures": [entry],
                    "project_frames": synth.project_frames,
                    "project_glazings": synth.project_glazings,
                }
            )
        }
    )
    stub_catalog = cast(DefaultsCatalogReader, None)

    body, _ = apply_aperture_command(
        body,
        SetApertureComfortParams(
            aperture_type_id="apt_1",
            sill_height_mm=900.0,
            nfrc_whole_window_u_w_m2k=0.78,
            nfrc_standard_size_note="1.20 m x 1.50 m",
        ),
        actor_user_id="usr_1",
        catalog=stub_catalog,
    )
    assert body.tables.apertures[0].sill_height_mm == 900.0
    assert body.tables.apertures[0].nfrc_whole_window_u_w_m2k == pytest.approx(0.78)
    assert body.tables.apertures[0].nfrc_standard_size_note == "1.20 m x 1.50 m"

    # Exemption without reason is rejected.
    with pytest.raises(HTTPException) as exc:
        apply_aperture_command(
            body,
            SetElementComfortFlags(
                aperture_type_id="apt_1",
                element_id="aptel_1",
                comfort_exempt=True,
                comfort_exempt_reason=None,
            ),
            actor_user_id="usr_1",
            catalog=stub_catalog,
        )
    assert exc.value.status_code == 422

    # Valid exemption persists.
    body, _ = apply_aperture_command(
        body,
        SetElementComfortFlags(
            aperture_type_id="apt_1",
            element_id="aptel_1",
            comfort_exempt=True,
            comfort_exempt_reason="ada_door",
        ),
        actor_user_id="usr_1",
        catalog=stub_catalog,
    )
    assert body.tables.apertures[0].elements[0].comfort_exempt is True
    assert body.tables.apertures[0].elements[0].comfort_exempt_reason == "ada_door"


def test_thermal_comfort_route_smoke(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    response = client.get(
        f"/api/v1/projects/{project['id']}/versions/{project['active_version_id']}/apertures/thermal-comfort?source=draft",
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["project_id"] == project["id"]
    assert payload["source"] == "draft"
    assert payload["apertures"] == []
