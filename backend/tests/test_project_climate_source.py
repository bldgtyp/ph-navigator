"""Project-scoped climate-source contract tests (Climate Phase 3b).

Covers source CRUD, per-kind validation (phius ref existence + provider match,
custom record validation, epw asset ref), project-scoping isolation,
editor/viewer gating, and MCP list parity.
"""

from __future__ import annotations

import hashlib
from typing import cast

import httpx
import pytest
from fastapi.testclient import TestClient
from mcp.server.fastmcp import Context

from features.climate.ashrae_meteo import AshraeMeteoResult
from features.climate.design_conditions import ClimateDesignConditions
from features.climate.epw_catalog import EpwCatalogEntry, EpwZipPayload
from features.climate.importers.phius import parse_phius_mon_file
from features.project_climate_source.mcp import tool_list_project_climate_sources
from main import app
from tests.test_assets_service import FakeR2Client
from tests.test_climate_datasets import (
    _STATION_FILE,
    _seed_two_locations,
    clean_climate_tables,
)
from tests.test_mcp import ORIGIN, clean_mcp_tables, create_project, signed_in_client
from tests.test_project_location import (
    clear_fake_asset_service,
    epw_bytes,
    install_fake_asset_service,
    upload_epw,
)

__all__ = ["clean_climate_tables", "clean_mcp_tables"]

_SOURCES = "/api/v1/projects/{project_id}/climate/sources"


def _custom_body(label: str) -> dict[str, object]:
    """A low-friction valid source for the kind-agnostic CRUD/scoping tests.

    The merged climate kinds (phius/phi/weather) all verify their ``ref`` against
    live data, so ``custom`` — a self-contained standardized record — is the
    simplest source to create without seeding a location, dataset, or EPW asset.
    """
    record = parse_phius_mon_file(_STATION_FILE).model_dump(mode="json")
    return {"kind": "custom", "data": record, "label": label}


def _issue_token(client: TestClient, project_id: str, scopes: list[str]) -> str:
    response = client.post(
        f"/api/v1/projects/{project_id}/mcp-tokens",
        headers={"Origin": ORIGIN},
        json={"label": "Climate source token", "scopes": scopes},
    )
    assert response.status_code == 201
    return cast(str, response.json()["token"])


def _post(client: TestClient, project_id: str, body: dict[str, object]) -> httpx.Response:
    return client.post(_SOURCES.format(project_id=project_id), headers={"Origin": ORIGIN}, json=body)


def _create(client: TestClient, project_id: str, body: dict[str, object]) -> dict[str, object]:
    response = _post(client, project_id, body)
    assert response.status_code == 201, response.text
    return cast(dict[str, object], response.json())


def _list(client: TestClient, project_id: str) -> list[dict[str, object]]:
    response = client.get(_SOURCES.format(project_id=project_id))
    assert response.status_code == 200, response.text
    return cast(list[dict[str, object]], response.json()["items"])


def _set_location(
    client: TestClient,
    project_id: str,
    *,
    latitude: float,
    longitude: float,
    elevation_m: float | None = None,
    state: str | None = None,
) -> None:
    body: dict[str, object] = {"latitude": latitude, "longitude": longitude}
    if elevation_m is not None:
        body["elevation_m"] = elevation_m
    if state is not None:
        body["state"] = state
    response = client.put(
        f"/api/v1/projects/{project_id}/location",
        headers={"Origin": ORIGIN},
        json=body,
    )
    assert response.status_code == 200, response.text


def _first_phius_location_id(client: TestClient) -> str:
    datasets = client.get("/api/v1/climate/datasets").json()["items"]
    dataset_id = datasets[0]["id"]
    locations = client.get(f"/api/v1/climate/datasets/{dataset_id}/locations").json()["items"]
    return cast(str, locations[0]["id"])


def test_create_and_list_sources(clean_mcp_tables: None) -> None:
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])

    first = _create(client, project_id, _custom_body("Custom A"))
    second = _create(client, project_id, _custom_body("Custom B"))
    assert "is_default" not in first
    assert "is_default" not in second

    # Sources are listed newest first.
    items = _list(client, project_id)
    assert [item["id"] for item in items] == [second["id"], first["id"]]


def test_phius_source_validates_ref_and_provider(clean_mcp_tables: None, clean_climate_tables: None) -> None:
    _seed_two_locations()
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])
    # A manual PH attach recomputes proximity server-side, so it needs a site.
    _set_location(client, project_id, latitude=40.0, longitude=-75.0)
    location_id = _first_phius_location_id(client)

    created = _create(client, project_id, {"kind": "phius", "ref": location_id, "label": "Worcester"})
    assert created["ref"] == location_id

    missing = _post(client, project_id, {"kind": "phius", "ref": "00000000-0000-0000-0000-000000000000"})
    assert missing.status_code == 422
    assert missing.json()["error_code"] == "climate_source_ref_not_found"

    # The location is a Phius location; attaching it as a PHI source is rejected.
    mismatch = _post(client, project_id, {"kind": "phi", "ref": location_id})
    assert mismatch.status_code == 422
    assert mismatch.json()["error_code"] == "climate_source_provider_mismatch"


def test_custom_source_record_validation(clean_mcp_tables: None) -> None:
    from features.climate.importers.phius import parse_phius_mon_file

    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])

    invalid = _post(client, project_id, {"kind": "custom", "data": {"not": "a record"}})
    assert invalid.status_code == 422
    assert invalid.json()["error_code"] == "climate_source_record_invalid"

    record = parse_phius_mon_file(_STATION_FILE).model_dump(mode="json")
    created = _create(client, project_id, {"kind": "custom", "data": record, "label": "Custom site"})
    assert created["kind"] == "custom" and created["ref"] is None


def test_weather_source_requires_existing_asset(clean_mcp_tables: None) -> None:
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])

    response = _post(client, project_id, {"kind": "weather", "ref": "asset_missing"})
    assert response.status_code == 422
    assert response.json()["error_code"] == "climate_source_ref_not_found"


def _ashrae_fetch_pittsfield(*, latitude: float, longitude: float, ashrae_version: str) -> AshraeMeteoResult:
    assert latitude == 42.325
    assert longitude == -73.367
    assert ashrae_version == "2025"
    return AshraeMeteoResult(
        station_id="744104",
        label="PITTSFIELD MUNI AP",
        url="https://ashrae-meteo.info/v3.0/index.php?ashrae_version=2025&wmo=744104",
        design_conditions=ClimateDesignConditions(
            basis="ASHRAE Meteo 2025 / PITTSFIELD MUNI AP",
            source="ashrae-meteo",
            edition="2025",
            heating_996_db_c=-18.8,
            heating_990_db_c=-16.0,
            cooling_010_db_c=28.5,
            cooling_010_mcwb_c=20.8,
        ),
    )


def test_refresh_ashrae_design_conditions_updates_weather_source(
    clean_mcp_tables: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "features.project_climate_source.service.fetch_nearest_ashrae_station_conditions",
        _ashrae_fetch_pittsfield,
    )
    fake_r2 = FakeR2Client()
    install_fake_asset_service(fake_r2)
    try:
        client = signed_in_client()
        project_id = cast(str, create_project(client)["id"])
        saved = client.put(
            f"/api/v1/projects/{project_id}/location",
            headers={"Origin": ORIGIN},
            json={"latitude": 42.325, "longitude": -73.367},
        )
        assert saved.status_code == 200, saved.text
        asset_id = upload_epw(client, fake_r2, project_id, epw_bytes())
        _create(
            client,
            project_id,
            {
                "kind": "weather",
                "ref": asset_id,
                "label": "Pittsfield.Muni.AP",
                "data": {
                    "station": {"name": "Pittsfield.Muni.AP"},
                    "design_conditions": {"basis": "STAT", "source": "stat", "heating_996_db_c": -10.0},
                },
            },
        )

        response = client.post(
            f"{_SOURCES.format(project_id=project_id)}/ashrae/current",
            headers={"Origin": ORIGIN},
            json={"ashrae_version": "2025"},
        )

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["kind"] == "weather"
        # The ASHRAE pull replaces the design conditions in place...
        assert body["data"]["design_conditions"]["heating_996_db_c"] == -18.8
        assert body["data"]["design_conditions"]["source"] == "ashrae-meteo"
        assert body["data"]["design_conditions_source"]["provider"] == "ashrae_meteo"
        # ...while the rest of the weather payload is preserved.
        assert body["data"]["station"]["name"] == "Pittsfield.Muni.AP"
    finally:
        clear_fake_asset_service()


def test_refresh_ashrae_requires_weather_source(clean_mcp_tables: None) -> None:
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])
    saved = client.put(
        f"/api/v1/projects/{project_id}/location",
        headers={"Origin": ORIGIN},
        json={"latitude": 42.325, "longitude": -73.367},
    )
    assert saved.status_code == 200, saved.text

    # No weather file yet → fail fast (no ASHRAE network fetch).
    response = client.post(
        f"{_SOURCES.format(project_id=project_id)}/ashrae/current",
        headers={"Origin": ORIGIN},
        json={"ashrae_version": "2025"},
    )
    assert response.status_code == 409
    assert response.json()["error_code"] == "weather_source_required"


def test_sources_are_project_scoped(clean_mcp_tables: None) -> None:
    client = signed_in_client()
    project_a = cast(str, create_project(client, bt_number="2426")["id"])
    project_b = cast(str, create_project(client, bt_number="2427")["id"])

    source = _create(client, project_a, _custom_body("Project A source"))

    assert _list(client, project_b) == []

    # B's URL cannot see or mutate A's source.
    cross = client.patch(
        f"{_SOURCES.format(project_id=project_b)}/{source['id']}",
        headers={"Origin": ORIGIN},
        json={"label": "hijack"},
    )
    assert cross.status_code == 404
    cross_delete = client.delete(f"{_SOURCES.format(project_id=project_b)}/{source['id']}", headers={"Origin": ORIGIN})
    assert cross_delete.status_code == 404


def test_patch_and_delete(clean_mcp_tables: None) -> None:
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])
    source = _create(client, project_id, _custom_body("Before"))

    patched = client.patch(
        f"{_SOURCES.format(project_id=project_id)}/{source['id']}",
        headers={"Origin": ORIGIN},
        json={"label": "After"},
    )
    assert patched.status_code == 200
    assert patched.json()["label"] == "After"

    deleted = client.delete(f"{_SOURCES.format(project_id=project_id)}/{source['id']}", headers={"Origin": ORIGIN})
    assert deleted.status_code == 204
    assert _list(client, project_id) == []


def test_viewer_cannot_write(clean_mcp_tables: None) -> None:
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])

    anon = TestClient(app)
    # Read is public...
    assert anon.get(_SOURCES.format(project_id=project_id)).status_code == 200
    # ...write requires an editor. The body is shape-valid (ref present) so the
    # 401 comes from the editor gate, not request validation.
    response = _post(anon, project_id, {"kind": "weather", "ref": "asset_x"})
    assert response.status_code == 401


def test_mcp_list_project_climate_sources(clean_mcp_tables: None, monkeypatch: pytest.MonkeyPatch) -> None:
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])
    first = _create(client, project_id, _custom_body("A"))
    second = _create(client, project_id, _custom_body("B"))
    ctx = cast(Context, None)

    monkeypatch.setenv("PHN_MCP_TOKEN", _issue_token(client, project_id, ["project:read", "project:write"]))

    listed = tool_list_project_climate_sources(project_id, ctx, allow_env_token=True)
    listed_items = cast(list[dict[str, object]], listed["items"])
    assert {item["id"] for item in listed_items} == {first["id"], second["id"]}


# --- EPW catalog roster + from-catalog attach (P2: "Select from map") --------


def _epw_entry(name: str, region: str, lat: float, lon: float, elev: float, url: str) -> EpwCatalogEntry:
    return EpwCatalogEntry(
        country="USA",
        region=region,
        name=name,
        wmo="744104",
        source_data="SRC-TMYx",
        latitude=lat,
        longitude=lon,
        elevation_m=elev,
        time_zone_offset_hours=-5,
        url=url,
    )


# Two MA stations + one NY, so a state filter and a nearest sweep diverge.
_EPW_CATALOG = (
    _epw_entry("Pittsfield.Muni.AP", "MA", 42.43, -73.29, 364, "https://climate.onebuilding.org/pittsfield.zip"),
    _epw_entry("Boston.Logan", "MA", 42.36, -71.01, 6, "https://climate.onebuilding.org/boston.zip"),
    _epw_entry("Albany.Intl", "NY", 42.75, -73.80, 84, "https://climate.onebuilding.org/albany.zip"),
)


def test_epw_roster_filters_by_state(clean_mcp_tables: None, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("features.climate.epw_catalog.load_epw_catalog", lambda _urls: _EPW_CATALOG)
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])
    _set_location(client, project_id, latitude=42.33, longitude=-73.37, elevation_m=300.0, state="MA")

    response = client.get(f"/api/v1/projects/{project_id}/climate/epw-roster?region=MA")

    assert response.status_code == 200, response.text
    body = response.json()
    # MA only, nearest-first; no proximity verdict (D4).
    assert [item["name"] for item in body["items"]] == ["Pittsfield.Muni.AP", "Boston.Logan"]
    assert all(item["distance_mi"] is not None for item in body["items"])
    assert body["items"][0]["elevation_delta_ft"] is not None
    assert "proximity" not in body["items"][0]


def test_epw_roster_nearest_mode_sweeps_all_states(clean_mcp_tables: None, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("features.climate.epw_catalog.load_epw_catalog", lambda _urls: _EPW_CATALOG)
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])
    _set_location(client, project_id, latitude=42.33, longitude=-73.37, elevation_m=300.0, state="MA")

    response = client.get(f"/api/v1/projects/{project_id}/climate/epw-roster?near=true")

    assert response.status_code == 200, response.text
    names = [item["name"] for item in response.json()["items"]]
    assert names[0] == "Pittsfield.Muni.AP"  # nearest the site
    assert set(names) == {"Pittsfield.Muni.AP", "Boston.Logan", "Albany.Intl"}  # crosses states


def test_epw_roster_requires_location(clean_mcp_tables: None) -> None:
    client = signed_in_client()
    project_id = cast(str, create_project(client)["id"])

    response = client.get(f"/api/v1/projects/{project_id}/climate/epw-roster")

    assert response.status_code == 409
    assert response.json()["error_code"] == "project_location_required"


def test_attach_weather_from_catalog(clean_mcp_tables: None, monkeypatch: pytest.MonkeyPatch) -> None:
    from tests.test_climate_design_conditions import STAT_SAMPLE

    entry = _EPW_CATALOG[0]
    payload = EpwZipPayload(
        entry=entry,
        epw_name="pittsfield.epw",
        epw_bytes=epw_bytes(latitude=42.43, longitude=-73.29, elevation_m=364),
        stat_name="pittsfield.stat",
        stat_text=STAT_SAMPLE,
    )
    monkeypatch.setattr(
        "features.project_climate_source.service.find_entry_by_url",
        lambda url: entry if url == entry.url else None,
    )
    monkeypatch.setattr("features.project_climate_source.service.download_epw_zip", lambda _entry: payload)
    fake_r2 = FakeR2Client()
    install_fake_asset_service(fake_r2)
    try:
        client = signed_in_client()
        project_id = cast(str, create_project(client)["id"])
        _set_location(client, project_id, latitude=42.33, longitude=-73.37)

        response = client.post(
            f"/api/v1/projects/{project_id}/climate/sources/weather/from-catalog",
            headers={"Origin": ORIGIN},
            json={"url": entry.url},
        )

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["kind"] == "weather"
        assert body["data"]["stat_metrics"]["hdd65_f_days"] == 3884
        assert body["data"]["design_conditions"]["cooling_004_db_c"] == 29.9
        sources = client.get(f"/api/v1/projects/{project_id}/climate/sources").json()["items"]
        assert {source["kind"] for source in sources} == {"weather"}
    finally:
        clear_fake_asset_service()


def test_attach_weather_from_catalog_unknown_url(clean_mcp_tables: None, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("features.project_climate_source.service.find_entry_by_url", lambda _url: None)
    fake_r2 = FakeR2Client()
    install_fake_asset_service(fake_r2)
    try:
        client = signed_in_client()
        project_id = cast(str, create_project(client)["id"])
        _set_location(client, project_id, latitude=42.33, longitude=-73.37)

        response = client.post(
            f"/api/v1/projects/{project_id}/climate/sources/weather/from-catalog",
            headers={"Origin": ORIGIN},
            json={"url": "https://climate.onebuilding.org/missing.zip"},
        )

        assert response.status_code == 422
        assert response.json()["error_code"] == "epw_catalog_entry_not_found"
    finally:
        clear_fake_asset_service()


# --- Manual upload attach (P3: "Upload Climate Data" EPW / STAT / DDY) --------


def _upload_weather_asset(
    client: TestClient, fake_r2: FakeR2Client, project_id: str, *, asset_kind: str, filename: str, body: bytes
) -> str:
    intent = client.post(
        f"/api/v1/projects/{project_id}/assets/upload-intent",
        headers={"Origin": ORIGIN},
        json={
            "asset_kind": asset_kind,
            "original_filename": filename,
            "display_name": filename,
            "content_type": "text/plain",
            "size_bytes": len(body),
            "content_hash_sha256": hashlib.sha256(body).hexdigest(),
        },
    )
    assert intent.status_code == 200, intent.text
    asset = intent.json()["asset"]
    fake_r2.put_object(asset["object_key"], body, asset["content_type"])
    complete = client.post(
        f"/api/v1/projects/{project_id}/assets/{asset['id']}/complete-upload",
        headers={"Origin": ORIGIN},
    )
    assert complete.status_code == 200, complete.text
    return cast(str, asset["id"])


def test_attach_weather_from_upload_full_bundle(clean_mcp_tables: None) -> None:
    from tests.test_climate_design_conditions import STAT_SAMPLE

    fake_r2 = FakeR2Client()
    install_fake_asset_service(fake_r2)
    try:
        client = signed_in_client()
        project_id = cast(str, create_project(client)["id"])
        epw_id = upload_epw(client, fake_r2, project_id, epw_bytes(latitude=42.43, longitude=-73.29, elevation_m=364))
        stat_id = _upload_weather_asset(
            client, fake_r2, project_id, asset_kind="stat", filename="pittsfield.stat", body=STAT_SAMPLE.encode()
        )
        ddy_id = _upload_weather_asset(
            client, fake_r2, project_id, asset_kind="ddy", filename="pittsfield.ddy", body=b"DDY design days\n"
        )

        response = client.post(
            f"/api/v1/projects/{project_id}/climate/sources/weather/from-upload",
            headers={"Origin": ORIGIN},
            json={"epw_asset_id": epw_id, "stat_asset_id": stat_id, "ddy_asset_id": ddy_id},
        )

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["kind"] == "weather"
        assert body["ref"] == epw_id
        assert body["data"]["provider"] == "upload"
        assert body["data"]["stat_asset_id"] == stat_id
        assert body["data"]["ddy_asset_id"] == ddy_id
        assert body["data"]["stat_metrics"]["hdd65_f_days"] == 3884
        assert body["data"]["design_conditions"]["cooling_004_db_c"] == 29.9
    finally:
        clear_fake_asset_service()


def test_attach_weather_from_upload_epw_only(clean_mcp_tables: None) -> None:
    fake_r2 = FakeR2Client()
    install_fake_asset_service(fake_r2)
    try:
        client = signed_in_client()
        project_id = cast(str, create_project(client)["id"])
        epw_id = upload_epw(client, fake_r2, project_id, epw_bytes())

        response = client.post(
            f"/api/v1/projects/{project_id}/climate/sources/weather/from-upload",
            headers={"Origin": ORIGIN},
            json={"epw_asset_id": epw_id},
        )

        assert response.status_code == 200, response.text
        data = response.json()["data"]
        assert data["provider"] == "upload"
        # No STAT given → no metrics / design conditions / companion ids.
        assert "stat_metrics" not in data
        assert "stat_asset_id" not in data
        assert "ddy_asset_id" not in data
    finally:
        clear_fake_asset_service()


def test_attach_weather_from_upload_rejects_non_epw_ref(clean_mcp_tables: None) -> None:
    fake_r2 = FakeR2Client()
    install_fake_asset_service(fake_r2)
    try:
        client = signed_in_client()
        project_id = cast(str, create_project(client)["id"])
        # A STAT asset cannot stand in as the EPW reference.
        stat_id = _upload_weather_asset(
            client, fake_r2, project_id, asset_kind="stat", filename="x.stat", body=b"Location -- X\n"
        )

        response = client.post(
            f"/api/v1/projects/{project_id}/climate/sources/weather/from-upload",
            headers={"Origin": ORIGIN},
            json={"epw_asset_id": stat_id},
        )

        assert response.status_code == 422
        assert response.json()["error_code"] == "asset_kind_mismatch"
    finally:
        clear_fake_asset_service()
