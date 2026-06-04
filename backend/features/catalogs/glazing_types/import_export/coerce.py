"""Per-row coercion for glazing-types catalog import.

Forgiving: convert what we can, blank what we can't, never fail the
whole import on a single recoverable row. Mirrors
`materials/import_export/coerce.py` minus category handling.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from typing import Final

_CATALOG_ID_RE: Final[re.Pattern[str]] = re.compile(r"^rec[A-Za-z0-9]{14}$")

_HEX_COLOR_RE: Final[re.Pattern[str]] = re.compile(r"^#[0-9A-Fa-f]{6}$")
_ARGB_TUPLE_RE: Final[re.Pattern[str]] = re.compile(
    r"^\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*$"
)

# Reason codes.
WARN_UNKNOWN_FIELD: Final[str] = "unknown_field"
WARN_BAD_NUMBER: Final[str] = "bad_number"
WARN_G_VALUE_RANGE: Final[str] = "g_value_range"
WARN_BAD_COLOR: Final[str] = "bad_color"
WARN_FIELD_TOO_LONG: Final[str] = "field_too_long"
ERR_BAD_ID: Final[str] = "bad_id"
ERR_MISSING_NAME: Final[str] = "missing_name"

# Mirrors `_CatalogGlazingTypeFields` in models.py.
_FIELD_MAX_LENGTHS: Final[dict[str, int]] = {
    "name": 200,
    "manufacturer": 200,
    "brand": 200,
    "suffix": 80,
    "source": 400,
    "comments": 4000,
    "color": 40,
}

_CANONICAL_FIELDS: Final[set[str]] = {
    "name",
    "manufacturer",
    "brand",
    "suffix",
    "u_value_w_m2k",
    "g_value",
    "color",
    "source",
    "comments",
}


@dataclass
class CoercedRow:
    row: dict[str, object] | None
    id: str | None
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def coerce_row(raw: dict[str, object]) -> CoercedRow:
    warnings: list[str] = []
    errors: list[str] = []

    for key in raw:
        if key == "id":
            continue
        if key not in _CANONICAL_FIELDS:
            warnings.append(f"{WARN_UNKNOWN_FIELD}:{key}")

    row_id: str | None = None
    raw_id = raw.get("id")
    if raw_id is not None:
        if not isinstance(raw_id, str) or not _CATALOG_ID_RE.fullmatch(raw_id):
            errors.append(ERR_BAD_ID)
        else:
            row_id = raw_id

    raw_name = raw.get("name")
    name: str | None = None
    if isinstance(raw_name, str):
        stripped = raw_name.strip()
        if stripped:
            name = stripped
    if name is not None and len(name) > _FIELD_MAX_LENGTHS["name"]:
        warnings.append(f"{WARN_FIELD_TOO_LONG}:name")
        name = None
    if name is None:
        errors.append(ERR_MISSING_NAME)

    if errors:
        return CoercedRow(row=None, id=row_id, warnings=warnings, errors=errors)

    u_value = _coerce_number(raw.get("u_value_w_m2k"), warnings, allow_negative=False)
    g_value = _coerce_g_value(raw.get("g_value"), warnings)
    color = _coerce_color(raw.get("color"), warnings)

    cleaned: dict[str, object] = {
        "name": name,
        "manufacturer": _coerce_text(raw.get("manufacturer"), warnings, field_name="manufacturer"),
        "brand": _coerce_text(raw.get("brand"), warnings, field_name="brand"),
        "suffix": _coerce_text(raw.get("suffix"), warnings, field_name="suffix"),
        "u_value_w_m2k": u_value,
        "g_value": g_value,
        "color": color,
        "source": _coerce_text(raw.get("source"), warnings, field_name="source"),
        "comments": _coerce_text(raw.get("comments"), warnings, field_name="comments"),
    }
    return CoercedRow(row=cleaned, id=row_id, warnings=warnings, errors=[])


def _coerce_number(value: object, warnings: list[str], *, allow_negative: bool) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        warnings.append(WARN_BAD_NUMBER)
        return None
    if isinstance(value, (int, float)):
        numeric = float(value)
    elif isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None
        try:
            numeric = float(stripped)
        except ValueError:
            warnings.append(WARN_BAD_NUMBER)
            return None
    else:
        warnings.append(WARN_BAD_NUMBER)
        return None
    if not math.isfinite(numeric) or (not allow_negative and numeric < 0):
        warnings.append(WARN_BAD_NUMBER)
        return None
    return numeric


def _coerce_g_value(value: object, warnings: list[str]) -> float | None:
    numeric = _coerce_number(value, warnings, allow_negative=False)
    if numeric is None:
        return None
    if numeric > 1.0:
        warnings.append(WARN_G_VALUE_RANGE)
        return None
    return numeric


def _coerce_color(value: object, warnings: list[str]) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        warnings.append(WARN_BAD_COLOR)
        return None
    stripped = value.strip()
    if not stripped:
        return None
    if _HEX_COLOR_RE.fullmatch(stripped):
        return stripped.lower()
    argb_match = _ARGB_TUPLE_RE.fullmatch(stripped)
    if argb_match is not None:
        a, r, g, b = (int(component) for component in argb_match.groups())
        if a == 0:
            return None
        if all(0 <= component <= 255 for component in (r, g, b)):
            return f"#{r:02x}{g:02x}{b:02x}"
    warnings.append(WARN_BAD_COLOR)
    return None


def _coerce_text(value: object, warnings: list[str], *, field_name: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    if not stripped:
        return None
    cap = _FIELD_MAX_LENGTHS.get(field_name)
    if cap is not None and len(stripped) > cap:
        warnings.append(f"{WARN_FIELD_TOO_LONG}:{field_name}")
        return None
    return stripped
