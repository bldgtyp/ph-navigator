"""PHPP U-Value export HTTP routes: preflight JSON + streamed ZIP."""

from __future__ import annotations

import io
import zipfile
from typing import Any

from fastapi.testclient import TestClient

from features.project_document.document import ProjectDocumentV1
from tests.envelope.test_envelope_document_contracts import (
    ORIGIN,
    create_project,
    signed_in_client,
    write_saved_body,
)
from tests.envelope.test_phpp_export import _assembly, _body_with_assemblies, _material, _uniform_layer

PREFLIGHT_URL = "/api/v1/projects/{project_id}/versions/{version_id}/envelope/export/phpp/preflight"
EXPORT_URL = "/api/v1/projects/{project_id}/versions/{version_id}/envelope/export/phpp"


def _mixed_body() -> ProjectDocumentV1:
    """One exportable wall, one incomplete (no material), one over the row cap."""
    materials = [
        _material("pmat_concrete", "Concrete (Heavily Reinforced)", 2.3),
        _material("pmat_roxul", "Roxul ComfortBoard", 0.036),
    ]
    good = _assembly(
        "Good Wall",
        [
            _uniform_layer("lyr_0", 0, 200.0, "pmat_concrete"),
            _uniform_layer("lyr_1", 1, 100.0, "pmat_roxul"),
        ],
    )
    incomplete = _assembly("Incomplete Wall", [_uniform_layer("lyr_0", 0, 20.0, None)])
    over_limit = _assembly("Over Limit", [_uniform_layer(f"lyr_{i}", i, 20.0, "pmat_concrete") for i in range(9)])
    return _body_with_assemblies([good, incomplete, over_limit], materials=materials)


def _seed_mixed_version() -> tuple[TestClient, dict[str, Any]]:
    client = signed_in_client()
    project = create_project(client)
    write_saved_body(project["active_version_id"], _mixed_body())
    return client, project


def _zip_from_response(content: bytes) -> zipfile.ZipFile:
    return zipfile.ZipFile(io.BytesIO(content))


def test_phpp_preflight_reports_eligibility_per_assembly(clean_document_tables: None) -> None:
    client, project = _seed_mixed_version()

    response = client.get(
        PREFLIGHT_URL.format(project_id=project["id"], version_id=project["active_version_id"]),
        headers={"Origin": ORIGIN},
    )

    assert response.status_code == 200
    by_name = {item["name"]: item for item in response.json()["assemblies"]}
    assert by_name["Good Wall"] == {"id": "asm_0", "name": "Good Wall", "exportable": True, "reason": None}
    assert by_name["Incomplete Wall"]["exportable"] is False
    assert by_name["Incomplete Wall"]["reason"] == "incomplete_materials"
    assert by_name["Over Limit"]["reason"] == "too_many_layers"


def test_phpp_export_streams_zip_with_units_in_filename(clean_document_tables: None) -> None:
    client, project = _seed_mixed_version()

    response = client.get(
        EXPORT_URL.format(project_id=project["id"], version_id=project["active_version_id"]),
        headers={"Origin": ORIGIN},
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert f'filename="phpp-u-values-SI-{project["active_version_id"]}.zip"' in response.headers["content-disposition"]


def test_phpp_export_emits_one_csv_per_assembly_including_error_csvs(clean_document_tables: None) -> None:
    """The PHPP divergence from HBJSON: incomplete/over-limit assemblies yield
    error CSVs inside the ZIP, not an all-or-nothing 422 (decisions Q-E)."""
    client, project = _seed_mixed_version()

    response = client.get(
        EXPORT_URL.format(project_id=project["id"], version_id=project["active_version_id"]),
        headers={"Origin": ORIGIN},
    )

    assert response.status_code == 200
    archive = _zip_from_response(response.content)
    assert sorted(archive.namelist()) == ["Good Wall.csv", "Incomplete Wall.csv", "Over Limit.csv"]
    assert "Concrete (Heavily Reinforced),2.300" in archive.read("Good Wall.csv").decode()
    assert archive.read("Incomplete Wall.csv").decode().startswith("Cannot export:")
    assert "exceeds the PHPP U-Value maximum" in archive.read("Over Limit.csv").decode()


def test_phpp_export_ip_units_annotate_material_names(clean_document_tables: None) -> None:
    client, project = _seed_mixed_version()
    base_url = EXPORT_URL.format(project_id=project["id"], version_id=project["active_version_id"])

    ip = client.get(f"{base_url}?units=IP", headers={"Origin": ORIGIN})
    si = client.get(f"{base_url}?units=SI", headers={"Origin": ORIGIN})

    assert ip.status_code == 200 and si.status_code == 200
    assert f'filename="phpp-u-values-IP-{project["active_version_id"]}.zip"' in ip.headers["content-disposition"]
    ip_good = _zip_from_response(ip.content).read("Good Wall.csv").decode()
    si_good = _zip_from_response(si.content).read("Good Wall.csv").decode()
    assert "Concrete (Heavily Reinforced) [ 7.9 in ]" in ip_good
    assert "in ]" not in si_good


def test_phpp_export_rejects_invalid_units(clean_document_tables: None) -> None:
    client, project = _seed_mixed_version()

    response = client.get(
        EXPORT_URL.format(project_id=project["id"], version_id=project["active_version_id"]) + "?units=metric",
        headers={"Origin": ORIGIN},
    )

    assert response.status_code == 422


def test_phpp_export_of_all_complete_version_has_no_error_csvs(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    body = _body_with_assemblies(
        [_assembly("Solo", [_uniform_layer("lyr_0", 0, 50.0, "pmat_x")])],
        materials=[_material("pmat_x", "Mat X", 0.5)],
    )
    write_saved_body(project["active_version_id"], body)

    response = client.get(
        EXPORT_URL.format(project_id=project["id"], version_id=project["active_version_id"]),
        headers={"Origin": ORIGIN},
    )

    assert response.status_code == 200
    assert "Cannot export" not in _zip_from_response(response.content).read("Solo.csv").decode()
