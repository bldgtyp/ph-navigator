"""Permanent Honeybee ``ref_status`` format-compatibility contract (D-6)."""

from __future__ import annotations

import pytest

from features.envelope.honeybee_specification_status import (
    from_external_ref_status,
    to_external_ref_status,
    to_native_ref_status,
)
from features.project_document.document import SpecificationStatus


@pytest.mark.parametrize(
    "internal,external",
    [("needed", "MISSING"), ("complete", "COMPLETE"), ("question", "QUESTION"), ("na", "NA")],
)
def test_internal_status_exports_as_a_honeybee_token(internal: SpecificationStatus, external: str) -> None:
    assert to_external_ref_status(internal) == external
    assert to_native_ref_status(internal) == external.lower()


@pytest.mark.parametrize(
    "external,internal",
    [
        ("MISSING", "needed"),
        ("missing", "needed"),
        ("needed", "needed"),
        ("NA", "na"),
        ("Complete", "complete"),
        ("  QUESTION  ", "question"),
    ],
)
def test_honeybee_and_legacy_tokens_import_as_canonical_statuses(external: str, internal: str) -> None:
    assert from_external_ref_status(external) == internal


@pytest.mark.parametrize("value", ["unknown", "", None, 3])
def test_unreadable_ref_status_imports_as_none(value: object) -> None:
    assert from_external_ref_status(value) is None


@pytest.mark.parametrize("internal", ["needed", "complete", "question", "na"])
def test_export_import_round_trip_preserves_the_internal_status(internal: SpecificationStatus) -> None:
    assert from_external_ref_status(to_external_ref_status(internal)) == internal
    assert from_external_ref_status(to_native_ref_status(internal)) == internal
