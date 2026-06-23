---
DATE: 2026-06-23
TIME: 17:51 EDT
STATUS: Resolved (2026-06-23) — D-1…D-7 all settled; PLAN.md cleared to execute
AUTHOR: Claude (Opus 4.8)
SCOPE: Decisions gating the window-frames-catalog-enums refactor
RELATED: ./research.md, ./PLAN.md
---

# Decisions — window-frames-catalog-enums

Each has a recommendation. Nothing in `PLAN.md` should be built until D-2 and
D-3 are confirmed, since they set the whole shape.

## D-1 — Which of the six become *strict* single-select? — RESOLVED (2026-06-23): all six

> **Ed (2026-06-23):** we want to **group on `brand`**, so it must be enforced
> consistent (single-select). ⇒ **All six** are strict single-select, incl.
> `manufacturer` and `brand`. (Grouping/filtering on a single-select gives clean
> buckets; free text fragments groups by casing/typos — which is the whole point.)
> Implication: the inline "add new value" path (D-4) is load-bearing for `brand`
> /`manufacturer` since new product lines arrive often.

All six were requested. But they fall into two groups by cardinality and intent:

- **Controlled vocabularies (low cardinality, shared terms):** `use` (6),
  `operation` (7), `location` (6), `mull_type` (3). These are exactly the
  consistency win — `Head/Jamb/Sill`, `OP-to-FX`. **Strict single-select, clear
  yes.**
- **Identity-ish (high cardinality, supplier-specific):** `manufacturer` (~14)
  and especially `brand` (~24, e.g. `1600 UT CW Alu PP`, `ThermoPlus Clad III`).
  Every new product line is a new option, so the "add new value" path will be
  used *constantly* for `brand`. Strict-enforcing them still gives the
  consistency benefit (no `Curries` vs `Mercury` swap), but the UX leans more on
  D-4 (easy inline add).

**Recommendation:** make **all six** single-select (honoring the request), but
treat `manufacturer`/`brand` as "single-select with frictionless add" rather
than a curated list. Flagging only so the cardinality cost is a conscious
choice — happy to keep `brand` as free text if you'd rather not manage ~24+
options.

## D-2 — Where do user-extensible options live? (the big one) — RESOLVED (2026-06-23): option store (B)

> **Ed (2026-06-23):** build the catalog app-scoped option store — users will
> want to add new items. ⇒ Approach **(B)**. Label-string storage stands as the
> default sub-choice unless changed.

Catalogs have no option store today (research §3). Three ways to get one:

- **(A) Frontend-declared + locked** (today's materials `category`). ❌ Rejected
  — not user-extensible; fails requirement #4 outright.
- **(B) New catalog-scoped option store** — a small global table, e.g.
  `catalog_field_options(catalog_table, field_key, option_id, label, color,
  order)`, fronted by a repository + service (add/rename/merge/reorder/delete
  with cascade checks) + REST routes, reusing the existing `SingleSelectOption`
  model and `options.py` helpers. ✅ **Recommended.** Meets #4, respects the
  catalog/project separation (catalogs are global so options are global),
  moderate lift, and is **reusable** by glazing/materials later (materials
  `category` could graduate off its CHECK constraint).
- **(C) Port catalogs onto the project-document registered-table-contract
  machinery** (formula fields, `single_select_options`, custom-field pipeline).
  ❌ Rejected for now — large, and explicitly deferred by `plan-13` D4. It's the
  eventual convergence direction, not this refactor.

**Recommendation: (B).** Sub-question — store the option **label string** in the
row column (status quo: columns stay TEXT) vs. an `opt_*` id:

- **Label string (recommended):** name derivation stays a trivial concat of the
  stored strings; import/export stays human-readable; existing rows need no value
  rewrite. Cost: renaming an option must rewrite matching rows (rare for
  `Head/Jamb/Sill`; and the *rename/merge* tool is precisely what fixes
  `OP-TO-FIX`).
- **`opt_*` id:** free renames, but forces a join to render `name` and a full
  data migration of existing rows. Overkill for stable domain terms.

## D-3 — `name`: backend-computed column vs. true formula field — RESOLVED (2026-06-23): backend-computed (A)

> **Ed (2026-06-23):** compute it as per the normal formula. ⇒ Approach **(A)** —
> compute `name` server-side using the formula composition; read-only in the UI.



- **(A) Backend-computed, stored, read-only column (recommended).** Compute
  `name` in the service from the components (` | ` join, drop null/empty), keep
  the existing `name` column + its index, reject `name` on create/update, render
  read-only in the grid. Simple, keeps `name` queryable, and preserves the one
  legitimate stored-name use after D-5.
- **(B) True DataTable formula field.** The grammar already supports the exact
  formula (research §2), but catalogs aren't formula-capable, so this drags in
  most of option (C) from D-2. Defer.

**Recommendation: (A).** Implement the formula's logic in Python (and mirror it
once in TS for optimistic display), not as a live formula field. Revisit (B) if
catalogs later converge onto the project-document substrate.

## D-4 — "Add new value" UX

The DataTable already supports inline option-add (`OptionListDelta`/`newOptions`,
`SingleSelectPopover`). With store (B) wired, "+ Add option" in the cell/field
config persists to the catalog option store and is immediately shared.

**Recommendation:** reuse the existing inline-add affordance; do **not** lock the
`options` attribute for these fields (unlike materials `category`). Add a
lightweight field-config "manage options" path for rename/merge/reorder/delete.
Merge is the cleanup tool (e.g. select `OP-TO-FIX`, merge into `OP-to-FX`).

## D-5 — Default-frame / default-glazing resolution — RESOLVED (2026-06-23): by id (technical fix)

> Direct consequence of D-3 (derived name can't reproduce the sentinel). Adopt
> the recommendation: resolve by deterministic id. No separate product call.

The `PHN-Default-Frame` sentinel row is seeded with all component fields NULL
(`20260605_0018:44-58`), so a derived `name` can't reproduce it and the
name-based lookup (`default_refs.py:104`) breaks.

**Recommendation:** switch `default_refs._fetch_by_name` to fetch by the
deterministic sentinel **ids** already in the seed (`recPHNDefFrame001`,
`recPHNDefGlazng01`). Contained, removes a `name`-as-key dependency, and applies
to glazing too.

## D-6 — Existing-data cleanup scope — RESOLVED (2026-06-23): clean up

> **Ed (2026-06-23):** yes, let's clean up. ⇒ Fold `OP-TO-FIX → OP-to-FX`, fix
> the `Mercury | CURRIES` ↔ `Curries | Mercury` swap, normalize `source` casing.
> The stray `Default` row (an AirTable export artifact, distinct from the
> `PHN-Default-Frame` sentinel) → verify-then-remove during the migration, since
> D-5 makes `PHN-Default-Frame` the real default. "Default" should not survive as
> a `manufacturer` option.



The seed has artifacts: `OP-TO-FIX` (typo), `Mercury | CURRIES` swap, a
free-floating `Default` row, `source` casing. These should be fixed as part of
the migration so the initial option sets are clean.

**Recommendation:** fold typos on the way in, fix the Mercury/CURRIES swap, and
confirm with Ed what the `Default` row is (keep, delete, or fold into the
`PHN-Default-Frame` sentinel). Low-risk, but it's source-data editing so it gets
an explicit checkpoint. Note: this is **public repo** seed data — keep it as
generic catalog reference, no PHI/licensed values.

## D-7 — Glazing & materials: in scope?

Glazing-types has the same shape and the same latent problem; materials
`category` is the locked precedent. Store (B) is designed to serve all three.

**Recommendation:** scope **this** refactor to **frame-types only**, but build
the option store generic so glazing/materials adopt it next without a redesign.
