from __future__ import annotations

import csv
import json
from pathlib import Path

import pytest

from scripts.import_census_localities import (
    COUNTY_SUBDIVISION_FUNCSTAT_ALLOWLIST,
    build_index,
    locality_name,
    normalize_locality_name,
    write_index,
)

FIXTURE_ROOT = Path(__file__).parent / "fixtures" / "project_location" / "geocode"


def _source_bytes(name: str) -> bytes:
    return (FIXTURE_ROOT / name).read_bytes()


def _sources() -> dict[str, bytes]:
    return {
        "places": _source_bytes("2025_Gaz_place_fixture.txt"),
        "county_subdivisions": _source_bytes("2025_Gaz_cousubs_fixture.txt"),
        "zctas": _source_bytes("2025_Gaz_zcta_fixture.txt"),
    }


def test_build_index_normalizes_selectable_places_and_county_subdivisions() -> None:
    localities, zctas = build_index(*_sources().values())

    assert COUNTY_SUBDIVISION_FUNCSTAT_ALLOWLIST == {"A", "B", "C", "G"}
    assert [(row.name, row.kind, row.state) for row in localities] == [
        ("West Stockbridge", "county_subdivision", "MA"),
        ("Hoboken", "place", "NJ"),
        ("Springfield", "place", "NY"),
        ("Springfield", "county_subdivision", "NY"),
    ]
    assert all(row.source_name != "Springfield CCD" for row in localities)
    assert all(row.source_name != "Inactiveville city" for row in localities)
    assert [row.postal_code for row in zctas] == ["01266", "11232", "12000"]


def test_locality_name_removes_one_type_suffix_and_normalizes_punctuation() -> None:
    assert locality_name("Oklahoma City city") == "Oklahoma City"
    assert locality_name("West Stockbridge town") == "West Stockbridge"
    assert normalize_locality_name("St. André's") == "st andre s"


def test_write_index_is_deterministic_and_records_integrity(tmp_path: Path) -> None:
    sources = _sources()
    first_metadata = write_index(tmp_path, sources=sources)
    first_bytes = {path.name: path.read_bytes() for path in tmp_path.iterdir()}
    second_metadata = write_index(tmp_path, sources=sources)

    assert second_metadata == first_metadata
    assert {path.name: path.read_bytes() for path in tmp_path.iterdir()} == first_bytes
    metadata = json.loads((tmp_path / "census_localities_2025.metadata.json").read_text())
    assert metadata["artifacts"]["census_localities_2025.csv"]["rows"] == 4
    assert metadata["sources"]["places"]["url"].endswith("2025_Gaz_place_national.zip")
    with (tmp_path / "census_localities_2025.csv").open(newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert rows[0]["name"] == "West Stockbridge"
    assert rows[0]["county_fips"] == "003"


def test_build_index_rejects_missing_columns() -> None:
    invalid_places = b"USPS|GEOID|NAME|FUNCSTAT|INTPTLAT\nNJ|3432250|Hoboken city|A|40.7\n"

    with pytest.raises(ValueError, match="Places source is missing columns: INTPTLONG"):
        build_index(invalid_places, _sources()["county_subdivisions"], _sources()["zctas"])


def test_build_index_rejects_duplicate_source_keys() -> None:
    places = _sources()["places"]
    duplicate = places + places.splitlines(keepends=True)[1]

    with pytest.raises(ValueError, match="Duplicate locality source key: place/3432250"):
        build_index(duplicate, _sources()["county_subdivisions"], _sources()["zctas"])


def test_build_index_rejects_coordinates_outside_us_gazetteer_extent() -> None:
    invalid_places = _sources()["places"].replace(b"40.745255|-74.027925", b"0.000000|0.000000")

    with pytest.raises(ValueError, match="Coordinates outside the US Gazetteer extent: 0.000000, 0.000000"):
        build_index(invalid_places, _sources()["county_subdivisions"], _sources()["zctas"])


def test_search_and_address_fixtures_freeze_phase_one_contract() -> None:
    search_cases = json.loads((FIXTURE_ROOT / "locality_search_cases.json").read_text())["cases"]
    assert search_cases[0] == {
        "query": "West Stockbridge, MA 01266",
        "expected_names": ["West Stockbridge"],
        "expected_kinds": ["county_subdivision"],
        "expected_postal_code": "01266",
    }
    assert search_cases[2]["expected_kinds"] == ["county_subdivision", "place"]
    assert search_cases[3]["expected_names"] == []

    address_fixture = json.loads((FIXTURE_ROOT / "census_address_candidate.json").read_text())
    address_match = address_fixture["result"]["addressMatches"][0]
    assert address_match["matchedAddress"] == "1 MAIN ST, WEST STOCKBRIDGE, MA, 01266"
    assert address_match["addressComponents"]["zip"] == "01266"
