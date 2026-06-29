"""Create or refresh the PERF-STRESS project for frontend performance sweeps."""

from __future__ import annotations

import argparse
import getpass
from dataclasses import dataclass, replace
from typing import Any, TypeVar
from urllib.parse import quote
from uuid import UUID

from psycopg import Connection
from psycopg.types.json import Jsonb
from pydantic import BaseModel

from config import settings
from database import transaction
from features.auth.service import create_or_update_user
from features.project_document.document import ProjectDocumentV1
from features.project_document.validation import SerializedProjectDocument, serialize_document, validate_document
from features.projects.models import CreateProjectRequest
from features.projects.repository import insert_project_with_initial_version
from scripts._seed_paths import assert_local_dev_database
from scripts.seed_dev_db import _seed_climate, _starter_project_document

DEFAULT_EMAIL = "codex@example.com"
DEFAULT_DISPLAY_NAME = "Codex Agent"
DEFAULT_PASSWORD = "password"
DEFAULT_PRODUCTION_EMAIL = "codex@testing.com"
DEFAULT_PRODUCTION_DISPLAY_NAME = "Codex Testing"
DEFAULT_BT_NUMBER = "PERF-STRESS"
DEFAULT_PROJECT_NAME = "Frontend Perf Stress Fixture"
DEFAULT_FRONTEND_URL = "http://localhost:5173"
DEFAULT_PRODUCTION_FRONTEND_URL = "https://www.ph-nav.com"
DEFAULT_TABLE_ROWS = 1000
DEFAULT_EQUIPMENT_ROWS = 250
DEFAULT_PRODUCTION_TABLE_ROWS = 250
DEFAULT_PRODUCTION_EQUIPMENT_ROWS = 250

RowT = TypeVar("RowT", bound=BaseModel)


@dataclass(frozen=True)
class PerfStressFixture:
    email: str
    password: str
    project_id: UUID
    version_id: UUID
    bt_number: str
    sign_in_route: str
    rooms_route: str
    climate: dict[str, Any] | None = None


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the PERF-STRESS frontend perf project.")
    parser.add_argument("--email")
    parser.add_argument("--display-name")
    parser.add_argument("--password")
    parser.add_argument("--bt-number", default=DEFAULT_BT_NUMBER)
    parser.add_argument("--project-name", default=DEFAULT_PROJECT_NAME)
    parser.add_argument("--frontend-url")
    parser.add_argument("--table-rows", type=int)
    parser.add_argument("--equipment-rows", type=int)
    parser.add_argument(
        "--confirm-production",
        action="store_true",
        help="Allow the production-only fixture reset path. Required for production writes.",
    )
    parser.add_argument(
        "--skip-climate",
        action="store_true",
        help="Skip production climate seeding. Intended only for recovery/debugging.",
    )
    args = parser.parse_args()

    if args.confirm_production:
        password = args.password or getpass.getpass("Testing account password: ")
        fixture = seed_production_perf_stress_fixture(
            email=args.email or DEFAULT_PRODUCTION_EMAIL,
            display_name=args.display_name or DEFAULT_PRODUCTION_DISPLAY_NAME,
            password=password,
            bt_number=args.bt_number,
            project_name=args.project_name,
            frontend_url=(args.frontend_url or DEFAULT_PRODUCTION_FRONTEND_URL).rstrip("/"),
            table_rows=_int_arg_or_default(args.table_rows, DEFAULT_PRODUCTION_TABLE_ROWS),
            equipment_rows=_int_arg_or_default(args.equipment_rows, DEFAULT_PRODUCTION_EQUIPMENT_ROWS),
            confirm_production=True,
            seed_climate=not args.skip_climate,
        )
        _print_production_fixture(fixture)
        return

    if args.skip_climate:
        raise SystemExit("--skip-climate only applies with --confirm-production.")

    fixture = seed_perf_stress_fixture(
        email=args.email or DEFAULT_EMAIL,
        display_name=args.display_name or DEFAULT_DISPLAY_NAME,
        password=args.password or DEFAULT_PASSWORD,
        bt_number=args.bt_number,
        project_name=args.project_name,
        frontend_url=(args.frontend_url or DEFAULT_FRONTEND_URL).rstrip("/"),
        table_rows=_int_arg_or_default(args.table_rows, DEFAULT_TABLE_ROWS),
        equipment_rows=_int_arg_or_default(args.equipment_rows, DEFAULT_EQUIPMENT_ROWS),
    )
    _print_local_fixture(fixture)


def seed_perf_stress_fixture(
    *,
    email: str = DEFAULT_EMAIL,
    display_name: str = DEFAULT_DISPLAY_NAME,
    password: str = DEFAULT_PASSWORD,
    bt_number: str = DEFAULT_BT_NUMBER,
    project_name: str = DEFAULT_PROJECT_NAME,
    frontend_url: str = DEFAULT_FRONTEND_URL,
    table_rows: int = DEFAULT_TABLE_ROWS,
    equipment_rows: int = DEFAULT_EQUIPMENT_ROWS,
) -> PerfStressFixture:
    """Upsert a Codex-owned stress project without truncating local dev data."""

    if table_rows < 1 or equipment_rows < 1:
        raise SystemExit("--table-rows and --equipment-rows must be positive.")
    assert_local_dev_database()

    return _upsert_perf_stress_fixture(
        email=email,
        display_name=display_name,
        password=password,
        bt_number=bt_number,
        project_name=project_name,
        frontend_url=frontend_url,
        table_rows=table_rows,
        equipment_rows=equipment_rows,
    )


def seed_production_perf_stress_fixture(
    *,
    email: str = DEFAULT_PRODUCTION_EMAIL,
    display_name: str = DEFAULT_PRODUCTION_DISPLAY_NAME,
    password: str,
    bt_number: str = DEFAULT_BT_NUMBER,
    project_name: str = DEFAULT_PROJECT_NAME,
    frontend_url: str = DEFAULT_PRODUCTION_FRONTEND_URL,
    table_rows: int = DEFAULT_PRODUCTION_TABLE_ROWS,
    equipment_rows: int = DEFAULT_PRODUCTION_EQUIPMENT_ROWS,
    confirm_production: bool = False,
    seed_climate: bool = True,
) -> PerfStressFixture:
    """Reset the dedicated production perf fixture in place.

    This intentionally owns only the ``PERF-STRESS`` project/account path. It
    never truncates production data and it refuses to run outside a production
    environment so local/staging operators do not accidentally create divergent
    fixture shapes.
    """

    if table_rows < 1 or equipment_rows < 1:
        raise SystemExit("--table-rows and --equipment-rows must be positive.")
    _assert_production_fixture_allowed(confirm_production, email=email, bt_number=bt_number)

    fixture = _upsert_perf_stress_fixture(
        email=email,
        display_name=display_name,
        password=password,
        bt_number=bt_number,
        project_name=project_name,
        frontend_url=frontend_url,
        table_rows=table_rows,
        equipment_rows=equipment_rows,
    )
    if not seed_climate:
        return fixture

    _reset_project_climate(fixture.project_id)
    climate = _seed_climate(fixture.project_id)
    return replace(fixture, climate=climate)


def _upsert_perf_stress_fixture(
    *,
    email: str,
    display_name: str,
    password: str,
    bt_number: str,
    project_name: str,
    frontend_url: str,
    table_rows: int,
    equipment_rows: int,
) -> PerfStressFixture:
    frontend_url = frontend_url.rstrip("/")

    user = create_or_update_user(email=email, display_name=display_name, password=password)
    payload = CreateProjectRequest(
        name=project_name,
        bt_number=bt_number,
        client="Codex",
        cert_programs=["phi"],
        phius_number=None,
        phius_dropbox_url=None,
    )
    body = _stress_project_document(payload, table_rows=table_rows, equipment_rows=equipment_rows)
    serialized_body = serialize_document(body)

    with transaction() as conn:
        project = _upsert_perf_project(conn, payload, user.id, body, serialized_body)

    path = f"/projects/{project['id']}/spaces/rooms"
    return PerfStressFixture(
        email=email,
        password=password,
        project_id=project["id"],
        version_id=project["active_version_id"],
        bt_number=bt_number,
        sign_in_route=f"{frontend_url}/sign-in?next={quote(path, safe='')}",
        rooms_route=f"{frontend_url}{path}",
    )


def _assert_production_fixture_allowed(
    confirm_production: bool,
    *,
    email: str = DEFAULT_PRODUCTION_EMAIL,
    bt_number: str = DEFAULT_BT_NUMBER,
) -> None:
    if settings.environment != "production":
        raise SystemExit(
            "Production perf fixture seeding must run with ENVIRONMENT=production. "
            "Use the local seed path without --confirm-production for local dev."
        )
    if not confirm_production:
        raise SystemExit("Refusing to reset the production perf fixture without --confirm-production.")
    if email.lower() != DEFAULT_PRODUCTION_EMAIL:
        raise SystemExit(f"Production perf fixture account must be {DEFAULT_PRODUCTION_EMAIL}.")
    if bt_number != DEFAULT_BT_NUMBER:
        raise SystemExit(f"Production perf fixture project must be {DEFAULT_BT_NUMBER}.")


def _int_arg_or_default(value: int | None, default: int) -> int:
    return default if value is None else value


def _reset_project_climate(project_id: UUID) -> None:
    with transaction() as conn:
        conn.execute("DELETE FROM project_climate_source WHERE project_id = %(project_id)s", {"project_id": project_id})
        conn.execute("DELETE FROM project_location WHERE project_id = %(project_id)s", {"project_id": project_id})


def _print_local_fixture(fixture: PerfStressFixture) -> None:
    print("Seeded local frontend perf stress fixture:")
    print(f"  login: {fixture.email} / {fixture.password}")
    print(f"  project: {fixture.bt_number} ({fixture.project_id})")
    print(f"  version: {fixture.version_id}")
    print(f"  sign-in route: {fixture.sign_in_route}")
    print(f"  rooms route: {fixture.rooms_route}")
    print("")
    print("Run perf matrix:")
    print(f"  cd frontend && PHN_PERF=1 PERF_PROJECT_ID={fixture.project_id} pnpm run test:e2e -- tests/e2e/perf")


def _print_production_fixture(fixture: PerfStressFixture) -> None:
    print("Seeded production frontend perf stress fixture:")
    print(f"  login: {fixture.email} / <password not printed>")
    print(f"  project: {fixture.bt_number} ({fixture.project_id})")
    print(f"  version: {fixture.version_id}")
    print(f"  sign-in route: {fixture.sign_in_route}")
    print(f"  rooms route: {fixture.rooms_route}")
    if fixture.climate is not None:
        print(f"  climate: {fixture.climate}")
    print("")
    print("Read-only production perf matrix command:")
    print(
        "  cd frontend && "
        f"PHN_PERF=1 PHN_PERF_PRODUCTION=1 PHN_PERF_READONLY=1 PERF_PROJECT_ID={fixture.project_id} "
        f"E2E_BASE_URL={DEFAULT_PRODUCTION_FRONTEND_URL} E2E_API_BASE_URL=https://api.ph-nav.com "
        f"E2E_EMAIL={fixture.email} E2E_PASSWORD=<supplied-at-runtime> "
        "pnpm run test:e2e -- tests/e2e/perf"
    )


def _stress_project_document(
    payload: CreateProjectRequest,
    *,
    table_rows: int,
    equipment_rows: int,
) -> ProjectDocumentV1:
    body = _starter_project_document(payload)
    table_row_count = max(
        table_rows,
        len(body.tables.rooms.rows),
        len(body.tables.space_types.rows),
        len(body.tables.thermal_bridges.rows),
    )
    equipment_row_count = max(
        equipment_rows,
        len(body.tables.equipment.pumps.rows),
        len(body.tables.equipment.fans.rows),
        len(body.tables.equipment.ervs.rows),
        len(body.tables.equipment.hot_water_heaters.rows),
        len(body.tables.equipment.hot_water_tanks.rows),
        len(body.tables.equipment.electric_heaters.rows),
        len(body.tables.equipment.appliances.rows),
    )

    space_type_ids = [f"st_perf_{index:04d}" for index in range(1, table_row_count + 1)]
    tables = body.tables.model_copy(
        update={
            "space_types": body.tables.space_types.model_copy(
                update={
                    "rows": _clone_rows(
                        body.tables.space_types.rows,
                        row_count=table_row_count,
                        id_prefix="st_perf",
                        label_prefix="Perf Space Type",
                    )
                }
            ),
            "rooms": body.tables.rooms.model_copy(
                update={
                    "rows": _clone_rows(
                        body.tables.rooms.rows,
                        row_count=table_row_count,
                        id_prefix="rm_perf",
                        label_prefix="Perf Room",
                        linked_space_type_ids=space_type_ids,
                        preserve_source_ids=True,
                    )
                }
            ),
            "thermal_bridges": body.tables.thermal_bridges.model_copy(
                update={
                    "rows": _clone_rows(
                        body.tables.thermal_bridges.rows,
                        row_count=table_row_count,
                        id_prefix="tb_perf",
                        label_prefix="Perf Thermal Bridge",
                    )
                }
            ),
            "equipment": body.tables.equipment.model_copy(
                update={
                    "pumps": body.tables.equipment.pumps.model_copy(
                        update={
                            "rows": _clone_rows(
                                body.tables.equipment.pumps.rows,
                                row_count=equipment_row_count,
                                id_prefix="pmp_perf",
                                label_prefix="Perf Pump",
                            )
                        }
                    ),
                    "fans": body.tables.equipment.fans.model_copy(
                        update={
                            "rows": _clone_rows(
                                body.tables.equipment.fans.rows,
                                row_count=equipment_row_count,
                                id_prefix="fan_perf",
                                label_prefix="Perf Fan",
                            )
                        }
                    ),
                    "ervs": body.tables.equipment.ervs.model_copy(
                        update={
                            "rows": _clone_rows(
                                body.tables.equipment.ervs.rows,
                                row_count=equipment_row_count,
                                id_prefix="vent_perf",
                                label_prefix="Perf Ventilator",
                                preserve_source_ids=True,
                            )
                        }
                    ),
                    "hot_water_heaters": body.tables.equipment.hot_water_heaters.model_copy(
                        update={
                            "rows": _clone_rows(
                                body.tables.equipment.hot_water_heaters.rows,
                                row_count=equipment_row_count,
                                id_prefix="hwh_perf",
                                label_prefix="Perf Water Heater",
                            )
                        }
                    ),
                    "hot_water_tanks": body.tables.equipment.hot_water_tanks.model_copy(
                        update={
                            "rows": _clone_rows(
                                body.tables.equipment.hot_water_tanks.rows,
                                row_count=equipment_row_count,
                                id_prefix="hwt_perf",
                                label_prefix="Perf Tank",
                            )
                        }
                    ),
                    "electric_heaters": body.tables.equipment.electric_heaters.model_copy(
                        update={
                            "rows": _clone_rows(
                                body.tables.equipment.electric_heaters.rows,
                                row_count=equipment_row_count,
                                id_prefix="heatr_perf",
                                label_prefix="Perf Electric Heater",
                            )
                        }
                    ),
                    "appliances": body.tables.equipment.appliances.model_copy(
                        update={
                            "rows": _clone_rows(
                                body.tables.equipment.appliances.rows,
                                row_count=equipment_row_count,
                                id_prefix="appl_perf",
                                label_prefix="Perf Appliance",
                            )
                        }
                    ),
                }
            ),
        }
    )
    return validate_document(body.model_copy(update={"tables": tables}).model_dump(mode="json"))


def _clone_rows(
    rows: list[RowT],
    *,
    row_count: int,
    id_prefix: str,
    label_prefix: str,
    linked_space_type_ids: list[str] | None = None,
    preserve_source_ids: bool = False,
) -> list[RowT]:
    if not rows:
        raise SystemExit(f"Cannot build perf fixture: source table for {id_prefix!r} has no seed rows.")
    cloned: list[RowT] = []
    row_class = type(rows[0])
    for index in range(1, row_count + 1):
        data = rows[(index - 1) % len(rows)].model_dump(mode="python", round_trip=True)
        if not (preserve_source_ids and index <= len(rows)):
            data["id"] = f"{id_prefix}_{index:04d}"
        _label_row(data, label_prefix=label_prefix, index=index)
        if linked_space_type_ids is not None:
            data.setdefault("custom_links", {})["space_type_id"] = [linked_space_type_ids[index - 1]]
        cloned.append(row_class.model_validate(data))
    return cloned


def _label_row(data: dict[str, Any], *, label_prefix: str, index: int) -> None:
    custom_values = dict(data.get("custom_values") or {})
    for key in ("name", "tag", "model", "model_number", "use"):
        if key in custom_values:
            custom_values[key] = f"{label_prefix} {index:04d}"
    if "number" in custom_values:
        custom_values["number"] = f"{index:04d}"
    if "num_people" in custom_values:
        custom_values["num_people"] = float((index % 4) + 1)
    if "num_bedrooms" in custom_values:
        custom_values["num_bedrooms"] = float(index % 3)
    data["custom_values"] = custom_values
    if "tag" in data:
        data["tag"] = f"{label_prefix} {index:04d}"
    if "notes" in data:
        data["notes"] = f"Perf stress fixture row {index:04d}."


def _upsert_perf_project(
    conn: Connection[Any],
    payload: CreateProjectRequest,
    user_id: UUID,
    body: ProjectDocumentV1,
    serialized_body: SerializedProjectDocument,
) -> dict[str, Any]:
    existing = conn.execute(
        """
        SELECT id, active_version_id
        FROM projects
        WHERE bt_number = %(bt_number)s
        """,
        {"bt_number": payload.bt_number},
    ).fetchone()
    if existing is None:
        return insert_project_with_initial_version(
            conn,
            payload,
            user_id,
            body,
            serialized_body.size_bytes,
            serialized_body=serialized_body,
        )

    version_id = existing["active_version_id"]
    if version_id is None:
        raise RuntimeError("Perf fixture project has no active version to update.")

    project = conn.execute(
        """
        UPDATE projects
        SET name = %(name)s,
            client = %(client)s,
            cert_programs = %(cert_programs)s,
            phius_number = %(phius_number)s,
            phius_dropbox_url = %(phius_dropbox_url)s,
            owner_id = %(owner_id)s,
            deleted_at = NULL,
            deleted_by = NULL,
            hard_delete_after = NULL,
            updated_at = now()
        WHERE id = %(project_id)s
        RETURNING id, active_version_id
        """,
        {
            "project_id": existing["id"],
            "name": payload.name,
            "client": payload.client,
            "cert_programs": payload.cert_programs,
            "phius_number": payload.phius_number,
            "phius_dropbox_url": payload.phius_dropbox_url,
            "owner_id": user_id,
        },
    ).fetchone()
    if project is None:
        raise RuntimeError("Perf fixture project update did not return a row.")

    conn.execute(
        """
        UPDATE project_versions
        SET name = 'Working',
            kind = 'working',
            locked = false,
            body = %(body)s,
            schema_version = %(schema_version)s,
            body_size_bytes = %(body_size_bytes)s,
            updated_by = %(user_id)s,
            updated_at = now()
        WHERE id = %(version_id)s
        """,
        {
            "version_id": version_id,
            "user_id": user_id,
            "body": Jsonb(serialized_body.json_value),
            "schema_version": body.schema_version,
            "body_size_bytes": serialized_body.size_bytes,
        },
    )
    conn.execute("DELETE FROM project_version_drafts WHERE version_id = %(version_id)s", {"version_id": version_id})
    return project


if __name__ == "__main__":
    main()
