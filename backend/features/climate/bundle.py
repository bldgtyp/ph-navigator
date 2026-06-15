"""The standardized climate bundle — the one artifact the seed step consumes.

The two-stage pipeline (PRD D-CS-3) splits the messy, provider-specific
*process* step from a trivial, provider-agnostic *seed* step. The bundle
defined here is the contract between them: the *process* step
(:mod:`features.climate.processing`) parses raw Phius/PHI source into
:class:`~features.climate.record.ClimateRecord` rows and writes them into this
envelope; the *seed* step (:mod:`features.climate.seeding`) reads only this
envelope and never touches the source formats.

The envelope (PRD D-CS-4) mirrors the catalog seed envelope used elsewhere in
``backend/seeds/`` — a small, versioned header plus the records — so the shape
is familiar across the codebase. One bundle describes exactly one
``(provider, version)`` reference release.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict

from features.climate.record import ClimateRecord

# The standardized `.json` is self-describing; these constants pin the
# envelope identity a reader checks before trusting the records.
BUNDLE_KIND = "climate_dataset"
BUNDLE_SCHEMA_VERSION = 1


class ClimateBundle(BaseModel):
    """A standardized, self-describing climate reference release (PRD D-CS-4).

    Carries its own ``provider``/``version`` identity plus the ``label`` and
    ``source`` provenance the seed step forwards verbatim to
    :func:`features.climate.service.seed_dataset` — so seeding needs no
    provider-specific knowledge, only this envelope.
    """

    model_config = ConfigDict(extra="forbid")

    kind: Literal["climate_dataset"] = BUNDLE_KIND
    schema_version: int = BUNDLE_SCHEMA_VERSION
    provider: str
    version: str
    label: str
    source: str
    exported_at: str
    records: list[ClimateRecord]

    def to_json_bytes(self) -> bytes:
        """Serialize to the UTF-8 ``dataset.json`` bytes stored in the object store."""
        return self.model_dump_json(indent=2).encode("utf-8")

    @classmethod
    def from_json_bytes(cls, raw: bytes) -> ClimateBundle:
        """Parse + validate a ``dataset.json`` bundle (every record re-validated)."""
        return cls.model_validate_json(raw)
