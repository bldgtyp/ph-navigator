from __future__ import annotations

import pypdfium2 as pdfium
from fastapi.testclient import TestClient
from psycopg.types.json import Jsonb

from database import transaction
from features.project_document.document import ProjectDocumentV1
from main import app
from tests.envelope.test_envelope_document_contracts import (
    ORIGIN,
    create_project,
    envelope_body,
    signed_in_client,
    write_saved_body,
)
from tests.test_project_document import create_rooms_draft


def _url(project: dict[str, object]) -> str:
    return f"/api/v1/projects/{project['id']}/versions/{project['active_version_id']}/envelope/export/assemblies.pdf"


def test_assembly_pdf_route_exports_saved_version_with_stable_filename(
    clean_document_tables: None,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    write_saved_body(project["active_version_id"], envelope_body())

    response = client.get(_url(project), headers={"Origin": ORIGIN})

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"] == ('attachment; filename="2426-assemblies-SI-Working.pdf"')
    document = pdfium.PdfDocument(response.content)
    assert len(document) == 2
    assert "West Stockbridge House" in document[0].get_textpage().get_text_range()


def test_assembly_pdf_route_ignores_unsaved_draft_changes(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    version_id = project["active_version_id"]
    raw_body = envelope_body().model_dump(mode="json")
    for material in raw_body["tables"]["project_materials"]:
        material["datasheet_asset_ids"] = []
    for assembly in raw_body["tables"]["assemblies"]:
        for layer in assembly["layers"]:
            for segment in layer["segments"]:
                segment["photo_asset_ids"] = []
    write_saved_body(version_id, ProjectDocumentV1.model_validate(raw_body))
    create_rooms_draft(client, project["id"], version_id)
    with transaction() as conn:
        row = conn.execute(
            "SELECT body FROM project_version_drafts WHERE version_id = %(version_id)s",
            {"version_id": version_id},
        ).fetchone()
        assert row is not None
        draft_body = dict(row["body"])
        draft_body["tables"]["assemblies"] = []
        conn.execute(
            "UPDATE project_version_drafts SET body = %(body)s WHERE version_id = %(version_id)s",
            {"body": Jsonb(draft_body), "version_id": version_id},
        )

    response = client.get(_url(project), headers={"Origin": ORIGIN})

    assert response.status_code == 200
    assert len(pdfium.PdfDocument(response.content)) == 2


def test_assembly_pdf_route_allows_locked_editor_and_ip_units(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    write_saved_body(project["active_version_id"], envelope_body())
    with transaction() as conn:
        conn.execute(
            "UPDATE project_versions SET locked = TRUE WHERE id = %(version_id)s",
            {"version_id": project["active_version_id"]},
        )

    response = client.get(f"{_url(project)}?units=IP", headers={"Origin": ORIGIN})

    assert response.status_code == 200
    assert 'filename="2426-assemblies-IP-Working.pdf"' in response.headers["content-disposition"]
    assert "Resistivity" in pdfium.PdfDocument(response.content)[0].get_textpage().get_text_range()


def test_assembly_pdf_route_rejects_zero_assemblies(clean_document_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)

    response = client.get(_url(project), headers={"Origin": ORIGIN})

    assert response.status_code == 422
    assert response.json()["error_code"] == "no_assemblies"


def test_assembly_pdf_route_rejects_anonymous_viewer(clean_document_tables: None) -> None:
    editor = signed_in_client()
    project = create_project(editor)
    write_saved_body(project["active_version_id"], envelope_body())

    response = TestClient(app).get(_url(project))

    assert response.status_code == 401
    assert response.json()["error_code"] == "not_authenticated"
