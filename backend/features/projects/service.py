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
from features.project_document.document import (
    EmptyEquipmentTables,
    ProjectDocumentProject,
    ProjectDocumentTables,
    ProjectDocumentV1,
    PumpsTableEnvelope,
    RoomsTableEnvelope,
)
from features.project_document.tables.pumps import PUMPS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.rooms import ROOMS_BUILT_IN_FIELD_DEFS
from features.project_document.validation import body_size_bytes
from features.projects import repository
from features.projects.models import (
    AccessMode,
    BtNumberAvailabilityResponse,
    BtNumberConflict,
    CreateProjectRequest,
    ProjectDetail,
    ProjectListResponse,
    ProjectSummary,
    ProjectVersionPublic,
    UpdateProjectRequest,
)
from features.shared.errors import api_error


def empty_project_document(payload: CreateProjectRequest) -> ProjectDocumentV1:
    # New projects land the built-in FieldDef seeds (incl. `record_id`)
    # into each FieldDef-capable table verbatim. `validate_document_
    # references` enforces "exactly one record_id" per table, so the
    # seeding has to happen here rather than at first save.
    return ProjectDocumentV1(
        project=ProjectDocumentProject(
            name=payload.name,
            bt_number=payload.bt_number,
            cert_programs=payload.cert_programs,
            phius_number=payload.phius_number,
            phius_dropbox_url=payload.phius_dropbox_url,
        ),
        tables=ProjectDocumentTables(
            rooms=RoomsTableEnvelope(field_defs=list(ROOMS_BUILT_IN_FIELD_DEFS)),
            equipment=EmptyEquipmentTables(
                pumps=PumpsTableEnvelope(field_defs=list(PUMPS_BUILT_IN_FIELD_DEFS)),
            ),
        ),
    )


def project_summary(row: dict[str, object]) -> ProjectSummary:
    return ProjectSummary.model_validate({field: row[field] for field in ProjectSummary.model_fields})


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


def update_project_metadata(
    project_id: UUID,
    payload: UpdateProjectRequest,
    user: UserPublic,
    request_meta: Request,
) -> ProjectDetail:
    try:
        with transaction() as conn:
            current_project = repository.get_project_by_id(conn, project_id)
            if current_project is None:
                raise api_error(status.HTTP_404_NOT_FOUND, "project_not_found", "Project not found.")

            changed_fields = changed_project_metadata_fields(payload, current_project)
            if not changed_fields:
                return get_project_detail(project_id, access_mode="editor")

            if payload.bt_number is not None:
                existing = repository.get_project_by_bt_number(conn, payload.bt_number)
                if existing is not None and existing["id"] != project_id:
                    raise api_error(
                        status.HTTP_409_CONFLICT,
                        "bt_number_taken",
                        "BT number is already assigned to another project.",
                        {"project_id": str(existing["id"]), "name": existing["name"]},
                    )

            project = repository.update_project_metadata(conn, project_id, payload, changed_fields)
            if project is None:
                raise api_error(status.HTTP_404_NOT_FOUND, "project_not_found", "Project not found.")

            auth_repository.log_action(
                conn,
                action="project_update_metadata",
                user_id=user.id,
                email=user.email,
                session_id=None,
                ip_address=client_ip(request_meta),
                user_agent=user_agent(request_meta),
                details={"project_id": str(project_id), "fields": sorted(changed_fields)},
            )
    except UniqueViolation as exc:
        raise api_error(
            status.HTTP_409_CONFLICT,
            "bt_number_taken",
            "BT number is already assigned to another project.",
        ) from exc

    return get_project_detail(
        project_id,
        access_mode="editor",
        project=project_summary(project),
        owner_display_name=project["owner_display_name"] if isinstance(project["owner_display_name"], str) else None,
    )


def changed_project_metadata_fields(payload: UpdateProjectRequest, current: dict[str, object]) -> set[str]:
    values = payload.model_dump(exclude_unset=True)
    changed: set[str] = set()
    for field, value in values.items():
        current_value = current[field]
        if field == "cert_programs":
            next_programs = value if isinstance(value, list) else []
            current_programs = current_value if isinstance(current_value, list) else []
            if sorted(next_programs) != sorted(current_programs):
                changed.add(field)
        elif value != current_value:
            changed.add(field)
    return changed


def get_project_detail(
    project_id: UUID,
    access_mode: AccessMode,
    project: ProjectSummary | None = None,
    owner_display_name: str | None = None,
) -> ProjectDetail:
    with connection() as conn:
        if project is None:
            project_row = repository.get_project_detail_by_id(conn, project_id)
            if project_row is None:
                raise api_error(status.HTTP_404_NOT_FOUND, "project_not_found", "Project not found.")
            project = project_summary(project_row)
            owner_display_name = (
                project_row["owner_display_name"] if isinstance(project_row["owner_display_name"], str) else None
            )
        versions = [version_public(row) for row in repository.list_versions_for_project(conn, project_id)]

    active_version = next((version for version in versions if version.id == project.active_version_id), None)
    return ProjectDetail(
        **project.model_dump(),
        versions=versions,
        active_version=active_version,
        access_mode=access_mode,
        owner_display_name=owner_display_name if access_mode == "editor" else None,
    )
