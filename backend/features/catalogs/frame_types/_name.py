"""Derived-name formula for the frame-types catalog.

`name` is a server-derived label (D-3): the non-empty parts joined by ``" | "``
in a fixed order, ``material`` excluded, clamped to 200 chars. This leaf module
holds the formula so both the write path (`service`) and the import path
(`import_export.coerce`) share one definition without coupling to each other.

The SQL twin lives in `repository._COMPOSE_NAME_SQL` (and migration
20260623_0039); all three must stay in sync — see `_NAME_PART_ORDER`.
"""

from __future__ import annotations

from collections.abc import Mapping

_NAME_PART_ORDER: tuple[str, ...] = (
    "manufacturer",
    "prefix",
    "brand",
    "use",
    "operation",
    "location",
    "mull_type",
    "suffix",
)


def compose_frame_name(fields: Mapping[str, object]) -> str:
    """Derive the read-only frame ``name`` from its parts.

    Mirrors the AirTable formula and reproduces every existing seed ``name``
    (research §2). The all-null case yields ``""`` — which is why the built-in
    default frame sentinel is resolved by **id**, never by this name.
    """
    parts: list[str] = []
    for key in _NAME_PART_ORDER:
        value = fields.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            parts.append(text)
    return " | ".join(parts)[:200]
