"""Pydantic models for the catalog-import file envelope.

Format: a versioned JSON object with a `kind` discriminator, a
`schema_version` integer, and a list of catalog rows. Per-row
`extra="allow"` is deliberate so unknown keys reach the coerce step
and become warnings instead of being silently dropped by Pydantic.

See `planning/features/materials-catalog-import-export/PRD.md` for
the full contract.
"""

from __future__ import annotations

from datetime import datetime
from typing import Final, Literal

from pydantic import BaseModel, ConfigDict

# Bump when a backward-incompatible field rename / drop / unit change
# ships. Each bump must add an entry to `upgrade.py:upgrade_steps`.
CURRENT_SCHEMA_VERSION: Final[int] = 1

FILE_KIND: Final[str] = "ph-navigator.catalog.materials"


class CatalogFileRow(BaseModel):
    """One row inside a catalog import file.

    Field set mirrors the nine canonical catalog fields plus optional
    `id`. Unknown keys are accepted (`extra="allow"`) so the coerce
    step can surface them as `unknown_field:<key>` warnings.
    """

    model_config = ConfigDict(extra="allow")

    id: str | None = None
    name: str | None = None
    category: str | None = None
    density_kg_m3: float | str | None = None
    specific_heat_j_kgk: float | str | None = None
    conductivity_w_mk: float | str | None = None
    emissivity: float | str | None = None
    color: str | None = None
    source: str | None = None
    url: str | None = None
    comments: str | None = None


class CatalogFile(BaseModel):
    """Outer envelope.

    `kind` is the discriminator — a wrong `kind` rejects at envelope
    check, never reaching the upgrade chain. `schema_version` selects
    the upgrade path.
    """

    model_config = ConfigDict(extra="ignore")

    kind: Literal["ph-navigator.catalog.materials"]
    schema_version: int
    exported_at: datetime | None = None
    exported_by: str | None = None
    app_version: str | None = None
    rows: list[CatalogFileRow]
