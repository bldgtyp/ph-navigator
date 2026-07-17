"""Catalog option cascade rewrite and persistence tests."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

import pytest
from fastapi import HTTPException

from database import connection, transaction
from features.auth.service import create_or_update_user
from features.catalogs.option_jobs_models import CatalogOptionOperation
from features.catalogs.option_jobs_service import (
    begin_option_edit,
    create_job,
    get_job,
    rewrite_document_options,
    run_job,
)
from features.project_document import repository as document_repository
from features.project_document.document import (
    CatalogOrigin,
    ManufacturerFilters,
    ProjectDocumentV1,
    ProjectFrame,
)
from features.project_document.validation import document_etag, enforce_document_body_size, next_draft_etag
from features.projects import repository as projects_repository
from features.projects.models import CreateProjectRequest
from features.projects.service import empty_project_document


def _payload(bt_number: str = "2426") -> CreateProjectRequest:
    return CreateProjectRequest(
        name=f"Project {bt_number}",
        bt_number=bt_number,
        client=None,
        cert_programs=["phi"],
        phius_number=None,
        phius_dropbox_url=None,
    )


def _origin(record_id: str = "recFrame000000001") -> CatalogOrigin:
    return CatalogOrigin(
        catalog_table="frame_types",
        catalog_record_id=record_id,
        catalog_version_id=None,
        catalog_schema_version=1,
        synced_at=datetime(2026, 7, 17, tzinfo=UTC),
        local_overrides=[],
    )


def _body(bt_number: str = "2426") -> ProjectDocumentV1:
    body = empty_project_document(_payload(bt_number))
    body.tables.project_frames = [
        ProjectFrame(
            id="pfrm_catalog",
            name="Old Window",
            manufacturer="Old",
            operation="Casement",
            catalog_origin=_origin(),
        ),
        ProjectFrame(
            id="pfrm_manual",
            name="Manual Old Window",
            manufacturer="Old",
            operation="Casement",
            catalog_origin=None,
        ),
        ProjectFrame(
            id="pfrm_override",
            name="Overridden Window",
            manufacturer="Custom",
            operation="Casement",
            catalog_origin=_origin("recFrame000000002").model_copy(update={"local_overrides": ["manufacturer"]}),
        ),
    ]
    body.tables.manufacturer_filters = ManufacturerFilters(frame_manufacturers_enabled=["Old", "New", "Other"])
    return body


def _rename() -> list[CatalogOptionOperation]:
    return [CatalogOptionOperation(kind="rename", old_label="Old", new_label="New")]


def test_rename_rewrites_matching_catalog_refs_and_deduplicates_filters() -> None:
    body = _body()

    rewritten, stats = rewrite_document_options(
        body,
        catalog_table="frame_types",
        field_key="manufacturer",
        operations=_rename(),
    )

    assert stats.refs_rewritten == 1
    assert stats.filters_rewritten == 1
    assert rewritten.tables.project_frames[0].manufacturer == "New"
    assert rewritten.tables.project_frames[0].catalog_origin == body.tables.project_frames[0].catalog_origin
    assert rewritten.tables.project_frames[1].manufacturer == "Old"
    assert rewritten.tables.project_frames[2].manufacturer == "Custom"
    assert rewritten.tables.project_frames[2].catalog_origin is not None
    assert rewritten.tables.project_frames[2].catalog_origin.local_overrides == ["manufacturer"]
    assert rewritten.tables.manufacturer_filters is not None
    assert rewritten.tables.manufacturer_filters.frame_manufacturers_enabled == ["New", "Other"]
    assert body.tables.project_frames[0].manufacturer == "Old"


def test_merge_rewrites_filters_but_leaves_refs_for_drift_review() -> None:
    rewritten, stats = rewrite_document_options(
        _body(),
        catalog_table="frame_types",
        field_key="manufacturer",
        operations=[CatalogOptionOperation(kind="merge", old_label="Old", new_label="New")],
    )

    assert stats.refs_rewritten == 0
    assert stats.filters_rewritten == 1
    assert rewritten.tables.project_frames[0].manufacturer == "Old"
    assert rewritten.tables.manufacturer_filters is not None
    assert rewritten.tables.manufacturer_filters.frame_manufacturers_enabled == ["New", "Other"]


def test_non_manufacturer_rename_updates_only_matching_catalog_refs_and_is_idempotent() -> None:
    body = _body()
    operations = [CatalogOptionOperation(kind="rename", old_label="Casement", new_label="Tilt-turn")]
    rewritten, first = rewrite_document_options(
        body,
        catalog_table="frame_types",
        field_key="operation",
        operations=operations,
    )
    rerun, second = rewrite_document_options(
        rewritten,
        catalog_table="frame_types",
        field_key="operation",
        operations=operations,
    )

    assert first.refs_rewritten == 2
    assert first.filters_rewritten == 0
    assert rewritten.tables.project_frames[0].operation == "Tilt-turn"
    assert rewritten.tables.project_frames[1].operation == "Casement"
    assert second.refs_rewritten == 0
    assert rerun == rewritten


def _insert_project(body: ProjectDocumentV1, user_id: UUID) -> tuple[UUID, UUID]:
    serialized = enforce_document_body_size(body)
    with transaction() as conn:
        project = projects_repository.insert_project_with_initial_version(
            conn,
            _payload(body.project.bt_number),
            user_id,
            body,
            serialized.size_bytes,
            serialized_body=serialized,
        )
    return UUID(str(project["id"])), UUID(str(project["active_version_id"]))


def test_job_appends_version_when_active_version_has_no_draft(clean_document_tables: None) -> None:
    user = create_or_update_user(email="ed@example.com", display_name="Ed", password="password")
    project_id, original_version_id = _insert_project(_body(), user.id)
    job = create_job(
        catalog_table="frame_types",
        field_key="manufacturer",
        operations=_rename(),
        created_by=user.id,
    )

    completed = run_job(job.id)

    assert completed.status == "completed"
    assert completed.progress == 100
    assert completed.result.projects_touched == 1
    assert completed.result.refs_rewritten == 1
    assert completed.result.filters_rewritten == 1
    assert completed.result.versions_created == 1
    with connection() as conn:
        versions = conn.execute(
            "SELECT id, parent_version_id, name, body, created_by FROM project_versions "
            "WHERE project_id = %s ORDER BY created_at",
            (project_id,),
        ).fetchall()
        active = conn.execute("SELECT active_version_id FROM projects WHERE id = %s", (project_id,)).fetchone()
    assert len(versions) == 2
    assert versions[0]["id"] == original_version_id
    assert versions[0]["body"]["tables"]["project_frames"][0]["manufacturer"] == "Old"
    assert versions[1]["parent_version_id"] == original_version_id
    assert versions[1]["name"] == "Catalog rename: Old → New"
    assert versions[1]["created_by"] == user.id
    assert versions[1]["body"]["tables"]["project_frames"][0]["manufacturer"] == "New"
    assert active is not None and active["active_version_id"] == versions[1]["id"]

    rerun = run_job(job.id)
    assert rerun.result == completed.result
    with connection() as conn:
        count = conn.execute(
            "SELECT count(*) AS count FROM project_versions WHERE project_id = %s", (project_id,)
        ).fetchone()
    assert count is not None and count["count"] == 2


def test_job_rewrites_existing_draft_and_bumps_etag_without_new_version(
    clean_document_tables: None,
) -> None:
    user = create_or_update_user(email="ed@example.com", display_name="Ed", password="password")
    project_id, version_id = _insert_project(_body(), user.id)
    body = _body()
    original_draft_etag = next_draft_etag(body)
    with transaction() as conn:
        document_repository.upsert_draft(
            conn,
            version_id,
            user.id,
            body,
            document_etag(body),
            original_draft_etag,
        )
    job = create_job(
        catalog_table="frame_types",
        field_key="manufacturer",
        operations=_rename(),
        created_by=user.id,
    )

    completed = run_job(job.id)

    assert completed.result.drafts_rewritten == 1
    assert completed.result.versions_created == 0
    with connection() as conn:
        draft = document_repository.get_draft(conn, version_id, user.id)
        count = conn.execute(
            "SELECT count(*) AS count FROM project_versions WHERE project_id = %s", (project_id,)
        ).fetchone()
    assert draft is not None
    assert draft["draft_etag"] != original_draft_etag
    assert draft["body"]["tables"]["project_frames"][0]["manufacturer"] == "New"
    assert count is not None and count["count"] == 1


def test_job_leaves_historical_version_drafts_untouched(clean_document_tables: None) -> None:
    """A relabel changes the current working surface, never version history."""

    user = create_or_update_user(email="ed@example.com", display_name="Ed", password="password")
    project_id, historical_version_id = _insert_project(_body(), user.id)
    historical_draft = _body()
    current_body = _body()
    current_serialized = enforce_document_body_size(current_body)
    with transaction() as conn:
        document_repository.upsert_draft(
            conn,
            historical_version_id,
            user.id,
            historical_draft,
            document_etag(historical_draft),
            next_draft_etag(historical_draft),
        )
        document_repository.insert_version_from_body(
            conn,
            project_id,
            historical_version_id,
            user.id,
            "Current",
            "working",
            False,
            current_body,
            current_serialized.size_bytes,
            serialized_body=current_serialized,
        )

    job = create_job(
        catalog_table="frame_types",
        field_key="manufacturer",
        operations=_rename(),
        created_by=user.id,
    )
    completed = run_job(job.id)

    with connection() as conn:
        untouched = document_repository.get_draft(conn, historical_version_id, user.id)
    assert completed.status == "completed"
    assert completed.result.versions_created == 1
    assert untouched is not None
    assert untouched["body"]["tables"]["project_frames"][0]["manufacturer"] == "Old"


def test_create_job_rejects_empty_operations(clean_document_tables: None) -> None:
    user = create_or_update_user(email="ed@example.com", display_name="Ed", password="password")
    with pytest.raises(ValueError, match="at least one operation"):
        create_job(
            catalog_table="frame_types",
            field_key="manufacturer",
            operations=[],
            created_by=user.id,
        )


def test_unresolved_job_blocks_every_option_edit(clean_document_tables: None) -> None:
    user = create_or_update_user(email="ed@example.com", display_name="Ed", password="password")
    create_job(
        catalog_table="frame_types",
        field_key="manufacturer",
        operations=_rename(),
        created_by=user.id,
    )

    with transaction() as conn, pytest.raises(HTTPException) as error:
        begin_option_edit(conn, "frame_types")

    assert error.value.status_code == 409
    assert isinstance(error.value.detail, dict)
    assert error.value.detail["error_code"] == "catalog_option_cascade_running"


def test_expired_running_job_becomes_retryable(clean_document_tables: None) -> None:
    user = create_or_update_user(email="ed@example.com", display_name="Ed", password="password")
    job = create_job(
        catalog_table="frame_types",
        field_key="manufacturer",
        operations=_rename(),
        created_by=user.id,
    )
    with transaction() as conn:
        conn.execute(
            """
            UPDATE catalog_option_jobs
            SET status = 'running', heartbeat_at = now() - INTERVAL '6 minutes'
            WHERE id = %(job_id)s
            """,
            {"job_id": job.id},
        )

    recovered = get_job(job.id)
    assert recovered is not None
    assert recovered.status == "failed"
    assert recovered.error == "Catalog cascade worker lease expired; retry the job."
    assert run_job(job.id).status == "completed"
