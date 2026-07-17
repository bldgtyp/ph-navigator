"""HTTP status and retry surface for catalog-wide option cascades."""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks
from starlette import status

from features.catalogs.access import CatalogEditor
from features.catalogs.option_jobs_models import (
    CatalogOptionCascadePreview,
    CatalogOptionCascadePreviewRequest,
    CatalogOptionJob,
    CatalogOptionTable,
)
from features.catalogs.option_jobs_service import get_job, get_unresolved_job, preview_cascade, run_job
from features.shared.errors import api_error

router = APIRouter(prefix="/api/v1/catalogs/option-jobs", tags=["catalogs"])


def _job_or_404(job_id: str) -> CatalogOptionJob:
    job = get_job(job_id)
    if job is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "catalog_option_job_not_found", "Catalog option job not found.")
    return job


@router.post("/preview", response_model=CatalogOptionCascadePreview)
def preview_catalog_option_cascade(
    payload: CatalogOptionCascadePreviewRequest,
    auth: CatalogEditor,
) -> CatalogOptionCascadePreview:
    """Count the active project documents affected by a proposed option rename."""

    del auth
    return CatalogOptionCascadePreview(
        project_count=preview_cascade(
            catalog_table=payload.catalog_table,
            field_key=payload.field_key,
            operations=payload.operations,
        )
    )


@router.get("/unresolved/{catalog_table}", response_model=CatalogOptionJob | None)
def get_unresolved_catalog_option_job(
    catalog_table: CatalogOptionTable,
    auth: CatalogEditor,
) -> CatalogOptionJob | None:
    """Recover the durable progress surface after a catalog-page remount."""

    del auth
    return get_unresolved_job(catalog_table)


@router.get("/{job_id}", response_model=CatalogOptionJob)
def get_catalog_option_job(job_id: str, auth: CatalogEditor) -> CatalogOptionJob:
    """Expose durable cascade progress to the catalog working modal."""

    del auth
    return _job_or_404(job_id)


@router.post("/{job_id}/retry", response_model=CatalogOptionJob, status_code=status.HTTP_202_ACCEPTED)
def retry_catalog_option_job(
    job_id: str,
    background_tasks: BackgroundTasks,
    auth: CatalogEditor,
) -> CatalogOptionJob:
    """Resume only a failed cascade; completed runs are immutable audit records."""

    del auth
    job = _job_or_404(job_id)
    if job.status != "failed":
        raise api_error(
            status.HTTP_409_CONFLICT,
            "catalog_option_job_not_retryable",
            "Only a failed catalog option job can be retried.",
            {"status": job.status},
        )
    background_tasks.add_task(run_job, job.id)
    return job
