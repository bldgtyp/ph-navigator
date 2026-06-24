---
DATE: 2026-06-24
TIME: 16:10 EDT
STATUS: Resolved (2026-06-24) — D-6 settled by Ed; D-1/D-2/D-3/D-4 inherit the
  frame resolutions; D-5/D-7 are no-ops here. Cleared to execute.
AUTHOR: Claude (Opus 4.8)
SCOPE: Decisions gating the window-glass-catalog-enums refactor
RELATED: ./research.md, ./PLAN.md,
  planning/archive/dated/2026-06-23/window-frames-catalog-enums/decisions.md
---

# Decisions — window-glass-catalog-enums

Most decisions are **inherited** from the frame refactor (same architecture, same
store). Only **D-1** (brand cardinality) and **D-6** (the `DEFAULT` rows) are
genuinely glazing-specific; **D-6 is now resolved** (Ed, 2026-06-24) — all
decisions are settled and the plan is cleared to execute.

## D-1 — Which fields become strict single-select? — Ed: Manufacturer + Brand

Ed's request is explicit: **`manufacturer` and `brand`**. Honored. But note the
cardinality split (cf. frame D-1):

- **`manufacturer` (14 → 13 after fold):** clean grouping field, modest
  cardinality, mostly shared across rows. **Strict single-select, clear yes.** The
  only work is folding casing (`INTUS`→`Intus`, `ZOLA`→`Zola`) and resolving
  `DEFAULT` (D-6).
- **`brand` (~40 distinct across 43 rows — near-unique):** each brand is a glass
  make-up string used by essentially one row (research §1). Strict single-select
  gives almost **no grouping benefit** here (unlike frame, where `brand` had ~24
  reused product lines), and the inline-add path (D-4) becomes **load-bearing** —
  every new glazing product is a new brand option the user must add first.

**Recommendation:** proceed as Ed asked (both single-select), seeding `brand` from
the existing values, **but** treat `brand` as "single-select with frictionless
add", not a curated list. Flagging only so the cost is a conscious choice — if the
near-uniqueness proves annoying in use, `brand` can revert to free text later
without touching `manufacturer` or the derived name (the composer treats both as
plain strings). Not blocking.

> **RESOLVED — reverted to manufacturer-only (Ed, 2026-06-24, post-ship).** The
> flagged near-uniqueness cost was real: Ed confirmed `brand` should **not** be a
> single-select. Reverted exactly as anticipated above — `brand` is back to free
> text, `manufacturer` untouched, the derived name unchanged (still
> `manufacturer | brand | suffix`, `brand` as a plain-string part). Implemented
> by dropping `brand` from `GLAZING_TYPE_SINGLE_SELECT_FIELDS` + the option seeds,
> migration `20260624_0043` (delete seeded `brand` options), and the matching
> frontend/test/doc changes. **Final decision: only `manufacturer` is a glazing
> single-select.**

## D-2 — Where do options live + how stored? — INHERITED: existing store, label-string

No decision to make. The frame refactor built the catalog-scoped option store
(`catalog_field_options`) with **label-string** storage, designed generic for
glazing (frame D-2 / D-7). Glazing wires onto it unchanged: columns stay TEXT and
hold the label; rename/merge is a row-rewrite (`_options_repository.rename_label`).

## D-3 — `name`: backend-computed vs. live formula — INHERITED: backend-computed

Same as frame D-3. Compute `name` server-side in Python (`compose_glazing_name`:
`manufacturer | brand | suffix`, ` | ` join, drop null/empty, clamp 200), store it
in the existing `name` column (read-only), reject inbound `name` on create/patch,
recompute on any part change. Catalogs are not formula-capable, so this is a
computed column, not a live formula field. Mirror in TS for optimistic display
only (never source of truth — CLAUDE.md hard rule).

## D-4 — "Add new value" UX — INHERITED: inline add; manage-options modal deferred

Reuse the DataTable inline "+ Add option" affordance (the `SingleSelectPopover`
create-footer is **not** gated by the options lock, so inline-add works — frame
5a). On import, an unknown value that survives folding is **auto-added** to the
option store on commit (frame D-4, Ed's "frictionless" choice), with a
`new_option:<field>` preview warning.

**Manage-options modal (rename/merge/reorder/delete UI):** the option-edit
*translation logic* can be built + unit-tested for glazing (mirror frame 5b), but
the modal **open affordance is unreachable** for catalog single-selects because no
catalog page passes `onEditCustomFieldBundle`/`editConfigEnabled` to the shared
DataTable — confirmed for both `FrameTypesCatalogPage` and `GlazingTypesCatalogPage`.
That is a **shared-DataTable** task tracked as the v1.1 candidate
`planning/features_v1.1/catalog-manage-options-modal/`. Glazing **inherits** that
dependency; it is out of scope here. (Casing cleanup like `INTUS`→`Intus` is done
in Phase 0/4 server-side, so glazing does not *need* the merge UI to ship.)

## D-5 — Default-glazing resolution — INHERITED & ALREADY DONE (no-op)

`default_refs.get_default_glazing` already resolves the sentinel by id
(`recPHNDefGlazng01`), not name (`default_refs.py:86-96`) — the frame refactor
fixed both catalogs. The frame's highest-risk change is **already shipped** for
glazing. The only related task is making glazing's `recompute_names` **skip the
sentinel** (its parts are null → empty derived name; `GlazingRef.name` needs
`min_length=1`), exactly as frame skips `recPHNDefFrame001`. See research §3.

## D-6 — The two `DEFAULT` seed rows — RESOLVED (Ed, 2026-06-24): match frame, one sentinel

The seed had two rows with `manufacturer = "DEFAULT"` (`DEFAULT | 1 W/m2-k`,
`DEFAULT | 2 W/m2-k`, U = 1.0 / 2.0 W/m²K), distinct from the `PHN-Default-Glazing`
sentinel (research §3).

> **Ed (2026-06-24):** *"Match Frames. We used 'PHN-Default-Frame', so lets use
> 'PHN-Default-Glass' (just one)."*

Resolution — exactly parallel to how frame handled its `Default` artifact:

1. **Drop both `DEFAULT` artifact rows** from `glazing-types.v1.json` (and drop
   them on import via the v1→v2 upgrade → `dropped` count). `DEFAULT` never becomes
   a manufacturer option; the brands `1 W/m2-k` / `2 W/m2-k` therefore never seed.
2. **Keep exactly one default** — the existing migration-seeded sentinel
   (`recPHNDefGlazng01`), the glazing analogue of `recPHNDefFrame001`.
3. **Rename the sentinel's display name** `PHN-Default-Glazing` → **`PHN-Default-Glass`**
   for parity with `PHN-Default-Frame`. Because defaults resolve by **id** now
   (D-5), the name is a display label only — a contained, low-risk change:
   - new migration: `UPDATE catalog_glazing_types SET name = 'PHN-Default-Glass'
     WHERE id = 'recPHNDefGlazng01'`;
   - change the **value** of `APERTURE_DEFAULT_GLAZING_NAME`
     (`envelope_models.py:30`) to `"PHN-Default-Glass"`.
   - **Code identifiers stay `*_GLAZING_*`** (constant *name*, table
     `catalog_glazing_types`, `glazing_types` feature, `GlazingRef`) — only the
     human-facing sentinel string changes, so the codebase's internal "glazing"
     naming is undisturbed while the label reads as Ed wants. Update the migration
     `20260605_0018` downgrade/any test asserting the old label, and the `recompute_names`
     skip is by id so it is unaffected.

This is the only decision that gated Phase 0; now resolved.

## D-7 — Materials next? — INHERITED: out of scope

Frame D-7 already designated the store generic for materials too. Materials
`category` (locked CHECK-constraint precedent) is a separate later effort. Out of
scope here. After glazing lands, the only un-migrated catalog is materials.

## Cross-cutting: public-repo safety

All glazing option/fold/seed values are generic catalog reference data — no
PHI/PHPP/WUFI-derived or licensed product data (project CLAUDE.md public-repo rule;
`project_public_repo_licensed_data` memory). The brand strings are glass make-up
descriptors, not licensed datasheets — safe.
