"""Permanent format adapters between PH-Navigator and Honeybee ref statuses.

Installed ``honeybee_ref`` accepts ``COMPLETE | MISSING | QUESTION | NA``.
PH-Navigator's canonical value for the same semantic is ``needed``, not
``missing`` (D-1/D-6), so every crossing of that boundary is translated here
rather than by aliasing the internal literal.

This is not migration scaffolding: it stays as long as we read and write
Honeybee files. Two spellings exist on the wire because Honeybee-authored
files use upper case while our own native export has always written lower
case, so imports normalize case and exports keep the spelling of the format
they are writing.
"""

from __future__ import annotations

from typing import cast

from features.project_document.document import SPECIFICATION_STATUSES, SpecificationStatus

#: External token that carries PH-Navigator's ``needed`` semantic, in the two
#: spellings the formats use (Honeybee upper case, our native export lower).
EXTERNAL_NEEDED_REF_STATUS = "MISSING"
_EXTERNAL_NEEDED_LOWER = EXTERNAL_NEEDED_REF_STATUS.lower()


def to_external_ref_status(status: SpecificationStatus) -> str:
    """Return the Honeybee ``ref_status`` token for an internal status."""

    return EXTERNAL_NEEDED_REF_STATUS if status == "needed" else status.upper()


def to_native_ref_status(status: SpecificationStatus) -> str:
    """Return the lower-case ``ref_status`` our own native HBJSON export writes."""

    return _EXTERNAL_NEEDED_LOWER if status == "needed" else status


def from_external_ref_status(value: object) -> SpecificationStatus | None:
    """Return the internal status for a Honeybee token, or ``None`` if unreadable.

    Accepts either case and either spelling, so a Honeybee-authored ``MISSING``
    and a PH-Navigator ``needed`` both read back as internal ``needed``.
    """

    if not isinstance(value, str):
        return None
    normalized = value.strip().lower()
    if normalized == _EXTERNAL_NEEDED_LOWER:
        return "needed"
    return cast(SpecificationStatus, normalized) if normalized in SPECIFICATION_STATUSES else None
