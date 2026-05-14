"""Unit tests for shared catalog primitives (TB-08.a)."""

from __future__ import annotations

import re

from features.catalogs._shared import (
    CATALOG_RECORD_ID_PREFIX,
    new_catalog_record_id,
    new_catalog_version_id,
)
from features.catalogs.frame_types.models import CATALOG_VERSION_ID_PREFIX as FRAME_VERSION_PREFIX
from features.catalogs.glazing_types.models import CATALOG_VERSION_ID_PREFIX as GLAZING_VERSION_PREFIX
from features.catalogs.materials.models import CATALOG_VERSION_ID_PREFIX as MATERIAL_VERSION_PREFIX

_RECORD_ID_PATTERN = re.compile(r"^rec[A-Za-z0-9]{14}$")


def test_new_catalog_record_id_matches_airtable_shape() -> None:
    """`rec` + 14 base62 chars — matches AirTable so V1 imports drop in unchanged."""
    for _ in range(100):
        record_id = new_catalog_record_id()
        assert _RECORD_ID_PATTERN.match(record_id), record_id
        assert record_id.startswith(CATALOG_RECORD_ID_PREFIX)
        assert len(record_id) == 17


def test_new_catalog_record_id_is_unique_across_calls() -> None:
    """Each call returns a fresh id; collisions are astronomically rare."""
    ids = {new_catalog_record_id() for _ in range(1000)}
    assert len(ids) == 1000


def test_version_ids_keep_v2_native_table_prefix() -> None:
    """Versions are V2-native because AirTable has no version concept; the
    table prefix keeps them self-documenting (`matv_` / `framev_` / `glazingv_`).
    """
    assert MATERIAL_VERSION_PREFIX == "matv_"
    assert FRAME_VERSION_PREFIX == "framev_"
    assert GLAZING_VERSION_PREFIX == "glazingv_"

    for prefix in (MATERIAL_VERSION_PREFIX, FRAME_VERSION_PREFIX, GLAZING_VERSION_PREFIX):
        version_id = new_catalog_version_id(prefix)
        assert version_id.startswith(prefix)
        # Body is url-safe base64 of 12 random bytes -> 16 chars.
        assert len(version_id) > len(prefix)
