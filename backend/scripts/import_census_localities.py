"""Build the bundled Project Location locality index from Census Gazetteers.

The runtime artifact is generated from the pinned 2025 national Places, County
Subdivisions, and ZCTA archives. Runtime requests never download these files.

Run from ``backend/``:

    uv run python -m scripts.import_census_localities

Pass local archives or extracted text files during review/testing:

    uv run python -m scripts.import_census_localities \
      --places-source /path/to/places.zip \
      --county-subdivisions-source /path/to/cousubs.zip \
      --zctas-source /path/to/zctas.zip
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import os
import re
import ssl
import tempfile
import unicodedata
import urllib.request
import zipfile
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal, cast

import certifi

SOURCE_VINTAGE = "2025"
SCHEMA_VERSION = 1
SOURCE_URLS = {
    "places": (
        "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/"
        "2025_Gazetteer/2025_Gaz_place_national.zip"
    ),
    "county_subdivisions": (
        "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/"
        "2025_Gazetteer/2025_Gaz_cousubs_national.zip"
    ),
    "zctas": (
        "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/"
        "2025_Gazetteer/2025_Gaz_zcta_national.zip"
    ),
}

# Census Gazetteer County Subdivision files expose FUNCSTAT, not CLASSFP.
# A/B/C/G are functioning legal governments. F/I/N/S are respectively
# fictitious, inactive, nonfunctioning, and statistical entities.
COUNTY_SUBDIVISION_FUNCSTAT_ALLOWLIST = frozenset({"A", "B", "C", "G"})
PLACE_FUNCSTAT_ALLOWLIST = frozenset({"A", "B", "C", "G", "S"})

LOCALITY_COLUMNS = (
    "kind",
    "state",
    "state_fips",
    "county_fips",
    "name",
    "normalized_name",
    "source_name",
    "geoid",
    "funcstat",
    "latitude",
    "longitude",
    "source_vintage",
)
ZCTA_COLUMNS = ("postal_code", "latitude", "longitude", "source_vintage")
LocalityKind = Literal["place", "county_subdivision"]

_LOCALITY_SUFFIXES = tuple(
    sorted(
        {
            "borough",
            "census county division",
            "census designated place",
            "census subarea",
            "cdp",
            "city",
            "county subdivision",
            "district",
            "gore",
            "grant",
            "location",
            "municipality",
            "plantation",
            "precinct",
            "purchase",
            "reservation",
            "supervisor's district",
            "town",
            "township",
            "unorganized territory",
            "village",
        },
        key=len,
        reverse=True,
    )
)


@dataclass(frozen=True)
class LocalityRow:
    kind: LocalityKind
    state: str
    state_fips: str
    county_fips: str
    name: str
    normalized_name: str
    source_name: str
    geoid: str
    funcstat: str
    latitude: str
    longitude: str
    source_vintage: str = SOURCE_VINTAGE


@dataclass(frozen=True)
class ZctaRow:
    postal_code: str
    latitude: str
    longitude: str
    source_vintage: str = SOURCE_VINTAGE


def normalize_locality_name(value: str) -> str:
    """Return the accent-insensitive, punctuation-normalized match key."""
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return " ".join(re.sub(r"[^a-z0-9]+", " ", ascii_value.casefold()).split())


def locality_name(source_name: str) -> str:
    """Remove one Census legal/statistical suffix while preserving the name."""
    folded = source_name.casefold()
    for suffix in _LOCALITY_SUFFIXES:
        marker = f" {suffix}"
        if folded.endswith(marker):
            return source_name[: -len(marker)].strip()
    return source_name.strip()


def build_index(
    places_bytes: bytes,
    county_subdivisions_bytes: bytes,
    zctas_bytes: bytes,
) -> tuple[list[LocalityRow], list[ZctaRow]]:
    """Normalize and validate the three pinned source files."""
    localities = [*_read_places(places_bytes), *_read_county_subdivisions(county_subdivisions_bytes)]
    zctas = list(_read_zctas(zctas_bytes))

    _require_unique(((row.kind, row.geoid) for row in localities), label="locality source key")
    _require_unique(((row.postal_code,) for row in zctas), label="ZCTA postal code")

    kind_order: dict[LocalityKind, int] = {"place": 0, "county_subdivision": 1}
    localities.sort(key=lambda row: (row.state, row.normalized_name, kind_order[row.kind], row.name, row.geoid))
    zctas.sort(key=lambda row: row.postal_code)
    return localities, zctas


def write_index(
    output_dir: Path,
    *,
    sources: Mapping[str, bytes],
) -> dict[str, object]:
    """Write deterministic CSV artifacts plus integrity metadata."""
    localities, zctas = build_index(
        sources["places"],
        sources["county_subdivisions"],
        sources["zctas"],
    )
    output_dir.mkdir(parents=True, exist_ok=True)
    locality_path = output_dir / f"census_localities_{SOURCE_VINTAGE}.csv"
    zcta_path = output_dir / f"census_zctas_{SOURCE_VINTAGE}.csv"
    metadata_path = output_dir / f"census_localities_{SOURCE_VINTAGE}.metadata.json"

    _write_csv(locality_path, LOCALITY_COLUMNS, (asdict(row) for row in localities))
    _write_csv(zcta_path, ZCTA_COLUMNS, (asdict(row) for row in zctas))

    metadata: dict[str, object] = {
        "schema_version": SCHEMA_VERSION,
        "source_vintage": SOURCE_VINTAGE,
        "county_subdivision_funcstat_allowlist": sorted(COUNTY_SUBDIVISION_FUNCSTAT_ALLOWLIST),
        "place_funcstat_allowlist": sorted(PLACE_FUNCSTAT_ALLOWLIST),
        "sources": {
            key: {"url": SOURCE_URLS[key], "sha256": _sha256(value)}
            for key, value in sorted(sources.items())
        },
        "artifacts": {
            locality_path.name: {"rows": len(localities), "sha256": _sha256(locality_path.read_bytes())},
            zcta_path.name: {"rows": len(zctas), "sha256": _sha256(zcta_path.read_bytes())},
        },
    }
    _atomic_write(metadata_path, (json.dumps(metadata, indent=2, sort_keys=True) + "\n").encode())
    return metadata


def _read_places(data: bytes) -> Iterable[LocalityRow]:
    required = {"USPS", "GEOID", "NAME", "FUNCSTAT", "INTPTLAT", "INTPTLONG"}
    for row in _read_pipe_rows(data, required=required, source="Places"):
        if row["FUNCSTAT"] not in PLACE_FUNCSTAT_ALLOWLIST:
            continue
        yield _locality_row("place", row)


def _read_county_subdivisions(data: bytes) -> Iterable[LocalityRow]:
    required = {"USPS", "GEOID", "NAME", "FUNCSTAT", "INTPTLAT", "INTPTLONG"}
    for row in _read_pipe_rows(data, required=required, source="County Subdivisions"):
        if row["FUNCSTAT"] not in COUNTY_SUBDIVISION_FUNCSTAT_ALLOWLIST:
            continue
        yield _locality_row("county_subdivision", row)


def _read_zctas(data: bytes) -> Iterable[ZctaRow]:
    required = {"GEOID", "INTPTLAT", "INTPTLONG"}
    for row in _read_pipe_rows(data, required=required, source="ZCTAs"):
        postal_code = row["GEOID"].strip()
        if not re.fullmatch(r"\d{5}", postal_code):
            raise ValueError(f"Invalid ZCTA postal code: {postal_code!r}")
        latitude, longitude = _coordinates(row)
        yield ZctaRow(postal_code=postal_code, latitude=latitude, longitude=longitude)


def _locality_row(kind: LocalityKind, row: Mapping[str, str]) -> LocalityRow:
    geoid = row["GEOID"].strip()
    expected_length = 7 if kind == "place" else 10
    if not geoid.isdigit() or len(geoid) != expected_length:
        raise ValueError(f"Invalid {kind} GEOID: {geoid!r}")
    source_name = row["NAME"].strip()
    name = locality_name(source_name)
    if not name:
        raise ValueError(f"Empty locality name for {kind} GEOID {geoid}")
    latitude, longitude = _coordinates(row)
    return LocalityRow(
        kind=kind,
        state=row["USPS"].strip().upper(),
        state_fips=geoid[:2],
        county_fips=geoid[2:5] if kind == "county_subdivision" else "",
        name=name,
        normalized_name=normalize_locality_name(name),
        source_name=source_name,
        geoid=geoid,
        funcstat=row["FUNCSTAT"].strip(),
        latitude=latitude,
        longitude=longitude,
    )


def _coordinates(row: Mapping[str, str]) -> tuple[str, str]:
    latitude_text = row["INTPTLAT"].strip()
    longitude_text = row["INTPTLONG"].strip()
    latitude = float(latitude_text)
    longitude = float(longitude_text)
    if not math.isfinite(latitude) or not math.isfinite(longitude):
        raise ValueError(f"Non-finite coordinates: {latitude_text}, {longitude_text}")
    # Cover the 50 states, DC, Puerto Rico, and island-area/ZCTA extents while
    # excluding structurally valid but clearly non-US points such as (0, 0).
    in_us_longitude_band = -180 <= longitude <= -60 or 130 <= longitude <= 180
    if not -15 <= latitude <= 75 or not in_us_longitude_band:
        raise ValueError(f"Coordinates outside the US Gazetteer extent: {latitude_text}, {longitude_text}")
    return latitude_text, longitude_text


def _read_pipe_rows(data: bytes, *, required: set[str], source: str) -> Iterable[dict[str, str]]:
    text = _extract_text(data)
    reader = csv.DictReader(io.StringIO(text), delimiter="|")
    columns = set(reader.fieldnames or ())
    missing = required - columns
    if missing:
        raise ValueError(f"{source} source is missing columns: {', '.join(sorted(missing))}")
    yield from reader


def _extract_text(data: bytes) -> str:
    if zipfile.is_zipfile(io.BytesIO(data)):
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            members = [name for name in archive.namelist() if not name.endswith("/")]
            if len(members) != 1:
                raise ValueError(f"Expected one Gazetteer file in archive, found {len(members)}")
            data = archive.read(members[0])
    return data.decode("utf-8-sig")


def _write_csv(path: Path, fieldnames: Sequence[str], rows: Iterable[Mapping[str, object]]) -> None:
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=fieldnames, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    _atomic_write(path, buffer.getvalue().encode())


def _atomic_write(path: Path, data: bytes) -> None:
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as handle:
        temporary_path = Path(handle.name)
        handle.write(data)
    temporary_path.chmod(0o644)
    os.replace(temporary_path, path)


def _require_unique(values: Iterable[tuple[str, ...]], *, label: str) -> None:
    seen: set[tuple[str, ...]] = set()
    for value in values:
        if value in seen:
            raise ValueError(f"Duplicate {label}: {'/'.join(value)}")
        seen.add(value)


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _load_source(location: str) -> bytes:
    if location.startswith(("https://", "http://")):
        tls_context = ssl.create_default_context(cafile=certifi.where())
        with urllib.request.urlopen(  # noqa: S310 - pinned Census URLs by default
            location,
            timeout=60,
            context=tls_context,
        ) as response:
            return response.read()
    return Path(location).read_bytes()


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--places-source", default=SOURCE_URLS["places"])
    parser.add_argument("--county-subdivisions-source", default=SOURCE_URLS["county_subdivisions"])
    parser.add_argument("--zctas-source", default=SOURCE_URLS["zctas"])
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "features" / "project_location" / "data",
    )
    args = parser.parse_args(argv)
    source_labels = {
        "places": args.places_source,
        "county_subdivisions": args.county_subdivisions_source,
        "zctas": args.zctas_source,
    }
    sources = {key: _load_source(location) for key, location in source_labels.items()}
    metadata = write_index(args.output_dir, sources=sources)
    artifacts = cast(dict[str, dict[str, object]], metadata["artifacts"])
    print(f"Wrote Census {SOURCE_VINTAGE} locality index to {args.output_dir}")
    for name, details in artifacts.items():
        print(f"- {name}: {details['rows']} rows")


if __name__ == "__main__":
    main()
