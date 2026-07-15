"""Project location contract tests."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import cast
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from mcp.server.fastmcp import Context
from mcp.server.fastmcp.exceptions import ToolError

from database import transaction
from features.assets.routes import get_asset_service
from features.assets.service import AssetService
from features.climate.epw_catalog import EpwCatalogEntry, EpwZipPayload
from features.climate.importers.phius import parse_phius_mon_file
from features.climate.record import ClimateRecord
from features.climate.service import seed_dataset
from features.project_climate_source import repository as climate_source_repository
from features.project_location.derive import (
    DeriveClients,
    DerivedLocationGeodata,
    fetch_elevation_geodata,
    geocode_address,
    lookup_climate_zone,
)
from features.project_location.locality_index import clear_locality_index_cache
from features.project_location.mcp import tool_get_project_location
from features.project_location.models import GeocodeProjectLocationCandidate, UpdateProjectLocationRequest
from features.project_location.service import existing_weather_source_values
from main import app
from tests.test_assets_service import FakeR2Client, NoopThumbnailer
from tests.test_climate_datasets import _STATION_FILE, clean_climate_tables
from tests.test_mcp import ORIGIN, clean_mcp_tables, create_project, signed_in_client

__all__ = ["clean_climate_tables", "clean_mcp_tables"]


def _default_geodata(latitude: float, longitude: float) -> DerivedLocationGeodata:
    """No-network geodata default so a Set Location write never hits external APIs.

    Tests asserting specific derived values override this with their own stub.
    """
    return DerivedLocationGeodata(
        county="Test County",
        county_fips="00000",
        state="TS",
        country="US",
        elevation_m=None,
        climate_zone=None,
        geodata_provenance={},
    )


@pytest.fixture(autouse=True)
def stub_location_external_calls(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("features.project_location.service.prepare_weather_source", lambda **_kwargs: (None, {}, []))
    monkeypatch.setattr("features.project_location.service.derive_location_geodata", _default_geodata)


def issue_mcp_token(client: TestClient, project_id: str) -> str:
    response = client.post(
        f"/api/v1/projects/{project_id}/mcp-tokens",
        headers={"Origin": ORIGIN},
        json={"label": "Location reader", "scopes": ["project:read"]},
    )
    assert response.status_code == 201
    return cast(str, response.json()["token"])


def install_fake_asset_service(fake_r2: FakeR2Client) -> None:
    app.dependency_overrides[get_asset_service] = lambda: AssetService(fake_r2, NoopThumbnailer())


def clear_fake_asset_service() -> None:
    app.dependency_overrides.pop(get_asset_service, None)


def epw_bytes(
    *,
    latitude: float = 42.2876,
    longitude: float = -73.3662,
    elevation_m: float = 305.0,
) -> bytes:
    return (
        f"LOCATION,West Stockbridge,MA,USA,TMYx,725060,{latitude},{longitude},-5,{elevation_m}\nDESIGN CONDITIONS,0\n"
    ).encode()


def upload_epw(client: TestClient, fake_r2: FakeR2Client, project_id: str, body: bytes) -> str:
    intent = client.post(
        f"/api/v1/projects/{project_id}/assets/upload-intent",
        headers={"Origin": ORIGIN},
        json={
            "asset_kind": "epw",
            "original_filename": "west-stockbridge.epw",
            "display_name": "West Stockbridge EPW",
            "content_type": "text/plain",
            "size_bytes": len(body),
            "content_hash_sha256": hashlib.sha256(body).hexdigest(),
        },
    )
    assert intent.status_code == 200
    asset = intent.json()["asset"]
    fake_r2.put_object(asset["object_key"], body, asset["content_type"])
    complete = client.post(
        f"/api/v1/projects/{project_id}/assets/{asset['id']}/complete-upload",
        headers={"Origin": ORIGIN},
    )
    assert complete.status_code == 200
    return cast(str, asset["id"])


def first_phius_location_id(client: TestClient) -> str:
    datasets = client.get("/api/v1/climate/datasets").json()["items"]
    dataset_id = datasets[0]["id"]
    locations = client.get(f"/api/v1/climate/datasets/{dataset_id}/locations").json()["items"]
    return cast(str, locations[0]["id"])


def west_stockbridge_geodata(latitude: float, longitude: float) -> DerivedLocationGeodata:
    assert latitude == 42.325
    assert longitude == -73.367
    return DerivedLocationGeodata(
        county="Berkshire",
        county_fips="25003",
        state="MA",
        country="US",
        elevation_m=302.0,
        climate_zone="5A",
        geodata_provenance={
            "county": "fcc_area_api",
            "elevation_m": "usgs_epqs",
            "climate_zone": "pnnl_2021_iecc",
        },
    )


def synthetic_site_geodata(latitude: float, longitude: float) -> DerivedLocationGeodata:
    assert latitude == 40.0
    assert longitude == -75.0
    return DerivedLocationGeodata(
        county="Synthetic",
        county_fips="42000",
        state="PA",
        country="US",
        elevation_m=110.0,
        climate_zone="5A",
        geodata_provenance={"county": "test", "elevation_m": "test", "climate_zone": "test"},
    )


def synthetic_climate_record(
    *,
    provider: str,
    station_id: str,
    latitude: float,
    longitude: float,
    elevation_m: float,
) -> ClimateRecord:
    base = parse_phius_mon_file(_STATION_FILE)
    return base.model_copy(
        update={
            "provider": provider,
            "display_name": station_id,
            "station_id": station_id,
            "location": base.location.model_copy(
                update={
                    "latitude": latitude,
                    "longitude": longitude,
                    "site_elevation_m": elevation_m,
                }
            ),
            "climate": base.climate.model_copy(update={"station_elevation_m": elevation_m}),
        }
    )


def test_location_model_validates_ranges_and_time_zone() -> None:
    valid = UpdateProjectLocationRequest(
        latitude=-90,
        longitude=180,
        elevation_m=9000,
        true_north_deg=359.999,
        time_zone="America/New_York",
    )
    assert valid.latitude == -90

    invalid_builders = [
        lambda: UpdateProjectLocationRequest(latitude=-90.1),
        lambda: UpdateProjectLocationRequest(longitude=180.1),
        lambda: UpdateProjectLocationRequest(elevation_m=9000.1),
        lambda: UpdateProjectLocationRequest(true_north_deg=360),
        lambda: UpdateProjectLocationRequest(time_zone="New York"),
    ]
    for build_invalid in invalid_builders:
        with pytest.raises(ValueError):
            build_invalid()


def test_public_get_returns_unset_shape(clean_mcp_tables: None) -> None:
    editor = signed_in_client()
    project = create_project(editor)

    response = TestClient(app).get(f"/api/v1/projects/{project['id']}/location")

    assert response.status_code == 200
    assert response.json() == {
        "latitude": None,
        "longitude": None,
        "elevation_m": None,
        "time_zone": None,
        "true_north_deg": None,
        "street_address": None,
        "city": None,
        "state": None,
        "postal_code": None,
        "full_site_address": None,
        "county": None,
        "county_fips": None,
        "country": None,
        "climate_zone": None,
        "geodata_provenance": {},
        "epw_asset_id": None,
        "epw_source_url": None,
        "is_set": False,
        "updated_at": None,
        "epw": None,
    }


def test_editor_can_upsert_and_clear_location_fields(clean_mcp_tables: None) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])

    created = client.put(
        f"/api/v1/projects/{project_id}/location",
        headers={"Origin": ORIGIN},
        json={
            "latitude": 42.325,
            "longitude": -73.367,
            "elevation_m": 260.0,
            "time_zone": "America/New_York",
            "true_north_deg": 12.5,
            "street_address": "1 Main St",
            "city": "West Stockbridge",
            "state": "MA",
            "postal_code": "01266",
        },
    )

    assert created.status_code == 200
    created_body = created.json()
    assert created_body["warnings"] == []
    assert created_body["location"]["is_set"] is True
    assert created_body["location"]["latitude"] == 42.325
    assert created_body["location"]["updated_at"] is not None

    cleared = client.put(
        f"/api/v1/projects/{project_id}/location",
        headers={"Origin": ORIGIN},
        json={"elevation_m": None, "city": "  "},
    )

    assert cleared.status_code == 200
    location = cleared.json()["location"]
    assert location["latitude"] == 42.325
    assert location["elevation_m"] is None
    assert location["city"] is None
    assert location["is_set"] is True


def test_public_location_projection_omits_street_address(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("features.project_location.service.derive_location_geodata", west_stockbridge_geodata)
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    saved = client.put(
        f"/api/v1/projects/{project_id}/location",
        headers={"Origin": ORIGIN},
        json={
            "latitude": 42.325,
            "longitude": -73.367,
            "street_address": "1 Main St",
            "city": "West Stockbridge",
            "state": "MA",
            "postal_code": "01266",
        },
    )
    assert saved.status_code == 200

    public = TestClient(app).get(f"/api/v1/projects/{project_id}/location")
    editor = client.get(f"/api/v1/projects/{project_id}/location")

    assert public.status_code == 200
    assert public.json()["street_address"] is None
    assert public.json()["full_site_address"] == "West Stockbridge, MA 01266"
    assert public.json()["county"] == "Berkshire"
    assert public.json()["climate_zone"] == "5A"
    assert editor.status_code == 200
    assert editor.json()["street_address"] == "1 Main St"
    assert editor.json()["full_site_address"] == "1 Main St, West Stockbridge, MA 01266"


def test_locality_only_location_replaces_old_street_in_editor_and_public_projections(
    clean_mcp_tables: None,
) -> None:
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])
    first_save = client.put(
        f"/api/v1/projects/{project_id}/location",
        headers={"Origin": ORIGIN},
        json={
            "latitude": 42.325,
            "longitude": -73.367,
            "street_address": "1 Main St",
            "city": "West Stockbridge",
            "state": "MA",
            "postal_code": "01266",
        },
    )
    assert first_save.status_code == 200

    locality_save = client.put(
        f"/api/v1/projects/{project_id}/location",
        headers={"Origin": ORIGIN},
        json={
            "latitude": 42.312354,
            "longitude": -73.388044,
            "street_address": None,
            "city": "West Stockbridge",
            "state": "MA",
            "postal_code": "01266",
        },
    )

    assert locality_save.status_code == 200
    editor_location = locality_save.json()["location"]
    assert editor_location["street_address"] is None
    assert editor_location["full_site_address"] == "West Stockbridge, MA 01266"
    public_location = TestClient(app).get(f"/api/v1/projects/{project_id}/location").json()
    assert public_location["street_address"] is None
    assert public_location["full_site_address"] == "West Stockbridge, MA 01266"


def test_climate_zone_lookup_uses_pnnl_2021_county_csv() -> None:
    zone = lookup_climate_zone("25003")

    assert zone is not None
    assert zone.iecc_zone == "5A"
    assert zone.ba_zone == "Cold"


def test_set_location_persists_county_elevation_and_zone(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("features.project_location.service.derive_location_geodata", west_stockbridge_geodata)
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])

    response = client.put(
        f"/api/v1/projects/{project_id}/location",
        headers={"Origin": ORIGIN},
        json={"latitude": 42.325, "longitude": -73.367, "street_address": "1 Main St"},
    )

    assert response.status_code == 200, response.text
    location = response.json()["location"]
    assert location["street_address"] == "1 Main St"
    assert location["county"] == "Berkshire"
    assert location["county_fips"] == "25003"
    assert location["elevation_m"] == 302.0
    assert location["climate_zone"] == "5A"
    assert location["geodata_provenance"]["climate_zone"] == "pnnl_2021_iecc"


def test_per_type_derive_attaches_certification_sources_idempotently(
    clean_mcp_tables: None,
    clean_climate_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seed_dataset(
        "phius",
        "2022",
        [
            synthetic_climate_record(
                provider="phius",
                station_id="PHIUS-NEAR",
                latitude=40.1,
                longitude=-75.1,
                elevation_m=100.0,
            ),
            synthetic_climate_record(
                provider="phius",
                station_id="PHIUS-FAR",
                latitude=35.0,
                longitude=-105.0,
                elevation_m=1000.0,
            ),
        ],
        label="Phius 2022",
    )
    seed_dataset(
        "phi",
        "10.6",
        [
            synthetic_climate_record(
                provider="phi",
                station_id="PHI-NEAR",
                latitude=40.2,
                longitude=-75.2,
                elevation_m=120.0,
            )
        ],
        label="PHI 10.6",
    )
    monkeypatch.setattr("features.project_location.service.derive_location_geodata", synthetic_site_geodata)
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])
    located = client.put(
        f"/api/v1/projects/{project_id}/location",
        headers={"Origin": ORIGIN},
        json={"latitude": 40.0, "longitude": -75.0},
    )
    assert located.status_code == 200, located.text

    for kind in ("phius", "phi"):
        attached = client.post(
            f"/api/v1/projects/{project_id}/location/derive/{kind}",
            headers={"Origin": ORIGIN},
        )
        assert attached.status_code == 200, attached.text
    sources = client.get(f"/api/v1/projects/{project_id}/climate/sources").json()["items"]
    by_kind = {source["kind"]: source for source in sources}

    assert set(by_kind) == {"phius", "phi"}
    assert by_kind["phius"]["label"] == "PHIUS-NEAR"
    assert by_kind["phius"]["data"]["dataset_version"] == "2022"
    assert by_kind["phius"]["data"]["status"] == "pass"
    assert by_kind["phius"]["data"]["distance_mi"] < 10
    assert by_kind["phi"]["label"] == "PHI-NEAR"
    assert by_kind["phi"]["data"]["dataset_version"] == "10.6"

    for kind in ("phius", "phi"):
        rerun = client.post(
            f"/api/v1/projects/{project_id}/location/derive/{kind}",
            headers={"Origin": ORIGIN},
        )
        assert rerun.status_code == 200, rerun.text
    rerun_sources = client.get(f"/api/v1/projects/{project_id}/climate/sources").json()["items"]

    assert len(rerun_sources) == 2
    assert {source["id"] for source in rerun_sources} == {source["id"] for source in sources}


def test_per_type_derive_requires_location_set(clean_mcp_tables: None) -> None:
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])

    response = client.post(
        f"/api/v1/projects/{project_id}/location/derive/phius",
        headers={"Origin": ORIGIN},
    )

    assert response.status_code == 409, response.text
    assert response.json()["error_code"] == "location_not_set"


def test_per_type_derive_rejects_unknown_kind(clean_mcp_tables: None) -> None:
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])

    response = client.post(
        f"/api/v1/projects/{project_id}/location/derive/bogus",
        headers={"Origin": ORIGIN},
    )

    assert response.status_code == 422


def test_per_type_derive_requires_editor_session(clean_mcp_tables: None) -> None:
    editor = signed_in_client()
    project = create_project(editor)

    response = TestClient(app).post(
        f"/api/v1/projects/{project['id']}/location/derive/phius",
        headers={"Origin": ORIGIN},
    )

    assert response.status_code == 401
    assert response.json()["error_code"] == "not_authenticated"


def test_direct_location_update_refreshes_attached_phius_proximity(
    clean_mcp_tables: None,
    clean_climate_tables: None,
) -> None:
    seed_dataset(
        "phius",
        "2022",
        [
            synthetic_climate_record(
                provider="phius",
                station_id="PHIUS-FIXED",
                latitude=40.0,
                longitude=-75.0,
                elevation_m=100.0,
            ),
        ],
        label="Phius 2022",
    )
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])
    first_location = client.put(
        f"/api/v1/projects/{project_id}/location",
        headers={"Origin": ORIGIN},
        json={"latitude": 40.0, "longitude": -75.0, "elevation_m": 100.0},
    )
    assert first_location.status_code == 200, first_location.text
    location_id = first_phius_location_id(client)
    attached = client.post(
        f"/api/v1/projects/{project_id}/climate/sources",
        headers={"Origin": ORIGIN},
        json={"kind": "phius", "ref": location_id, "label": "PHIUS-FIXED"},
    )
    assert attached.status_code == 201, attached.text
    source = attached.json()
    assert source["data"]["status"] == "pass"
    assert source["data"]["distance_mi"] == 0.0
    assert source["data"]["auto_attached"] is False

    moved_location = client.put(
        f"/api/v1/projects/{project_id}/location",
        headers={"Origin": ORIGIN},
        json={"latitude": 41.0, "longitude": -75.0, "elevation_m": 100.0},
    )
    assert moved_location.status_code == 200, moved_location.text
    sources = client.get(f"/api/v1/projects/{project_id}/climate/sources").json()["items"]
    refreshed = next(item for item in sources if item["kind"] == "phius")

    assert refreshed["id"] == source["id"]
    assert refreshed["ref"] == location_id
    assert refreshed["data"]["auto_attached"] is False
    assert refreshed["data"]["distance_mi"] > 50
    assert refreshed["data"]["status"] == "fail"


def test_weather_derive_attaches_single_weather_source(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_r2 = FakeR2Client()
    install_fake_asset_service(fake_r2)

    def fake_prepare_weather_source(
        *,
        project_id: UUID,
        user,
        asset_service: AssetService,
        **_kwargs,
    ):
        from features.climate.weather_source import build_weather_source_payload
        from tests.test_climate_design_conditions import STAT_SAMPLE

        payload = EpwZipPayload(
            entry=EpwCatalogEntry(
                country="USA",
                region="MA",
                name="Pittsfield.Muni.AP",
                wmo="744104",
                source_data="SRC-TMYx",
                latitude=42.427,
                longitude=-73.289,
                elevation_m=364,
                time_zone_offset_hours=-5,
                url="https://climate.onebuilding.org/pittsfield.zip",
                distance_mi=8.1,
            ),
            epw_name="pittsfield.epw",
            epw_bytes=epw_bytes(latitude=42.427, longitude=-73.289, elevation_m=364),
            stat_name="pittsfield.stat",
            stat_text=STAT_SAMPLE,
        )
        source = build_weather_source_payload(project_id, user, asset_service, payload)
        return source, {"epw_asset_id": source["ref"], "epw_source_url": payload.entry.url}, []

    try:
        monkeypatch.setattr("features.project_location.service.derive_location_geodata", west_stockbridge_geodata)
        monkeypatch.setattr("features.project_location.service.prepare_weather_source", fake_prepare_weather_source)
        client = signed_in_client()
        project_id = cast(str, create_project(client)["id"])
        located = client.put(
            f"/api/v1/projects/{project_id}/location",
            headers={"Origin": ORIGIN},
            json={"latitude": 42.325, "longitude": -73.367},
        )
        assert located.status_code == 200, located.text

        response = client.post(
            f"/api/v1/projects/{project_id}/location/derive/weather",
            headers={"Origin": ORIGIN},
        )

        assert response.status_code == 200, response.text
        location = response.json()["location"]
        assert location["epw_asset_id"].startswith("asset_")
        assert location["epw"]["filename"] == "pittsfield.epw"
        sources = client.get(f"/api/v1/projects/{project_id}/climate/sources").json()["items"]
        # One merged weather source carries both the STAT metrics and the ASHRAE
        # design conditions — no separate ashrae record.
        by_kind = {source["kind"]: source for source in sources}
        assert set(by_kind) == {"weather"}
        weather = by_kind["weather"]
        assert weather["label"] == "Pittsfield.Muni.AP"
        assert weather["data"]["stat_metrics"]["hdd65_f_days"] == 3884
        assert weather["data"]["design_conditions"]["cooling_004_db_c"] == 29.9
        assert weather["data"]["design_conditions"]["cooling_010_db_c"] == 28.5
        assert weather["data"]["design_conditions"]["cooling_020_db_c"] == 27.2
    finally:
        clear_fake_asset_service()


def test_existing_weather_source_values_reuses_same_onebuilding_epw(clean_mcp_tables: None) -> None:
    client = signed_in_client()
    project_id = UUID(cast(str, create_project(client)["id"]))
    with transaction() as conn:
        climate_source_repository.insert_source(
            conn,
            source_id=uuid4(),
            project_id=project_id,
            kind="weather",
            ref="asset_reused",
            label="Pittsfield",
            data={"source_url": "https://climate.onebuilding.org/pittsfield.zip"},
        )

    values = existing_weather_source_values(project_id, "https://climate.onebuilding.org/pittsfield.zip")

    assert values == {
        "epw_asset_id": "asset_reused",
        "epw_source_url": "https://climate.onebuilding.org/pittsfield.zip",
    }


def test_coordinate_edit_rederives_geodata(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def geodata_by_coords(latitude: float, longitude: float) -> DerivedLocationGeodata:
        if (latitude, longitude) == (42.325, -73.367):
            return west_stockbridge_geodata(latitude, longitude)
        assert (latitude, longitude) == (42.4, -73.367)
        return DerivedLocationGeodata(
            county="Hampden",
            county_fips="25013",
            state="MA",
            country="US",
            elevation_m=250.0,
            climate_zone="6A",
            geodata_provenance={"county": "fcc_area_api", "climate_zone": "pnnl_2021_iecc"},
        )

    monkeypatch.setattr("features.project_location.service.derive_location_geodata", geodata_by_coords)
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])
    set_location = client.put(
        f"/api/v1/projects/{project_id}/location",
        headers={"Origin": ORIGIN},
        json={"latitude": 42.325, "longitude": -73.367},
    )
    assert set_location.status_code == 200
    assert set_location.json()["location"]["climate_zone"] == "5A"

    # A partial edit of latitude alone re-derives off the persisted longitude.
    edited = client.put(
        f"/api/v1/projects/{project_id}/location",
        headers={"Origin": ORIGIN},
        json={"latitude": 42.4},
    )

    assert edited.status_code == 200
    location = edited.json()["location"]
    assert location["latitude"] == 42.4
    assert location["county"] == "Hampden"
    assert location["county_fips"] == "25013"
    assert location["climate_zone"] == "6A"


def test_geocode_location_requires_editor_and_returns_candidates(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_geocode(query: str) -> list[GeocodeProjectLocationCandidate]:
        assert query == "1 Main St"
        return [
            GeocodeProjectLocationCandidate(
                result_type="address",
                label="1 Main St, West Stockbridge, Massachusetts",
                latitude=42.325,
                longitude=-73.367,
                street_address="1 Main St",
                city="West Stockbridge",
                state="MA",
                postal_code="01266",
                country="US",
                source="census_geocoder",
            )
        ]

    monkeypatch.setattr("features.project_location.service.geocode_address", fake_geocode)
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])

    anon = TestClient(app).post(
        f"/api/v1/projects/{project_id}/location/geocode",
        headers={"Origin": ORIGIN},
        json={"query": "1 Main St"},
    )
    response = client.post(
        f"/api/v1/projects/{project_id}/location/geocode",
        headers={"Origin": ORIGIN},
        json={"query": "1 Main St"},
    )

    assert anon.status_code == 401
    assert response.status_code == 200
    assert response.json()["candidates"][0]["latitude"] == 42.325


def test_fetch_elevation_geodata_prefers_usgs_then_falls_back_to_open_meteo() -> None:
    def usgs_ok(url: str) -> dict[str, object]:
        assert "epqs.nationalmap.gov" in url
        return {"value": 302.0}

    primary, primary_warning = fetch_elevation_geodata(42.325, -73.367, usgs_ok)
    assert primary_warning is None
    assert primary is not None
    assert primary.elevation_m == 302.0
    assert primary.source == "usgs_epqs"

    def usgs_down_open_meteo_ok(url: str) -> dict[str, object]:
        if "epqs.nationalmap.gov" in url:
            raise RuntimeError("USGS unavailable")
        assert "api.open-meteo.com/v1/elevation" in url
        return {"elevation": [301.5]}

    fallback, fallback_warning = fetch_elevation_geodata(42.325, -73.367, usgs_down_open_meteo_ok)
    assert fallback_warning is None
    assert fallback is not None
    assert fallback.elevation_m == 301.5
    assert fallback.source == "open_meteo"

    def both_down(_url: str) -> dict[str, object]:
        raise RuntimeError("offline")

    missing, missing_warning = fetch_elevation_geodata(42.325, -73.367, both_down)
    assert missing is None
    assert missing_warning == "Could not derive site elevation from USGS EPQS or Open-Meteo."


def test_lookup_elevation_endpoint_returns_value_without_persisting(
    clean_mcp_tables: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fake_fetch(url: str) -> dict[str, object]:
        assert "epqs.nationalmap.gov" in url
        return {"value": 415.0}

    monkeypatch.setattr("features.project_location.service.fetch_json_url", fake_fetch)
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])

    response = client.post(
        f"/api/v1/projects/{project_id}/location/elevation",
        headers={"Origin": ORIGIN},
        json={"latitude": 42.325, "longitude": -73.367},
    )

    assert response.status_code == 200, response.text
    assert response.json() == {"elevation_m": 415.0, "source": "usgs_epqs", "warning": None}

    # A lookup must never persist the value or attach climate sources.
    location = client.get(f"/api/v1/projects/{project_id}/location").json()
    assert location["elevation_m"] is None
    assert location["is_set"] is False
    sources = client.get(f"/api/v1/projects/{project_id}/climate/sources").json()["items"]
    assert sources == []


def test_lookup_elevation_endpoint_reports_warning_when_providers_miss(
    clean_mcp_tables: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    def offline(_url: str) -> dict[str, object]:
        raise RuntimeError("offline")

    monkeypatch.setattr("features.project_location.service.fetch_json_url", offline)
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])

    response = client.post(
        f"/api/v1/projects/{project_id}/location/elevation",
        headers={"Origin": ORIGIN},
        json={"latitude": 42.0, "longitude": -73.0},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["elevation_m"] is None
    assert body["source"] is None
    assert body["warning"] == "Could not derive site elevation from USGS EPQS or Open-Meteo."


def test_lookup_elevation_requires_editor_session(clean_mcp_tables: None) -> None:
    editor = signed_in_client()
    project = create_project(editor)

    response = TestClient(app).post(
        f"/api/v1/projects/{project['id']}/location/elevation",
        headers={"Origin": ORIGIN},
        json={"latitude": 42.0, "longitude": -73.0},
    )

    assert response.status_code == 401
    assert response.json()["error_code"] == "not_authenticated"


def test_lookup_elevation_rejects_out_of_range_coordinates(clean_mcp_tables: None) -> None:
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])

    response = client.post(
        f"/api/v1/projects/{project_id}/location/elevation",
        headers={"Origin": ORIGIN},
        json={"latitude": 200.0, "longitude": -73.0},
    )

    assert response.status_code == 422


def test_geocode_address_uses_census_when_locality_does_not_match() -> None:
    def fake_fetch(url: str) -> dict[str, object]:
        assert "geocoder/locations/onelineaddress" in url
        assert "address=1+Main+St%2C+West+Stockbridge%2C+MA" in url
        return {
            "result": {
                "addressMatches": [
                    {
                        "matchedAddress": "1 MAIN ST, WEST STOCKBRIDGE, MA, 01266",
                        "coordinates": {"x": -73.367, "y": 42.325},
                        "addressComponents": {"city": "WEST STOCKBRIDGE", "state": "MA", "zip": "01266"},
                    }
                ]
            }
        }

    candidates = geocode_address("1 Main St, West Stockbridge, MA", DeriveClients(fetch_json=fake_fetch))

    assert candidates == [
        GeocodeProjectLocationCandidate(
            result_type="address",
            label="1 MAIN ST, WEST STOCKBRIDGE, MA, 01266",
            latitude=42.325,
            longitude=-73.367,
            street_address="1 MAIN ST",
            city="WEST STOCKBRIDGE",
            state="MA",
            postal_code="01266",
            country="US",
            source="census_geocoder",
        )
    ]


def test_geocode_address_returns_keyless_census_locality_without_external_request() -> None:
    def unexpected_fetch(_url: str) -> dict[str, object]:
        raise AssertionError("Locality lookup must not call an external geocoder")

    candidates = geocode_address(
        "West Stockbridge, MA 01266",
        DeriveClients(fetch_json=unexpected_fetch),
    )

    assert candidates == [
        GeocodeProjectLocationCandidate(
            result_type="locality",
            label="West Stockbridge, MA 01266",
            latitude=42.312354,
            longitude=-73.388044,
            street_address=None,
            city="West Stockbridge",
            state="MA",
            postal_code="01266",
            country="US",
            source="census_gazetteer_2025",
        )
    ]


def test_geocode_address_ranks_ambiguous_localities_by_optional_zip() -> None:
    without_zip = geocode_address("Springfield, NJ")
    with_zip = geocode_address("Springfield, NJ 07081")

    assert [candidate.result_type for candidate in with_zip] == ["locality", "locality", "locality"]
    assert [candidate.source for candidate in with_zip] == ["census_gazetteer_2025"] * 3
    assert [candidate.label for candidate in without_zip] == [
        "Springfield, NJ — Place",
        "Springfield, NJ — Town / county subdivision",
        "Springfield, NJ — Town / county subdivision",
    ]
    assert [candidate.latitude for candidate in with_zip] == [40.697966, 40.706073, 40.039565]
    assert all(candidate.postal_code == "07081" for candidate in with_zip)


def test_geocode_address_returns_empty_for_zip_only_without_external_request() -> None:
    def unexpected_fetch(_url: str) -> dict[str, object]:
        raise AssertionError("ZIP-only input must not call an external geocoder")

    assert geocode_address("01266", DeriveClients(fetch_json=unexpected_fetch)) == []


def test_geocode_location_returns_503_for_corrupt_locality_index_without_address_fallback(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    from features.project_location import locality_index

    corrupt_metadata = tmp_path / "metadata.json"
    corrupt_metadata.write_text("{}")
    monkeypatch.setattr(locality_index, "_METADATA_PATH", corrupt_metadata)
    clear_locality_index_cache()

    def unexpected_fetch(_url: str) -> dict[str, object]:
        raise AssertionError("A corrupt locality index must not fall through to Census")

    monkeypatch.setattr("features.project_location.derive.fetch_json_url", unexpected_fetch)
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])

    response = client.post(
        f"/api/v1/projects/{project_id}/location/geocode",
        headers={"Origin": ORIGIN},
        json={"query": "1 Main St, West Stockbridge, MA"},
    )

    assert response.status_code == 503
    assert response.json()["error_code"] == "locality_index_unavailable"
    clear_locality_index_cache()


def test_geocode_location_returns_502_when_census_address_geocoder_is_unavailable(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def offline(_url: str) -> dict[str, object]:
        raise RuntimeError("offline")

    monkeypatch.setattr("features.project_location.derive.fetch_json_url", offline)
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])

    response = client.post(
        f"/api/v1/projects/{project_id}/location/geocode",
        headers={"Origin": ORIGIN},
        json={"query": "1 Main St, Not A Locality, MA"},
    )

    assert response.status_code == 502
    assert response.json()["error_code"] == "geocoder_unavailable"


def test_geocode_location_returns_502_for_invalid_census_candidate(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def malformed(_url: str) -> dict[str, object]:
        return {
            "result": {
                "addressMatches": [
                    {
                        "matchedAddress": "INVALID",
                        "coordinates": {"x": "not-a-longitude", "y": 42.0},
                        "addressComponents": {},
                    }
                ]
            }
        }

    monkeypatch.setattr("features.project_location.derive.fetch_json_url", malformed)
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])

    response = client.post(
        f"/api/v1/projects/{project_id}/location/geocode",
        headers={"Origin": ORIGIN},
        json={"query": "1 Invalid Address, MA"},
    )

    assert response.status_code == 502
    assert response.json()["error_code"] == "geocoder_unavailable"


def test_geocode_location_returns_503_for_hash_valid_malformed_locality_rows(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    from features.project_location import locality_index

    locality_path = tmp_path / "census_localities_2025.csv"
    zcta_path = tmp_path / "census_zctas_2025.csv"
    metadata_path = tmp_path / "census_localities_2025.metadata.json"
    locality_path.write_text(
        "kind,state,state_fips,county_fips,name,normalized_name,source_name,geoid,funcstat,latitude,longitude,source_vintage\n"
        "place,NJ,34,,Broken,broken,Broken city,3400001,A,40.0,,2025\n"
    )
    zcta_path.write_text("postal_code,latitude,longitude,source_vintage\n01266,42.3,-73.4,2025\n")
    metadata_path.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "source_vintage": "2025",
                "county_subdivision_funcstat_allowlist": ["A", "B", "C", "G"],
                "place_funcstat_allowlist": ["A", "B", "C", "G", "S"],
                "artifacts": {
                    locality_path.name: {
                        "rows": 1,
                        "sha256": hashlib.sha256(locality_path.read_bytes()).hexdigest(),
                    },
                    zcta_path.name: {
                        "rows": 1,
                        "sha256": hashlib.sha256(zcta_path.read_bytes()).hexdigest(),
                    },
                },
            }
        )
    )
    monkeypatch.setattr(locality_index, "_LOCALITY_PATH", locality_path)
    monkeypatch.setattr(locality_index, "_ZCTA_PATH", zcta_path)
    monkeypatch.setattr(locality_index, "_METADATA_PATH", metadata_path)
    clear_locality_index_cache()
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])

    response = client.post(
        f"/api/v1/projects/{project_id}/location/geocode",
        headers={"Origin": ORIGIN},
        json={"query": "Broken, NJ"},
    )

    assert response.status_code == 503
    assert response.json()["error_code"] == "locality_index_unavailable"
    clear_locality_index_cache()


def test_epw_upload_parse_persists_metadata_and_suggests_location(clean_mcp_tables: None) -> None:
    fake_r2 = FakeR2Client()
    install_fake_asset_service(fake_r2)
    try:
        client = signed_in_client()
        project = create_project(client)
        project_id = cast(str, project["id"])
        asset_id = upload_epw(client, fake_r2, project_id, epw_bytes())

        parsed = client.post(
            f"/api/v1/projects/{project_id}/location/epw/parse?asset_id={asset_id}",
            headers={"Origin": ORIGIN},
        )

        assert parsed.status_code == 200
        suggestion = parsed.json()["suggestion"]
        assert suggestion["latitude"] == 42.2876
        assert suggestion["longitude"] == -73.3662
        assert suggestion["elevation_m"] == 305.0
        assert suggestion["time_zone"] == "America/New_York"
        assert suggestion["time_zone_offset_hours"] == -5
        asset = client.get(f"/api/v1/projects/{project_id}/assets/{asset_id}")
        assert asset.status_code == 200
        assert asset.json()["metadata"]["epw_location"]["city"] == "West Stockbridge"
    finally:
        clear_fake_asset_service()


def test_epw_magic_validation_rejects_non_epw_named_epw(clean_mcp_tables: None) -> None:
    fake_r2 = FakeR2Client()
    install_fake_asset_service(fake_r2)
    try:
        client = signed_in_client()
        project = create_project(client)
        project_id = cast(str, project["id"])
        body = b"not an epw file"
        intent = client.post(
            f"/api/v1/projects/{project_id}/assets/upload-intent",
            headers={"Origin": ORIGIN},
            json={
                "asset_kind": "epw",
                "original_filename": "bad.epw",
                "display_name": "Bad EPW",
                "content_type": "text/plain",
                "size_bytes": len(body),
                "content_hash_sha256": hashlib.sha256(body).hexdigest(),
            },
        )
        assert intent.status_code == 200
        asset = intent.json()["asset"]
        fake_r2.put_object(asset["object_key"], body, asset["content_type"])

        complete = client.post(
            f"/api/v1/projects/{project_id}/assets/{asset['id']}/complete-upload",
            headers={"Origin": ORIGIN},
        )

        assert complete.status_code == 422
        assert complete.json()["details"]["reason"] == "epw_location_header_missing"
    finally:
        clear_fake_asset_service()


def test_epw_mismatch_warning_is_non_blocking(clean_mcp_tables: None) -> None:
    fake_r2 = FakeR2Client()
    install_fake_asset_service(fake_r2)
    try:
        client = signed_in_client()
        project = create_project(client)
        project_id = cast(str, project["id"])
        asset_id = upload_epw(client, fake_r2, project_id, epw_bytes(latitude=42, longitude=-73))
        parsed = client.post(
            f"/api/v1/projects/{project_id}/location/epw/parse?asset_id={asset_id}",
            headers={"Origin": ORIGIN},
        )
        assert parsed.status_code == 200

        close = client.put(
            f"/api/v1/projects/{project_id}/location",
            headers={"Origin": ORIGIN},
            json={"latitude": 42.5, "longitude": -73.5, "epw_asset_id": asset_id},
        )
        assert close.status_code == 200
        assert close.json()["warnings"] == []

        far = client.put(
            f"/api/v1/projects/{project_id}/location",
            headers={"Origin": ORIGIN},
            json={"latitude": 44.2, "longitude": -73.5},
        )
        assert far.status_code == 200
        assert far.json()["location"]["latitude"] == 44.2
        assert far.json()["warnings"] == ["Weather file location differs from project location by more than 1 degree."]
    finally:
        clear_fake_asset_service()


def test_location_write_requires_editor_session(clean_mcp_tables: None) -> None:
    editor = signed_in_client()
    project = create_project(editor)

    response = TestClient(app).put(
        f"/api/v1/projects/{project['id']}/location",
        headers={"Origin": ORIGIN},
        json={"latitude": 42.0},
    )

    assert response.status_code == 401
    assert response.json()["error_code"] == "not_authenticated"


def test_epw_parse_requires_editor_session(clean_mcp_tables: None) -> None:
    editor = signed_in_client()
    project = create_project(editor)

    response = TestClient(app).post(
        f"/api/v1/projects/{project['id']}/location/epw/parse?asset_id=asset_fake",
        headers={"Origin": ORIGIN},
    )

    assert response.status_code == 401
    assert response.json()["error_code"] == "not_authenticated"


def test_mcp_get_project_location_reads_saved_location(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    project = create_project(client)
    project_id = cast(str, project["id"])
    saved = client.put(
        f"/api/v1/projects/{project_id}/location",
        headers={"Origin": ORIGIN},
        json={"latitude": 42.325, "longitude": -73.367, "time_zone": "America/New_York"},
    )
    assert saved.status_code == 200
    monkeypatch.setenv("PHN_MCP_TOKEN", issue_mcp_token(client, project_id))

    result = tool_get_project_location(project_id, cast(Context, None), allow_env_token=True)

    assert result["is_set"] is True
    assert result["latitude"] == 42.325
    assert result["longitude"] == -73.367
    assert result["time_zone"] == "America/New_York"


def test_mcp_get_project_location_enforces_project_scope(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = signed_in_client()
    first = create_project(client, "2426")
    second = create_project(client, "2427")
    monkeypatch.setenv("PHN_MCP_TOKEN", issue_mcp_token(client, cast(str, first["id"])))

    with pytest.raises(ToolError, match="mcp_project_scope_mismatch"):
        tool_get_project_location(cast(str, second["id"]), cast(Context, None), allow_env_token=True)
