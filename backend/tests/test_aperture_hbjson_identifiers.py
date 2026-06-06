"""Unit tests for the HBJSON identifier escape rule and collision detection.

The escape rule is a stable contract (PRD §17 / §21 decision 17);
these tests pin it down so regressions surface immediately.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from features.aperture_hbjson_export.identifiers import (
    Collision,
    detect_collisions,
    escape_hbjson_identifier,
)


def test_escape_replaces_space() -> None:
    assert escape_hbjson_identifier("Door A") == "Door_A"


def test_escape_replaces_slash() -> None:
    assert escape_hbjson_identifier("Type B/2") == "Type_B_2"


def test_escape_collapses_runs() -> None:
    assert escape_hbjson_identifier("Door  A--B") == "Door_A_B"


def test_escape_strips_leading_and_trailing_underscores() -> None:
    assert escape_hbjson_identifier("-Door A-") == "Door_A"


def test_escape_preserves_underscores_already_present() -> None:
    assert escape_hbjson_identifier("CW01_North") == "CW01_North"


def test_escape_empty_result_raises_422() -> None:
    with pytest.raises(HTTPException) as exc:
        escape_hbjson_identifier("---")
    assert exc.value.status_code == 422
    detail = exc.value.detail
    assert isinstance(detail, dict)
    assert detail["error_code"] == "aperture_hbjson_identifier_empty"


def test_detect_collisions_returns_empty_when_unique() -> None:
    assert detect_collisions([("Door_A_C0_R0", "Door A"), ("Door_A_C1_R0", "Door A")]) == []


def test_detect_collisions_identifies_pair() -> None:
    pairs = [("Door_A_C0_R0", "Door A"), ("Door_A_C0_R0", "Door-A")]
    collisions = detect_collisions(pairs)
    assert collisions == [Collision(escaped="Door_A_C0_R0", first="Door A", second="Door-A")]


def test_detect_collisions_ignores_same_source_repeats() -> None:
    # Two elements from the same aperture name reach the same key only when
    # column / row indices already collide — that's caller error, not a
    # name collision. The helper treats identical sources as not a collision.
    pairs = [("Door_A_C0_R0", "Door A"), ("Door_A_C0_R0", "Door A")]
    assert detect_collisions(pairs) == []
