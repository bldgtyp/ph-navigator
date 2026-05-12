"""Project workflow rules."""

from __future__ import annotations

from uuid import UUID

from fastapi import Request
from psycopg.errors import UniqueViolation
from starlette import status

from database import connection, transaction
from features.auth import repository as auth_repository
from features.auth.models import UserPublic
from features.auth.service import client_ip, user_agent
from features.projects import repository
from features.projects.models import (
    AccessMode,
    BtNumberAvailabilityResponse,
    BtNumberConflict,
    CreateProjectRequest,
    ProjectDetail,
    ProjectDocumentProject,
    ProjectDocumentV1,
    ProjectListResponse,
    ProjectSummary,
    ProjectVersionPublic,
)
from features.shared.errors import api_error


def body_size_bytes(body: ProjectDocumentV1) -> int:
    return len(body.model_dump_json().encode("utf-8"))


def empty_project_document(payload: CreateProjectRequest) -> ProjectDocumentV1:
    return ProjectDocumentV1(
        project=ProjectDocumentProject(
            name=payload.name,
            bt_number=payload.bt_number,
            cert_programs=payload.cert_programs,
            phius_number=payload.phius_number,
            phius_dropbox_url=payload.phius_dropbox_url,
        )
    )


def project_summary(row: dict[str, object]) -> ProjectSummary:
    return ProjectSummary.model_validate(row)


def version_public(row: dict[str, object]) -> ProjectVersionPublic:
    return ProjectVersionPublic.model_validate(row)


def list_dashboard_projects(user: UserPublic) -> ProjectListResponse:
    with connection() as conn:
        rows = repository.list_projects_for_owner(conn, user.id)
    return ProjectListResponse(projects=[project_summary(row) for row in rows])


def check_bt_number_available(value: str) -> BtNumberAvailabilityResponse:
    with connection() as conn:
        conflict = repository.get_project_by_bt_number(conn, value.strip())
    if conflict is None:
        return BtNumberAvailabilityResponse(available=True)
    return BtNumberAvailabilityResponse(
        available=False,
        conflict=BtNumberConflict(id=conflict["id"], name=conflict["name"]),
    )


def create_project(payload: CreateProjectRequest, user: UserPublic, request_meta: Request) -> ProjectDetail:
    body = empty_project_document(payload)
    size = body_size_bytes(body)
    try:
        with transaction() as conn:
            existing = repository.get_project_by_bt_number(conn, payload.bt_number)
            if existing is not None:
                raise api_error(
                    status.HTTP_409_CONFLICT,
                    "bt_number_taken",
                    "BT number is already assigned to another project.",
                    {"project_id": str(existing["id"]), "name": existing["name"]},
                )
            project = repository.insert_project_with_initial_version(conn, payload, user.id, body, size)
            auth_repository.log_action(
                conn,
                action="project_create",
                user_id=user.id,
                email=user.email,
                session_id=None,
                ip_address=client_ip(request_meta),
                user_agent=user_agent(request_meta),
                details={"project_id": str(project["id"]), "bt_number": project["bt_number"]},
            )
    except UniqueViolation as exc:
        raise api_error(
            status.HTTP_409_CONFLICT,
            "bt_number_taken",
            "BT number is already assigned to another project.",
        ) from exc

    return get_project_detail(project["id"], access_mode="editor")


def get_project_detail(
    project_id: UUID,
    access_mode: AccessMode,
    project: ProjectSummary | None = None,
) -> ProjectDetail:
    with connection() as conn:
        if project is None:
            project_row = repository.get_project_by_id(conn, project_id)
            if project_row is None:
                raise api_error(status.HTTP_404_NOT_FOUND, "project_not_found", "Project not found.")
            project = project_summary(project_row)
        versions = [version_public(row) for row in repository.list_versions_for_project(conn, project_id)]

    active_version = next((version for version in versions if version.id == project.active_version_id), None)
    return ProjectDetail(
        **project.model_dump(),
        versions=versions,
        active_version=active_version,
        access_mode=access_mode,
    )
