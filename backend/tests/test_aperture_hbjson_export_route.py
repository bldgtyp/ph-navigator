"""Smoke tests for the HBJSON export REST endpoint.

Heavy seeding-and-payload coverage lives in
``test_aperture_hbjson_export_service.py``; this file just verifies the
REST wiring — auth, source-query validation, and that an empty
apertures table emits an empty object.
"""

from __future__ import annotations

from tests.test_project_document import ORIGIN, create_project, signed_in_client


def _url(project_id: object, version_id: object, source: str = "draft") -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/apertures/hbjson?source={source}"


def test_empty_apertures_returns_empty_object(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    response = client.get(
        _url(project["id"], project["active_version_id"], source="draft"),
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 200, response.text
    assert response.json() == {}


def test_version_source_works_on_fresh_project(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    response = client.get(
        _url(project["id"], project["active_version_id"], source="version"),
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 200
    assert response.json() == {}


def test_invalid_source_returns_422(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    response = client.get(
        _url(project["id"], project["active_version_id"], source="banana"),
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 422
