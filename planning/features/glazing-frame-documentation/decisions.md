---
DATE: 2026-06-24
TIME: 17:30 EDT
STATUS: All decisions accepted (D-2 confirmed Option A by Ed 2026-06-24)
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Accepted/rejected design calls for glazing+frame documentation.
RELATED: ./PRD.md, ./README.md
---

# Decisions — Glazing + Frame Documentation

## D-1 — Promote to flat deduped entities (accepted, Ed 2026-06-24)

Glazings/frames become flat `ProjectGlazing`/`ProjectFrame` tables with element
FK references, mirroring `ProjectMaterial`. **Rejected alternative:** attach
`specification_status` + `datasheet_asset_ids` to the existing inline refs.
Rejected because datasheets/spec-status are per-product questions; inline
copies would give every use its own independent datasheet set — the exact V1
defect the Materials restructure fixed (envelope-tab.md §2.7.3, Q-ENV-2). Ed:
"adopt the data-structure patterns from Materials wherever we can."

## D-2 — Hand-entered dedup key (accepted, Ed 2026-06-24 — Option A)

Catalog refs dedup by `(catalog_table, catalog_record_id)`. **Hand-entered refs
(`catalog_origin is None`) each create their own entity** — exactly
`ProjectMaterial` semantics (materials never value-dedup hand-entered rows).
Faithful to Ed's "mimic Materials." "Shown once" still holds for the common case
(catalog products, incl. the default) via record-id dedup; duplicate hand-entered
rows are a rare, user-controllable edge.

**Rejected — Option B (value-tuple dedup of hand-entered):** would literally
honor "each frame type shown ONCE" for hand-entered duplicates too, but diverges
from Materials and adds copy-on-write complexity when one shared slot is later
edited. The `ensure_project_*` upsert key in Phases 0/1/2 is therefore: dedup
catalog refs by record id; always append for hand-entered.

## D-3 — Backend-owned upsert; pick command unchanged (accepted)

The frontend pick command keeps sending the full `FrameRef`/`GlazingRef`
payload (`aperture_commands/models.py:145-168`); the **backend** handler upserts
the flat entity and assigns the FK. Honors the "all data manipulation in
backend" hard rule and minimizes frontend churn (`ref-builders.ts`,
`GlazingPicker`/`FramePicker` keep building the ref from the catalog row).
**Rejected:** frontend resolves/sends an id (would need a two-step
ensure-then-pick round-trip).

## D-4 — Keep `GlazingRef`/`FrameRef` as the catalog-copy DTO (accepted)

Retain both as the pick-payload + bookshelf-copy DTO; they are simply no longer
stored on the element. Avoids rewriting `_ref_helpers.py`, the pick command
models, and the import/export ref schema. `datasheet_url` stays on them (not
promoted; import/export compatibility).

## D-5 — Aperture use-site photos deferred (accepted)

Materials carry per-segment `photo_asset_ids` (install photos). Whether aperture
use-sites get installation photos is **deferred to a later iteration**. The
read use-site DTO (sibling feature) will carry the field shape so it can be
populated later without a schema bump. Keeps this feature scoped to
datasheets + spec-status.

## D-6 — Drop `EditFieldOverride`; adopt shared-edit semantics (accepted)

Under the flat model, editing a product edits all uses; per-slot independent
field overrides are obsolete. Drop the unimplemented `EditFieldOverride` kind
(`aperture_commands/models.py:180-199`) rather than implement it. "Want one
different" = pick/enter a different product (Materials pattern).

## D-7 — Migration via `mode="before"` document upgrader (accepted)

The v11→v12 migration is a Pydantic `@model_validator(mode="before")` on the
document/tables model, mirroring the existing
`_migrate_legacy_manufacturer_filters` precedent (`document.py:278`), with the
standard safe-mode read fallback (`store.py:255-277`) for any doc that cannot be
coerced. No separate migration framework. PHN is pre-deploy, so reseed covers
the dev project; the upgrader covers any persisted draft/version.
