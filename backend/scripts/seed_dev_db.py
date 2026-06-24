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
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from psycopg import sql
from pydantic import BaseModel, Field

from config import settings
from database import transaction
from features.auth.service import create_or_update_user
from features.climate import repository as climate_repository
from features.climate.importers import get_provider
from features.climate.object_store import ClimateBundleStore
from features.climate.seeding import seed_all_from_object_store
from features.climate.service import SeedResult
from features.heat_pumps.models import (
    HeatPumpIndoorEquipRow,
    HeatPumpIndoorEquipTableEnvelope,
    HeatPumpIndoorUnitRow,
    HeatPumpIndoorUnitsTableEnvelope,
    HeatPumpOutdoorEquipRow,
    HeatPumpOutdoorEquipTableEnvelope,
    HeatPumpOutdoorUnitRow,
    HeatPumpOutdoorUnitsTableEnvelope,
    HeatPumpsTableSlice,
)
from features.project_climate_source import repository as climate_source_repository
from features.project_document.apertures.factories import build_default_aperture_type
from features.project_document.document import (
    APERTURE_DEFAULT_FRAME_NAME,
    APERTURE_DEFAULT_GLAZING_NAME,
    ApplianceRow,
    AppliancesTableEnvelope,
    Assembly,
    CatalogOrigin,
    ElectricHeaterRow,
    ElectricHeatersTableEnvelope,
    FanRow,
    FansTableEnvelope,
    FrameRef,
    GlazingRef,
    HotWaterHeaterRow,
    HotWaterHeatersTableEnvelope,
    HotWaterTankRow,
    HotWaterTanksTableEnvelope,
    ProjectDocumentTables,
    ProjectDocumentV1,
    ProjectMaterial,
    PumpRow,
    PumpsTableEnvelope,
    RoomRow,
    RoomsTableEnvelope,
    SingleSelectOption,
    SpaceTypeRow,
    SpaceTypesTableEnvelope,
    ThermalBridgeRow,
    ThermalBridgesTableEnvelope,
    VentilatorRow,
    VentilatorsTableEnvelope,
)
from features.project_document.tables.appliances import APPLIANCES_BUILT_IN_FIELD_DEFS
from features.project_document.tables.electric_heaters import ELECTRIC_HEATERS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.fans import FANS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.heat_pumps import (
    INDOOR_EQUIP_BUILT_IN_FIELD_DEFS,
    INDOOR_UNITS_BUILT_IN_FIELD_DEFS,
    OUTDOOR_EQUIP_BUILT_IN_FIELD_DEFS,
    OUTDOOR_UNITS_BUILT_IN_FIELD_DEFS,
)
from features.project_document.tables.hot_water_heaters import HOT_WATER_HEATERS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.hot_water_tanks import HOT_WATER_TANKS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.pumps import PUMPS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.rooms import ROOMS_BUILT_IN_FIELD_DEFS
from features.project_document.tables.space_types import SPACE_TYPES_BUILT_IN_FIELD_DEFS
from features.project_document.tables.thermal_bridges import THERMAL_BRIDGES_BUILT_IN_FIELD_DEFS
from features.project_document.tables.ventilators import VENTILATORS_BUILT_IN_FIELD_DEFS
from features.project_document.validation import body_size_bytes, validate_document
from features.project_location import repository as project_location_repository
from features.projects.models import CreateProjectRequest
from features.projects.repository import insert_project_with_initial_version
from features.projects.service import empty_project_document
from scripts._seed_paths import (
    APERTURES_SEED_PATH,
    APPLIANCES_SEED_PATH,
    ASSEMBLIES_SEED_PATH,
    CLIMATE_DEFAULT_STATION_ID,
    ELECTRIC_HEATERS_SEED_PATH,
    FANS_SEED_PATH,
    HEAT_PUMPS_SEED_PATH,
    HOT_WATER_HEATERS_SEED_PATH,
    HOT_WATER_TANKS_SEED_PATH,
    PROJECT_META_PATH,
    PUMPS_SEED_PATH,
    ROOMS_SEED_PATH,
    SPACE_TYPES_SEED_PATH,
    THERMAL_BRIDGES_SEED_PATH,
    VENTILATORS_SEED_PATH,
    assert_local_dev_database,
    default_user_kwargs,
)

_USER_DEFAULTS = default_user_kwargs()


class _TableSeed(BaseModel):
    """One project-doc table seed JSON: option lists + rows."""

    options: dict[str, list[SingleSelectOption]] = Field(default_factory=dict)
    rows: list[dict[str, Any]] = Field(default_factory=list)


class _EnvelopeSeed(BaseModel):
    """Assembly Builder seed JSON: project materials plus assemblies."""

    project_materials: list[dict[str, Any]] = Field(default_factory=list)
    assemblies: list[dict[str, Any]] = Field(default_factory=list)


class _ApertureSeedRow(BaseModel):
    """One starter aperture row using the built-in default frame/glazing."""

    id: str
    name: str


class _ApertureSeed(BaseModel):
    rows: list[_ApertureSeedRow] = Field(default_factory=list)


class _HeatPumpsSeed(BaseModel):
    """Heat-pumps slice seed: four parallel row lists plus shared option lists."""

    options: dict[str, list[SingleSelectOption]] = Field(default_factory=dict)
    outdoor_equip: list[dict[str, Any]] = Field(default_factory=list)
    indoor_equip: list[dict[str, Any]] = Field(default_factory=list)
    outdoor_units: list[dict[str, Any]] = Field(default_factory=list)
    indoor_units: list[dict[str, Any]] = Field(default_factory=list)


def _load_table_seed(path: Any) -> _TableSeed:
    return _TableSeed.model_validate_json(path.read_text())


def _load_envelope_seed(path: Any) -> _EnvelopeSeed:
    return _EnvelopeSeed.model_validate_json(path.read_text())


def _load_aperture_seed(path: Any) -> _ApertureSeed:
    return _ApertureSeed.model_validate_json(path.read_text())


def _load_heat_pumps_seed(path: Any) -> _HeatPumpsSeed:
    return _HeatPumpsSeed.model_validate_json(path.read_text())


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
    assert_local_dev_database()

    if args.reset:
        _truncate_application_tables()

    user = create_or_update_user(email=args.email, display_name=args.display_name, password=args.password)
    project_meta = json.loads(PROJECT_META_PATH.read_text())
    payload = CreateProjectRequest(**project_meta)
    body = _starter_project_document(payload)
    with transaction() as conn:
        project = insert_project_with_initial_version(conn, payload, user.id, body, body_size_bytes(body))

    climate = _seed_climate(project["id"])

    print(f"Seeded local dev database: user={user.email}, project={project['bt_number']} ({project['id']})")
    print("Seeded climate datasets: " + ", ".join(climate["seeded"]))
    if climate["skipped"]:
        print("  (not published, skipped: " + ", ".join(climate["skipped"]) + ")")
    print(f"  Phius source -> {climate['phius_location_name']}")
    if climate["phi_location_name"] is not None:
        print(f"  nearest PHI source   -> {climate['phi_location_name']}")


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


# Mirrors alembic revisions ``20260605_0018`` + ``20260624_0040`` — the
# truncate above clears the Alembic-seeded ``PHN-Default-Frame`` /
# ``PHN-Default-Glass`` rows that the Aperture Builder bookshelf-copies, so we
# re-insert them here in the same transaction. Idempotent via the
# ``WHERE NOT EXISTS`` guard so a ``--no-reset`` run is also safe.
_APERTURE_DEFAULT_FRAME_ID = "recPHNDefFrame001"
_APERTURE_DEFAULT_FRAME_NAME = "PHN-Default-Frame"
_APERTURE_DEFAULT_GLAZING_ID = "recPHNDefGlazng01"
_APERTURE_DEFAULT_GLAZING_NAME = "PHN-Default-Glass"


class _SeedDefaultsCatalog:
    """In-memory default refs matching the DB rows reseeded above."""

    def get_default_frame(self) -> FrameRef:
        return FrameRef(
            name=APERTURE_DEFAULT_FRAME_NAME,
            width_mm=50.0,
            u_value_w_m2k=1.5,
            psi_g_w_mk=0.04,
            color="#888888",
            source="PH-Navigator built-in default",
            catalog_origin=CatalogOrigin(
                catalog_table="frame_types",
                catalog_record_id=_APERTURE_DEFAULT_FRAME_ID,
                catalog_schema_version=1,
                synced_at=datetime.now(tz=UTC),
                local_overrides=[],
            ),
        )

    def get_default_glazing(self) -> GlazingRef:
        return GlazingRef(
            name=APERTURE_DEFAULT_GLAZING_NAME,
            u_value_w_m2k=1.0,
            g_value=0.5,
            color="#a8c8ff",
            source="PH-Navigator built-in default",
            catalog_origin=CatalogOrigin(
                catalog_table="glazing_types",
                catalog_record_id=_APERTURE_DEFAULT_GLAZING_ID,
                catalog_schema_version=1,
                synced_at=datetime.now(tz=UTC),
                local_overrides=[],
            ),
        )


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

    envelope_seed = _load_envelope_seed(ASSEMBLIES_SEED_PATH)
    apertures_seed = _load_aperture_seed(APERTURES_SEED_PATH)
    rooms_seed = _load_table_seed(ROOMS_SEED_PATH)
    space_types_seed = _load_table_seed(SPACE_TYPES_SEED_PATH)
    pumps_seed = _load_table_seed(PUMPS_SEED_PATH)
    fans_seed = _load_table_seed(FANS_SEED_PATH)
    thermal_bridges_seed = _load_table_seed(THERMAL_BRIDGES_SEED_PATH)
    ventilators_seed = _load_table_seed(VENTILATORS_SEED_PATH)
    hot_water_heaters_seed = _load_table_seed(HOT_WATER_HEATERS_SEED_PATH)
    hot_water_tanks_seed = _load_table_seed(HOT_WATER_TANKS_SEED_PATH)
    electric_heaters_seed = _load_table_seed(ELECTRIC_HEATERS_SEED_PATH)
    appliances_seed = _load_table_seed(APPLIANCES_SEED_PATH)
    heat_pumps_seed = _load_heat_pumps_seed(HEAT_PUMPS_SEED_PATH)

    next_options = dict(body.single_select_options)
    for seed in (
        rooms_seed,
        space_types_seed,
        pumps_seed,
        fans_seed,
        thermal_bridges_seed,
        ventilators_seed,
        hot_water_heaters_seed,
        hot_water_tanks_seed,
        electric_heaters_seed,
        appliances_seed,
        heat_pumps_seed,
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
            "hot_water_heaters": HotWaterHeatersTableEnvelope(
                field_defs=list(HOT_WATER_HEATERS_BUILT_IN_FIELD_DEFS),
                rows=[HotWaterHeaterRow.model_validate(row) for row in hot_water_heaters_seed.rows],
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
            "heat_pumps": HeatPumpsTableSlice(
                outdoor_equip=HeatPumpOutdoorEquipTableEnvelope(
                    field_defs=list(OUTDOOR_EQUIP_BUILT_IN_FIELD_DEFS),
                    rows=[HeatPumpOutdoorEquipRow.model_validate(row) for row in heat_pumps_seed.outdoor_equip],
                ),
                indoor_equip=HeatPumpIndoorEquipTableEnvelope(
                    field_defs=list(INDOOR_EQUIP_BUILT_IN_FIELD_DEFS),
                    rows=[HeatPumpIndoorEquipRow.model_validate(row) for row in heat_pumps_seed.indoor_equip],
                ),
                outdoor_units=HeatPumpOutdoorUnitsTableEnvelope(
                    field_defs=list(OUTDOOR_UNITS_BUILT_IN_FIELD_DEFS),
                    rows=[HeatPumpOutdoorUnitRow.model_validate(row) for row in heat_pumps_seed.outdoor_units],
                ),
                indoor_units=HeatPumpIndoorUnitsTableEnvelope(
                    field_defs=list(INDOOR_UNITS_BUILT_IN_FIELD_DEFS),
                    rows=[HeatPumpIndoorUnitRow.model_validate(row) for row in heat_pumps_seed.indoor_units],
                ),
            ),
        }
    )

    next_tables = ProjectDocumentTables(
        assemblies=[Assembly.model_validate(row) for row in envelope_seed.assemblies],
        project_materials=[ProjectMaterial.model_validate(row) for row in envelope_seed.project_materials],
        rooms=RoomsTableEnvelope(
            field_defs=list(ROOMS_BUILT_IN_FIELD_DEFS),
            rows=[RoomRow.model_validate(row) for row in rooms_seed.rows],
        ),
        space_types=SpaceTypesTableEnvelope(
            field_defs=list(SPACE_TYPES_BUILT_IN_FIELD_DEFS),
            rows=[SpaceTypeRow.model_validate(row) for row in space_types_seed.rows],
        ),
        thermal_bridges=ThermalBridgesTableEnvelope(
            field_defs=list(THERMAL_BRIDGES_BUILT_IN_FIELD_DEFS),
            rows=[ThermalBridgeRow.model_validate(row) for row in thermal_bridges_seed.rows],
        ),
        equipment=next_equipment,
    )
    next_tables.apertures = [
        build_default_aperture_type(_SeedDefaultsCatalog(), tables=next_tables, name=row.name, aperture_id=row.id)
        for row in apertures_seed.rows
    ]
    return validate_document(
        body.model_copy(update={"tables": next_tables, "single_select_options": next_options}).model_dump(mode="json")
    )


def _seed_climate(project_id: UUID) -> dict[str, Any]:
    """Seed every published climate dataset and pin the starter project's sources.

    Mirrors the production seed (``seeding --all``, PRD D-CS-7): the truncate
    above wipes ``climate_dataset*`` plus the project-scoped
    ``project_climate_source`` / ``project_location`` rows, so this rebuilds
    them from whatever standardized bundles are published in the private object
    store (PRD D-CS-2) — today ``phius/2022`` and ``phi/10.6``, both put there by
    ``make seed-climate-bundle``. It then pins the starter project's **default
    Phius** source (the firm's home turf) plus a matching site location, and
    attaches the **nearest PHI** station as the project's advisory PHI source,
    so both the Phius and PHI Climate pickers open with real data instead of an
    empty roster.

    Phius is required — the starter default resolves against it. PHI is seeded
    and pinned only when its bundle is published; without it the PHI picker
    keeps its graceful empty state.
    """
    if not settings.r2_endpoint_url:
        raise SystemExit(
            "R2_ENDPOINT_URL is required to seed climate from the object store; "
            "run `make object-store-init` and `make seed-climate-bundle` first."
        )
    store = ClimateBundleStore.from_settings()
    seeded, skipped = seed_all_from_object_store(store)
    results = {result.provider: result for result in seeded}

    phius = results.get("phius")
    if phius is None:
        raise SystemExit(
            "No Phius bundle is published in the object store, so the starter project's "
            "Phius climate source cannot resolve. Publish phius/2022 with "
            "`make seed-climate-bundle` (see backend/seeds/climate/README.md)."
        )

    with transaction() as conn:
        phius_location = _pin_phius_source(conn, project_id, phius)
        _upsert_starter_location(conn, project_id, phius_location)
        phi_location = _pin_nearest_phi_source(conn, project_id, results.get("phi"), phius_location)

    return {
        "seeded": [f"{result.provider} {result.version} ({result.location_count} locations)" for result in seeded],
        "skipped": [f"{provider} {version}" for provider, version in skipped],
        "phius_location_name": phius_location["name"],
        "phi_location_name": phi_location["name"] if phi_location is not None else None,
    }


def _pin_phius_source(conn: Any, project_id: UUID, phius: SeedResult) -> dict[str, Any]:
    """Pin the firm's home-turf Phius station as the project's Phius source."""
    location = conn.execute(
        """
        SELECT id, name, latitude, longitude, elevation_m, region
        FROM climate_dataset_location
        WHERE dataset_id = %(dataset_id)s AND station_id = %(station_id)s
        """,
        {"dataset_id": phius.dataset_id, "station_id": CLIMATE_DEFAULT_STATION_ID},
    ).fetchone()
    if location is None:
        raise SystemExit(
            f"Climate seed station {CLIMATE_DEFAULT_STATION_ID!r} missing from the Phius dataset; "
            "check backend/seeds/climate/."
        )
    _insert_climate_source(conn, project_id, kind="phius", version=phius.version, location=location)
    return location


def _pin_nearest_phi_source(
    conn: Any, project_id: UUID, phi: SeedResult | None, site: dict[str, Any]
) -> dict[str, Any] | None:
    """Attach the PHI station nearest the project site as the advisory PHI source.

    Symmetric with the Phius source; reuses the backend nearest-station query
    so no proximity math lives here. Returns ``None`` when PHI is unpublished
    or its dataset has no located stations.
    """
    if phi is None:
        return None
    nearest = climate_repository.nearest_locations(
        conn, phi.dataset_id, latitude=float(site["latitude"]), longitude=float(site["longitude"]), limit=1
    )
    if not nearest:
        return None
    location = nearest[0]
    _insert_climate_source(conn, project_id, kind="phi", version=phi.version, location=location)
    return location


def _insert_climate_source(conn: Any, project_id: UUID, *, kind: str, version: str, location: dict[str, Any]) -> None:
    """Attach one ``climate_dataset_location`` to the project as a ``kind`` source.

    ``data=None`` matches auto-attach: proximity is recomputed server-side on
    read (D-DP-2), never trusted from a seeded snapshot. The label reuses the
    provider registry so it reads "(Phius 2022)" / "(PHI 10.6)" without hardcoding.
    """
    climate_source_repository.insert_source(
        conn,
        source_id=uuid4(),
        project_id=project_id,
        kind=kind,
        ref=str(location["id"]),
        label=f"{location['name']} ({get_provider(kind).label_for(version)})",
        data=None,
    )


def _upsert_starter_location(conn: Any, project_id: UUID, location: dict[str, Any]) -> None:
    """Set the starter project's site location from its seeded Phius station."""
    location_values: dict[str, object] = {
        "latitude": location["latitude"],
        "longitude": location["longitude"],
        "elevation_m": location["elevation_m"],
        "time_zone": "America/New_York",
        "true_north_deg": 0.0,
        "street_address": "Industry City, 220 36th St",
        "city": "Brooklyn",
        "state": location["region"],
    }
    project_location_repository.upsert_location(conn, project_id, set(location_values), location_values)


if __name__ == "__main__":
    main()
