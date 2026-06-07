"""Honeybee-Energy identifier escaping for the HBJSON export.

Per PRD §17 / §21 decision 17 the rule is:

    re.sub(r"[^A-Za-z0-9_]", "_", raw)
    collapse runs of "_"
    strip leading / trailing "_"

The escape rule is a **stable contract**: it is consumed by Rhino /
Grasshopper component scripts via ``honeybee_energy.WindowConstruction.
from_dict``. Changing it silently would break user scripts in the
wild, so any future change has to be a coordinated breaking-change
release (see ``context/technical-requirements/hbjson-export.md``).

Collisions are surfaced as hard errors — there is **no silent
suffix-disambiguation**. The export caller resolves them by
renaming an aperture.
"""

from __future__ import annotations

import re

from pydantic import BaseModel, ConfigDict

from features.shared.errors import api_error

_ESCAPE_RE = re.compile(r"[^A-Za-z0-9_]")
_COLLAPSE_RE = re.compile(r"_+")


def escape_hbjson_identifier(raw: str) -> str:
    """Apply the stable identifier escape rule. Raises 422 if the result
    is empty (every character was non-alphanumeric/underscore)."""

    cleaned = _ESCAPE_RE.sub("_", raw)
    cleaned = _COLLAPSE_RE.sub("_", cleaned)
    cleaned = cleaned.strip("_")
    if not cleaned:
        raise api_error(
            422,
            "aperture_hbjson_identifier_empty",
            "Aperture name escapes to an empty Honeybee identifier.",
            {"raw": raw},
        )
    return cleaned


class Collision(BaseModel):
    """Two aperture identifiers that escape to the same Honeybee id."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    escaped: str
    first: str
    second: str


def detect_collisions(identifiers: list[tuple[str, str]]) -> list[Collision]:
    """Return a ``Collision`` for every pair of identifiers that share an
    escaped form but come from different source aperture names.

    ``identifiers`` is a list of ``(escaped_identifier, source_aperture_name)``.
    Repeated entries from the same source name are ignored (they come from
    distinct elements of the same aperture and are expected to be unique by
    ``_C{col}_R{row}`` suffix).
    """

    seen: dict[str, str] = {}
    collisions: list[Collision] = []
    for escaped, source in identifiers:
        if escaped in seen:
            other = seen[escaped]
            if other != source:
                collisions.append(Collision(escaped=escaped, first=other, second=source))
        else:
            seen[escaped] = source
    return collisions
