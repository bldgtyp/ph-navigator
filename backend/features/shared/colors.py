"""Shared color validation helpers.

PH-Navigator stores editable colors as nullable sRGB hex strings. The
backend accepts only expanded six-digit values so API and document JSON
stay canonical; short `#rgb` input is frontend sugar only.
"""

from __future__ import annotations

import re

HEX_COLOR_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")


def normalize_hex_color(value: str) -> str:
    stripped = value.strip()
    if not HEX_COLOR_PATTERN.fullmatch(stripped):
        raise ValueError("color must be a 6-digit hex string like #rrggbb")
    return stripped.lower()


def normalize_optional_hex_color(value: object) -> object:
    if value is None:
        return None
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None
        return normalize_hex_color(stripped)
    return value
