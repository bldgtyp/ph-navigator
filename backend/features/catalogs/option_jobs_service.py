"""Project-wide rewrite engine for catalog option renames and merges."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from psycopg import Connection
from starlette import status

from database import connection, transaction
from features.catalogs import option_jobs_repository as repository
from features.catalogs._option_seeds import (
    FRAME_TYPE_SINGLE_SELECT_FIELDS,
    GLAZING_TYPE_SINGLE_SELECT_FIELDS,
)
from features.catalogs.option_jobs_models import (
    CatalogOptionCascadeTotals,
    CatalogOptionJob,
    CatalogOptionOperation,
    CatalogOptionProjectResult,
    CatalogOptionTable,
)
from features.project_document import repository as document_repository
from features.project_document.document import ProjectDocumentV1
from features.project_document.validation import (
    enforce_document_body_size,
    next_draft_etag_from_etag,
    validate_document,
)
from features.shared.errors import api_error
from features.shared.ids import timestamp_id


@dataclass(frozen=True)
class DocumentRewriteStats:
    refs_rewritten: int = 0
    filters_rewritten: int = 0

    @property
    def changed(self) -> bool:
        return self.refs_rewritten > 0 or self.filters_rewritten > 0


def _job(row: dict[str, Any]) -> CatalogOptionJob:
    return CatalogOptionJob.model_validate(row)


def _validate_job_input(
    catalog_table: CatalogOptionTable,
    field_key: str,
    operations: list[CatalogOptionOperation],
) -> None:
    allowed = FRAME_TYPE_SINGLE_SELECT_FIELDS if catalog_table == "frame_types" else GLAZING_TYPE_SINGLE_SELECT_FIELDS
    if field_key not in allowed:
        raise ValueError(f"{field_key!r} is not editable on {catalog_table!r}.")
    if not operations:
        raise ValueError("A catalog option cascade requires at least one operation.")
    old_labels: set[str] = set()
    for operation in operations:
        if operation.old_label == operation.new_label:
            raise ValueError("Catalog option operations must change the label.")
        if operation.old_label in old_labels:
            raise ValueError(f"Duplicate source label {operation.old_label!r}.")
        old_labels.add(operation.old_label)


def _raise_unresolved_job(job: CatalogOptionJob) -> None:
    message = (
        "Option edits are unavailable while a catalog cascade is running."
        if job.status in {"pending", "running"}
        else "Option edits are unavailable until the failed catalog cascade is retried."
    )
    raise api_error(
        status.HTTP_409_CONFLICT,
        "catalog_option_cascade_running",
        message,
        {"job_id": job.id, "status": job.status},
    )


def begin_option_edit(conn: Connection[Any], catalog_table: CatalogOptionTable) -> None:
    """Hold a per-catalog transaction lock and reject unresolved cascades.

    Every option-list edit takes this lock, including cosmetic reorders and
    additions.  That closes the gap between checking a job's status and
    committing the rename that creates the next job.
    """

    repository.lock_catalog_option_edits(conn, catalog_table)
    unresolved = repository.get_unresolved_job(conn, catalog_table)
    if unresolved is not None:
        _raise_unresolved_job(_job(unresolved))


def create_job_in_transaction(
    conn: Connection[Any],
    *,
    catalog_table: CatalogOptionTable,
    field_key: str,
    operations: list[CatalogOptionOperation],
    created_by: UUID,
) -> CatalogOptionJob:
    """Persist one cascade with the option-store write that caused it.

    The partial unique index protects the invariant at the database boundary;
    the explicit check produces a useful 409 for the modal instead of leaking
    a constraint error if an editor tries another option change mid-cascade.
    """

    _validate_job_input(catalog_table, field_key, operations)
    begin_option_edit(conn, catalog_table)
    row = repository.try_insert_job(
        conn,
        job_id=timestamp_id("catjob"),
        catalog_table=catalog_table,
        field_key=field_key,
        created_by=created_by,
        operations=operations,
    )
    if row is not None:
        return _job(row)
    unresolved = repository.get_unresolved_job(conn, catalog_table)
    if unresolved is not None:
        _raise_unresolved_job(_job(unresolved))
    raise RuntimeError("Catalog option cascade insert did not return a row.")


def create_job(
    *,
    catalog_table: CatalogOptionTable,
    field_key: str,
    operations: list[CatalogOptionOperation],
    created_by: UUID,
) -> CatalogOptionJob:
    with transaction() as conn:
        return create_job_in_transaction(
            conn,
            catalog_table=catalog_table,
            field_key=field_key,
            operations=operations,
            created_by=created_by,
        )


def get_job(job_id: str) -> CatalogOptionJob | None:
    with transaction() as conn:
        repository.recover_expired_job(conn, job_id)
        row = repository.get_job(conn, job_id)
    return _job(row) if row else None


def get_unresolved_job(catalog_table: CatalogOptionTable) -> CatalogOptionJob | None:
    """Return the one job that still holds this catalog's option-edit lock."""

    with transaction() as conn:
        row = repository.get_unresolved_job(conn, catalog_table)
    # Fetch through `get_job` so a dead running worker is surfaced as a
    # retryable failure instead of making a returning editor wait forever.
    return get_job(str(row["id"])) if row else None


def _operation_maps(
    operations: list[CatalogOptionOperation],
) -> tuple[dict[str, str], dict[str, str]]:
    rename_map = {operation.old_label: operation.new_label for operation in operations if operation.kind == "rename"}
    return rename_map, {operation.old_label: operation.new_label for operation in operations}


def operations_from_option_edit(
    *,
    field_key: str,
    stored_label_by_id: dict[str, str],
    incoming_label_by_id: dict[str, str],
    replacements: dict[str, str],
) -> list[CatalogOptionOperation]:
    """Derive the document-side work from one validated option-list edit.

    Kept option IDs represent relabels; deleted IDs paired with a replacement
    represent catalog merges.  Only manufacturer merges affect project
    documents (their allow-lists store labels), while every relabel can update
    matching snapshot reference fields.
    """

    operations: list[CatalogOptionOperation] = []
    for option_id, old_label in stored_label_by_id.items():
        new_label = incoming_label_by_id.get(option_id)
        if new_label is not None:
            if new_label != old_label:
                operations.append(CatalogOptionOperation(kind="rename", old_label=old_label, new_label=new_label))
            continue
        replacement = replacements.get(old_label)
        if field_key == "manufacturer" and replacement is not None:
            operations.append(CatalogOptionOperation(kind="merge", old_label=old_label, new_label=replacement))
    return operations


def _rewrite_stats(
    body: ProjectDocumentV1,
    *,
    catalog_table: CatalogOptionTable,
    field_key: str,
    rename_map: dict[str, str],
    filter_map: dict[str, str],
) -> DocumentRewriteStats:
    if catalog_table == "frame_types":
        refs = body.tables.project_frames
        filter_attribute = "frame_manufacturers_enabled"
    else:
        refs = body.tables.project_glazings
        filter_attribute = "glazing_manufacturers_enabled"
    refs_rewritten = sum(
        1
        for ref in refs
        if ref.catalog_origin is not None
        and ref.catalog_origin.catalog_table == catalog_table
        and isinstance(getattr(ref, field_key), str)
        and getattr(ref, field_key) in rename_map
    )
    filters_rewritten = 0
    filters = body.tables.manufacturer_filters
    if field_key == "manufacturer" and filters is not None:
        values = getattr(filters, filter_attribute)
        if values is not None:
            filters_rewritten = sum(value in filter_map for value in values)
    return DocumentRewriteStats(refs_rewritten, filters_rewritten)


def rewrite_document_options(
    body: ProjectDocumentV1,
    *,
    catalog_table: CatalogOptionTable,
    field_key: str,
    operations: list[CatalogOptionOperation],
) -> tuple[ProjectDocumentV1, DocumentRewriteStats]:
    """Rewrite one document without mutating the caller's model.

    Renames update matching catalog-origin refs and manufacturer filters.
    Merges update manufacturer filters only; refs intentionally remain stale so
    the existing drift/Refresh flow can review the identity change.
    """

    rename_map, filter_map = _operation_maps(operations)
    stats = _rewrite_stats(
        body,
        catalog_table=catalog_table,
        field_key=field_key,
        rename_map=rename_map,
        filter_map=filter_map,
    )
    if not stats.changed:
        return body, stats

    next_body = body.model_copy(deep=True)
    next_refs = next_body.tables.project_frames if catalog_table == "frame_types" else next_body.tables.project_glazings
    for ref in next_refs:
        value = getattr(ref, field_key)
        replacement = rename_map.get(value) if isinstance(value, str) else None
        if (
            ref.catalog_origin is not None
            and ref.catalog_origin.catalog_table == catalog_table
            and replacement is not None
        ):
            setattr(ref, field_key, replacement)

    filters = next_body.tables.manufacturer_filters
    if field_key == "manufacturer" and filters is not None:
        filter_attribute = (
            "frame_manufacturers_enabled" if catalog_table == "frame_types" else "glazing_manufacturers_enabled"
        )
        values = getattr(filters, filter_attribute)
        if values is not None:
            rewritten: list[str] = []
            seen: set[str] = set()
            for value in values:
                replacement = filter_map.get(value, value)
                if replacement not in seen:
                    rewritten.append(replacement)
                    seen.add(replacement)
            setattr(filters, filter_attribute, rewritten)
    return next_body, stats


def _target_projects_for(
    *,
    catalog_table: CatalogOptionTable,
    field_key: str,
    operations: list[CatalogOptionOperation],
) -> list[dict[str, Any]]:
    with connection() as conn:
        rows = repository.list_active_project_bodies(conn)
    targets: dict[UUID, dict[str, Any]] = {}
    rename_map, filter_map = _operation_maps(operations)
    for row in rows:
        body = validate_document(row["body"])
        if not _rewrite_stats(
            body,
            catalog_table=catalog_table,
            field_key=field_key,
            rename_map=rename_map,
            filter_map=filter_map,
        ).changed:
            continue
        project_id = UUID(str(row["id"]))
        targets[project_id] = {
            "id": project_id,
            "name": str(row["name"]),
        }
    return list(targets.values())


def preview_cascade(
    *,
    catalog_table: CatalogOptionTable,
    field_key: str,
    operations: list[CatalogOptionOperation],
) -> int:
    """Count active project documents the rename confirmation will rewrite."""

    _validate_job_input(catalog_table, field_key, operations)
    return len(
        _target_projects_for(
            catalog_table=catalog_table,
            field_key=field_key,
            operations=operations,
        )
    )


def _target_projects(job: CatalogOptionJob) -> list[dict[str, Any]]:
    targets = {
        UUID(str(project["id"])): project
        for project in _target_projects_for(
            catalog_table=job.catalog_table,
            field_key=job.field_key,
            operations=job.operations,
        )
    }
    for result in job.project_results:
        if result.status == "failed":
            targets.setdefault(
                result.project_id,
                {"id": result.project_id, "name": result.project_name},
            )
    return list(targets.values())


def _version_name(field_key: str, operations: list[CatalogOptionOperation]) -> str:
    if len(operations) != 1:
        return f"Catalog option update: {field_key} ({len(operations)} changes)"
    operation = operations[0]
    action = "rename" if operation.kind == "rename" else "merge"
    return f"Catalog {action}: {operation.old_label} → {operation.new_label}"


def _process_project(
    project: dict[str, Any],
    *,
    catalog_table: CatalogOptionTable,
    field_key: str,
    operations: list[CatalogOptionOperation],
    created_by: UUID,
) -> CatalogOptionProjectResult:
    project_id = UUID(str(project["id"]))
    refs_rewritten = 0
    filters_rewritten = 0
    drafts_rewritten = 0
    version_created = False

    with transaction() as conn:
        locked_project = repository.get_project_for_update(conn, project_id)
        if locked_project is None or locked_project["active_version_id"] is None:
            raise LookupError("Project or active version no longer exists.")
        active_version_id = UUID(str(locked_project["active_version_id"]))
        active = document_repository.get_project_version_for_update(conn, project_id, active_version_id)
        if active is None:
            raise LookupError("Active project version no longer exists.")
        drafts = repository.list_active_version_drafts_for_update(conn, project_id, active_version_id)
        active_has_draft = bool(drafts)

        for draft in drafts:
            body = validate_document(draft["body"])
            next_body, stats = rewrite_document_options(
                body,
                catalog_table=catalog_table,
                field_key=field_key,
                operations=operations,
            )
            if not stats.changed:
                continue
            serialized = enforce_document_body_size(next_body)
            document_repository.rewrite_draft_body(
                conn,
                UUID(str(draft["version_id"])),
                UUID(str(draft["user_id"])),
                next_body,
                next_draft_etag_from_etag(serialized.etag),
                serialized_body=serialized,
            )
            refs_rewritten += stats.refs_rewritten
            filters_rewritten += stats.filters_rewritten
            drafts_rewritten += 1

        if not active_has_draft:
            body = validate_document(active["body"])
            next_body, stats = rewrite_document_options(
                body,
                catalog_table=catalog_table,
                field_key=field_key,
                operations=operations,
            )
            if stats.changed:
                serialized = enforce_document_body_size(next_body)
                base_name = _version_name(field_key, operations)
                document_repository.insert_version_from_body(
                    conn,
                    project_id,
                    active_version_id,
                    created_by,
                    repository.unique_version_name(conn, project_id, base_name),
                    "working",
                    False,
                    next_body,
                    serialized.size_bytes,
                    serialized_body=serialized,
                )
                refs_rewritten += stats.refs_rewritten
                filters_rewritten += stats.filters_rewritten
                version_created = True

    return CatalogOptionProjectResult(
        project_id=project_id,
        project_name=str(project["name"]),
        status="completed",
        refs_rewritten=refs_rewritten,
        filters_rewritten=filters_rewritten,
        drafts_rewritten=drafts_rewritten,
        version_created=version_created,
    )


def _totals(results: list[CatalogOptionProjectResult]) -> CatalogOptionCascadeTotals:
    successful = [result for result in results if result.status == "completed"]
    return CatalogOptionCascadeTotals(
        projects_touched=sum(bool(result.refs_rewritten or result.filters_rewritten) for result in successful),
        refs_rewritten=sum(result.refs_rewritten for result in successful),
        filters_rewritten=sum(result.filters_rewritten for result in successful),
        drafts_rewritten=sum(result.drafts_rewritten for result in successful),
        versions_created=sum(result.version_created for result in successful),
        failures=sum(result.status == "failed" for result in results),
    )


def run_job(job_id: str) -> CatalogOptionJob:
    """Run or resume a cascade; already-completed projects remain durable."""

    with transaction() as conn:
        claimed = repository.claim_job(conn, job_id)
    if claimed is None:
        current = get_job(job_id)
        if current is None:
            raise LookupError("catalog_option_job_not_found")
        return current
    job = _job(claimed)
    try:
        with transaction() as conn:
            repository.reset_expired_project_claims(conn, job_id)
        projects = _target_projects(job)
        with transaction() as conn:
            repository.register_projects(conn, job_id, projects)
        results_by_project = {result.project_id: result for result in job.project_results}
        for project in projects:
            project_id = UUID(str(project["id"]))
            with transaction() as conn:
                if not repository.claim_project(conn, job_id, project_id):
                    continue
            try:
                project_result = _process_project(
                    project,
                    catalog_table=job.catalog_table,
                    field_key=job.field_key,
                    operations=job.operations,
                    created_by=job.created_by,
                )
            except Exception as exc:
                project_result = CatalogOptionProjectResult(
                    project_id=project_id,
                    project_name=str(project["name"]),
                    status="failed",
                    error=str(exc),
                )
            results_by_project[project_id] = project_result
            totals = _totals(list(results_by_project.values()))
            with transaction() as conn:
                repository.save_project_result(
                    conn,
                    job_id=job_id,
                    project_result=project_result,
                    totals=totals,
                )
        totals = _totals(list(results_by_project.values()))
        final_status = "failed" if totals.failures else "completed"
        with transaction() as conn:
            return _job(
                repository.finish_job(
                    conn,
                    job_id=job_id,
                    status=final_status,
                    totals=totals,
                )
            )
    except Exception as exc:
        totals = _totals(job.project_results)
        with transaction() as conn:
            return _job(
                repository.finish_job(
                    conn,
                    job_id=job_id,
                    status="failed",
                    totals=totals,
                    error=str(exc),
                )
            )
