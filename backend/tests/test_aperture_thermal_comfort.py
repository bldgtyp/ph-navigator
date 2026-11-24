"""Unit and route tests for Phius window thermal-comfort screening (#72)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal, cast
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from database import transaction
from features.aperture_u_value.comfort import (
    PHIUS_COMFORT_RULESET,
    PHIUS_PERIMETER_HEAT_MIN_HEIGHT_MM,
    U_IP_TO_SI,
    compute_phius_u_max,
    derive_element_head_height_mm,
    evaluate_aperture_thermal_comfort,
)
from features.aperture_u_value.service import calculate_aperture_u_values
from features.project_climate_source import repository as climate_source_repo
from features.project_document.aperture_commands.dispatcher import apply_aperture_command
from features.project_document.aperture_commands.models import (
    ApertureAssignmentSnapshot,
    DuplicateApertureType,
    MergeElements,
    PasteAssignment,
    PickFrame,
    PickGlazing,
    RefreshRefFromCatalog,
    SetApertureComfortParams,
    SetElementComfortFlags,
    SetElementKind,
    SplitElement,
)
from features.project_document.apertures.factories import DefaultsCatalogReader
from features.project_document.document import (
    ApertureElement,
    ApertureElementFrames,
    ApertureTypeEntry,
    CatalogOrigin,
    FrameRef,
    GlazingRef,
    ProjectDocumentTables,
    ProjectDocumentV1,
    ProjectFrame,
    ProjectGlazing,
)
from features.project_document.validation import document_etag
from features.projects.models import CreateProjectRequest
from features.projects.service import empty_project_document
from tests.test_apertures_mcp import _seed_aperture
from tests.test_project_document import ORIGIN, create_project, signed_in_client


class _FakeCatalog:
    def frame_exists(self, _record_id: str) -> bool:
        return True

    def glazing_exists(self, _record_id: str) -> bool:
        return True


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
    nfrc_whole_window_u_w_m2k: float | None = None,
    nfrc_standard_size_note: str | None = None,
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
        nfrc_whole_window_u_w_m2k=nfrc_whole_window_u_w_m2k,
        nfrc_standard_size_note=nfrc_standard_size_note,
    )


def test_phius_u_max_formula_and_clamping() -> None:
    dt_low, u_ip_low, u_si_low = compute_phius_u_max(304.8, -10.0)
    assert dt_low == pytest.approx(13.3)
    expected_ip_low = 13.3 / (0.74 * (68.0 - 14.0))
    assert u_ip_low == pytest.approx(expected_ip_low)
    assert u_si_low == pytest.approx(expected_ip_low * U_IP_TO_SI)

    dt_mid, u_ip_mid, _ = compute_phius_u_max(2438.4, -10.0)
    assert dt_mid == pytest.approx(14.7 - 0.742 * 8.0)
    assert u_ip_mid == pytest.approx(dt_mid / (0.74 * 54.0))

    dt_high, u_ip_high, _ = compute_phius_u_max(3657.6, -10.0)
    assert dt_high == pytest.approx(6.0)
    assert u_ip_high == pytest.approx(6.0 / (0.74 * 54.0))

    dt_mild, u_ip_mild, u_si_mild = compute_phius_u_max(2438.4, 21.0)
    assert dt_mild > 0
    assert u_ip_mild is None
    assert u_si_mild is None


def test_head_height_derivation_over_ragged_grid_with_voids_and_spans() -> None:
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


def test_mixed_storefront_per_lite_nfrc_and_missing_caveat_on_pass_and_fail() -> None:
    tables = _synthetic_tables(frame_u=1.8, frame_width_mm=90.0, psi_g=0.05, glazing_u=0.80)
    entry = ApertureTypeEntry(
        id="apt_sf",
        name="SF-Mixed",
        sill_height_mm=207.0,
        row_heights_mm=[500.0, 2853.0],
        column_widths_mm=[1200.0],
        elements=[
            _glazed("aptel_transom", "Top Transom", (0, 0), (0, 0)),
            _glazed("aptel_vision", "Lower Vision", (1, 1), (0, 0)),
        ],
    )
    res_proj_only = evaluate_aperture_thermal_comfort(
        entry,
        tables,
        heating_990_db_c=-10.0,
        climate_source_label="JFK Synthetic",
        climate_source_basis="ASHRAE 2021",
    )
    assert res_proj_only.ruleset == PHIUS_COMFORT_RULESET
    assert res_proj_only.state == "fail"
    by_el = {el.element_id: el for el in res_proj_only.elements}
    assert by_el["aptel_transom"].state == "fail"
    assert by_el["aptel_transom"].nfrc_route_missing_caveat is True

    # Giving ONLY the transom an NFRC rating passes the transom while leaving the lower
    # vision lite unaffected by the transom's NFRC rating!
    mixed_entry = entry.model_copy(
        update={
            "elements": [
                _glazed(
                    "aptel_transom",
                    "Top Transom",
                    (0, 0),
                    (0, 0),
                    nfrc_whole_window_u_w_m2k=0.55,
                    nfrc_standard_size_note="Fixed 2.00 m x 2.00 m",
                ),
                _glazed("aptel_vision", "Lower Vision", (1, 1), (0, 0)),
            ]
        }
    )
    # Use a colder design temp where lower vision fails project-specific U so we prove
    # the transom's NFRC rating does NOT leak onto the lower vision lite.
    res_mixed = evaluate_aperture_thermal_comfort(mixed_entry, tables, heating_990_db_c=-20.0)
    mixed_by_el = {el.element_id: el for el in res_mixed.elements}
    assert mixed_by_el["aptel_transom"].state == "pass"
    assert mixed_by_el["aptel_transom"].governing_route == "nfrc_standard"
    assert mixed_by_el["aptel_transom"].nfrc_route_missing_caveat is False
    assert mixed_by_el["aptel_vision"].state == "fail"
    assert mixed_by_el["aptel_vision"].u_nfrc_standard_w_m2k is None
    assert mixed_by_el["aptel_vision"].nfrc_route_missing_caveat is True
    assert res_mixed.state == "fail"

    # Project-only PASS must ALSO carry nfrc_route_missing_caveat = True.
    good_tables = _synthetic_tables(frame_u=0.75, frame_width_mm=60.0, psi_g=0.03, glazing_u=0.50)
    res_good = evaluate_aperture_thermal_comfort(entry, good_tables, heating_990_db_c=-10.0)
    assert res_good.state == "pass"
    assert all(el.nfrc_route_missing_caveat is True for el in res_good.elements)


def test_perimeter_heating_6ft_height_eligibility_boundary() -> None:
    tables = _synthetic_tables(frame_u=2.2, frame_width_mm=90.0, psi_g=0.06, glazing_u=1.40)

    # Exactly 6 ft (1828.8 mm) is NOT taller than 6 ft -> perimeter heat ineligible -> stays fail.
    at_6ft = ApertureTypeEntry(
        id="apt_6ft",
        name="W-6ft",
        sill_height_mm=600.0,
        row_heights_mm=[PHIUS_PERIMETER_HEAT_MIN_HEIGHT_MM],
        column_widths_mm=[1200.0],
        elements=[
            _glazed(
                "aptel_1",
                "Six Foot Lite",
                (0, 0),
                (0, 0),
                perimeter_heat_within_3ft=True,
                perimeter_heat_note="Trench convector",
            )
        ],
    )
    res_at_6ft = evaluate_aperture_thermal_comfort(at_6ft, tables, heating_990_db_c=-10.0)
    assert res_at_6ft.state == "fail"
    assert res_at_6ft.elements[0].perimeter_heat_ineligible is True

    # 1829.0 mm (> 6 ft) IS eligible -> reports `alternative` when failing U check.
    over_6ft = at_6ft.model_copy(update={"row_heights_mm": [1829.0]})
    res_over_6ft = evaluate_aperture_thermal_comfort(over_6ft, tables, heating_990_db_c=-10.0)
    assert res_over_6ft.state == "alternative"
    assert res_over_6ft.elements[0].perimeter_heat_ineligible is False

    # Direct pass is preserved even when perimeter_heat_within_3ft is set on a >6 ft lite!
    good_tables = _synthetic_tables(frame_u=0.75, frame_width_mm=60.0, psi_g=0.03, glazing_u=0.50)
    res_direct_pass = evaluate_aperture_thermal_comfort(over_6ft, good_tables, heating_990_db_c=-10.0)
    assert res_direct_pass.state == "pass"

    # Missing U data stays blocked even when perimeter_heat_within_3ft is set on a >6 ft lite!
    empty_tables = ProjectDocumentTables()
    res_missing_u = evaluate_aperture_thermal_comfort(over_6ft, empty_tables, heating_990_db_c=-10.0)
    assert res_missing_u.state == "blocked"
    assert "missing_element_u_value" in res_missing_u.blocked_reasons


def test_unrounded_project_u_compared_against_u_max() -> None:
    # Construct synthetic geometry where exact U is slightly above U_max (e.g. X.XXXX4 > U_max > X.XXXX0)
    # so comparing the 4-decimal rounded legacy value would false-pass.
    tables = _synthetic_tables(frame_u=1.4, frame_width_mm=80.0, psi_g=0.04, glazing_u=0.65)
    entry = ApertureTypeEntry(
        id="apt_bound",
        name="W-Boundary",
        sill_height_mm=900.0,
        row_heights_mm=[1500.0],
        column_widths_mm=[1000.0],
        elements=[_glazed("aptel_1", "Lite", (0, 0), (0, 0))],
    )
    legacy = calculate_aperture_u_values(entry, tables)
    rounded_u = legacy.elements[0].u_value_w_m2k
    # Compute exact unrounded U via evaluate_aperture_thermal_comfort
    probe = evaluate_aperture_thermal_comfort(entry, tables, heating_990_db_c=-10.0)
    exact_u = probe.elements[0].u_project_specific_w_m2k
    assert exact_u is not None
    # Pick a glazing_u so exact_u is strictly above round(exact_u, 4)
    # (offset by +0.00004 via glazing_u tweak if needed).
    if exact_u <= rounded_u:
        tables = _synthetic_tables(frame_u=1.4, frame_width_mm=80.0, psi_g=0.04, glazing_u=0.65006)
        legacy = calculate_aperture_u_values(entry, tables)
        rounded_u = legacy.elements[0].u_value_w_m2k
        probe = evaluate_aperture_thermal_comfort(entry, tables, heating_990_db_c=-10.0)
        exact_u = probe.elements[0].u_project_specific_w_m2k
        assert exact_u is not None
    assert exact_u > rounded_u

    # Solve for td_c such that u_max sits strictly between rounded_u and exact_u.
    target_u_max = (rounded_u + exact_u) / 2.0
    head_mm = derive_element_head_height_mm(entry, entry.elements[0])
    dt_max_f, _, _ = compute_phius_u_max(head_mm, -10.0)
    u_max_ip = target_u_max / U_IP_TO_SI
    delta_t_design_f = dt_max_f / (0.74 * u_max_ip)
    td_f = 68.0 - delta_t_design_f
    td_c = (td_f - 32.0) * 5.0 / 9.0

    res = evaluate_aperture_thermal_comfort(entry, tables, heating_990_db_c=td_c)
    assert res.elements[0].u_max_w_m2k == pytest.approx(target_u_max)
    assert res.elements[0].state == "fail"


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


def test_comfort_commands_void_duplicate_merge_split_and_substitution() -> None:
    base = empty_project_document(CreateProjectRequest(bt_number="2601", name="Comfort Cmds"))
    entry = ApertureTypeEntry(
        id="apt_1",
        name="W-01",
        row_heights_mm=[1500.0, 1500.0],
        column_widths_mm=[1000.0],
        elements=[
            _glazed("aptel_1", "Top", (0, 0), (0, 0)),
            _glazed("aptel_2", "Bottom", (1, 1), (0, 0)),
        ],
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
    catalog = cast(DefaultsCatalogReader, _FakeCatalog())

    # Set sill height + per-element NFRC U and exemption.
    body, _ = apply_aperture_command(
        body,
        SetApertureComfortParams(aperture_type_id="apt_1", sill_height_mm=900.0),
        actor_user_id="usr_1",
        catalog=catalog,
    )
    body, _ = apply_aperture_command(
        body,
        SetElementComfortFlags(
            aperture_type_id="apt_1",
            element_id="aptel_1",
            comfort_exempt=True,
            comfort_exempt_reason="ada_door",
            nfrc_whole_window_u_w_m2k=0.78,
            nfrc_standard_size_note="1.20 m x 1.50 m",
        ),
        actor_user_id="usr_1",
        catalog=catalog,
    )
    assert body.tables.apertures[0].sill_height_mm == 900.0
    assert body.tables.apertures[0].elements[0].nfrc_whole_window_u_w_m2k == pytest.approx(0.78)

    # Duplicate preserves sill_height_mm and per-element comfort fields.
    dup_body, _ = apply_aperture_command(
        body,
        DuplicateApertureType(aperture_type_id="apt_1"),
        actor_user_id="usr_1",
        catalog=catalog,
    )
    assert len(dup_body.tables.apertures) == 2
    assert dup_body.tables.apertures[1].sill_height_mm == 900.0
    assert dup_body.tables.apertures[1].elements[0].comfort_exempt is True

    # Converting a flagged lite to void clears comfort flags and NFRC cleanly (no 422).
    void_body, _ = apply_aperture_command(
        body,
        SetElementKind(aperture_type_id="apt_1", element_ids=["aptel_1"], element_kind="void"),
        actor_user_id="usr_1",
        catalog=catalog,
    )
    voided = void_body.tables.apertures[0].elements[0]
    assert voided.kind == "void"
    assert voided.comfort_exempt is False
    assert voided.nfrc_whole_window_u_w_m2k is None

    # Frame/glazing substitution clears stale NFRC rating on that lite.
    picked_frame_body, _ = apply_aperture_command(
        body,
        PickFrame(
            aperture_type_id="apt_1",
            element_id="aptel_1",
            side="top",
            frame=FrameRef(
                name="Replacement Frame",
                width_mm=75.0,
                u_value_w_m2k=1.1,
                psi_g_w_mk=0.04,
                catalog_origin=CatalogOrigin(
                    catalog_table="frame_types",
                    catalog_record_id="recFrm00000000002",
                    catalog_schema_version=1,
                    synced_at=datetime.now(tz=UTC),
                ),
            ),
        ),
        actor_user_id="usr_1",
        catalog=catalog,
    )
    assert picked_frame_body.tables.apertures[0].elements[0].nfrc_whole_window_u_w_m2k is None

    picked_glazing_body, _ = apply_aperture_command(
        body,
        PickGlazing(
            aperture_type_id="apt_1",
            element_id="aptel_1",
            glazing=GlazingRef(
                name="Replacement Glazing",
                u_value_w_m2k=0.55,
                g_value=0.40,
                catalog_origin=CatalogOrigin(
                    catalog_table="glazing_types",
                    catalog_record_id="recGlz00000000002",
                    catalog_schema_version=1,
                    synced_at=datetime.now(tz=UTC),
                ),
            ),
        ),
        actor_user_id="usr_1",
        catalog=catalog,
    )
    assert picked_glazing_body.tables.apertures[0].elements[0].nfrc_whole_window_u_w_m2k is None

    # Merge preserves identical comfort flags; split preserves comfort flags on children.
    both_exempt_body, _ = apply_aperture_command(
        body,
        SetElementComfortFlags(
            aperture_type_id="apt_1",
            element_id="aptel_2",
            comfort_exempt=True,
            comfort_exempt_reason="ada_door",
        ),
        actor_user_id="usr_1",
        catalog=catalog,
    )
    merged_body, _ = apply_aperture_command(
        both_exempt_body,
        MergeElements(aperture_type_id="apt_1", element_ids=["aptel_1", "aptel_2"]),
        actor_user_id="usr_1",
        catalog=catalog,
    )
    merged_el = merged_body.tables.apertures[0].elements[0]
    assert merged_el.comfort_exempt is True
    assert merged_el.comfort_exempt_reason == "ada_door"
    # NFRC differed (0.78 vs None), so merge resets NFRC to None.
    assert merged_el.nfrc_whole_window_u_w_m2k is None

    split_body, _ = apply_aperture_command(
        merged_body,
        SplitElement(aperture_type_id="apt_1", element_id=merged_el.id),
        actor_user_id="usr_1",
        catalog=catalog,
    )
    assert all(el.comfort_exempt is True for el in split_body.tables.apertures[0].elements)

    # Exemption without reason is rejected.
    with pytest.raises(HTTPException) as exc:
        apply_aperture_command(
            body,
            SetElementComfortFlags(
                aperture_type_id="apt_1",
                element_id="aptel_2",
                comfort_exempt=True,
                comfort_exempt_reason=None,
            ),
            actor_user_id="usr_1",
            catalog=catalog,
        )
    assert exc.value.status_code == 422

    # Comfort flags on an already-void lite are rejected.
    with pytest.raises(HTTPException) as exc_void:
        apply_aperture_command(
            void_body,
            SetElementComfortFlags(
                aperture_type_id="apt_1",
                element_id="aptel_1",
                comfort_exempt=True,
                comfort_exempt_reason="ada_door",
            ),
            actor_user_id="usr_1",
            catalog=catalog,
        )
    assert exc_void.value.status_code == 422

    # Perimeter heat with blank note is rejected.
    with pytest.raises(HTTPException) as exc_perim:
        apply_aperture_command(
            body,
            SetElementComfortFlags(
                aperture_type_id="apt_1",
                element_id="aptel_2",
                perimeter_heat_within_3ft=True,
                perimeter_heat_note="   ",
            ),
            actor_user_id="usr_1",
            catalog=catalog,
        )
    assert exc_perim.value.status_code == 422

    # Out-of-range sill height and NFRC U are rejected by Pydantic validation.
    with pytest.raises(ValueError):
        SetApertureComfortParams(aperture_type_id="apt_1", sill_height_mm=-1.0)
    with pytest.raises(ValueError):
        SetElementComfortFlags(aperture_type_id="apt_1", element_id="aptel_1", nfrc_whole_window_u_w_m2k=0.0)
    with pytest.raises(ValueError):
        SetElementComfortFlags(aperture_type_id="apt_1", element_id="aptel_1", nfrc_whole_window_u_w_m2k=-0.5)

    # Reselecting the SAME glazing preserves NFRC; replacing clears it.
    same_glazing_origin = CatalogOrigin(
        catalog_table="glazing_types",
        catalog_record_id="recGlz00000000001",
        catalog_schema_version=1,
        synced_at=datetime.now(tz=UTC),
    )
    body_with_cat_glz = body.model_copy(
        update={
            "tables": body.tables.model_copy(
                update={
                    "project_glazings": [
                        body.tables.project_glazings[0].model_copy(update={"catalog_origin": same_glazing_origin})
                    ]
                }
            )
        }
    )
    reselected_body, _ = apply_aperture_command(
        body_with_cat_glz,
        PickGlazing(
            aperture_type_id="apt_1",
            element_id="aptel_1",
            glazing=GlazingRef(
                name="Synthetic Triple",
                u_value_w_m2k=0.65,
                g_value=0.45,
                catalog_origin=same_glazing_origin,
            ),
        ),
        actor_user_id="usr_1",
        catalog=catalog,
    )
    assert reselected_body.tables.apertures[0].elements[0].nfrc_whole_window_u_w_m2k == pytest.approx(0.78)

    # Refreshing a shared glazing's documentation-only field preserves NFRC;
    # refreshing a thermal field clears NFRC on every lite referencing that glazing.
    doc_refresh_body, _ = apply_aperture_command(
        body_with_cat_glz,
        RefreshRefFromCatalog(
            aperture_type_id="apt_1",
            element_id="aptel_1",
            target="glazing",
            chosen_values={"comments": "Updated datasheet note"},
        ),
        actor_user_id="usr_1",
        catalog=catalog,
    )
    assert doc_refresh_body.tables.apertures[0].elements[0].nfrc_whole_window_u_w_m2k == pytest.approx(0.78)

    thermal_refresh_body, _ = apply_aperture_command(
        body_with_cat_glz,
        RefreshRefFromCatalog(
            aperture_type_id="apt_1",
            element_id="aptel_2",
            target="glazing",
            chosen_values={"u_value_w_m2k": 0.92},
        ),
        actor_user_id="usr_1",
        catalog=catalog,
    )
    assert thermal_refresh_body.tables.apertures[0].elements[0].nfrc_whole_window_u_w_m2k is None

    # Paste clears target's NFRC; paste-undo restores target's original NFRC rating and note.
    orig_el = body.tables.apertures[0].elements[0]
    pasted_body, _ = apply_aperture_command(
        body,
        PasteAssignment(
            aperture_type_id="apt_1",
            source_element_id="aptel_2",
            target_element_ids=["aptel_1"],
        ),
        actor_user_id="usr_1",
        catalog=catalog,
    )
    assert pasted_body.tables.apertures[0].elements[0].nfrc_whole_window_u_w_m2k is None

    restored_body, _ = apply_aperture_command(
        pasted_body,
        PasteAssignment(
            aperture_type_id="apt_1",
            source_element_id="aptel_1",
            target_element_ids=["aptel_1"],
            restore_assignment=ApertureAssignmentSnapshot(
                operation=orig_el.operation,
                glazing_id=orig_el.glazing_id,
                frames=orig_el.frames,
                installs=orig_el.installs,
                nfrc_whole_window_u_w_m2k=orig_el.nfrc_whole_window_u_w_m2k,
                nfrc_standard_size_note=orig_el.nfrc_standard_size_note,
            ),
        ),
        actor_user_id="usr_1",
        catalog=catalog,
    )
    assert restored_body.tables.apertures[0].elements[0].nfrc_whole_window_u_w_m2k == pytest.approx(0.78)
    assert restored_body.tables.apertures[0].elements[0].nfrc_standard_size_note == "1.20 m x 1.50 m"


def test_thermal_comfort_route_populated_draft_version_and_climate(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = project["id"]
    version_id = project["active_version_id"]

    # 1. Attach a weather climate source with ASHRAE 99% heating_990_db_c = -10.0 °C
    #    matching the exact shape written by `refresh_ashrae_design_conditions`.
    with transaction() as conn:
        weather_row = climate_source_repo.insert_source(
            conn,
            source_id=uuid4(),
            project_id=UUID(str(project_id)),
            kind="weather",
            ref="asset_synth_epw",
            label="Synthetic Weather Station",
            data={
                "design_conditions": {
                    "basis": "ASHRAE 2021",
                    "source": "ashrae-meteo",
                    "heating_990_db_c": -10.0,
                }
            },
        )
    climate_id = UUID(str(weather_row["id"]))

    # 2. Seed a glazed aperture type into the version document (missing sill height -> blocked).
    seeded_body = _seed_aperture(str(version_id))
    version_etag = document_etag(ProjectDocumentV1.model_validate(seeded_body))
    aperture_id = "apt_A"
    element_id = "aptel_A1"

    # 3. Invalid comfort command (exempt without reason) returns 422.
    bad_cmd = client.post(
        f"/api/v1/projects/{project_id}/versions/{version_id}/apertures/command",
        headers={"Origin": ORIGIN, "If-Match-Version": version_etag},
        json={
            "kind": "setElementComfortFlags",
            "aperture_type_id": aperture_id,
            "element_id": element_id,
            "comfort_exempt": True,
            "comfort_exempt_reason": None,
        },
    )
    assert bad_cmd.status_code == 422, bad_cmd.text

    # 4. Set sill height and per-element NFRC U through the command endpoint.
    sill_cmd = client.post(
        f"/api/v1/projects/{project_id}/versions/{version_id}/apertures/command",
        headers={"Origin": ORIGIN, "If-Match-Version": version_etag},
        json={
            "kind": "setApertureComfortParams",
            "aperture_type_id": aperture_id,
            "sill_height_mm": 900.0,
        },
    )
    assert sill_cmd.status_code == 200, sill_cmd.text
    draft_etag = sill_cmd.json()["draft_etag"]

    nfrc_cmd = client.post(
        f"/api/v1/projects/{project_id}/versions/{version_id}/apertures/command",
        headers={"Origin": ORIGIN, "If-Match": draft_etag},
        json={
            "kind": "setElementComfortFlags",
            "aperture_type_id": aperture_id,
            "element_id": element_id,
            "nfrc_whole_window_u_w_m2k": 0.72,
            "nfrc_standard_size_note": "1.20 m x 1.50 m",
        },
    )
    assert nfrc_cmd.status_code == 200, nfrc_cmd.text

    # 5. Draft route returns populated passing result; version route is still blocked pre-save.
    draft_comfort = client.get(
        f"/api/v1/projects/{project_id}/versions/{version_id}/apertures/thermal-comfort?source=draft",
        headers={"Origin": ORIGIN},
    )
    assert draft_comfort.status_code == 200, draft_comfort.text
    draft_payload = draft_comfort.json()
    assert len(draft_payload["apertures"]) == 1
    assert draft_payload["apertures"][0]["state"] == "pass"
    assert draft_payload["apertures"][0]["heating_990_db_c"] == pytest.approx(-10.0)
    assert draft_payload["apertures"][0]["elements"][0]["u_nfrc_standard_w_m2k"] == pytest.approx(0.72)

    version_comfort = client.get(
        f"/api/v1/projects/{project_id}/versions/{version_id}/apertures/thermal-comfort?source=version",
        headers={"Origin": ORIGIN},
    )
    assert version_comfort.status_code == 200, version_comfort.text
    assert version_comfort.json()["apertures"][0]["state"] == "blocked"
    assert "missing_sill_height" in version_comfort.json()["apertures"][0]["blocked_reasons"]

    # 6. Save draft to version, then verify version route returns the populated result.
    save_resp = client.post(
        f"/api/v1/projects/{project_id}/versions/{version_id}/draft/save",
        headers={"Origin": ORIGIN, "If-Match": version_etag},
    )
    assert save_resp.status_code == 200, save_resp.text

    saved_comfort = client.get(
        f"/api/v1/projects/{project_id}/versions/{version_id}/apertures/thermal-comfort?source=version",
        headers={"Origin": ORIGIN},
    )
    assert saved_comfort.status_code == 200, saved_comfort.text
    assert len(saved_comfort.json()["apertures"]) == 1
    assert saved_comfort.json()["apertures"][0]["state"] == "pass"

    # 7. Update weather source with null heating_990_db_c -> blocked on missing_climate_source.
    with transaction() as conn:
        climate_source_repo.update_source(
            conn,
            climate_id,
            {
                "data": {
                    "design_conditions": {
                        "basis": "ASHRAE 2021",
                        "source": "ashrae-meteo",
                        "heating_990_db_c": None,
                    }
                }
            },
        )

    blocked_comfort = client.get(
        f"/api/v1/projects/{project_id}/versions/{version_id}/apertures/thermal-comfort?source=version",
        headers={"Origin": ORIGIN},
    )
    assert blocked_comfort.status_code == 200, blocked_comfort.text
    assert blocked_comfort.json()["apertures"][0]["state"] == "blocked"
    assert "missing_climate_source" in blocked_comfort.json()["apertures"][0]["blocked_reasons"]
