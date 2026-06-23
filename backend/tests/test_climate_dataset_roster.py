"""Climate dataset picker — Phase 1 (backend roster + authoritative attach).

Covers the project-scoped roster endpoint (per-station proximity, nearest-first
sort, the gate boundary, region default / explicit / any-state modes, the
unseeded-kind empty state, and the no-location guard) and server-authoritative
proximity recomputation on a manual PH dataset attach (D-DP-2 / D-DP-3).
"""

from __future__ import annotations

import math
from typing import cast

import httpx
from fastapi.testclient import TestClient

from features.climate.importers.phius import parse_phius_mon_file
from features.climate.proximity import M_TO_FT
from features.climate.record import ClimateRecord
from features.climate.service import seed_dataset
from tests.test_climate_datasets import _STATION_FILE, clean_climate_tables
from tests.test_mcp import clean_mcp_tables, create_project, signed_in_client
from tests.test_project_climate_source import (
    _create,
    _first_phius_location_id,
    _list,
    _post,
    _set_location,
)

__all__ = ["clean_climate_tables", "clean_mcp_tables"]

_ROSTER = "/api/v1/projects/{project_id}/climate/datasets/{kind}/locations"

# A due-north offset gives an exact haversine distance (the longitude term is
# zero), so stations land at precise mileages and the gate boundary is testable.
_MI_PER_DEG_LAT = 3958.7613 * math.pi / 180


def _lat_north(miles: float, *, base_lat: float = 40.0) -> float:
    return base_lat + miles / _MI_PER_DEG_LAT


def _elev_for_delta_ft(delta_ft: float, *, base_elev_m: float = 100.0) -> float:
    return base_elev_m + delta_ft / M_TO_FT


def _station(
    *,
    station_id: str,
    miles_north: float,
    region: str,
    delta_ft: float = 0.0,
    provider: str = "phius",
) -> ClimateRecord:
    """A synthetic station `miles_north` of the project with a given elevation delta."""
    base = parse_phius_mon_file(_STATION_FILE)
    return base.model_copy(
        update={
            "provider": provider,
            "display_name": station_id,
            "station_id": station_id,
            "phpp_codes": base.phpp_codes.model_copy(update={"region_code": region}),
            "location": base.location.model_copy(
                update={
                    "latitude": _lat_north(miles_north),
                    "longitude": -75.0,
                    "site_elevation_m": _elev_for_delta_ft(delta_ft),
                }
            ),
        }
    )


def _roster(
    client: TestClient,
    project_id: str,
    kind: str,
    *,
    region: str | None = None,
    near: bool = False,
) -> httpx.Response:
    params: dict[str, str] = {}
    if region is not None:
        params["region"] = region
    if near:
        params["near"] = "true"
    return client.get(_ROSTER.format(project_id=project_id, kind=kind), params=params)


def _roster_ok(
    client: TestClient,
    project_id: str,
    kind: str,
    *,
    region: str | None = None,
    near: bool = False,
) -> dict[str, object]:
    response = _roster(client, project_id, kind, region=region, near=near)
    assert response.status_code == 200, response.text
    return cast(dict[str, object], response.json())


def test_roster_returns_state_stations_sorted_with_proximity(
    clean_mcp_tables: None, clean_climate_tables: None
) -> None:
    seed_dataset(
        "phius",
        "2022",
        [
            _station(station_id="PA-PASS", miles_north=49.0, delta_ft=390.0, region="PA"),
            _station(station_id="PA-FAR", miles_north=51.0, region="PA"),
            _station(station_id="PA-HIGH", miles_north=10.0, delta_ft=410.0, region="PA"),
        ],
        label="Phius 2022",
    )
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])
    _set_location(client, project_id, latitude=40.0, longitude=-75.0, elevation_m=100.0, state="PA")

    roster = _roster_ok(client, project_id, "phius")
    dataset = cast(dict, roster["dataset"])
    assert dataset["provider"] == "phius" and dataset["version"] == "2022"
    assert cast(dict, roster["project"])["state"] == "PA"
    assert roster["total"] == 3

    items = cast(list[dict], roster["items"])
    # Nearest-first: 10 mi, 49 mi, 51 mi.
    assert [item["name"] for item in items] == ["PA-HIGH", "PA-PASS", "PA-FAR"]

    by_name = {item["name"]: item for item in items}
    passing = by_name["PA-PASS"]["proximity"]
    assert passing["distance_mi"] == 49.0
    assert passing["elevation_delta_ft"] == 390.0
    assert passing["status"] == "pass"
    # 51 mi fails the distance gate; 410 ft fails the elevation gate.
    assert by_name["PA-FAR"]["proximity"]["status"] == "fail"
    assert by_name["PA-HIGH"]["proximity"]["status"] == "fail"


def test_roster_region_default_explicit_and_near_modes(clean_mcp_tables: None, clean_climate_tables: None) -> None:
    seed_dataset(
        "phius",
        "2022",
        [
            _station(station_id="PA-A", miles_north=10.0, region="PA"),
            _station(station_id="CO-CLOSE", miles_north=2.0, region="CO"),
            _station(station_id="CO-FAR", miles_north=80.0, region="CO"),
        ],
        label="Phius 2022",
    )
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])
    _set_location(client, project_id, latitude=40.0, longitude=-75.0, elevation_m=100.0, state="PA")

    # Default → the project's state only.
    default = _roster_ok(client, project_id, "phius")
    assert [item["name"] for item in cast(list[dict], default["items"])] == ["PA-A"]

    # Explicit region overrides the default, nearest-first within it.
    colorado = _roster_ok(client, project_id, "phius", region="CO")
    assert [item["name"] for item in cast(list[dict], colorado["items"])] == ["CO-CLOSE", "CO-FAR"]

    # Any-state near mode ignores region and ranks every station by distance.
    nearest = _roster_ok(client, project_id, "phius", near=True)
    near_items = cast(list[dict], nearest["items"])
    assert near_items[0]["name"] == "CO-CLOSE"
    assert near_items[0]["region"] == "CO"
    assert {item["name"] for item in near_items} == {"PA-A", "CO-CLOSE", "CO-FAR"}


def test_phi_roster_default_state_code_matches_full_state_name_regions(
    clean_mcp_tables: None, clean_climate_tables: None
) -> None:
    seed_dataset(
        "phi",
        "10.6",
        [
            _station(station_id="BOSTON", miles_north=10.0, region="Massachusetts", provider="phi"),
            _station(station_id="HUDSON", miles_north=2.0, region="New York", provider="phi"),
        ],
        label="PHI 10.6",
    )
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])
    _set_location(client, project_id, latitude=40.0, longitude=-75.0, elevation_m=100.0, state="MA")

    roster = _roster_ok(client, project_id, "phi")
    assert roster["total"] == 1
    assert [item["name"] for item in cast(list[dict], roster["items"])] == ["BOSTON"]


def test_roster_unseeded_kind_returns_null_dataset(clean_mcp_tables: None, clean_climate_tables: None) -> None:
    seed_dataset("phius", "2022", [_station(station_id="PA-A", miles_north=10.0, region="PA")], label="Phius 2022")
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])
    _set_location(client, project_id, latitude=40.0, longitude=-75.0, elevation_m=100.0, state="PA")

    # No PHI dataset is seeded → empty state, not an error (O-DP-5).
    roster = _roster_ok(client, project_id, "phi")
    assert roster["dataset"] is None
    assert roster["items"] == []
    assert roster["total"] == 0
    assert cast(dict, roster["project"])["latitude"] == 40.0


def test_roster_requires_project_location(clean_mcp_tables: None, clean_climate_tables: None) -> None:
    seed_dataset("phius", "2022", [_station(station_id="PA-A", miles_north=10.0, region="PA")], label="Phius 2022")
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])

    response = _roster(client, project_id, "phius")
    assert response.status_code == 409
    assert response.json()["error_code"] == "project_location_required"


def test_roster_rejects_unknown_kind(clean_mcp_tables: None, clean_climate_tables: None) -> None:
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])
    assert _roster(client, project_id, "ashrae").status_code == 422


def test_manual_attach_recomputes_proximity_server_side(clean_mcp_tables: None, clean_climate_tables: None) -> None:
    seed_dataset("phius", "2022", [_station(station_id="FAR", miles_north=80.0, region="PA")], label="Phius 2022")
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])
    _set_location(client, project_id, latitude=40.0, longitude=-75.0, elevation_m=100.0, state="PA")
    location_id = _first_phius_location_id(client)

    # The client sends a bogus payload; the server discards it and recomputes.
    created = _create(
        client,
        project_id,
        {"kind": "phius", "ref": location_id, "data": {"status": "pass", "distance_mi": 1.0, "bogus": True}},
    )
    stored = cast(dict, created["data"])
    assert stored["auto_attached"] is False
    assert stored["status"] == "fail"  # 80 mi exceeds the 50 mi gate
    assert stored["distance_mi"] == 80.0
    assert stored["dataset_version"] == "2022"
    assert "bogus" not in stored


def test_manual_attach_replaces_existing_source_of_the_same_kind(
    clean_mcp_tables: None, clean_climate_tables: None
) -> None:
    seed_dataset(
        "phius",
        "2022",
        [
            _station(station_id="NEAR", miles_north=10.0, region="PA"),
            _station(station_id="FAR", miles_north=80.0, region="PA"),
        ],
        label="Phius 2022",
    )
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])
    _set_location(client, project_id, latitude=40.0, longitude=-75.0, elevation_m=100.0, state="PA")

    roster = _roster_ok(client, project_id, "phius")
    by_name = {item["name"]: item["id"] for item in cast(list[dict], roster["items"])}

    first = _create(client, project_id, {"kind": "phius", "ref": by_name["NEAR"], "label": "NEAR"})
    second = _create(client, project_id, {"kind": "phius", "ref": by_name["FAR"], "label": "FAR"})

    # A project holds one Phius source: the second attach replaced the first in
    # place (same row id), now pointing at FAR with the recomputed fail verdict.
    phius_sources = [source for source in _list(client, project_id) if source["kind"] == "phius"]
    assert len(phius_sources) == 1
    assert second["id"] == first["id"]
    assert phius_sources[0]["ref"] == by_name["FAR"]
    assert cast(dict, phius_sources[0]["data"])["status"] == "fail"


def test_manual_attach_without_location_is_guarded(clean_mcp_tables: None, clean_climate_tables: None) -> None:
    seed_dataset("phius", "2022", [_station(station_id="FAR", miles_north=80.0, region="PA")], label="Phius 2022")
    client = signed_in_client()
    sited_project = cast(str, create_project(client)["id"])
    _set_location(client, sited_project, latitude=40.0, longitude=-75.0, elevation_m=100.0, state="PA")
    location_id = _first_phius_location_id(client)

    # A project with no location cannot have proximity computed → guarded attach.
    bare_project = cast(str, create_project(client, bt_number="9999")["id"])
    response = _post(client, bare_project, {"kind": "phius", "ref": location_id})
    assert response.status_code == 409
    assert response.json()["error_code"] == "project_location_required"
