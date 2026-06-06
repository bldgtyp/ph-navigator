"""Reset and seed the local development database.

This is intentionally local-only. It wipes application tables, creates
the default editor account, and inserts one project with starter Rooms
and Pumps table rows.
"""

from __future__ import annotations

import argparse
from urllib.parse import urlparse

from psycopg import sql

from config import settings
from database import transaction
from features.auth.service import create_or_update_user
from features.project_document.document import (
    ProjectDocumentTables,
    ProjectDocumentV1,
    PumpRow,
    PumpsTableEnvelope,
    RoomRow,
    RoomsTableEnvelope,
    SingleSelectOption,
)
from features.project_document.tables.pumps import PUMPS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.rooms import ROOMS_BUILT_IN_FIELD_DEFS
from features.project_document.validation import body_size_bytes, validate_document
from features.projects.models import CreateProjectRequest
from features.projects.repository import insert_project_with_initial_version
from features.projects.service import empty_project_document

LOCAL_ENVIRONMENTS = {"development", "test", "local"}
DEFAULT_EMAIL = "ed@example.com"
DEFAULT_PASSWORD = "password"
DEFAULT_DISPLAY_NAME = "Ed May"


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset and seed the PHN-V2 local dev database.")
    parser.add_argument("--email", default=DEFAULT_EMAIL)
    parser.add_argument("--display-name", default=DEFAULT_DISPLAY_NAME)
    parser.add_argument("--password", default=DEFAULT_PASSWORD)
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Wipe application data before seeding. Required unless --no-reset is supplied.",
    )
    parser.add_argument(
        "--no-reset",
        action="store_true",
        help="Seed into the current database without truncating first.",
    )
    args = parser.parse_args()

    if args.reset == args.no_reset:
        raise SystemExit("Pass exactly one of --reset or --no-reset.")
    _assert_local_dev_database()

    if args.reset:
        _truncate_application_tables()

    user = create_or_update_user(email=args.email, display_name=args.display_name, password=args.password)
    payload = CreateProjectRequest(
        name="PHN V2 Starter Project",
        bt_number="DEV-0001",
        client="BLDGTYP",
        cert_programs=["phius"],
        phius_number=None,
        phius_dropbox_url=None,
    )
    body = _starter_project_document(payload)
    with transaction() as conn:
        project = insert_project_with_initial_version(conn, payload, user.id, body, body_size_bytes(body))

    print(f"Seeded local dev database: user={user.email}, project={project['bt_number']} ({project['id']})")


def _assert_local_dev_database() -> None:
    if settings.environment not in LOCAL_ENVIRONMENTS:
        raise SystemExit(f"Refusing to seed ENVIRONMENT={settings.environment!r}; expected local/dev/test.")

    db_name = urlparse(settings.database_url).path.lstrip("/")
    if db_name != "ph_navigator_v2":
        raise SystemExit(f"Refusing to reset database {db_name!r}; expected local dev database 'ph_navigator_v2'.")


def _truncate_application_tables() -> None:
    with transaction() as conn:
        rows = conn.execute(
            """
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename <> 'alembic_version'
            ORDER BY tablename
            """
        ).fetchall()
        table_names = [str(row["tablename"]) for row in rows]
        if table_names:
            query = sql.SQL("TRUNCATE {} RESTART IDENTITY CASCADE").format(
                sql.SQL(", ").join(sql.Identifier(name) for name in table_names)
            )
            conn.execute(query)


def _starter_project_document(payload: CreateProjectRequest) -> ProjectDocumentV1:
    body = empty_project_document(payload)
    next_options = {
        **body.single_select_options,
        "rooms.floor_level": [
            SingleSelectOption(id="opt_level_1", label="Level 1", color="#3b82f6", order=0),
            SingleSelectOption(id="opt_level_2", label="Level 2", color="#6366f1", order=1),
        ],
        "rooms.building_zone": [
            SingleSelectOption(id="opt_conditioned", label="Conditioned", color="#10b981", order=0),
            SingleSelectOption(id="opt_unconditioned", label="Unconditioned", color="#f59e0b", order=1),
        ],
        "pumps.device_type": [
            SingleSelectOption(id="opt_circulator", label="Circulator", color="#0ea5e9", order=0),
        ],
    }
    next_tables = ProjectDocumentTables(
        assemblies=body.tables.assemblies,
        project_materials=body.tables.project_materials,
        window_types=body.tables.window_types,
        rooms=RoomsTableEnvelope(
            field_defs=list(ROOMS_BUILT_IN_FIELD_DEFS),
            rows=[
                _room("rm_101", "101", "Living Room", "opt_level_1", "opt_conditioned", people=2),
                _room("rm_102", "102", "Kitchen", "opt_level_1", "opt_conditioned", people=1),
                _room("rm_103", "103", "Bedroom 1", "opt_level_2", "opt_conditioned", bedrooms=1),
                _room("rm_104", "104", "Bedroom 2", "opt_level_2", "opt_conditioned", bedrooms=1),
                _room("rm_105", "105", "Basement", "opt_level_1", "opt_unconditioned", icfa_factor=0.0),
            ],
        ),
        equipment=body.tables.equipment.model_copy(
            update={
                "pumps": PumpsTableEnvelope(
                    field_defs=list(PUMPS_BUILT_IN_FIELD_DEFS),
                    rows=[
                        PumpRow(
                            id="pmp_1",
                            device_type="opt_circulator",
                            phase=1,
                            link="https://example.com/pump.pdf",
                            notes="Starter DHW recirculation pump.",
                            datasheet_asset_ids=[],
                            custom_values={
                                "record_id": "P-1",
                                "use": "DHW recirc",
                                "manufacturer": "Taco",
                                "model": "0015e3",
                                "volts": 120,
                                "horse_power": None,
                                "wattage": 45,
                                "flow_gpm": 4,
                                "runtime_khr_yr": 2.5,
                            },
                        )
                    ],
                )
            }
        ),
    )
    return validate_document(
        body.model_copy(update={"tables": next_tables, "single_select_options": next_options}).model_dump(mode="json")
    )


def _room(
    row_id: str,
    number: str,
    name: str,
    floor_level: str,
    building_zone: str,
    *,
    people: int = 0,
    bedrooms: int = 0,
    icfa_factor: float = 1.0,
) -> RoomRow:
    return RoomRow(
        id=row_id,
        floor_level=floor_level,
        building_zone=building_zone,
        icfa_factor=icfa_factor,
        erv_unit_ids=[],
        catalog_origin=None,
        notes=None,
        custom_values={
            "number": number,
            "name": name,
            "num_people": people,
            "num_bedrooms": bedrooms,
        },
    )


if __name__ == "__main__":
    main()
