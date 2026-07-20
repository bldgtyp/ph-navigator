"""Import-side boundary regression for Honeybee `ref_status` (D-6).

Honeybee-authored files spell the status in upper case (see the `"NA"` values
throughout `tests/fixtures/ph_nav_v2_example.hbjson`), while PH-Navigator's own
native export writes lower case. Both must read back as canonical internal
statuses, and the external `MISSING` must land on `needed`.
"""

from __future__ import annotations

from typing import Any

import pytest

from features.envelope.hbjson_import import parse_construction_library
from features.project_document.document import CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION


def _library(ref_status: object) -> dict[str, Any]:
    material: dict[str, Any] = {
        "type": "EnergyMaterial",
        "identifier": "Insulation",
        "display_name": "Insulation",
        "thickness": 0.1,
        "conductivity": 0.035,
        "density": 30.0,
        "specific_heat": 1000.0,
        "properties": {"ref": {"ref_status": ref_status}},
    }
    return {
        "type": "OpaqueConstruction",
        "identifier": "W_Simple Wall",
        "materials": [material],
        "layers": ["Insulation"],
    }


@pytest.mark.parametrize(
    "ref_status,expected",
    [
        ("MISSING", "needed"),
        ("missing", "needed"),
        ("needed", "needed"),
        ("COMPLETE", "complete"),
        ("NA", "na"),
        ("QUESTION", "question"),
    ],
)
def test_external_ref_status_imports_as_canonical_status(ref_status: str, expected: str) -> None:
    parsed = parse_construction_library(
        _library(ref_status), current_schema_version=CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION
    )

    material = next(iter(parsed.materials.values()))
    assert material.specification_status == expected


@pytest.mark.parametrize("ref_status", ["unknown", "", None, 7])
def test_unreadable_ref_status_leaves_the_status_unset(ref_status: object) -> None:
    """An unset status falls back to the row default at planning time."""

    parsed = parse_construction_library(
        _library(ref_status), current_schema_version=CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION
    )

    material = next(iter(parsed.materials.values()))
    assert material.specification_status is None
