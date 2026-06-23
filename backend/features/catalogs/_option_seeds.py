"""Frozen single-select vocabularies + seed-cleanup mapping for the frame-types
catalog.

This module is the **single source of truth** for the
``window-frames-catalog-enums`` refactor (planning/refactor/). Two independent
consumers read it verbatim, so it lives in one place to keep them from drifting:

- **Option-store seed** (Phase 1) reads ``FRAME_TYPE_OPTION_SEEDS`` to populate
  the initial dropdown lists in ``catalog_field_options``.
- **Import upgrade** (Phase 4) reads ``FRAME_TYPE_VALUE_FOLDS`` (plus the two
  row-level special cases below) to fold legacy/typo seed values into the
  canonical options before validation + name composition.

If the seed lists and the fold map ever disagree, write-validation (Phase 2)
rejects seed rows — so both halves are frozen together here, derived from the
distinct values actually present in ``seeds/catalogs/frame-types.v1.json``
(research §1) and the decisions D-1 (all six strict) / D-6 (clean up artifacts).

All values are generic, public-repo-safe reference data — no PHI/PHPP/licensed
product data (project CLAUDE.md public-repo rule).
"""

from __future__ import annotations

from typing import Final

# --------------------------------------------------------------------------- #
# Deliverable A — canonical option sets (display order = option `order`).
# --------------------------------------------------------------------------- #
# Low-cardinality controlled vocabularies (curated; rarely extended) and the
# high-cardinality supplier fields (`manufacturer`/`brand`, extended inline via
# D-4). `material`, `prefix`, `suffix` are NOT here — they stay free text and
# feed the composed name as raw fragments (Phase 3).
FRAME_TYPE_OPTION_SEEDS: Final[dict[str, list[str]]] = {
    "use": ["Door", "Window", "Lift & Slide", "Curtain Wall", "Skylight", "Sidelite"],
    "operation": [
        "Inswing",
        "Outswing",
        "Casement",
        "Fixed",
        "Tilt-Turn",
        "Sliding",
        "Double-Hung",
    ],
    "location": ["Head", "Jamb", "Sill", "Mull-V", "Mull-H", "Any"],
    "mull_type": ["OP-to-OP", "OP-to-FX", "FX-to-FX"],
    "manufacturer": [
        "Alpen",
        "Curries",
        "Internorm",
        "Intus",
        "Kawneer",
        "Lamilux",
        "Mercury",
        "Rehau",
        "smartwin",
        "Tishler",
        "Viking",
        "Wythe",
        "Zola",
    ],
    "brand": [
        "Tyrol",
        "Zenith",
        "Mercury",
        "HF510 - Home Pure",
        "HS330",
        "Supera",
        "1600 UT CW Alu PP",
        "1600 UT CW FG PP",
        "FE",
        "Artevo",
        "compact",
        "entrance",
        "sliding",
        "Sipo Mahogany",
        "Innova",
        "SW14",
        "SW17",
        "PremiSlide",
        "Stuyvesant",
        "ThermoPlus Clad II",
        "SDH",
        "Thermo Wood",
        "ThermoPlus Clad III",
    ],
}

# The six promoted single-select fields (D-1). `source` is folded for casing
# below but is NOT promoted — it stays free text and is not seeded as options.
FRAME_TYPE_SINGLE_SELECT_FIELDS: Final[tuple[str, ...]] = (
    "manufacturer",
    "brand",
    "use",
    "operation",
    "location",
    "mull_type",
)

# --------------------------------------------------------------------------- #
# Deliverable B — fold mapping (dirty seed value -> canonical).
# --------------------------------------------------------------------------- #
# Value-level folds, keyed ``field -> lower(btrim(dirty)) -> canonical``. Apply
# case-insensitively on trimmed input, so ``"OP-TO-FIX"`` and ``"op-to-fix "``
# both map. This is the only place casing/typo knowledge lives; everything
# downstream of the import upgrade sees canonical labels.
FRAME_TYPE_VALUE_FOLDS: Final[dict[str, dict[str, str]]] = {
    "mull_type": {"op-to-fix": "OP-to-FX"},
    # `source` is free text (not one of the six) — fold casing only.
    "source": {"manufacturer": "Manufacturer"},
}

# Row-level cleanups the value-fold map can't express (handled explicitly in the
# Phase 4 import upgrade step):
#
# - The transposed ``Mercury | CURRIES`` rows have manufacturer/brand swapped;
#   rewrite to the correct ``(Curries, Mercury)`` pair. ``CURRIES`` therefore
#   never survives as a `brand` option, and ``Mercury`` survives as a brand.
FRAME_TYPE_SWAPPED_MANUFACTURER_BRAND: Final[dict[str, tuple[str, str]]] = {
    # dirty (manufacturer, brand): canonical (manufacturer, brand)
    "dirty": ("Mercury", "CURRIES"),
    "canonical": ("Curries", "Mercury"),
}

# - The ``Default`` artifact manufacturer row is dropped entirely. It is distinct
#   from the ``PHN-Default-Frame`` sentinel (``recPHNDefFrame001``); D-5 makes
#   that sentinel the real default, resolved by id, so ``Default`` must not
#   survive as a manufacturer option.
FRAME_TYPE_DROP_MANUFACTURERS: Final[frozenset[str]] = frozenset({"Default"})
