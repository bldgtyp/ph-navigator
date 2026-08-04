"""Aperture install-types table: seeds, validation, delete-block, migration.

Phase 01 of aperture-psi-install: the library table itself (D-2), the
program-aware Default row (D-4), per-element `installs` slots (D-1), and
the referenced-row delete block (D-8).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from features.project_document.document import (
    APERTURE_INSTALL_TYPE_SOURCE_OPTION_KEY,
    APERTURE_INSTALL_TYPE_STATUS_OPTION_KEY,
    ApertureInstallTypeRow,
    ProjectDocumentV1,
)
from features.project_document.migrations import upgrade_project_document
from features.project_document.tables.aperture_install_types import (
    APERTURE_INSTALL_DEFAULT_TYPE_ID,
    APERTURE_INSTALL_SOURCE_OPTIONS,
    ApertureInstallTypesSliceOptions,
    ApertureInstallTypesSliceReplaceRequest,
    apply_aperture_install_types_replace,
    default_install_type_row,
)
from features.projects.models import CertificationProgram, CreateProjectRequest
from features.projects.service import empty_project_document

FIXTURE_ROOT = Path(__file__).parent / "project_document_schema" / "fixtures" / "v9" / "inputs"


def _document(*, cert_programs: tuple[CertificationProgram, ...] = ("phius",)) -> ProjectDocumentV1:
    return empty_project_document(
        CreateProjectRequest(name="Installs", bt_number="9001", cert_programs=list(cert_programs))
    )


def _install_type(type_id: str, name: str, psi: float) -> ApertureInstallTypeRow:
    return ApertureInstallTypeRow(
        id=type_id,
        custom_values={"name": name, "psi_w_mk": psi, "source": "opt_apit_src_calculated"},
    )


def _aperture_with_slot(install_type_id: str | None) -> dict[str, Any]:
    return {
        "id": "apt_a",
        "name": "W-01",
        "row_heights_mm": [1000.0],
        "column_widths_mm": [800.0],
        "elements": [
            {
                "id": "aptel_a",
                "row_span": [0, 0],
                "column_span": [0, 0],
                "installs": {"top": install_type_id, "right": None, "bottom": None, "left": None},
            }
        ],
    }


def _replace_request(
    document: ProjectDocumentV1, rows: list[ApertureInstallTypeRow]
) -> ApertureInstallTypesSliceReplaceRequest:
    return ApertureInstallTypesSliceReplaceRequest(
        aperture_install_types=rows,
        single_select_options=ApertureInstallTypesSliceOptions.model_validate(
            {
                APERTURE_INSTALL_TYPE_SOURCE_OPTION_KEY: document.single_select_options[
                    APERTURE_INSTALL_TYPE_SOURCE_OPTION_KEY
                ],
                APERTURE_INSTALL_TYPE_STATUS_OPTION_KEY: document.single_select_options[
                    APERTURE_INSTALL_TYPE_STATUS_OPTION_KEY
                ],
            }
        ),
        field_defs=document.tables.aperture_install_types.field_defs,
    )


# --- template seed -----------------------------------------------------------


def test_new_phius_project_seeds_default_row_at_0_052() -> None:
    row = _document(cert_programs=("phius",)).tables.aperture_install_types.rows[0]
    assert row.id == APERTURE_INSTALL_DEFAULT_TYPE_ID
    assert row.custom_values["psi_w_mk"] == 0.052
    assert row.custom_values["source"] == "opt_apit_src_program_default"
    assert row.custom_values["status"] == "opt_status_complete"
    assert row.datasheet_not_required is True
    assert row.photo_not_required is True


@pytest.mark.parametrize("cert_programs", [(), ("phi",)])
def test_new_non_phius_project_seeds_default_row_at_0_04(cert_programs: tuple[CertificationProgram, ...]) -> None:
    row = _document(cert_programs=cert_programs).tables.aperture_install_types.rows[0]
    assert row.custom_values["psi_w_mk"] == 0.04


def test_template_seeds_source_and_status_option_lists() -> None:
    document = _document()
    source_ids = [option.id for option in document.single_select_options[APERTURE_INSTALL_TYPE_SOURCE_OPTION_KEY]]
    assert source_ids == [option.id for option in APERTURE_INSTALL_SOURCE_OPTIONS]
    status_ids = [option.id for option in document.single_select_options[APERTURE_INSTALL_TYPE_STATUS_OPTION_KEY]]
    assert "opt_status_complete" in status_ids


# --- document validation -----------------------------------------------------


def test_unknown_install_slot_reference_is_rejected() -> None:
    raw = _document().model_dump(mode="json")
    raw["tables"]["apertures"] = [_aperture_with_slot("apit_missing")]
    with pytest.raises(ValidationError, match="Unknown install type 'apit_missing'"):
        ProjectDocumentV1.model_validate(raw)


def test_valid_install_slot_reference_is_accepted() -> None:
    document = _document()
    raw = document.model_dump(mode="json")
    raw["tables"]["aperture_install_types"]["rows"].append(
        _install_type("apit_flixo1", "Flixo Detail 1", 0.021).model_dump(mode="json")
    )
    raw["tables"]["apertures"] = [_aperture_with_slot("apit_flixo1")]
    parsed = ProjectDocumentV1.model_validate(raw)
    assert parsed.tables.apertures[0].elements[0].installs.top == "apit_flixo1"


def test_missing_default_row_is_healed_program_aware() -> None:
    # The Default row is a v10 invariant: a body missing it (impossible via
    # the API — the replace path delete-blocks `apit_default`) has it
    # restored by validation rather than rejected or silently tolerated.
    raw = _document(cert_programs=("phius",)).model_dump(mode="json")
    raw["tables"]["aperture_install_types"]["rows"] = [
        _install_type("apit_other", "Other", 0.03).model_dump(mode="json")
    ]
    healed = ProjectDocumentV1.model_validate(raw)
    row_ids = [row.id for row in healed.tables.aperture_install_types.rows]
    assert row_ids == ["apit_other", APERTURE_INSTALL_DEFAULT_TYPE_ID]
    assert healed.tables.aperture_install_types.rows[1].custom_values["psi_w_mk"] == 0.052


def test_duplicate_default_row_is_rejected() -> None:
    raw = _document().model_dump(mode="json")
    rows = raw["tables"]["aperture_install_types"]["rows"]
    duplicate = dict(rows[0])
    # A second `apit_default` id trips the unique-row-id guard first; give it
    # a distinct suffix and re-point to prove the exactly-one check itself.
    rows.append({**duplicate, "id": "apit_default2"})
    rows.append({**duplicate, "id": "apit_default"})
    with pytest.raises(ValidationError, match="Duplicate aperture install type id"):
        ProjectDocumentV1.model_validate(raw)


def test_negative_psi_is_rejected() -> None:
    raw = _document().model_dump(mode="json")
    raw["tables"]["aperture_install_types"]["rows"].append(
        _install_type("apit_bad", "Bad", -0.01).model_dump(mode="json")
    )
    with pytest.raises(ValidationError, match="psi_w_mk must be zero or greater"):
        ProjectDocumentV1.model_validate(raw)


def test_unknown_source_option_is_rejected() -> None:
    raw = _document().model_dump(mode="json")
    bad = _install_type("apit_bad", "Bad", 0.02)
    bad.custom_values["source"] = "opt_apit_src_nope"
    raw["tables"]["aperture_install_types"]["rows"].append(bad.model_dump(mode="json"))
    with pytest.raises(ValidationError, match="Invalid value for 'Source'"):
        ProjectDocumentV1.model_validate(raw)


def test_void_element_rejects_install_assignments() -> None:
    raw = _document().model_dump(mode="json")
    aperture = _aperture_with_slot(None)
    aperture["elements"][0]["kind"] = "void"
    aperture["elements"][0]["installs"]["top"] = "apit_default"
    raw["tables"]["apertures"] = [aperture]
    with pytest.raises(ValidationError, match="must not carry frames/installs/glazing/operation"):
        ProjectDocumentV1.model_validate(raw)


# --- delete block (D-8) ------------------------------------------------------


def test_replace_removing_default_row_is_blocked_409() -> None:
    document = _document()
    with pytest.raises(HTTPException) as exc_info:
        apply_aperture_install_types_replace(document, _replace_request(document, []))
    assert exc_info.value.status_code == 409
    detail = cast(dict[str, Any], exc_info.value.detail)
    assert detail["error_code"] == "dependent_link_delete_blocked"
    assert detail["details"]["referenced_by"][0]["row_id"] == APERTURE_INSTALL_DEFAULT_TYPE_ID


def test_replace_removing_referenced_type_is_blocked_with_usage_counts() -> None:
    document = _document()
    raw = document.model_dump(mode="json")
    raw["tables"]["aperture_install_types"]["rows"].append(
        _install_type("apit_flixo1", "Flixo Detail 1", 0.021).model_dump(mode="json")
    )
    raw["tables"]["apertures"] = [_aperture_with_slot("apit_flixo1")]
    document = ProjectDocumentV1.model_validate(raw)

    keep_only_default = [row for row in document.tables.aperture_install_types.rows if row.id == "apit_default"]
    with pytest.raises(HTTPException) as exc_info:
        apply_aperture_install_types_replace(document, _replace_request(document, keep_only_default))
    assert exc_info.value.status_code == 409
    details = cast(dict[str, Any], exc_info.value.detail)["details"]
    assert details["usage_counts"] == {"apit_flixo1": 1}
    ref = details["referenced_by"][0]
    assert ref == {"table": "apertures", "row_id": "aptel_a", "tag": "W-01 / Unnamed", "field": "installs.top"}


def test_replace_removing_unreferenced_type_succeeds() -> None:
    document = _document()
    raw = document.model_dump(mode="json")
    raw["tables"]["aperture_install_types"]["rows"].append(
        _install_type("apit_unused", "Unused", 0.03).model_dump(mode="json")
    )
    document = ProjectDocumentV1.model_validate(raw)

    keep_only_default = [row for row in document.tables.aperture_install_types.rows if row.id == "apit_default"]
    next_body = apply_aperture_install_types_replace(document, _replace_request(document, keep_only_default))
    assert [row.id for row in next_body.tables.aperture_install_types.rows] == [APERTURE_INSTALL_DEFAULT_TYPE_ID]


def test_default_row_values_remain_editable() -> None:
    document = _document(cert_programs=("phius",))
    edited = default_install_type_row(is_phius=True)
    edited.custom_values["psi_w_mk"] = 0.011
    next_body = apply_aperture_install_types_replace(document, _replace_request(document, [edited]))
    assert next_body.tables.aperture_install_types.rows[0].custom_values["psi_w_mk"] == 0.011


# --- generic table route -----------------------------------------------------


def test_install_types_route_serves_slice_with_seeded_default(clean_document_tables: None) -> None:
    # Route-level (not builder-level) on purpose: the generic table route
    # validates against the RegisteredTableResponse union, so a slice type
    # missing from `tables/__init__.py` 500s even when the builder works.
    from tests.test_project_document import create_project, signed_in_client

    client = signed_in_client()
    project = create_project(client)
    response = client.get(
        f"/api/v1/projects/{project['id']}/versions/{project['active_version_id']}/draft/tables/aperture_install_types"
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert [row["id"] for row in body["aperture_install_types"]] == [APERTURE_INSTALL_DEFAULT_TYPE_ID]
    assert body["field_defs"][0]["display_name"] == "Tag"
    assert APERTURE_INSTALL_TYPE_SOURCE_OPTION_KEY in body["single_select_options"]


# --- v9 -> v10 migration -----------------------------------------------------


def _upgrade_fixture(name: str) -> ProjectDocumentV1:
    raw = json.loads((FIXTURE_ROOT / name).read_text(encoding="utf-8"))
    return upgrade_project_document(raw).document


def test_v10_migration_seeds_program_aware_default_for_phius_body() -> None:
    document = _upgrade_fixture("phius_project_with_aperture.json")
    row = document.tables.aperture_install_types.rows[0]
    assert row.id == APERTURE_INSTALL_DEFAULT_TYPE_ID
    assert row.custom_values["psi_w_mk"] == 0.052


def test_v10_migration_seeds_program_aware_default_for_phi_body() -> None:
    document = _upgrade_fixture("empty_phi_project.json")
    row = document.tables.aperture_install_types.rows[0]
    assert row.custom_values["psi_w_mk"] == 0.04


def test_v10_migration_adds_all_none_install_slots_to_every_element() -> None:
    document = _upgrade_fixture("phius_project_with_aperture.json")
    elements = document.tables.apertures[0].elements
    assert len(elements) == 3
    for element in elements:
        assert element.installs.model_dump(mode="python") == {
            "top": None,
            "right": None,
            "bottom": None,
            "left": None,
        }
