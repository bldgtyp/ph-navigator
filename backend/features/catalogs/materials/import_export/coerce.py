"""Per-row coercion and validation for catalog import.

Forgiving by design: convert what we can, blank what we can't, never
fail the whole import on a single recoverable row. The rules are
documented in the Phase 2 plan; this module is the canonical
implementation.

Warning / error reason codes are constants so callers can group by
reason in the preview report.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from typing import Final

from features.catalogs.materials.models import MATERIAL_CATEGORY_IDS

# Catalog row id shape: `rec` + 14 base62 chars. Anything else is
# rejected outright so the importer never invents a valid id from a
# malformed one.
_CATALOG_ID_RE: Final[re.Pattern[str]] = re.compile(r"^rec[A-Za-z0-9]{14}$")

# Built-in label → option-id map for case-insensitive category matching.
# The display labels come straight from the frontend overlay; keep this
# in sync with `frontend/.../materials/fieldDefs.ts` Category options.
_CATEGORY_LABEL_TO_ID: Final[dict[str, str]] = {
    "insulation": "insulation",
    "finishes": "finishes",
    "woods": "woods",
    "metals": "metals",
    "masonry": "masonry",
    "stud-layers (steel)": "stud_layers_steel",
    "stud-layers (wood)": "stud_layers_wood",
    "air: horizontal heat flow": "air_horizontal_heat_flow",
    "air: upward heat flow": "air_upward_heat_flow",
    "air: downward heat flow": "air_downward_heat_flow",
    "rainscreen insulation": "rainscreen_insulation",
    "doors": "doors",
}

_CATEGORY_IDS_LOWER: Final[set[str]] = {cid.lower() for cid in MATERIAL_CATEGORY_IDS}

# Fail-loud guard: if a future PR adds a category id without extending
# the label map, this assertion trips at import time and CI catches it.
# Cheap belt-and-braces — `_CATEGORY_LABEL_TO_ID` and the model's
# `MATERIAL_CATEGORY_IDS` must enumerate the same id set.
assert set(_CATEGORY_LABEL_TO_ID.values()) == set(MATERIAL_CATEGORY_IDS), (
    "import coerce label→id map drifted from MATERIAL_CATEGORY_IDS; update _CATEGORY_LABEL_TO_ID in coerce.py"
)

_HEX_COLOR_RE: Final[re.Pattern[str]] = re.compile(r"^#[0-9A-Fa-f]{6}$")
_ARGB_TUPLE_RE: Final[re.Pattern[str]] = re.compile(
    r"^\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*$"
)

# Reason codes — used to group warnings in the preview report.
WARN_UNKNOWN_FIELD: Final[str] = "unknown_field"
WARN_UNKNOWN_CATEGORY: Final[str] = "unknown_category"
WARN_BAD_NUMBER: Final[str] = "bad_number"
WARN_EMISSIVITY_RANGE: Final[str] = "emissivity_range"
WARN_BAD_COLOR: Final[str] = "bad_color"
# Field length cap exceeded. Mirrors `_CatalogMaterialFields`
# max_length policy so the import path cannot land values the
# create/update API would later refuse to PATCH.
WARN_FIELD_TOO_LONG: Final[str] = "field_too_long"
ERR_BAD_ID: Final[str] = "bad_id"
ERR_MISSING_NAME: Final[str] = "missing_name"
# category is NOT NULL + CHECK-constrained at the DB. A blank category
# after coerce is unrecoverable: we surface the `unknown_category`
# warning for the *reason* and ALSO mark the row errored so it is
# excluded from the write set.
ERR_MISSING_CATEGORY: Final[str] = "missing_category"

# Mirrors `_CatalogMaterialFields` (`models.py`) so the import path
# enforces the same caps the create/update API does. Drift here would
# let imports land values that later PATCH calls would 422-reject.
_FIELD_MAX_LENGTHS: Final[dict[str, int]] = {
    "name": 200,
    "source": 400,
    "url": 2000,
    "comments": 4000,
    "color": 40,
}

# Canonical field set after coercion — also the projection persisted
# to the DB on commit. `id` is excluded; it's tracked separately.
_CANONICAL_FIELDS: Final[set[str]] = {
    "name",
    "category",
    "density_kg_m3",
    "specific_heat_j_kgk",
    "conductivity_w_mk",
    "emissivity",
    "color",
    "source",
    "url",
    "comments",
}


@dataclass
class CoercedRow:
    """Per-row coerce output.

    `row` is the cleaned canonical dict (None if the row was errored).
    `id` is the optional well-formed catalog id (None means: assign on
    insert). `warnings` and `errors` are reason-code lists used by the
    preview report.
    """

    row: dict[str, object] | None
    id: str | None
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def coerce_row(raw: dict[str, object]) -> CoercedRow:
    """Apply the per-row rules. Pure; no DB access."""
    warnings: list[str] = []
    errors: list[str] = []

    # Detect unknown keys before we start projecting.
    for key in raw:
        if key == "id":
            continue
        if key not in _CANONICAL_FIELDS:
            warnings.append(f"{WARN_UNKNOWN_FIELD}:{key}")

    # id — optional; if present must match the rec-shape.
    row_id: str | None = None
    raw_id = raw.get("id")
    if raw_id is not None:
        if not isinstance(raw_id, str) or not _CATALOG_ID_RE.fullmatch(raw_id):
            errors.append(ERR_BAD_ID)
        else:
            row_id = raw_id

    # name — required.
    raw_name = raw.get("name")
    name: str | None = None
    if isinstance(raw_name, str):
        stripped = raw_name.strip()
        if stripped:
            name = stripped
    if name is not None and len(name) > _FIELD_MAX_LENGTHS["name"]:
        # Oversize required field → blank it + warning → falls through
        # to missing_name error below. Symmetric with how other oversize
        # values blank-and-warn.
        warnings.append(f"{WARN_FIELD_TOO_LONG}:name")
        name = None
    if name is None:
        errors.append(ERR_MISSING_NAME)

    # category — resolve against ids first, then labels. Tracked
    # before the early `errors` exit so the user sees the
    # `unknown_category` warning even for rows already errored on
    # name/id.
    category = _coerce_category(raw.get("category"), warnings)
    if category is None:
        errors.append(ERR_MISSING_CATEGORY)

    if errors:
        # Errored rows do not need full coercion of the remaining
        # fields. The preview report only needs reason codes for them.
        return CoercedRow(row=None, id=row_id, warnings=warnings, errors=errors)

    # numerics — coerce strings, blank on failure / out-of-range.
    density = _coerce_number(raw.get("density_kg_m3"), warnings, allow_negative=False)
    specific_heat = _coerce_number(raw.get("specific_heat_j_kgk"), warnings, allow_negative=False)
    conductivity = _coerce_number(raw.get("conductivity_w_mk"), warnings, allow_negative=False)
    emissivity = _coerce_emissivity(raw.get("emissivity"), warnings)

    color = _coerce_color(raw.get("color"), warnings)

    cleaned: dict[str, object] = {
        "name": name,
        "category": category,
        "density_kg_m3": density,
        "specific_heat_j_kgk": specific_heat,
        "conductivity_w_mk": conductivity,
        "emissivity": emissivity,
        "color": color,
        "source": _coerce_text(raw.get("source"), warnings, field="source"),
        "url": _coerce_text(raw.get("url"), warnings, field="url"),
        "comments": _coerce_text(raw.get("comments"), warnings, field="comments"),
    }
    return CoercedRow(row=cleaned, id=row_id, warnings=warnings, errors=[])


def _coerce_category(value: object, warnings: list[str]) -> str | None:
    if value is None:
        # category is required by the catalog DB CHECK, but absence in
        # the file is treated like an unknown value: blank + warning.
        # The preview surfaces this; the user can fix it before commit
        # by editing the file. (We intentionally do NOT mark this as
        # `errored` — it is recoverable and consistent with how other
        # type narrowings behave.)
        warnings.append(WARN_UNKNOWN_CATEGORY)
        return None
    if not isinstance(value, str):
        warnings.append(WARN_UNKNOWN_CATEGORY)
        return None
    candidate = value.strip().lower()
    if candidate in _CATEGORY_IDS_LOWER:
        return candidate
    label_hit = _CATEGORY_LABEL_TO_ID.get(candidate)
    if label_hit is not None:
        return label_hit
    warnings.append(WARN_UNKNOWN_CATEGORY)
    return None


def _coerce_number(value: object, warnings: list[str], *, allow_negative: bool) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        # bool is a subclass of int; explicitly reject so True/False
        # don't sneak in as 1.0/0.0.
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


def _coerce_emissivity(value: object, warnings: list[str]) -> float | None:
    numeric = _coerce_number(value, warnings, allow_negative=False)
    if numeric is None:
        return None
    if numeric > 1.0:
        warnings.append(WARN_EMISSIVITY_RANGE)
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
        # Legacy ARGB tuple "a,r,g,b". Treat alpha=0 as the legacy
        # exporter's "no color set" sentinel and return None rather
        # than collapsing every transparent row to opaque #000000 —
        # the reference WUFI CSV uses (255,255,255,0) and similar
        # tuples that should not all surface as black.
        a, r, g, b = (int(component) for component in argb_match.groups())
        if a == 0:
            return None
        if all(0 <= component <= 255 for component in (r, g, b)):
            return f"#{r:02x}{g:02x}{b:02x}"
    warnings.append(WARN_BAD_COLOR)
    return None


def _coerce_text(value: object, warnings: list[str], *, field: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    if not stripped:
        return None
    cap = _FIELD_MAX_LENGTHS.get(field)
    if cap is not None and len(stripped) > cap:
        warnings.append(f"{WARN_FIELD_TOO_LONG}:{field}")
        return None
    return stripped
