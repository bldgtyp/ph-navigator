from __future__ import annotations

from datetime import UTC, datetime

import pytest
from psycopg.errors import RaiseException
from psycopg.types.json import Jsonb

from database import transaction
from features.project_document.document import ProjectDocumentV1
from features.project_document.validation import document_etag, serialize_document
from scripts.reconcile_material_catalog_ids import (
    CatalogIdentityReconciliationError,
    reconcile_material_catalog_ids,
)
from tests.envelope.test_envelope_document_contracts import (
    base_document,
    project_material,
    write_saved_body,
)
from tests.test_project_document import create_project, signed_in_client


def _body_with_catalog_origin(catalog_id: str) -> ProjectDocumentV1:
    raw = base_document().model_dump(mode="json")
    raw["tables"]["project_materials"] = [
        project_material(
            catalog_origin={
                "catalog_table": "materials",
                "catalog_record_id": catalog_id,
                "catalog_version_id": None,
                "catalog_schema_version": 1,
                "synced_at": datetime(2026, 8, 2, tzinfo=UTC).isoformat(),
                "local_overrides": [],
            }
        )
    ]
    return ProjectDocumentV1.model_validate(raw)


def test_reconciliation_rewrites_catalog_saved_version_and_draft_atomically(
    clean_catalog_tables: None,
) -> None:
    legacy_id = "recLEGACY00000000"
    stable_id = "recSTABLE00000000"
    name = "Canonical material"
    client = signed_in_client()
    project = create_project(client)
    version_id = project["active_version_id"]
    body = _body_with_catalog_origin(legacy_id)
    write_saved_body(version_id, body)

    with transaction() as conn:
        user = conn.execute("SELECT id FROM users LIMIT 1").fetchone()
        assert user is not None
        user_id = user["id"]
        conn.execute(
            "INSERT INTO catalog_materials (id, name, category) VALUES (%s, %s, 'insulation')",
            (legacy_id, name),
        )
        conn.execute(
            """
            INSERT INTO project_version_drafts (
                version_id, user_id, body, schema_version,
                base_version_etag, draft_etag
            ) VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                version_id,
                user_id,
                Jsonb(body.model_dump(mode="json")),
                body.schema_version,
                document_etag(body),
                "d" * 64,
            ),
        )

        dry_run = reconcile_material_catalog_ids(conn, apply=False, expected={name: stable_id})
        assert dry_run.remapped_rows == 1
        assert dry_run.version_references_changed == 1
        assert dry_run.draft_references_changed == 1

        report = reconcile_material_catalog_ids(conn, apply=True, expected={name: stable_id})
        assert report.applied is True
        assert report.remapped_rows == 1

        catalog = conn.execute("SELECT id FROM catalog_materials WHERE name = %s", (name,)).fetchone()
        version = conn.execute(
            "SELECT body, body_size_bytes FROM project_versions WHERE id = %s", (version_id,)
        ).fetchone()
        draft = conn.execute(
            "SELECT body, base_version_etag, draft_etag FROM project_version_drafts WHERE version_id = %s",
            (version_id,),
        ).fetchone()

        assert catalog is not None
        assert version is not None
        assert draft is not None
        assert catalog["id"] == stable_id
        assert version["body"]["tables"]["project_materials"][0]["catalog_origin"]["catalog_record_id"] == stable_id
        assert draft["body"]["tables"]["project_materials"][0]["catalog_origin"]["catalog_record_id"] == stable_id
        rewritten = ProjectDocumentV1.model_validate(version["body"])
        assert version["body_size_bytes"] == serialize_document(rewritten).size_bytes
        assert draft["base_version_etag"] == document_etag(rewritten)
        assert draft["draft_etag"] != "d" * 64

        idempotent = reconcile_material_catalog_ids(conn, apply=True, expected={name: stable_id})
        assert idempotent.already_stable_rows == 1
        assert idempotent.remapped_rows == 0
        assert idempotent.version_references_changed == 0


def test_reconciliation_rejects_ambiguous_catalog_names(clean_catalog_tables: None) -> None:
    name = "Duplicated canonical material"
    with transaction() as conn:
        conn.execute(
            """
            INSERT INTO catalog_materials (id, name, category)
            VALUES ('recDUPLICATE00001', %s, 'insulation'),
                   ('recDUPLICATE00002', %s, 'insulation')
            """,
            (name, name),
        )
        with pytest.raises(CatalogIdentityReconciliationError, match="not one-to-one"):
            reconcile_material_catalog_ids(
                conn,
                apply=True,
                expected={name: "recSTABLE00000000"},
            )


def test_reconciliation_updates_base_etag_for_an_unchanged_draft(clean_catalog_tables: None) -> None:
    legacy_id = "recLEGACY00000000"
    stable_id = "recSTABLE00000000"
    name = "Canonical material"
    client = signed_in_client()
    project = create_project(client)
    version_id = project["active_version_id"]
    saved_body = _body_with_catalog_origin(legacy_id)
    write_saved_body(version_id, saved_body)
    draft_raw = saved_body.model_dump(mode="json")
    draft_raw["tables"]["project_materials"][0]["catalog_origin"] = None
    draft_body = ProjectDocumentV1.model_validate(draft_raw)

    with transaction() as conn:
        user = conn.execute("SELECT id FROM users LIMIT 1").fetchone()
        assert user is not None
        conn.execute(
            "INSERT INTO catalog_materials (id, name, category) VALUES (%s, %s, 'insulation')",
            (legacy_id, name),
        )
        conn.execute(
            """
            INSERT INTO project_version_drafts (
                version_id, user_id, body, schema_version,
                base_version_etag, draft_etag
            ) VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                version_id,
                user["id"],
                Jsonb(draft_body.model_dump(mode="json")),
                draft_body.schema_version,
                document_etag(saved_body),
                "d" * 64,
            ),
        )

        report = reconcile_material_catalog_ids(conn, apply=True, expected={name: stable_id})
        assert report.draft_documents_changed == 0
        draft = conn.execute(
            "SELECT body, base_version_etag, draft_etag FROM project_version_drafts WHERE version_id = %s",
            (version_id,),
        ).fetchone()
        version = conn.execute("SELECT body FROM project_versions WHERE id = %s", (version_id,)).fetchone()
        assert draft is not None
        assert version is not None
        assert draft["body"] == draft_body.model_dump(mode="json")
        assert draft["base_version_etag"] == document_etag(ProjectDocumentV1.model_validate(version["body"]))
        assert draft["draft_etag"] == "d" * 64


def test_reconciliation_rolls_back_document_writes_when_catalog_update_fails(
    clean_catalog_tables: None,
) -> None:
    legacy_id = "recLEGACY00000000"
    stable_id = "recSTABLE00000000"
    name = "Canonical material"
    client = signed_in_client()
    project = create_project(client)
    version_id = project["active_version_id"]
    body = _body_with_catalog_origin(legacy_id)
    write_saved_body(version_id, body)

    with transaction() as conn:
        conn.execute(
            "INSERT INTO catalog_materials (id, name, category) VALUES (%s, %s, 'insulation')",
            (legacy_id, name),
        )
        conn.execute(
            """
            CREATE FUNCTION test_reject_catalog_id_reconcile() RETURNS trigger
            LANGUAGE plpgsql AS $$
            BEGIN
                RAISE EXCEPTION 'forced catalog identity failure';
            END
            $$
            """
        )
        conn.execute(
            """
            CREATE TRIGGER test_reject_catalog_id_reconcile
            BEFORE UPDATE OF id ON catalog_materials
            FOR EACH ROW EXECUTE FUNCTION test_reject_catalog_id_reconcile()
            """
        )
        try:
            with pytest.raises(RaiseException, match="forced catalog identity failure"):
                reconcile_material_catalog_ids(conn, apply=True, expected={name: stable_id})

            catalog = conn.execute("SELECT id FROM catalog_materials WHERE name = %s", (name,)).fetchone()
            version = conn.execute("SELECT body FROM project_versions WHERE id = %s", (version_id,)).fetchone()
            assert catalog is not None
            assert version is not None
            assert catalog["id"] == legacy_id
            assert version["body"]["tables"]["project_materials"][0]["catalog_origin"]["catalog_record_id"] == legacy_id
        finally:
            conn.execute("DROP TRIGGER test_reject_catalog_id_reconcile ON catalog_materials")
            conn.execute("DROP FUNCTION test_reject_catalog_id_reconcile()")
