"""Frozen single-select vocabularies + seed-cleanup mapping for the frame-types
and glazing-types catalogs.

This module is the **single source of truth** for the
``window-frames-catalog-enums`` and ``window-glass-catalog-enums`` refactors.
The frame constants come first, the ``GLAZING_TYPE_*`` twins follow. Two
independent consumers read each set verbatim, so they live in one place to keep
from drifting:

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


# =========================================================================== #
# Window-Glazing (window-glass-catalog-enums) — the glazing twin of the frame
# refactor above. Only `manufacturer` + `brand` are promoted (D-1); `suffix`
# stays free text and feeds the composed name as a raw fragment (Phase 3). Both
# halves below are derived from the distinct values present in
# ``seeds/catalogs/glazing-types.v1.json`` after the Phase 0 cleanup, so the
# seed and the option set agree exactly (a mismatch is rejected by Phase 2
# write-validation).
# =========================================================================== #
GLAZING_TYPE_OPTION_SEEDS: Final[dict[str, list[str]]] = {
    "manufacturer": [
        "Alpen",
        "Internorm",
        "Intus",
        "Kawneer",
        "Lamilux",
        "Lepage",
        "Mercury",
        "Rehau",
        "smartwin",
        "Tishler",
        "Viking",
        "Wythe",
        "Zola",
    ],
    # ~39 near-unique glass make-up strings (each used by ~one row). Strict
    # single-select gives little grouping benefit here (D-1) and leans on
    # frictionless inline-add; the list is the exact distinct seed `brand`
    # values, in seed order.
    "brand": [
        '1-3/8" OA, SolarControl-6 TGT, Triple Pane, Argon Fill, Tempered, 3/16"',
        'SolarControl-6 TGT, Triple Pane, Argon Fill, Annealed, 1/8"',
        'SolarControl-6 TGT, Triple Pane, Argon Fill, Tempered, 3/16"',
        "6-18Ar-4-16Ar-4",
        "6t-15Ar-6t-15Ar-6t",
        "6t-18Ar-4t-16Ar-4t",
        "Door Panel",
        "6_CG/12Ar/4/16Ar/CG_4",
        "6T_CG/12Ar/4T/16Ar/CG_4T",
        "44.1_Sn51/20AR/4",
        "44.2_CG/12Ar/4/14Ar/CG_6",
        "44.2_CG/12Ar/4T/14Ar/CG_6T",
        "44.6_CG/10Ar/4/14Ar/CG_6",
        "44.6_CG/10Ar/6T/12Ar/CG_6T",
        "Frit_4T4T.4_SN51/20Ar/4",
        "Frit_4T4T.6_CG/10Ar/6T/12Ar/CG_6T",
        "LOUVER",
        "GL-1",
        "GL-2",
        "GL-3",
        "GL-4",
        "GL-5",
        "U-0.9",
        "272-Arg-Cl-Arg-272",
        "TRIO-E",
        "6/SB70(2)T/16Ar/10 EA(4)T",
        "6SKN-18AR-4-18AR-4XN",
        "48mm 4 S,18 TGI,4,18 TGI,4 XN",
        "48mm 4 XN,18,4 ,18, XN4 (1.9 in)",
        "48mm ESG 4 XN,18,4 ESG,18, XN4 ESG (1.9 in)",
        "48mm ESG 6XN,16,6 ESG, 14, XN6 ESG (1.9 in)",
        "Double-Glazing",
        "4/18/4/20/4 U-0.47, g 0.39",
        "4/20/4/20/4 U-0.470, g-0.373",
        "33.1/16/4/18/4 U-0.499, g-0.38",
        "Cardinal 5-272/12/5/12/180-5",
        "4-18Ar-4-18Ar-4",
        "6/16/4/18/4 U-0.525, g-0.34",
        "6/18/4/20/4 U-0.493, g-0.34",
    ],
}

# The two promoted single-select fields (D-1).
GLAZING_TYPE_SINGLE_SELECT_FIELDS: Final[tuple[str, ...]] = ("manufacturer", "brand")

# Fold map: lower(btrim(dirty)) -> canonical, applied case-insensitively in the
# Phase 4 import upgrade. Casing only — glazing has no typo-class folds like
# frame's ``OP-TO-FIX``.
GLAZING_TYPE_VALUE_FOLDS: Final[dict[str, dict[str, str]]] = {
    "manufacturer": {"intus": "Intus", "zola": "Zola"},
}

# The two ``DEFAULT`` artifact rows are dropped on import (D-6), mirroring
# frame's ``FRAME_TYPE_DROP_MANUFACTURERS``. The single default is the
# ``PHN-Default-Glass`` sentinel (``recPHNDefGlazng01``), resolved by id, not a
# catalog manufacturer option — so ``DEFAULT`` must not survive. The value is
# upper-case to match the glazing seed's raw ``DEFAULT`` rows (frame's artifact
# was title-case ``Default``); the Phase 4 drop check compares the seed value
# verbatim.
GLAZING_TYPE_DROP_MANUFACTURERS: Final[frozenset[str]] = frozenset({"DEFAULT"})
