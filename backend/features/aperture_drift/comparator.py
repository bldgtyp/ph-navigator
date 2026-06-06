"""Field-by-field comparison of project refs against their catalog rows.

The comparator returns the list of differing field keys plus per-field
``in_local_overrides`` flag so the dialog can default user-edited fields
to *Keep mine*. Catalog-only fields (id, audit columns) are explicitly
excluded; only the typed values that round-trip from catalog row →
project ref are compared.
"""

from __future__ import annotations

from typing import Any

from features.aperture_drift.models import RefFieldDelta
from features.project_document.document import FrameRef, GlazingRef

# Keys compared between FrameRef and a catalog frame row. ``name`` is
# included because the catalog Name can be renamed in place (TB-09.a) and
# the user benefits from seeing the change even though it is mostly
# cosmetic.
_FRAME_KEYS: tuple[str, ...] = (
    "name",
    "manufacturer",
    "brand",
    "use",
    "operation",
    "location",
    "mull_type",
    "prefix",
    "suffix",
    "material",
    "width_mm",
    "u_value_w_m2k",
    "psi_g_w_mk",
    "psi_install_w_mk",
    "color",
    "source",
    "comments",
)

_GLAZING_KEYS: tuple[str, ...] = (
    "name",
    "manufacturer",
    "brand",
    "suffix",
    "u_value_w_m2k",
    "g_value",
    "color",
    "source",
    "comments",
)


def compare_frame_ref(ref: FrameRef, row: dict[str, Any]) -> list[RefFieldDelta]:
    """Return the list of fields where ``ref`` differs from the catalog row.

    The catalog row is the repository's ``dict[str, Any]`` projection
    (not the public Pydantic model) so the comparator can be called
    directly from the route layer without round-tripping through
    ``CatalogFrameTypePublic``.
    """

    return _compare(ref, row, _FRAME_KEYS)


def compare_glazing_ref(ref: GlazingRef, row: dict[str, Any]) -> list[RefFieldDelta]:
    return _compare(ref, row, _GLAZING_KEYS)


def _compare(
    ref: FrameRef | GlazingRef,
    row: dict[str, Any],
    keys: tuple[str, ...],
) -> list[RefFieldDelta]:
    overrides = set(ref.catalog_origin.local_overrides) if ref.catalog_origin else set()
    deltas: list[RefFieldDelta] = []
    for key in keys:
        ours = getattr(ref, key)
        theirs = row.get(key)
        if _values_equal(ours, theirs):
            continue
        deltas.append(
            RefFieldDelta(
                field_key=key,
                catalog_value=theirs,
                yours_value=ours,
                in_local_overrides=key in overrides,
            )
        )
    return deltas


def _values_equal(a: object, b: object) -> bool:
    # Floats from the catalog may round-trip with trailing zero; compare
    # numeric values with a tight tolerance so a 0.04 vs 0.0400 delta
    # doesn't trip the drift flag.
    if isinstance(a, float) and isinstance(b, float):
        return abs(a - b) < 1e-9
    if isinstance(a, float) and isinstance(b, int):
        return abs(a - float(b)) < 1e-9
    if isinstance(a, int) and isinstance(b, float):
        return abs(float(a) - b) < 1e-9
    return a == b
