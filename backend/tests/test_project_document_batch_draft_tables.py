"""Batch draft-tables read endpoint contract tests.

`GET …/draft/tables?names=…` returns one entry per requested table, each
byte-identical to `GET …/draft/tables/<name>`, from a single whole-draft load.
Mirrors the per-table read's error semantics (404 unknown name, 422 invalid
draft, edit-access required).
"""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient
from structlog.testing import capture_logs

from main import app
from tests.test_project_document import (
    corrupt_draft_schema,
    create_project,
    create_rooms_draft,
    signed_in_client,
)


def batch_url(project_id: object, version_id: object) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables"


def single_url(project_id: object, version_id: object, name: str) -> str:
    return f"/api/v1/projects/{project_id}/versions/{version_id}/draft/tables/{name}"


def _project_with_draft(client: TestClient) -> tuple[str, str]:
    project = create_project(client)
    project_id = str(project["id"])
    version_id = str(project["active_version_id"])
    # Establish a draft (writes the rooms table) so the batch reads the draft
    # view — source="draft" with a draft_etag — for every requested table.
    create_rooms_draft(client, project_id, version_id)
    return project_id, version_id


def test_batch_returns_one_entry_per_requested_name(clean_document_tables: None) -> None:
    client = signed_in_client()
    project_id, version_id = _project_with_draft(client)

    response = client.get(batch_url(project_id, version_id), params={"names": ["rooms", "pumps", "fans"]})

    assert response.status_code == 200
    tables = response.json()["tables"]
    assert set(tables.keys()) == {"rooms", "pumps", "fans"}
    for entry in tables.values():
        assert entry["source"] == "draft"
        assert entry["draft_etag"] is not None


def test_batch_entry_matches_single_key_get(clean_document_tables: None) -> None:
    client = signed_in_client()
    project_id, version_id = _project_with_draft(client)

    batch = client.get(batch_url(project_id, version_id), params={"names": ["rooms", "pumps"]})
    rooms_single = client.get(single_url(project_id, version_id, "rooms"))
    pumps_single = client.get(single_url(project_id, version_id, "pumps"))

    assert batch.status_code == 200
    assert rooms_single.status_code == 200
    assert pumps_single.status_code == 200
    # Each batch entry is byte-identical to the per-table read for the same draft.
    assert batch.json()["tables"]["rooms"] == rooms_single.json()
    assert batch.json()["tables"]["pumps"] == pumps_single.json()


def test_batch_does_one_document_load(clean_document_tables: None) -> None:
    client = signed_in_client()
    project_id, version_id = _project_with_draft(client)

    with capture_logs() as logs:
        response = client.get(
            batch_url(project_id, version_id),
            params={"names": ["rooms", "pumps", "fans"]},
        )

    assert response.status_code == 200
    loads = [entry for entry in logs if entry.get("event") == "project_document.loaded"]
    # One whole-draft load for the whole batch, vs. one per name on the
    # per-table fan-out.
    assert len(loads) == 1


def test_batch_unknown_name_returns_404(clean_document_tables: None) -> None:
    client = signed_in_client()
    project_id, version_id = _project_with_draft(client)

    response = client.get(batch_url(project_id, version_id), params={"names": ["rooms", "nope"]})

    assert response.status_code == 404
    assert response.json()["error_code"] == "document_table_not_found"


def test_batch_invalid_draft_returns_422(clean_document_tables: None) -> None:
    client = signed_in_client()
    project_id, version_id = _project_with_draft(client)
    corrupt_draft_schema(version_id)

    response = client.get(batch_url(project_id, version_id), params={"names": ["rooms"]})

    assert response.status_code == 422
    assert response.json()["error_code"] == "invalid_project_document"


def test_batch_duplicate_names_collapse_to_one_entry(clean_document_tables: None) -> None:
    client = signed_in_client()
    project_id, version_id = _project_with_draft(client)

    response = client.get(
        batch_url(project_id, version_id),
        params={"names": ["pumps", "pumps", "fans"]},
    )

    assert response.status_code == 200
    assert set(response.json()["tables"].keys()) == {"pumps", "fans"}


def test_batch_empty_names_returns_422(clean_document_tables: None) -> None:
    client = signed_in_client()
    project_id, version_id = _project_with_draft(client)

    # No `names` query param at all → FastAPI list min_length validation.
    response = client.get(batch_url(project_id, version_id))

    assert response.status_code == 422


def test_batch_anonymous_returns_401(clean_document_tables: None) -> None:
    editor = signed_in_client()
    project_id, version_id = _project_with_draft(editor)

    anonymous = TestClient(app)
    response = anonymous.get(batch_url(project_id, version_id), params={"names": ["rooms"]})

    assert response.status_code == 401


def test_batch_response_forbids_extra_fields(clean_document_tables: None) -> None:
    """The batch envelope is exactly `{ tables: {...} }` (no stray top-level meta)."""
    client = signed_in_client()
    project_id, version_id = _project_with_draft(client)

    body: dict[str, Any] = client.get(batch_url(project_id, version_id), params={"names": ["rooms"]}).json()

    assert set(body.keys()) == {"tables"}
