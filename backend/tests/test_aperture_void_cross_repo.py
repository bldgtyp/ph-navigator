"""Cross-repo contract smoke for PH-Navigator aperture exports.

The companion Grasshopper repository is optional in CI. When it is checked out
beside this repository (or supplied through ``HBPH_PLUS_REPO``), this test
parses the real route-3 serializer output with the unmodified deployed V1
schema.
"""

from __future__ import annotations

import importlib.util
import os
from pathlib import Path
from types import ModuleType

import pytest

from features.aperture_hbjson_export.service import export_apertures
from features.gh_api.aperture_types_export import export_aperture_types
from tests.aperture_void_fixtures import aperture_void_document, s15_aperture

_DEFAULT_HBPH_PLUS_REPO = Path(__file__).parents[2].parent / "honeybee_grasshopper_ph_plus"
_HBPH_PLUS_REPO = Path(os.environ.get("HBPH_PLUS_REPO", _DEFAULT_HBPH_PLUS_REPO))
_GH_SCHEMA_PATH = (
    _HBPH_PLUS_REPO / "honeybee_ph_plus_rhino" / "gh_compo_io" / "ph_navigator" / "v1" / "window_types_schema.py"
)


def _load_unmodified_gh_schema() -> ModuleType:
    spec = importlib.util.spec_from_file_location("hbph_plus_window_types_schema", _GH_SCHEMA_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load Grasshopper schema from {_GH_SCHEMA_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.skipif(not _GH_SCHEMA_PATH.is_file(), reason="companion HBPH+ repository is not checked out")
def test_s15_exports_parse_with_gh_schema_and_preserve_absolute_placement() -> None:
    body = aperture_void_document()
    aperture = s15_aperture()
    body.tables.apertures = [aperture]

    route_3_payload = export_aperture_types(body)["S15"]
    schema = _load_unmodified_gh_schema()
    parsed = schema.ApertureTypeData.from_dict(route_3_payload)

    assert {element.column_number for element in parsed.elements} == {0, 1, 2, 3}
    assert {element.name for element in parsed.elements}.isdisjoint({"aptel_left_empty", "aptel_right_empty"})
    assert {
        element.name: (element.column_number, element.row_number, element.column_span, element.row_span)
        for element in parsed.elements
    } == {
        "aptel_left_sidelite": (0, 1, 1, 3),
        "aptel_left_door": (1, 0, 1, 4),
        "aptel_right_door": (2, 0, 1, 4),
        "aptel_right_sidelite": (3, 1, 1, 3),
    }

    glazed_count = sum(element.kind == "glazed" for element in aperture.elements)
    route_4_payload = export_apertures([aperture], body.tables)
    assert len(route_4_payload) == glazed_count == 4
    assert all(value["type"] == "WindowConstruction" for value in route_4_payload.values())
