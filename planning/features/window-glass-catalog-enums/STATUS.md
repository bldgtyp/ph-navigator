---
DATE: 2026-06-24
TIME: 16:10 EDT
STATUS: Planning — plan complete; all decisions resolved; ready to execute
AUTHOR: Claude (Opus 4.8)
SCOPE: window-glass-catalog-enums
RELATED: ./README.md, ./research.md, ./decisions.md, ./PLAN.md, ./phases/
---

# STATUS — window-glass-catalog-enums

**State:** `In progress` — Phases 0–3 done; Phase 4 next. All decisions resolved
(D-6 settled by Ed 2026-06-24: drop the two `DEFAULT` rows, keep one sentinel
renamed `PHN-Default-Glass`).

**Phase 3 (done 2026-06-24):** `name` is now server-derived/read-only
(`manufacturer | brand | suffix`). Added `glazing_types/_name.py`
(`compose_glazing_name`), `repository._COMPOSE_NAME_SQL` + `recompute_names`
(skips the sentinel by id), backfill migration `20260624_0042`. Dropped `name`
from the create/update models (`extra="forbid"` rejects inbound name) and from
the drift comparator `_GLAZING_KEYS`. Service computes name on create, recomputes
on a name-part patch, and `duplicate` copies the derived name (removed the
`(copy)` suffix + orphaned `list_sibling_names`). Wired `recompute_names` into
`edit_glazing_type_options` (the Phase-1 deferral). Verified: composer is lossless
against the cleaned seed; full backend suite green (1083 passed); ruff/ty clean.

**Phase 2 (done 2026-06-24):** added `_validate_single_selects` to
`glazing_types/service.py` (mirror of frame), wired into `create` + `update`;
unknown `manufacturer`/`brand` → `catalog_option_unknown` (422); null/empty
allowed; `duplicate` deliberately skips (source already validated). Moved the
glazing test fixtures to canonical option values (Kawneer/GL-1) + added an
autouse option-reset; 5 new validation tests. Full backend suite green
(1079 passed); ruff/ty clean.

**Phase 1 (done 2026-06-24):** wired glazing onto the existing
`catalog_field_options` store — relocated the catalog-generic
`CatalogFieldOptionsResponse`/`EditCatalogOptionsRequest` DTOs to
`catalogs/_shared.py` (frame import sites repointed), added
`CatalogGlazingTypeOptionsResponse`, `glazing_types/options_service.py` (mirror
of frame, minus the Phase-3 `recompute_names` call), `GET/PUT
…/glazing-types/options` routes, and seed migration `20260624_0041`. Verified:
fresh-migrate seeds 13 manufacturer + 39 brand options; 44 contract/option tests
green; full backend suite green; ruff/ty clean.

**Phase 0 (done 2026-06-24):** added `GLAZING_TYPE_OPTION_SEEDS` (13
manufacturers + 39 brands), `GLAZING_TYPE_SINGLE_SELECT_FIELDS`,
`GLAZING_TYPE_VALUE_FOLDS`, `GLAZING_TYPE_DROP_MANUFACTURERS` to
`_option_seeds.py`; cleaned `glazing-types.v1.json` (43→41 rows: dropped the two
`DEFAULT` rows, folded `INTUS`/`ZOLA` casing, recomputed names); renamed the
default-glazing sentinel `PHN-Default-Glazing`→`PHN-Default-Glass` via migration
`20260624_0040` + the shared constant + `seed_dev_db`. Verified: seed↔option
cross-check clean (no EXTRA, no orphan options); fresh-migrate sentinel reads
`PHN-Default-Glass`; `ruff`/`ty` green; `test_seed_dev_db.py` 6/6 pass.

## Done

- Mapped the current glazing data shape, the seed's distinct values, and the drift
  (`INTUS`/`ZOLA` casing, the `DEFAULT` artifact) that motivates the change
  (research §1).
- Confirmed the reuse inventory: the option store, repository, derived-name
  pattern, import-v2 machinery, and **default-by-id** all already exist from the
  frame refactor — glazing wires onto them (research §0).
- Confirmed name-as-derived is lossless against the cleaned seed
  (`manufacturer | brand | suffix`) (research §2).
- Confirmed the sentinel is NULL-parts + resolved by id, so derived name is safe
  and `recompute_names` must skip it (research §3).
- Full downstream map: only the drift comparator (`_GLAZING_KEYS` drops `name`) and
  the import/export files change; no aperture-consumer change (research §4).
- File-level phase plans drafted, each a thin mirror of the merged frame code with
  cited `file:line` targets.

## Next step

Execute **Phase 4** (import/export schema v1→v2: fold legacy `INTUS`/`ZOLA`
casing, drop `DEFAULT` rows on import, compute name on import + drop the
missing-name gate, auto-add unknown options, surface `dropped`/`new_option`
counts), then 5 → 6 in order. Phase 5 is the frontend; Phase 6 is closeout +
archive.

Recommended execution: run via the `implement-loop` skill phase-by-phase, or
`implement` per phase, with the closeout gate after the last code phase.

## Blockers

- None. D-6 is resolved (drop the two `DEFAULT` rows; single sentinel renamed
  `PHN-Default-Glass`). All required primitives exist (option store, derived-name
  pattern, default-by-id) from the frame refactor.

## Inherited decisions (from the frame refactor — no re-litigation)

D-1 `manufacturer` + `brand` single-select (brand is near-unique — flagged, not
blocking) · D-2 existing `catalog_field_options` store, label-string · D-3
`name` computed server-side, read-only · D-4 inline-add + import auto-add;
manage-options modal deferred to v1.1 · D-5 default-by-id **already shipped** ·
D-7 glazing-only (materials next, separately).

## Verification ledger

- Planning only — no phases implemented yet. Each phase doc carries its own
  test list + exit criteria; the closeout gate (Phase 6) is the final
  `simplify` + `docs-pass` + `make ci`.
