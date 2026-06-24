---
DATE: 2026-06-24
TIME: 16:10 EDT
STATUS: Complete (2026-06-24), CORRECTED 2026-06-24 — `brand` reverted to free text; only `manufacturer` is single-select (see STATUS.md banner + decisions.md D-1)
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Window-Glazing catalog — promote `manufacturer` text field to
  user-extensible single-select, make `name` a derived field (manufacturer | brand | suffix).
  (`brand` was briefly promoted too, then reverted to free text — see the STATUS correction banner.)
RELATED:
  - planning/archive/dated/2026-06-23/window-frames-catalog-enums/ (the proven precedent this mirrors)
  - context/DATA_STORAGE.md + context/technical-requirements/data-model.md §6.6.4 (the catalog option store)
  - backend/features/catalogs/glazing_types/
  - frontend/src/features/catalogs/glazing-types/
---

# Refactor — Window-Glazing Catalog → constrained vocabularies + derived name

## Why this exists

This is the **glazing twin of the completed `window-frames-catalog-enums`
refactor**. The glazing-types catalog stores `manufacturer` and `brand` as free
**text**, and the AirTable seed already shows the same drift the frame catalog
had: `INTUS`/`ZOLA` (all-caps) for the title-case `Intus`/`Zola` that the frame
catalog standardized on, plus a `DEFAULT` manufacturer artifact. We want enforced
vocabularies so values group reliably, and we want `name` to be a **derived**
label so it can never drift from its parts.

The frame refactor was explicitly built so this would be cheap: its option store
is generic (`catalog_field_options`, keyed by `(catalog_table, field_key)`) and
already lists `glazing_types` in its allowlist. **D-7 of the frame decisions:**
*"scope this refactor to frame-types only, but build the option store generic so
glazing/materials adopt it next without a redesign."* This is that adoption.

## What Ed asked for

1. Convert two text fields → single-select: **Manufacturer, Brand**.
2. Make **Name** a formula:

   ```
   MANUFACTURER
   & IF(BRAND,  " | " & BRAND,  "")
   & IF(SUFFIX, " | " & SUFFIX, "")
   ```

   i.e. `manufacturer | brand | suffix`, dropping null/empty parts. (`suffix`
   stays free text — it is *not* promoted to single-select.)
3. Seed the single-select options from the values already in the catalog.
4. Let users **add new option values** in the future.

## Read order

1. `research.md` — current glazing state, the "what already exists from the frame
   refactor" inventory, the name-is-lossless check, and the downstream-consumer
   map (read this first).
2. `decisions.md` — the glazing-specific decisions. **All resolved** (D-6 settled
   by Ed 2026-06-24: drop the `DEFAULT` rows, one sentinel → `PHN-Default-Glass`).
3. `PLAN.md` — high-level phased sequence (the overview).
4. `phases/` — detailed, file-level implementation plan per phase (map below).
5. `STATUS.md` — current state and next step.

## Phase map

| Phase | File | Summary | Status |
| --- | --- | --- | --- |
| 0 | `phases/phase-00-canonical-vocab-and-cleanup.md` | Add the glazing option sets + fold map to `_option_seeds.py`; clean `glazing-types.v1.json` (fold `INTUS`/`ZOLA`, drop `DEFAULT` rows); rename sentinel → `PHN-Default-Glass`. | ✅ Done |
| 1 | `phases/phase-01-wire-option-store.md` | Wire glazing onto the **existing** `catalog_field_options` store: options service + models + routes + seed migration. **No new table.** | ✅ Done |
| 2 | `phases/phase-02-write-validation.md` | Reject unknown values on create/patch for `manufacturer` + `brand`. | ✅ Done |
| 3 | `phases/phase-03-derived-name.md` | Server-compute read-only `name` (`manufacturer \| brand \| suffix`); drop `name` from the glazing drift keys. (Default-by-id is **already done**.) | ✅ Done |
| 4 | `phases/phase-04-import-export-v2.md` | Import v2: fold legacy casing, compute name on import, auto-add unknown options, drop the missing-name gate. | ✅ Done |
| 5 | `phases/phase-05-frontend-single-select.md` | Two fields → single_select, read-only name, inline-add wired to the store. (Manage-options modal inherits the shared v1.1 blocker.) | ✅ Done |
| 6 | `phases/phase-06-cleanup-docs-closeout.md` | Fold decisions into `context/`, closeout gate, mark Complete. | ✅ Done |

Dependency order: 0 → 1 → 2 → 3 → 4 → 5 → 6. Phases 1–4 are backend-only and each
ends green on `make ci`; Phase 5 is the only frontend phase.

## Headline conclusions

- **The hard part is already built.** The frame refactor stood up the catalog
  option store (`catalog_field_options`, `_options_repository.py`,
  `_option_seeds.py`), the `SingleSelectOption` reuse, the derived-name pattern,
  the import-v2 upgrade machinery, and **default-resolution by id**. Glazing
  *wires onto* all of it — no new table, no new store, no new conversion
  semantics. This is a smaller, lower-risk refactor than the frame one was.
- **Default-by-id is already done for glazing.** `default_refs.get_default_glazing`
  already resolves the sentinel by id (`recPHNDefGlazng01`), not by name
  (`default_refs.py:86-96`). The frame refactor fixed both catalogs at once, so
  the frame's highest-risk item (D-5) is a **no-op** here.
- **Name-as-derived is lossless** against the *cleaned* seed — `manufacturer |
  brand | suffix` reproduces every existing glazing `name` once the `INTUS`/`ZOLA`
  casing is folded to `Intus`/`Zola` (research §2).
- **Smaller blast radius than frame:** only **two** single-select fields, a
  **3-part** name (vs 8), and a single drift-key removal. No swapped-field
  cleanup.
- **One genuinely new judgement call (flagged, not blocking):** glazing `brand`
  is **near-unique per row** (~40 distinct brands across 43 rows — each a glass
  make-up string like `44.2_CG/12Ar/4/14Ar/CG_6`). Strict single-select gives
  little *grouping* benefit and leans entirely on frictionless inline-add. We
  honor Ed's request; see `decisions.md` D-1.
- **D-6 resolved (Ed, 2026-06-24):** match frame — **drop** the two `DEFAULT`
  manufacturer seed rows and keep a **single** default sentinel, **renamed**
  `PHN-Default-Glazing` → `PHN-Default-Glass` for parity with `PHN-Default-Frame`
  (a display-label-only change, since defaults resolve by id; code identifiers stay
  `*_GLAZING_*`). All decisions are now settled.
