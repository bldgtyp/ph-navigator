"""Climate Phase 2 -- standardized record + reference datasets.

Covers the four corners of the phase: the honeybee_ph round-trip (the
pinned-schema guarantee, D-CL-10), the Phius `-mon.txt` importer against a
golden fixture, the seed routine's idempotency, and the dataset read
surfaces (repository/service, HTTP routes, MCP parity + auth).
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from typing import cast

import pytest
from fastapi.testclient import TestClient
from mcp.server.fastmcp import Context
from mcp.server.fastmcp.exceptions import ToolError

from database import connection
from features.climate.importers.phius import (
    PhiusParseError,
    parse_phius_mon_file,
    parse_phius_mon_txt,
    seed_phius_dataset,
)
from features.climate.mcp import (
    tool_get_climate_location,
    tool_list_climate_datasets,
    tool_search_climate_locations,
)
from features.climate.record import ClimateRecord
from features.climate.service import seed_dataset
from tests.test_catalogs import ORIGIN, signed_in_client
from tests.test_mcp import clean_mcp_tables, create_project

__all__ = ["clean_mcp_tables"]

_FIXTURE_ROOT = Path(__file__).parent / "fixtures" / "climate" / "phius"
_BOSTON_FILE = _FIXTURE_ROOT / "USA" / "MA" / "US0001a-Boston-mon.txt"


@pytest.fixture()
def clean_climate_tables() -> Iterator[None]:
    """Truncate the app-wide reference dataset tables around each test."""
    _truncate()
    yield
    _truncate()


def _truncate() -> None:
    with connection() as conn:
        conn.execute("TRUNCATE climate_dataset CASCADE")


def _mcp_token_env(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """Mint a (project-scoped) token and expose it as the MCP env token.

    The climate tools gate on a *valid* token, not on a project, so any
    active token authorizes them.
    """
    project = create_project(client)
    response = client.post(
        f"/api/v1/projects/{project['id']}/mcp-tokens",
        headers={"Origin": ORIGIN},
        json={"label": "Climate reader", "scopes": ["project:read"]},
    )
    assert response.status_code == 201
    monkeypatch.setenv("PHN_MCP_TOKEN", cast(str, response.json()["token"]))


# --- Standardized record: honeybee_ph round-trip ----------------------------


def test_climate_record_round_trips_through_honeybee_ph() -> None:
    from honeybee_ph.site import Site

    original = Site().to_dict()
    record = ClimateRecord.from_honeybee_ph_site(original)
    rebuilt = Site.from_dict(record.to_honeybee_ph_site()).to_dict()

    def strip(node: object) -> object:
        if isinstance(node, dict):
            return {k: strip(v) for k, v in node.items() if k not in ("identifier", "display_name", "user_data")}
        return node

    assert strip(rebuilt) == strip(original)


def test_climate_record_preserves_provider_identity_and_aux() -> None:
    from honeybee_ph.site import Site

    record = parse_phius_mon_file(_BOSTON_FILE).model_copy(update={"version": "2022"})
    # provider/version/station_id + aux live in honeybee_ph user_data; they
    # must survive the bridge unchanged.
    rebuilt = ClimateRecord.from_honeybee_ph_site(Site.from_dict(record.to_honeybee_ph_site()).to_dict())

    assert rebuilt.provider == "phius"
    assert rebuilt.version == "2022"
    assert rebuilt.station_id == "US0001a-Boston"
    assert rebuilt.aux.albedo == pytest.approx(0.2)
    assert rebuilt.aux.heating_degree_hours_12_20 == pytest.approx(78500.0)


# --- Phius importer ---------------------------------------------------------


def test_phius_parser_maps_golden_fixture() -> None:
    record = parse_phius_mon_file(_BOSTON_FILE)

    assert record.station_id == "US0001a-Boston"
    assert record.location.latitude == pytest.approx(42.36)
    assert record.location.longitude == pytest.approx(-71.06)
    assert record.location.hours_from_utc == -5
    assert record.location.climate_zone == 5
    assert record.climate.monthly_temps.air_c[0] == pytest.approx(-1.5)
    assert record.climate.monthly_radiation.glob[6] == pytest.approx(165.0)
    # Three design columns -> heat1 / heat2 / cooling1; cooling2 stays default.
    assert record.climate.peak_loads.heat_load_1.temp_c == pytest.approx(-12.0)
    assert record.climate.peak_loads.heat_load_2.temp_c == pytest.approx(-8.0)
    assert record.climate.peak_loads.cooling_load_1.temp_c == pytest.approx(30.0)
    assert record.climate.peak_loads.cooling_load_2.temp_c == pytest.approx(0.0)
    assert record.aux.albedo == pytest.approx(0.2)


def test_phius_parser_rejects_truncated_series() -> None:
    bad = "Temperature outdoor\t1\t2\t3\nRadiation Global\t1\nRadiation North\t1\n"
    with pytest.raises(PhiusParseError):
        parse_phius_mon_txt(bad, station_id="bad")


# --- Seed routine -----------------------------------------------------------


def test_seed_phius_is_idempotent(clean_climate_tables: None) -> None:
    first = seed_phius_dataset(_FIXTURE_ROOT)
    assert first.location_count == 1
    assert first.replaced is False

    second = seed_phius_dataset(_FIXTURE_ROOT)
    assert second.location_count == 1
    assert second.replaced is True
    # Re-seed replaces in place: still exactly one dataset, one location.
    assert second.dataset_id != first.dataset_id

    with connection() as conn:
        datasets = conn.execute("SELECT count(*) AS n FROM climate_dataset").fetchone()
        locations = conn.execute("SELECT count(*) AS n FROM climate_dataset_location").fetchone()
    assert datasets is not None and datasets["n"] == 1
    assert locations is not None and locations["n"] == 1


def test_seed_skips_existing_when_replace_false(clean_climate_tables: None) -> None:
    seed_phius_dataset(_FIXTURE_ROOT)
    result = seed_phius_dataset(_FIXTURE_ROOT, replace=False)
    assert result.replaced is False
    assert result.location_count == 1


# --- Read surfaces: routes --------------------------------------------------


def _seed_two_locations() -> None:
    boston = parse_phius_mon_file(_BOSTON_FILE)
    # A second, far-away station so nearest-search has a real choice.
    denver = boston.model_copy(
        update={
            "display_name": "US0002a-Denver",
            "station_id": "US0002a-Denver",
            "phpp_codes": boston.phpp_codes.model_copy(update={"region_code": "Colorado"}),
            "location": boston.location.model_copy(update={"latitude": 39.74, "longitude": -104.99}),
        }
    )
    seed_dataset("phius", "2022", [boston, denver], label="Phius 2022")


def test_routes_list_search_and_fetch(clean_climate_tables: None) -> None:
    _seed_two_locations()
    client = signed_in_client()

    datasets = client.get("/api/v1/climate/datasets", headers={"Origin": ORIGIN}).json()
    assert len(datasets["items"]) == 1
    dataset = datasets["items"][0]
    assert dataset["provider"] == "phius" and dataset["location_count"] == 2

    dataset_id = dataset["id"]
    by_region = client.get(
        f"/api/v1/climate/datasets/{dataset_id}/locations",
        params={"region": "Massachusetts"},
        headers={"Origin": ORIGIN},
    ).json()
    assert by_region["total"] == 1
    assert by_region["items"][0]["region"] == "Massachusetts"

    nearest = client.get(
        f"/api/v1/climate/datasets/{dataset_id}/locations",
        params={"near": "40.0,-105.0", "limit": 1},
        headers={"Origin": ORIGIN},
    ).json()
    assert nearest["items"][0]["station_id"] == "US0002a-Denver"

    location_id = by_region["items"][0]["id"]
    detail = client.get(
        f"/api/v1/climate/datasets/{dataset_id}/locations/{location_id}",
        headers={"Origin": ORIGIN},
    ).json()
    assert detail["record"]["station_id"] == "US0001a-Boston"
    assert len(detail["record"]["climate"]["monthly_temps"]["air_c"]) == 12


def test_route_unknown_dataset_is_404(clean_climate_tables: None) -> None:
    client = signed_in_client()
    response = client.get(
        "/api/v1/climate/datasets/00000000-0000-0000-0000-000000000000/locations",
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 404


def test_route_rejects_malformed_near(clean_climate_tables: None) -> None:
    _seed_two_locations()
    client = signed_in_client()
    datasets = client.get("/api/v1/climate/datasets", headers={"Origin": ORIGIN}).json()
    dataset_id = datasets["items"][0]["id"]
    response = client.get(
        f"/api/v1/climate/datasets/{dataset_id}/locations",
        params={"near": "not-a-coord"},
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 422


# --- Read surfaces: MCP parity + auth ---------------------------------------


def test_mcp_climate_tools_match_routes(
    clean_climate_tables: None, clean_mcp_tables: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    _seed_two_locations()
    client = signed_in_client()
    _mcp_token_env(client, monkeypatch)
    ctx = cast(Context, None)

    datasets = tool_list_climate_datasets(ctx, allow_env_token=True)
    assert len(datasets) == 1
    dataset_id = datasets[0]["id"]

    search = tool_search_climate_locations(cast(str, dataset_id), ctx, allow_env_token=True, region="Massachusetts")
    route_search = client.get(
        f"/api/v1/climate/datasets/{dataset_id}/locations",
        params={"region": "Massachusetts"},
        headers={"Origin": ORIGIN},
    ).json()
    assert search == route_search

    first_item = cast(list, search["items"])[0]
    location_id = cast(dict, first_item)["id"]
    detail = tool_get_climate_location(cast(str, location_id), ctx, allow_env_token=True)
    assert detail is not None
    assert cast(dict, detail["record"])["station_id"] == "US0001a-Boston"


def test_mcp_requires_token(clean_climate_tables: None) -> None:
    with pytest.raises(ToolError, match="not_authenticated"):
        tool_list_climate_datasets(cast(Context, None), allow_env_token=False)
