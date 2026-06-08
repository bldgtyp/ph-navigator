"""Project workflow rules."""

from __future__ import annotations

from datetime import date
from typing import Any, Protocol
from uuid import UUID

from fastapi import HTTPException, Request
from psycopg import Connection
from psycopg.errors import UniqueViolation
from starlette import status

from config import settings
from database import connection, transaction
from features.assets.storage_r2 import R2Client
from features.auth import repository as auth_repository
from features.auth.models import UserPublic
from features.auth.service import client_ip, user_agent
from features.project_document.document import (
    APPLIANCE_ENERGY_STAR_OPTION_KEY,
    APPLIANCE_TYPE_OPTION_KEY,
    FAN_TYPE_OPTION_KEY,
    HOT_WATER_HEATER_TYPE_OPTION_KEY,
    THERMAL_BRIDGE_TYPE_OPTION_KEY,
    VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY,
    AppliancesTableEnvelope,
    ElectricHeatersTableEnvelope,
    EmptyEquipmentTables,
    FansTableEnvelope,
    HotWaterHeatersTableEnvelope,
    ProjectDocumentProject,
    ProjectDocumentTables,
    ProjectDocumentV1,
    PumpsTableEnvelope,
    RoomsTableEnvelope,
    SingleSelectOption,
    ThermalBridgesTableEnvelope,
    VentilatorsTableEnvelope,
)
from features.project_document.tables.appliances import APPLIANCES_BUILT_IN_FIELD_DEFS
from features.project_document.tables.electric_heaters import ELECTRIC_HEATERS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.fans import FANS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.hot_water_heaters import HOT_WATER_HEATERS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.pumps import PUMPS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.rooms import ROOMS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.thermal_bridges import THERMAL_BRIDGES_BUILT_IN_FIELD_DEFS
from features.project_document.tables.ventilators import VENTILATORS_BUILT_IN_FIELD_DEFS
from features.project_document.validation import body_size_bytes
from features.projects import repository
from features.projects.models import (
    AccessMode,
    BtNumberAvailabilityResponse,
    BtNumberConflict,
    CreateProjectRequest,
    ProjectBulkDeleteItem,
    ProjectBulkDeleteRequest,
    ProjectBulkDeleteResponse,
    ProjectDeleteCounts,
    ProjectDeletedListResponse,
    ProjectDeletedSummary,
    ProjectDeleteRequest,
    ProjectDeleteResponse,
    ProjectDetail,
    ProjectHardDeleteRequest,
    ProjectHardDeleteResponse,
    ProjectHardDeleteStorageSummary,
    ProjectListResponse,
    ProjectSummary,
    ProjectVersionPublic,
    UpdateProjectRequest,
)
from features.shared.errors import api_error


class ProjectDeleteObjectsResult(Protocol):
    deleted_object_count: int
    failed_object_keys: list[str]


class ProjectObjectStorage(Protocol):
    def list_object_keys(self, prefix: str) -> list[str]: ...

    def delete_objects(self, object_keys: list[str]) -> ProjectDeleteObjectsResult: ...


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
            thermal_bridges=ThermalBridgesTableEnvelope(field_defs=list(THERMAL_BRIDGES_BUILT_IN_FIELD_DEFS)),
            equipment=EmptyEquipmentTables(
                appliances=AppliancesTableEnvelope(field_defs=list(APPLIANCES_BUILT_IN_FIELD_DEFS)),
                electric_heaters=ElectricHeatersTableEnvelope(field_defs=list(ELECTRIC_HEATERS_BUILT_IN_FIELD_DEFS)),
                ervs=VentilatorsTableEnvelope(field_defs=list(VENTILATORS_BUILT_IN_FIELD_DEFS)),
                pumps=PumpsTableEnvelope(field_defs=list(PUMPS_BUILT_IN_FIELD_DEFS)),
                fans=FansTableEnvelope(field_defs=list(FANS_BUILT_IN_FIELD_DEFS)),
                hot_water_heaters=HotWaterHeatersTableEnvelope(field_defs=list(HOT_WATER_HEATERS_BUILT_IN_FIELD_DEFS)),
            ),
        ),
        single_select_options={
            "rooms.floor_level": [],
            "rooms.building_zone": [],
            THERMAL_BRIDGE_TYPE_OPTION_KEY: [
                SingleSelectOption(id="opt_tb_ambient", label="15-Ambient", color="#0ea5e9", order=0),
                SingleSelectOption(id="opt_tb_perimeter", label="16-Perimeter", color="#f97316", order=1),
                SingleSelectOption(id="opt_tb_below_grade", label="17-Below-Grade", color="#64748b", order=2),
            ],
            "pumps.device_type": [
                SingleSelectOption(
                    id="opt_pump_heat_circulation", label="4-Heat Circulation Pump", color="#0ea5e9", order=0
                ),
                SingleSelectOption(
                    id="opt_pump_dhw_circulation", label="6-DHW Circulation Pump", color="#14b8a6", order=1
                ),
                SingleSelectOption(id="opt_pump_dhw_storage", label="7-DHW Storage Pump", color="#f97316", order=2),
                SingleSelectOption(id="opt_pump_other", label="10-Other", color="#64748b", order=3),
            ],
            VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY: [
                SingleSelectOption(id="opt_vent_inside", label="Inside", color="#3b82f6", order=0),
                SingleSelectOption(id="opt_vent_outside", label="Outside", color="#10b981", order=1),
            ],
            FAN_TYPE_OPTION_KEY: [
                SingleSelectOption(id="opt_fan_dryer", label="1-Dryer", color="#f97316", order=0),
                SingleSelectOption(id="opt_fan_kitchen_hood", label="2-Kitchen Hood", color="#0ea5e9", order=1),
                SingleSelectOption(id="opt_fan_user_defined", label="3-User Defined", color="#8b5cf6", order=2),
            ],
            HOT_WATER_HEATER_TYPE_OPTION_KEY: [
                SingleSelectOption(id="opt_hwh_electric", label="1-Electric", color="#ef4444", order=0),
                SingleSelectOption(id="opt_hwh_boiler_gas_oil", label="2-Boiler (Gas/Oil)", color="#f97316", order=1),
                SingleSelectOption(id="opt_hwh_boiler_wood", label="3-Boiler (Wood)", color="#92400e", order=2),
                SingleSelectOption(id="opt_hwh_district", label="4-District", color="#6366f1", order=3),
                SingleSelectOption(
                    id="opt_hwh_heat_pump_annual_cop",
                    label="5-Heat Pump (Annual COP)",
                    color="#10b981",
                    order=4,
                ),
                SingleSelectOption(
                    id="opt_hwh_heat_pump_monthly_cop",
                    label="6-Heat Pump (Monthly COP)",
                    color="#14b8a6",
                    order=5,
                ),
                SingleSelectOption(
                    id="opt_hwh_heat_pump_inside",
                    label="7-Heat Pump (Inside)",
                    color="#0ea5e9",
                    order=6,
                ),
            ],
            APPLIANCE_TYPE_OPTION_KEY: [
                SingleSelectOption(id="opt_appl_dishwasher", label="1-dishwasher", color="#0ea5e9", order=0),
                SingleSelectOption(id="opt_appl_clothes_washer", label="2-clothes_washer", color="#14b8a6", order=1),
                SingleSelectOption(id="opt_appl_clothes_dryer", label="3-clothes_dryer", color="#f97316", order=2),
                SingleSelectOption(id="opt_appl_fridge", label="4-fridge", color="#3b82f6", order=3),
                SingleSelectOption(id="opt_appl_freezer", label="5-freezer", color="#6366f1", order=4),
                SingleSelectOption(id="opt_appl_fridge_freezer", label="6-fridge_freezer", color="#8b5cf6", order=5),
                SingleSelectOption(id="opt_appl_cooking", label="7-cooking", color="#ef4444", order=6),
                SingleSelectOption(id="opt_appl_phius_mel", label="13-PHIUS_MEL", color="#f59e0b", order=7),
                SingleSelectOption(
                    id="opt_appl_phius_lighting_int", label="14-PHIUS_Lighting_Int", color="#84cc16", order=8
                ),
                SingleSelectOption(
                    id="opt_appl_phius_lighting_ext", label="15-PHIUS_Lighting_Ext", color="#22c55e", order=9
                ),
                SingleSelectOption(
                    id="opt_appl_phius_lighting_garage", label="16-PHIUS_Lighting_Garage", color="#10b981", order=10
                ),
                SingleSelectOption(
                    id="opt_appl_custom_electric_per_year",
                    label="11-Custom_Electric_per_Year",
                    color="#06b6d4",
                    order=11,
                ),
                SingleSelectOption(
                    id="opt_appl_custom_electric_lighting_per_year",
                    label="17-Custom_Electric_Lighting_per_Year",
                    color="#6366f1",
                    order=12,
                ),
                SingleSelectOption(
                    id="opt_appl_custom_electric_mel_per_use",
                    label="18-Custom_Electric_MEL_per_Use",
                    color="#8b5cf6",
                    order=13,
                ),
                SingleSelectOption(
                    id="opt_appl_commercial_dishwasher", label="21-Commercial_Dishwasher", color="#a855f7", order=14
                ),
                SingleSelectOption(
                    id="opt_appl_commercial_refrigerator", label="22-Commercial_Refrigerator", color="#d946ef", order=15
                ),
                SingleSelectOption(
                    id="opt_appl_commercial_cooking", label="23-Commercial_Cooking", color="#ec4899", order=16
                ),
                SingleSelectOption(
                    id="opt_appl_commercial_custom", label="24-Commercial_Custom", color="#64748b", order=17
                ),
            ],
            APPLIANCE_ENERGY_STAR_OPTION_KEY: [
                SingleSelectOption(id="opt_appl_energy_star_yes", label="Yes", color="#10b981", order=0),
                SingleSelectOption(id="opt_appl_energy_star_no", label="No", color="#64748b", order=1),
            ],
        },
    )


def project_summary(row: dict[str, object]) -> ProjectSummary:
    return ProjectSummary.model_validate({field: row[field] for field in ProjectSummary.model_fields})


def project_delete_counts(row: dict[str, int]) -> ProjectDeleteCounts:
    return ProjectDeleteCounts.model_validate(row)


def project_deleted_summary(row: dict[str, object], counts: ProjectDeleteCounts) -> ProjectDeletedSummary:
    values = {field: row[field] for field in ProjectSummary.model_fields}
    values.update(
        {
            "deleted_at": row["deleted_at"],
            "deleted_by": row["deleted_by"],
            "hard_delete_after": row["hard_delete_after"],
            "counts": counts,
        }
    )
    return ProjectDeletedSummary.model_validate(values)


def version_public(row: dict[str, object]) -> ProjectVersionPublic:
    return ProjectVersionPublic.model_validate(row)


def list_dashboard_projects(user: UserPublic) -> ProjectListResponse:
    with connection() as conn:
        rows = repository.list_projects_for_owner(conn, user.id)
    return ProjectListResponse(projects=[project_summary(row) for row in rows])


def list_deleted_dashboard_projects(user: UserPublic) -> ProjectDeletedListResponse:
    with connection() as conn:
        rows = repository.list_deleted_projects_for_owner(conn, user.id)
        projects = [
            project_deleted_summary(row, project_delete_counts(repository.count_project_children(conn, row["id"])))
            for row in rows
        ]
    return ProjectDeletedListResponse(projects=projects)


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


def delete_project(
    project_id: UUID,
    payload: ProjectDeleteRequest,
    user: UserPublic,
    request_meta: Request | None,
) -> ProjectDeleteResponse:
    if not payload.confirm:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "project_delete_confirmation_required",
            "Project delete requires explicit confirmation.",
        )
    with transaction() as conn:
        current = repository.get_project_by_id_including_deleted(conn, project_id)
        if current is None:
            raise api_error(status.HTTP_404_NOT_FOUND, "project_not_found", "Project not found.")
        _ensure_project_owner(current, user)
        already_deleted = current["deleted_at"] is not None
        deleted = repository.soft_delete_project(conn, project_id, user.id)
        if deleted is None:
            raise api_error(status.HTTP_404_NOT_FOUND, "project_not_found", "Project not found.")
        counts = project_delete_counts(repository.count_project_children(conn, project_id))
        auth_repository.log_action(
            conn,
            action="project_soft_delete",
            user_id=user.id,
            email=user.email,
            session_id=None,
            ip_address=_client_ip(request_meta),
            user_agent=_user_agent(request_meta),
            details={
                "project_id": str(project_id),
                "bt_number": deleted["bt_number"],
                "name": deleted["name"],
                "already_deleted": already_deleted,
                "hard_delete_after": (
                    deleted["hard_delete_after"].isoformat() if deleted["hard_delete_after"] is not None else None
                ),
                "counts": counts.model_dump(),
            },
        )
    return ProjectDeleteResponse(
        project_id=project_id,
        deleted_at=deleted["deleted_at"],
        hard_delete_after=deleted["hard_delete_after"],
        already_deleted=already_deleted,
        counts=counts,
    )


def bulk_delete_projects(
    payload: ProjectBulkDeleteRequest,
    user: UserPublic,
    request_meta: Request | None,
) -> ProjectBulkDeleteResponse:
    if not payload.confirm:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "project_delete_confirmation_required",
            "Project delete requires explicit confirmation.",
        )
    items: list[ProjectBulkDeleteItem] = []
    seen: set[UUID] = set()
    for project_id in payload.project_ids:
        if project_id in seen:
            continue
        seen.add(project_id)
        try:
            deleted = delete_project(project_id, ProjectDeleteRequest(confirm=True), user, request_meta)
            items.append(
                ProjectBulkDeleteItem(
                    project_id=project_id,
                    ok=True,
                    deleted_at=deleted.deleted_at,
                    hard_delete_after=deleted.hard_delete_after,
                    already_deleted=deleted.already_deleted,
                    counts=deleted.counts,
                )
            )
        except Exception as exc:
            detail = getattr(exc, "detail", None)
            if isinstance(detail, dict):
                items.append(
                    ProjectBulkDeleteItem(
                        project_id=project_id,
                        ok=False,
                        error_code=str(detail.get("error_code", "project_delete_failed")),
                        message=str(detail.get("message", "Project delete failed.")),
                    )
                )
            else:
                items.append(
                    ProjectBulkDeleteItem(
                        project_id=project_id,
                        ok=False,
                        error_code="project_delete_failed",
                        message=str(exc),
                    )
                )
    return ProjectBulkDeleteResponse(items=items)


def restore_project(project_id: UUID, user: UserPublic, request_meta: Request | None) -> ProjectDetail:
    with transaction() as conn:
        current = repository.get_project_by_id_including_deleted(conn, project_id)
        if current is None:
            raise api_error(status.HTTP_404_NOT_FOUND, "project_not_found", "Project not found.")
        _ensure_project_owner(current, user)
        if current["deleted_at"] is None:
            project = project_summary(current)
            owner_display_name = _owner_display_name(conn, project_id)
            return get_project_detail(
                project_id,
                access_mode="editor",
                project=project,
                owner_display_name=owner_display_name,
            )
        restored = repository.restore_project(conn, project_id)
        if restored is None:
            raise api_error(
                status.HTTP_409_CONFLICT,
                "project_restore_expired",
                "Project can no longer be restored.",
                {"project_id": str(project_id), "hard_delete_after": _isoformat(current["hard_delete_after"])},
            )
        auth_repository.log_action(
            conn,
            action="project_restore",
            user_id=user.id,
            email=user.email,
            session_id=None,
            ip_address=_client_ip(request_meta),
            user_agent=_user_agent(request_meta),
            details={"project_id": str(project_id), "bt_number": restored["bt_number"], "name": restored["name"]},
        )
        owner_display_name = _owner_display_name(conn, project_id)
    return get_project_detail(
        project_id,
        access_mode="editor",
        project=project_summary(restored),
        owner_display_name=owner_display_name,
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
                deleted_row = repository.get_project_by_id_including_deleted(conn, project_id)
                if deleted_row is not None and deleted_row["deleted_at"] is not None:
                    raise project_deleted_error(deleted_row)
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


def hard_delete_project(
    project_id: UUID,
    payload: ProjectHardDeleteRequest,
    *,
    user: UserPublic | None = None,
    request_meta: Request | None = None,
    storage: ProjectObjectStorage | None = None,
) -> ProjectHardDeleteResponse:
    """Permanently remove a project and its project-owned object prefix.

    This is intentionally not used by normal dashboard routes. It exists for
    dev/admin cleanup and MCP's explicitly confirmed hard-delete tool.
    """
    with transaction() as conn:
        current = repository.get_project_by_id_including_deleted(conn, project_id)
        if current is None:
            raise api_error(status.HTTP_404_NOT_FOUND, "project_not_found", "Project not found.")
        if user is not None:
            _ensure_project_owner(current, user)
        if current["name"] != payload.confirm_project_name or current["bt_number"] != payload.confirm_bt_number:
            raise api_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "project_delete_hard_confirmation_mismatch",
                "Project name and BT number confirmation did not match.",
            )
        if current["deleted_at"] is None:
            current = repository.soft_delete_project(conn, project_id, user.id if user else None)
            if current is None:
                raise api_error(status.HTTP_404_NOT_FOUND, "project_not_found", "Project not found.")
        counts = project_delete_counts(repository.count_project_children(conn, project_id))
        manifest = repository.list_project_storage_manifest(conn, project_id)

    resolved_storage = storage or R2Client(settings)
    object_prefix = f"projects/{project_id}/assets/"
    object_keys = resolved_storage.list_object_keys(object_prefix)
    manifest["prefix"] = object_prefix
    manifest["prefix_object_keys"] = object_keys
    delete_result = resolved_storage.delete_objects(object_keys)
    storage_summary = ProjectHardDeleteStorageSummary(
        deleted_object_count=int(getattr(delete_result, "deleted_object_count", 0)),
        failed_object_keys=list(getattr(delete_result, "failed_object_keys", [])),
    )
    if storage_summary.failed_object_keys:
        with transaction() as conn:
            auth_repository.log_action(
                conn,
                action="project_hard_delete_failed",
                user_id=user.id if user else None,
                email=user.email if user else None,
                session_id=None,
                ip_address=client_ip(request_meta) if request_meta else None,
                user_agent=user_agent(request_meta) if request_meta else None,
                details={
                    "project_id": str(project_id),
                    "bt_number": current["bt_number"],
                    "name": current["name"],
                    "counts": counts.model_dump(),
                    "manifest": manifest,
                    "storage": storage_summary.model_dump(),
                },
            )
        raise api_error(
            status.HTTP_409_CONFLICT,
            "project_hard_delete_storage_partial_failure",
            "Project storage cleanup partially failed; database rows were kept for retry.",
            {"project_id": str(project_id), "storage": storage_summary.model_dump(), "manifest": manifest},
        )

    with transaction() as conn:
        deleted = repository.hard_delete_project_rows(conn, project_id)
        if not deleted:
            raise api_error(status.HTTP_404_NOT_FOUND, "project_not_found", "Project not found.")
        auth_repository.log_action(
            conn,
            action="project_hard_delete",
            user_id=user.id if user else None,
            email=user.email if user else None,
            session_id=None,
            ip_address=client_ip(request_meta) if request_meta else None,
            user_agent=user_agent(request_meta) if request_meta else None,
            details={
                "project_id": str(project_id),
                "bt_number": current["bt_number"],
                "name": current["name"],
                "counts": counts.model_dump(),
                "manifest": manifest,
                "storage": storage_summary.model_dump(),
            },
        )
    return ProjectHardDeleteResponse(
        project_id=project_id,
        deleted=True,
        counts=counts,
        storage=storage_summary,
        manifest=manifest,
    )


def project_deleted_error(row: dict[str, object]) -> HTTPException:
    return api_error(
        status.HTTP_410_GONE,
        "project_deleted",
        "Project was deleted.",
        {
            "recoverability": "restore",
            "project_id": str(row["id"]),
            "deleted_at": _isoformat(row["deleted_at"]),
            "hard_delete_after": _isoformat(row["hard_delete_after"]),
        },
    )


def _ensure_project_owner(project: dict[str, object], user: UserPublic) -> None:
    if project["owner_id"] != user.id:
        raise api_error(status.HTTP_404_NOT_FOUND, "project_not_found", "Project not found.")


def _owner_display_name(conn: Connection[Any], project_id: UUID) -> str | None:
    row = conn.execute(
        """
        SELECT users.display_name AS owner_display_name
        FROM projects
        JOIN users ON users.id = projects.owner_id
        WHERE projects.id = %(project_id)s
        """,
        {"project_id": project_id},
    ).fetchone()
    return row["owner_display_name"] if row and isinstance(row["owner_display_name"], str) else None


def _isoformat(value: object) -> str | None:
    return value.isoformat() if isinstance(value, date) else None


def _client_ip(request_meta: Request | None) -> str | None:
    return client_ip(request_meta) if request_meta is not None else None


def _user_agent(request_meta: Request | None) -> str | None:
    return user_agent(request_meta) if request_meta is not None else None
