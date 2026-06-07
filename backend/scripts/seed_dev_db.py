"""Reset and seed the local development database.

Truncates application tables, creates the default editor account from
`backend/seeds/user.json`, and inserts one project whose document body
is assembled from the per-table JSON files in `backend/seeds/project/`.

Catalog tables (materials / glazing / frames) are populated by their
own seed scripts. Use `make db-seed` for the end-to-end orchestration
(reset → user → project → 3 catalogs).
"""

from __future__ import annotations

import argparse
import json
from typing import Any
from urllib.parse import urlparse

from psycopg import sql
from pydantic import BaseModel, Field

from config import settings
from database import transaction
from features.auth.service import create_or_update_user
from features.project_document.document import (
    ApplianceRow,
    AppliancesTableEnvelope,
    ElectricHeaterRow,
    ElectricHeatersTableEnvelope,
    FanRow,
    FansTableEnvelope,
    HotWaterTankRow,
    HotWaterTanksTableEnvelope,
    ProjectDocumentTables,
    ProjectDocumentV1,
    PumpRow,
    PumpsTableEnvelope,
    RoomRow,
    RoomsTableEnvelope,
    SingleSelectOption,
    VentilatorRow,
    VentilatorsTableEnvelope,
)
from features.project_document.tables.appliances import APPLIANCES_BUILT_IN_FIELD_DEFS
from features.project_document.tables.electric_heaters import ELECTRIC_HEATERS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.fans import FANS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.hot_water_tanks import HOT_WATER_TANKS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.pumps import PUMPS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.rooms import ROOMS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.ventilators import VENTILATORS_BUILT_IN_FIELD_DEFS
from features.project_document.validation import body_size_bytes, validate_document
from features.projects.models import CreateProjectRequest
from features.projects.repository import insert_project_with_initial_version
from features.projects.service import empty_project_document
from scripts._seed_paths import (
    APPLIANCES_SEED_PATH,
    ELECTRIC_HEATERS_SEED_PATH,
    FANS_SEED_PATH,
    HOT_WATER_TANKS_SEED_PATH,
    PROJECT_META_PATH,
    PUMPS_SEED_PATH,
    ROOMS_SEED_PATH,
    VENTILATORS_SEED_PATH,
    default_user_kwargs,
)

LOCAL_ENVIRONMENTS = {"development", "test", "local"}
_USER_DEFAULTS = default_user_kwargs()


class _TableSeed(BaseModel):
    """One project-doc table seed JSON: option lists + rows."""

    options: dict[str, list[SingleSelectOption]] = Field(default_factory=dict)
    rows: list[dict[str, Any]] = Field(default_factory=list)


def _load_table_seed(path: Any) -> _TableSeed:
    return _TableSeed.model_validate_json(path.read_text())


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset and seed the PHN-V2 local dev database.")
    parser.add_argument("--email", default=_USER_DEFAULTS["email"])
    parser.add_argument("--display-name", default=_USER_DEFAULTS["display_name"])
    parser.add_argument("--password", default=_USER_DEFAULTS["password"])
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
    project_meta = json.loads(PROJECT_META_PATH.read_text())
    payload = CreateProjectRequest(**project_meta)
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
        _reseed_aperture_default_catalog_rows(conn)


# Mirrors alembic revision ``20260605_0018`` — the truncate above clears
# the Alembic-seeded ``PHN-Default-Frame`` / ``PHN-Default-Glazing`` rows
# that the Aperture Builder bookshelf-copies, so we re-insert them here
# in the same transaction. Idempotent via the ``WHERE NOT EXISTS`` guard
# so a ``--no-reset`` run is also safe.
_APERTURE_DEFAULT_FRAME_ID = "recPHNDefFrame001"
_APERTURE_DEFAULT_FRAME_NAME = "PHN-Default-Frame"
_APERTURE_DEFAULT_GLAZING_ID = "recPHNDefGlazng01"
_APERTURE_DEFAULT_GLAZING_NAME = "PHN-Default-Glazing"


def _reseed_aperture_default_catalog_rows(conn: Any) -> None:
    conn.execute(
        """
        INSERT INTO catalog_frame_types (
            id, name,
            width_mm, u_value_w_m2k, psi_g_w_mk,
            color, source
        )
        SELECT
            %(id)s, %(name)s,
            50.0, 1.5, 0.04,
            '#888888', 'PH-Navigator built-in default'
        WHERE NOT EXISTS (
            SELECT 1 FROM catalog_frame_types
            WHERE name = %(name)s AND deleted_at IS NULL
        )
        """,
        {"id": _APERTURE_DEFAULT_FRAME_ID, "name": _APERTURE_DEFAULT_FRAME_NAME},
    )
    conn.execute(
        """
        INSERT INTO catalog_glazing_types (
            id, name,
            u_value_w_m2k, g_value,
            color, source
        )
        SELECT
            %(id)s, %(name)s,
            1.0, 0.5,
            '#a8c8ff', 'PH-Navigator built-in default'
        WHERE NOT EXISTS (
            SELECT 1 FROM catalog_glazing_types
            WHERE name = %(name)s AND deleted_at IS NULL
        )
        """,
        {"id": _APERTURE_DEFAULT_GLAZING_ID, "name": _APERTURE_DEFAULT_GLAZING_NAME},
    )


def _starter_project_document(payload: CreateProjectRequest) -> ProjectDocumentV1:
    body = empty_project_document(payload)

    rooms_seed = _load_table_seed(ROOMS_SEED_PATH)
    pumps_seed = _load_table_seed(PUMPS_SEED_PATH)
    fans_seed = _load_table_seed(FANS_SEED_PATH)
    ventilators_seed = _load_table_seed(VENTILATORS_SEED_PATH)
    hot_water_tanks_seed = _load_table_seed(HOT_WATER_TANKS_SEED_PATH)
    electric_heaters_seed = _load_table_seed(ELECTRIC_HEATERS_SEED_PATH)
    appliances_seed = _load_table_seed(APPLIANCES_SEED_PATH)

    next_options = dict(body.single_select_options)
    for seed in (
        rooms_seed,
        pumps_seed,
        fans_seed,
        ventilators_seed,
        hot_water_tanks_seed,
        electric_heaters_seed,
        appliances_seed,
    ):
        next_options.update(seed.options)

    next_equipment = body.tables.equipment.model_copy(
        update={
            "pumps": PumpsTableEnvelope(
                field_defs=list(PUMPS_BUILT_IN_FIELD_DEFS),
                rows=[PumpRow.model_validate(row) for row in pumps_seed.rows],
            ),
            "fans": FansTableEnvelope(
                field_defs=list(FANS_BUILT_IN_FIELD_DEFS),
                rows=[FanRow.model_validate(row) for row in fans_seed.rows],
            ),
            "ervs": VentilatorsTableEnvelope(
                field_defs=list(VENTILATORS_BUILT_IN_FIELD_DEFS),
                rows=[VentilatorRow.model_validate(row) for row in ventilators_seed.rows],
            ),
            "hot_water_tanks": HotWaterTanksTableEnvelope(
                field_defs=list(HOT_WATER_TANKS_BUILT_IN_FIELD_DEFS),
                rows=[HotWaterTankRow.model_validate(row) for row in hot_water_tanks_seed.rows],
            ),
            "electric_heaters": ElectricHeatersTableEnvelope(
                field_defs=list(ELECTRIC_HEATERS_BUILT_IN_FIELD_DEFS),
                rows=[ElectricHeaterRow.model_validate(row) for row in electric_heaters_seed.rows],
            ),
            "appliances": AppliancesTableEnvelope(
                field_defs=list(APPLIANCES_BUILT_IN_FIELD_DEFS),
                rows=[ApplianceRow.model_validate(row) for row in appliances_seed.rows],
            ),
        }
    )

    next_tables = ProjectDocumentTables(
        assemblies=body.tables.assemblies,
        project_materials=body.tables.project_materials,
        apertures=body.tables.apertures,
        rooms=RoomsTableEnvelope(
            field_defs=list(ROOMS_BUILT_IN_FIELD_DEFS),
            rows=[RoomRow.model_validate(row) for row in rooms_seed.rows],
        ),
        equipment=next_equipment,
    )
    return validate_document(
        body.model_copy(update={"tables": next_tables, "single_select_options": next_options}).model_dump(mode="json")
    )


if __name__ == "__main__":
    main()
