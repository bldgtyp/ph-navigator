"""Content-hash + LRU cache for ``calculate_aperture_u_values``.

The cache key is a SHA-256 over the canonical-JSON representation of
the U-Value-affecting subtree. ``operation`` and ``name`` are
explicitly excluded so toggling operation type or renaming an element
does not invalidate the cache (PRD §14).

Cache is process-local with a 256-entry FIFO bound — enough for
multi-aperture documents on a single request, small enough that
worst-case memory is trivial. The eviction policy is FIFO (insertion
order) rather than strict LRU; the simpler policy is plenty for the
read patterns here.
"""

from __future__ import annotations

import hashlib
import json
from collections import OrderedDict
from typing import TypeVar

from features.project_document.document import (
    ApertureTypeEntry,
    FrameRef,
    GlazingRef,
)

CACHE_MAX_ENTRIES = 256

T = TypeVar("T")


class _BoundedCache:
    """Insertion-order-bounded cache. Inherits nothing from ``dict`` to
    avoid Liskov complaints with ``dict.get``'s narrower return type."""

    def __init__(self, max_entries: int) -> None:
        self._max = max_entries
        self._data: OrderedDict[str, object] = OrderedDict()

    def get(self, key: str) -> object | None:
        if key in self._data:
            self._data.move_to_end(key)
            return self._data[key]
        return None

    def set(self, key: str, value: object) -> None:
        self._data[key] = value
        self._data.move_to_end(key)
        while len(self._data) > self._max:
            self._data.popitem(last=False)

    def clear(self) -> None:
        self._data.clear()

    def __len__(self) -> int:
        return len(self._data)


_RESULT_CACHE = _BoundedCache(CACHE_MAX_ENTRIES)


def cache_get(key: str) -> object | None:
    return _RESULT_CACHE.get(key)


def cache_put(key: str, value: object) -> None:
    _RESULT_CACHE.set(key, value)


def cache_clear() -> None:
    _RESULT_CACHE.clear()


def content_hash_for_aperture(entry: ApertureTypeEntry) -> str:
    """Stable SHA-256 hex over the U-Value-affecting subtree.

    Element ``name`` and ``operation`` are excluded so changes to
    those fields don't invalidate the cache. ``catalog_origin`` is
    excluded — the values referenced by the origin are already in
    the hash via the frame / glazing properties.
    """

    payload = {
        "row_heights_mm": [_round(v) for v in entry.row_heights_mm],
        "column_widths_mm": [_round(v) for v in entry.column_widths_mm],
        "elements": [
            {
                "id": el.id,
                "row_span": list(el.row_span),
                "column_span": list(el.column_span),
                "frames": {
                    "top": _frame_payload(el.frames.top),
                    "right": _frame_payload(el.frames.right),
                    "bottom": _frame_payload(el.frames.bottom),
                    "left": _frame_payload(el.frames.left),
                },
                "glazing": _glazing_payload(el.glazing),
            }
            for el in sorted(entry.elements, key=lambda e: (e.row_span[0], e.column_span[0], e.id))
        ],
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _frame_payload(frame: FrameRef | None) -> dict[str, float | None] | None:
    if frame is None:
        return None
    return {
        "width_mm": _round_opt(frame.width_mm),
        "u_value_w_m2k": _round_opt(frame.u_value_w_m2k),
        "psi_g_w_mk": _round_opt(frame.psi_g_w_mk),
    }


def _glazing_payload(glazing: GlazingRef | None) -> dict[str, float | None] | None:
    if glazing is None:
        return None
    return {"u_value_w_m2k": _round_opt(glazing.u_value_w_m2k)}


def _round(value: float) -> float:
    return round(value, 6)


def _round_opt(value: float | None) -> float | None:
    return None if value is None else round(value, 6)
