---
DATE: 2026-06-23
TIME: 17:17 EDT
STATUS: Complete — all decisions resolved and implemented (recommended defaults adopted)
AUTHOR: Ed (via Claude)
SCOPE: Design decisions to confirm for Envelope HBJSON Import.
---

# Decisions to confirm

Each has a recommended default. Confirm or override before we phase the work.

## D1 — Import source scope — RESOLVED (2026-06-23): both
v1 accepts **both** PHN-native files **and** raw Honeybee-PH constructions. The
parser has two front-ends → one IR (PRD §2A/§2B); the foreign path uses the
honeybee-ph library and name/property catalog matching, surfaced in the preview.
This adds real scope vs. native-only — reflected in the phase plan.

## D2 — Export enhancement as Phase 0 — RESOLVED (2026-06-23): yes
Add `assembly_id`, `assembly_type`, `orientation`, `layer_id`, homogeneous
`segment_id`, and `is_continuous_insulation` to the export's `ph_nav` blocks so
new files round-trip losslessly. Additive + backward-compatible.
- Sub-question (still open): bump `schema_version`, or just add optional `ph_nav`
  fields and leave it at 11? **Leaning: keep 11, additive optional fields.**

## D3 — Unmatched material with a *resolvable* catalog id: pick-from-catalog or copy-from-file?
When `catalog_record_id` resolves to an active catalog row, do we snapshot the
**current catalog values** (re-pick) or the **file's embedded values** (which may
have drifted / been overridden in the source project)?
**Recommend: pick from catalog (current values)**, then flag in the preview if
the file's values differ — consistent with copy-on-pick and the refresh model.
Override: trust the file's values when present.

## D4 — Unmatched material destination — RESOLVED (2026-06-23): project-only
Unmatched materials are created as hand-entered `ProjectMaterial`s
(`catalog_origin = null`); **no** auto-write to the global `catalog_materials`
table. "Promote to catalog" stays a separate, explicit action for later.

## D5 — Construction name/id collision: default action?
Per-construction choice in the preview: Add new / Replace existing / Skip.
**Recommend default:** `assembly_id` matches existing → **Replace**; else **Add
new** with name auto-suffixed on collision. Never silently overwrite.

## D6 — Preview step required in v1, or fast-follow?
**Recommend: preview is core to v1** (it is the "clear UI informing the user"
Ed asked for). Minimum acceptable fallback if we must cut: apply immediately but
return a mandatory matched/created/skipped summary the UI shows. Preferred path
is pre-apply preview → confirm.

## D7 — `specification_status` on imported materials
Carry the file's `ref_status`, or reset to `"missing"`?
**Recommend:** reuse → keep the existing project material's status untouched;
pick-from-catalog → `"missing"` (catalog default); create-new → carry the file's
status if valid, else `"missing"`.

## D8 — Where does the import land — current draft, or a new version?
**Recommend: current version's draft** (same as every other envelope edit), so
the user reviews in-app and Saves a Version deliberately. Not an auto-committed
new version.
