"""Validated, cached search over the bundled Census locality index."""

from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import re
from collections import Counter, defaultdict
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import cast

from features.climate.proximity import haversine_miles
from features.project_location.locality_contract import (
    COUNTY_SUBDIVISION_FUNCSTAT_ALLOWLIST,
    LOCALITY_COLUMNS,
    LOCALITY_KIND_ORDER,
    PLACE_FUNCSTAT_ALLOWLIST,
    SCHEMA_VERSION,
    SOURCE_VINTAGE,
    ZCTA_COLUMNS,
    LocalityKind,
    normalize_locality_name,
)
from features.project_location.models import GeocodeProjectLocationCandidate
from features.project_location.reference_data import load_county_reference_rows

MAX_CANDIDATES = 5

_DATA_DIR = Path(__file__).with_name("data")
_LOCALITY_PATH = _DATA_DIR / f"census_localities_{SOURCE_VINTAGE}.csv"
_ZCTA_PATH = _DATA_DIR / f"census_zctas_{SOURCE_VINTAGE}.csv"
_METADATA_PATH = _DATA_DIR / f"census_localities_{SOURCE_VINTAGE}.metadata.json"
_ZIP_ONLY = re.compile(r"\s*\d{5}(?:-\d{4})?\s*")
_LOCALITY_QUERY = re.compile(
    r"^\s*(?P<name>.+?)(?:,\s*|\s+)(?P<state>[A-Za-z]{2})"
    r"(?:\s+(?P<postal_code>\d{5})(?:-\d{4})?)?\s*$"
)


class LocalityIndexError(RuntimeError):
    """The bundled index is missing, corrupt, or incompatible."""


@dataclass(frozen=True)
class LocalityRecord:
    kind: LocalityKind
    state: str
    county_fips_5: str | None
    name: str
    normalized_name: str
    source_name: str
    geoid: str
    latitude: float
    longitude: float


@dataclass(frozen=True)
class ZctaPoint:
    latitude: float
    longitude: float


@dataclass(frozen=True)
class LocalityIndex:
    by_name_and_state: Mapping[tuple[str, str], tuple[LocalityRecord, ...]]
    zctas: Mapping[str, ZctaPoint]
    county_names: Mapping[str, str]


def load_locality_index() -> LocalityIndex:
    """Load and validate the committed artifacts once per backend process."""
    result = _load_locality_index_result()
    if isinstance(result, LocalityIndexError):
        raise result
    return result


def clear_locality_index_cache() -> None:
    """Clear the immutable index result for tests or an explicit operator reload."""
    _load_locality_index_result.cache_clear()


@cache
def _load_locality_index_result() -> LocalityIndex | LocalityIndexError:
    try:
        metadata = _read_metadata(_METADATA_PATH)
        locality_bytes = _validated_artifact(_LOCALITY_PATH, metadata)
        zcta_bytes = _validated_artifact(_ZCTA_PATH, metadata)
        localities = _read_localities(locality_bytes, expected_rows=_artifact_rows(metadata, _LOCALITY_PATH.name))
        zctas = _read_zctas(zcta_bytes, expected_rows=_artifact_rows(metadata, _ZCTA_PATH.name))
        county_names = {county_fips: row["county_name"] for county_fips, row in load_county_reference_rows().items()}
    except (OSError, UnicodeError, ValueError, TypeError, AttributeError, csv.Error, json.JSONDecodeError) as exc:
        return LocalityIndexError(str(exc))

    grouped: defaultdict[tuple[str, str], list[LocalityRecord]] = defaultdict(list)
    for locality in localities:
        grouped[(locality.state, locality.normalized_name)].append(locality)
    return LocalityIndex(
        by_name_and_state={key: tuple(value) for key, value in grouped.items()},
        zctas=zctas,
        county_names=county_names,
    )


def search_localities(query: str, index: LocalityIndex | None = None) -> list[GeocodeProjectLocationCandidate]:
    """Return exact name/state matches, optionally ranked by a valid ZCTA."""
    match = _LOCALITY_QUERY.fullmatch(query)
    if match is None:
        return []
    resolved_index = index or load_locality_index()
    state = match.group("state").upper()
    normalized_name = normalize_locality_name(match.group("name"))
    matches = list(resolved_index.by_name_and_state.get((state, normalized_name), ()))
    if not matches:
        return []

    supplied_postal_code = match.group("postal_code")
    zcta = resolved_index.zctas.get(supplied_postal_code) if supplied_postal_code else None
    accepted_postal_code = supplied_postal_code if zcta is not None else None

    def sort_key(record: LocalityRecord) -> tuple[float, int, str, str]:
        distance = (
            haversine_miles(zcta.latitude, zcta.longitude, record.latitude, record.longitude)
            if zcta is not None
            else 0.0
        )
        return distance, LOCALITY_KIND_ORDER[record.kind], record.name, record.geoid

    matches.sort(key=sort_key)
    ambiguous = len(matches) > 1
    selected_matches = matches[:MAX_CANDIDATES]
    labels = [
        _candidate_label(
            record,
            postal_code=accepted_postal_code,
            ambiguous=ambiguous,
            county_names=resolved_index.county_names,
        )
        for record in selected_matches
    ]
    duplicate_labels = Counter(labels)
    labels = [
        _candidate_label(
            record,
            postal_code=accepted_postal_code,
            ambiguous=ambiguous,
            county_names=resolved_index.county_names,
            include_source_type=duplicate_labels[label] > 1,
        )
        for record, label in zip(selected_matches, labels, strict=True)
    ]
    duplicate_labels = Counter(labels)
    return [
        _candidate(
            record,
            label=(label if duplicate_labels[label] == 1 else f"{label}, Census GEOID {record.geoid}"),
            postal_code=accepted_postal_code,
        )
        for record, label in zip(selected_matches, labels, strict=True)
    ]


def is_zip_only_query(query: str) -> bool:
    return _ZIP_ONLY.fullmatch(query) is not None


def _candidate(
    record: LocalityRecord,
    *,
    label: str,
    postal_code: str | None,
) -> GeocodeProjectLocationCandidate:
    return GeocodeProjectLocationCandidate(
        result_type="locality",
        label=label,
        latitude=record.latitude,
        longitude=record.longitude,
        street_address=None,
        city=record.name,
        state=record.state,
        postal_code=postal_code,
        country="US",
        source=f"census_gazetteer_{SOURCE_VINTAGE}",
    )


def _candidate_label(
    record: LocalityRecord,
    *,
    postal_code: str | None,
    ambiguous: bool,
    county_names: Mapping[str, str],
    include_source_type: bool = False,
) -> str:
    label = f"{record.name}, {record.state}"
    if postal_code:
        label = f"{label} {postal_code}"
    if ambiguous:
        qualifier = "Place" if record.kind == "place" else "Town / county subdivision"
        if include_source_type:
            qualifier = f"{qualifier} ({_source_type(record)})"
        if record.kind == "county_subdivision":
            assert record.county_fips_5 is not None
            county_name = county_names.get(record.county_fips_5, f"FIPS {record.county_fips_5}")
            qualifier = f"{qualifier}, {county_name} County"
        label = f"{label} — {qualifier}"
    return label


def _source_type(record: LocalityRecord) -> str:
    suffix = record.source_name.removeprefix(record.name).strip()
    return suffix if suffix.isupper() else suffix.title()


def _read_metadata(path: Path) -> dict[str, object]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Locality metadata must be a JSON object.")
    if payload.get("schema_version") != SCHEMA_VERSION:
        raise ValueError(f"Unsupported locality-index schema version: {payload.get('schema_version')!r}")
    if payload.get("source_vintage") != SOURCE_VINTAGE:
        raise ValueError(f"Unexpected locality-index source vintage: {payload.get('source_vintage')!r}")
    if payload.get("county_subdivision_funcstat_allowlist") != sorted(COUNTY_SUBDIVISION_FUNCSTAT_ALLOWLIST):
        raise ValueError("Unexpected County Subdivision functional-status allowlist.")
    if payload.get("place_funcstat_allowlist") != sorted(PLACE_FUNCSTAT_ALLOWLIST):
        raise ValueError("Unexpected Place functional-status allowlist.")
    return cast(dict[str, object], payload)


def _validated_artifact(path: Path, metadata: Mapping[str, object]) -> bytes:
    details = _artifact_details(metadata, path.name)
    expected_hash = details.get("sha256")
    if not isinstance(expected_hash, str):
        raise ValueError(f"Locality metadata has no SHA-256 for {path.name}.")
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != expected_hash:
        raise ValueError(f"Locality artifact integrity check failed for {path.name}.")
    return data


def _artifact_rows(metadata: Mapping[str, object], filename: str) -> int:
    row_count = _artifact_details(metadata, filename).get("rows")
    if not isinstance(row_count, int) or row_count < 0:
        raise ValueError(f"Locality metadata has an invalid row count for {filename}.")
    return row_count


def _artifact_details(metadata: Mapping[str, object], filename: str) -> Mapping[str, object]:
    artifacts_value = metadata.get("artifacts")
    if not isinstance(artifacts_value, dict):
        raise ValueError("Locality metadata is missing artifacts.")
    artifacts = cast(dict[str, object], artifacts_value)
    details_value = artifacts.get(filename)
    if not isinstance(details_value, dict):
        raise ValueError(f"Locality metadata is missing artifact {filename}.")
    return cast(dict[str, object], details_value)


def _read_localities(data: bytes, *, expected_rows: int) -> list[LocalityRecord]:
    reader = csv.DictReader(io.StringIO(data.decode("utf-8-sig")))
    _require_columns(reader.fieldnames, LOCALITY_COLUMNS, "locality")
    records: list[LocalityRecord] = []
    source_keys: set[tuple[str, str]] = set()
    for row in reader:
        kind_text = row["kind"]
        if kind_text not in ("place", "county_subdivision"):
            raise ValueError(f"Invalid locality geography kind: {kind_text!r}")
        kind = cast(LocalityKind, kind_text)
        geoid = row["geoid"]
        source_key = (kind, geoid)
        if source_key in source_keys:
            raise ValueError(f"Duplicate locality source key: {kind}/{geoid}")
        source_keys.add(source_key)
        latitude = _coordinate(row["latitude"], -90, 90, "latitude")
        longitude = _coordinate(row["longitude"], -180, 180, "longitude")
        name = row["name"].strip()
        normalized_name = row["normalized_name"].strip()
        if not name or normalized_name != normalize_locality_name(name):
            raise ValueError(f"Invalid normalized locality name for {kind}/{geoid}")
        state = row["state"].strip()
        if re.fullmatch(r"[A-Z]{2}", state) is None:
            raise ValueError(f"Invalid locality state for {kind}/{geoid}: {state!r}")
        state_fips = row["state_fips"].strip()
        if re.fullmatch(r"\d{2}", state_fips) is None:
            raise ValueError(f"Invalid locality state FIPS for {kind}/{geoid}: {state_fips!r}")
        county_fips = row["county_fips"].strip()
        expected_county_fips = r"\d{3}" if kind == "county_subdivision" else r""
        if re.fullmatch(expected_county_fips, county_fips) is None:
            raise ValueError(f"Invalid locality county FIPS for {kind}/{geoid}: {county_fips!r}")
        county_fips_5 = f"{state_fips}{county_fips}" if county_fips else None
        source_name = row["source_name"].strip()
        if not source_name:
            raise ValueError(f"Invalid locality source name for {kind}/{geoid}")
        if row["source_vintage"] != SOURCE_VINTAGE:
            raise ValueError(f"Unexpected locality row vintage for {kind}/{geoid}")
        records.append(
            LocalityRecord(
                kind,
                state,
                county_fips_5,
                name,
                normalized_name,
                source_name,
                geoid,
                latitude,
                longitude,
            )
        )
    if len(records) != expected_rows:
        raise ValueError(f"Locality artifact row count mismatch: expected {expected_rows}, found {len(records)}")
    return records


def _read_zctas(data: bytes, *, expected_rows: int) -> dict[str, ZctaPoint]:
    reader = csv.DictReader(io.StringIO(data.decode("utf-8-sig")))
    _require_columns(reader.fieldnames, ZCTA_COLUMNS, "ZCTA")
    records: dict[str, ZctaPoint] = {}
    for row in reader:
        postal_code = row["postal_code"]
        if re.fullmatch(r"\d{5}", postal_code) is None:
            raise ValueError(f"Invalid ZCTA postal code: {postal_code!r}")
        if postal_code in records:
            raise ValueError(f"Duplicate ZCTA postal code: {postal_code}")
        if row["source_vintage"] != SOURCE_VINTAGE:
            raise ValueError(f"Unexpected ZCTA row vintage for {postal_code}")
        records[postal_code] = ZctaPoint(
            _coordinate(row["latitude"], -90, 90, "latitude"),
            _coordinate(row["longitude"], -180, 180, "longitude"),
        )
    if len(records) != expected_rows:
        raise ValueError(f"ZCTA artifact row count mismatch: expected {expected_rows}, found {len(records)}")
    return records


def _require_columns(actual: Sequence[str] | None, expected: tuple[str, ...], label: str) -> None:
    if tuple(actual or ()) != expected:
        raise ValueError(f"Unexpected {label} artifact columns: {actual!r}")


def _coordinate(value: str, lower: float, upper: float, label: str) -> float:
    coordinate = float(value)
    if not math.isfinite(coordinate) or not lower <= coordinate <= upper:
        raise ValueError(f"Invalid locality {label}: {value!r}")
    return coordinate
