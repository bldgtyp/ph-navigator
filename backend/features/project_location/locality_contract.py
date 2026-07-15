"""Shared schema constants for Census locality artifact generation and loading."""

from __future__ import annotations

import re
import unicodedata
from typing import Literal

SOURCE_VINTAGE = "2025"
SCHEMA_VERSION = 1
LocalityKind = Literal["place", "county_subdivision"]
LOCALITY_KIND_ORDER: dict[LocalityKind, int] = {"place": 0, "county_subdivision": 1}
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


def normalize_locality_name(value: str) -> str:
    """Return the accent-insensitive, punctuation-normalized match key."""
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return " ".join(re.sub(r"[^a-z0-9]+", " ", ascii_value.casefold()).split())
