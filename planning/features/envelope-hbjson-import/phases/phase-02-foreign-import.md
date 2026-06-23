---
DATE: 2026-06-23
TIME: 18:40 EDT
STATUS: DONE (2026-06-23)
AUTHOR: Ed (via Claude)
SCOPE: Phase 2 — raw honeybee-PH construction import (foreign files).
---

# Phase 2 — Backend foreign import front-end

Accept raw honeybee-PH `OpaqueConstruction`s exported straight from
Grasshopper, normalizing them into the **same** `ParsedConstructionLibrary`
IR as the native path so matching/apply stay source-agnostic (PRD §2B).

## Key reuse finding

A raw honeybee `OpaqueConstruction.to_dict()` emits `materials[]` as full
`EnergyMaterial` dicts whose fields (`thickness`, `conductivity`, `density`,
`specific_heat`, `thermal_absorptance`, `properties.ph.divisions`,
`properties.ph.ph_color`) are exactly what the Phase 1 dict parser already
reads. Foreign files differ only in: (a) the file *envelope* shape, (b) no
`ph_nav` blocks (→ defaults; materials key on `identifier`,
`catalog_origin=None`), (c) name-based matching. So Phase 1's
`_parse_construction`/`_parse_layer` are reused verbatim.

> v1 parses the honeybee **dict shape directly** rather than round-tripping
> through `honeybee.dictutil.dict_to_object`. The divisions/EnergyMaterial
> format is stable and shared with our own export, so direct parsing avoids a
> honeybee runtime coupling. Library-based validation / schema-upgrade of
> older-honeybee files is a future hardening if such files appear. Abridged
> models (materials as identifier strings) are out of scope for v1 and reject
> with a clear parse error.

## Foreign file shapes detected

1. A single `OpaqueConstruction` (`type == "OpaqueConstruction"`).
2. A name-keyed **group** of objects (honeybee "dump objects": a dict whose
   values are object dicts) — keep the `OpaqueConstruction` values.
3. A full `Model` (`type == "Model"`) — sift
   `properties.energy.constructions[]` for opaque ones.

Dispatch lives in `parse_construction_library`: `type ==
"PHNavigatorOpaqueConstructionLibrary"` → native; otherwise → foreign.

## Assembly type heuristic

No `ph_nav.assembly_type` on foreign constructions → derive from the
identifier prefix: `W_` → wall, `R_` → roof, `F_` → floor, else `other`.
(Native files always carry an explicit type, so the heuristic never fires
there.) The user can still override in the preview.

## Matching ladder — rungs 4–5 (name)

Added after the id/catalog rungs, before create-new, for any material that
did not resolve by id:

4. **name in-project** — incoming name matches exactly one existing project
   material (normalized) ⇒ reuse, flagged `name_matched_project_material`.
   >1 ⇒ `ambiguous_name_in_project`, fall through.
5. **name in catalog** — matches an active `catalog_materials` row by name ⇒
   pick-from-catalog, flagged `name_matched_catalog_material`.

Name matches are fuzzy by nature, so every one carries a warning the preview
surfaces for confirmation. Property-tolerance matching is deferred.

## Out of scope (this phase)

Frontend (Phase 3); per-material override UI + drift warnings (Phase 4);
abridged honeybee models; honeybee-library schema upgrades.
