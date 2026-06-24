---
DATE: 2026-06-23
TIME: 23:35 EDT
STATUS: Deferred
AUTHOR: Claude (Opus 4.8) for Ed May
SCOPE: Disposition ledger for the catalog manage-options modal wiring.
RELATED: ./README.md, ./PRD.md
---

# STATUS — Catalog "Manage Options" Modal

## State

`Deferred` — pulled out of the completed
[`window-frames-catalog-enums`](../../archive/window-frames-catalog-enums/README.md)
feature (Phase 5b open item) so it isn't lost. The parent feature shipped: the
six fields are single-select, `name` is derived, inline add works, and the
rename/merge/reorder **translation logic is complete and unit-tested** in
`controller.ts`. Only the **modal-open UI wiring** on the shared DataTable is
outstanding.

## What's done vs. missing

- ✅ Backend options store + cascade-guard / `replacements` merge (Phases 1–4).
- ✅ Controller translation of `legacyOptions` `schemaMutation` → catalog REST
  (`editFrameTypeOptions`, 21 vitest tests).
- ✅ Inline "+ Add option" (Phase 5a — not gated by this).
- ❌ Field-config "manage options" trigger + modal reachable for a catalog
  single-select (catalog pages pass neither `onEditCustomFieldBundle` nor
  `onEditCustomFieldConfig`).

## Next step

None scheduled. Promote to active when a user actually needs to **clean up the
catalog vocabulary** in the UI — rename a sloppy option, reorder the picker, or
merge a typo'd value (the `OP-TO-FIX` → `OP-to-FX` case the parent feature was
built around). Until then the catalog is fully usable via inline add; this is the
curation/cleanup surface only.

## Blockers

None. The work is unblocked — it's a scope/priority deferral, not a dependency
one. The only care required is that it touches the **shared (iron-law)
DataTable**, so it must be wired uniformly (not a per-catalog opt-in) and smoked
with the dev env up.
