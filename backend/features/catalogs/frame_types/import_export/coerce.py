"""Per-row coercion for frame-types catalog import.

Forgiving: convert what we can, blank what we can't, never fail the
whole import on a single recoverable row. Mirrors
`glazing_types/import_export/coerce.py` with the seventeen-field frame
schema.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from typing import Final

from features.catalogs.frame_types._name import compose_frame_name

_CATALOG_ID_RE: Final[re.Pattern[str]] = re.compile(r"^rec[A-Za-z0-9]{14}$")

_HEX_COLOR_RE: Final[re.Pattern[str]] = re.compile(r"^#[0-9A-Fa-f]{6}$")
_ARGB_TUPLE_RE: Final[re.Pattern[str]] = re.compile(
    r"^\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*$"
)

# Reason codes.
WARN_UNKNOWN_FIELD: Final[str] = "unknown_field"
WARN_BAD_NUMBER: Final[str] = "bad_number"
WARN_BAD_COLOR: Final[str] = "bad_color"
WARN_FIELD_TOO_LONG: Final[str] = "field_too_long"
ERR_BAD_ID: Final[str] = "bad_id"

# Mirrors `_CatalogFrameTypeFields` in models.py. `name` is derived (Phase 3),
# not an input field, so it is absent here.
_FIELD_MAX_LENGTHS: Final[dict[str, int]] = {
    "manufacturer": 200,
    "brand": 200,
    "use": 40,
    "operation": 40,
    "location": 40,
    "mull_type": 40,
    "prefix": 80,
    "suffix": 80,
    "material": 80,
    "source": 400,
    "datasheet_url": 400,
    "comments": 4000,
    "color": 40,
}

_NUMERIC_FIELDS: Final[tuple[str, ...]] = (
    "width_mm",
    "u_value_w_m2k",
    "psi_g_w_mk",
    "psi_install_w_mk",
)

_TEXT_FIELDS: Final[tuple[str, ...]] = (
    "manufacturer",
    "brand",
    "use",
    "operation",
    "location",
    "mull_type",
    "prefix",
    "suffix",
    "material",
    "source",
    "datasheet_url",
    "comments",
)

_CANONICAL_FIELDS: Final[set[str]] = {"name", "color", *_TEXT_FIELDS, *_NUMERIC_FIELDS}


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

    if errors:
        return CoercedRow(row=None, id=row_id, warnings=warnings, errors=errors)

    cleaned: dict[str, object] = {}
    for field_name in _TEXT_FIELDS:
        cleaned[field_name] = _coerce_text(raw.get(field_name), warnings, field_name=field_name)
    for field_name in _NUMERIC_FIELDS:
        cleaned[field_name] = _coerce_number(raw.get(field_name), warnings, allow_negative=False)
    cleaned["color"] = _coerce_color(raw.get("color"), warnings)
    # `name` is derived from the parts (Phase 3), not taken from the file — any
    # inbound `name` is ignored. Computed after the parts are folded + coerced.
    cleaned["name"] = compose_frame_name(cleaned)
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
