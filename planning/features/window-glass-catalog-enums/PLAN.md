---
DATE: 2026-06-24
TIME: 16:10 EDT
STATUS: Planning — all decisions resolved; ready to execute
AUTHOR: Claude (Opus 4.8)
SCOPE: Phased implementation plan for window-glass-catalog-enums
RELATED: ./research.md, ./decisions.md, ./README.md, ./phases/
---

# PLAN — window-glass-catalog-enums

> **High-level overview.** File-level plans (targets, signatures, SQL, tests, exit
> gates) live under `phases/`, one file per phase. Start at
> `phases/phase-00-canonical-vocab-and-cleanup.md`.

Assumes the resolved decisions: D-1 `manufacturer` + `brand` single-select; D-2
existing store, label-string; D-3 backend-computed name; D-4 inline-add + import
auto-add; D-5 default-by-id (already done); D-6 **drop** the two `DEFAULT` rows +
keep one sentinel renamed `PHN-Default-Glass` (Ed, 2026-06-24); D-7 glazing-only.

All work is backend + catalog-frontend; **no aperture-consumer changes** (the
default-glazing lookup already resolves by id). Each phase is independently
shippable and ends green on `make ci` (per the closeout gate). The whole refactor
is a *thin mirror* of the merged `window-frames-catalog-enums` — cite the frame
archive when in doubt.

---

## Phase 0 — Canonical vocab + seed cleanup ✅

- Add to `backend/features/catalogs/_option_seeds.py`:
  `GLAZING_TYPE_OPTION_SEEDS` (manufacturer + brand), `GLAZING_TYPE_SINGLE_SELECT_FIELDS
  = ("manufacturer", "brand")`, `GLAZING_TYPE_VALUE_FOLDS` (casing folds
  `intus→Intus`, `zola→Zola`).
- Clean `backend/seeds/catalogs/glazing-types.v1.json`: fold `INTUS`/`ZOLA` casing,
  **drop** the two `DEFAULT` rows (D-6); names are recomputed (Phase 3) so no manual
  name edits needed.
- **Rename the default sentinel** (D-6): set `APERTURE_DEFAULT_GLAZING_NAME` value
  → `"PHN-Default-Glass"` and add a one-line migration `UPDATE catalog_glazing_types
  SET name='PHN-Default-Glass' WHERE id='recPHNDefGlazng01'`. Display-label only —
  resolution is by id; code identifiers stay `*_GLAZING_*`.

**Verify:** every distinct seed `manufacturer`/`brand` value is canonical
(cross-check vs `GLAZING_TYPE_OPTION_SEEDS`).

---

## Phase 1 — Wire glazing onto the existing option store ✅

**No new table** — `catalog_field_options` + `_options_repository.py` already serve
glazing (research §0).

- **Models:** extend `glazing_types/models.py` with `CatalogGlazingTypeOptionsResponse`
  (all fields at once) and reuse the **generic** `CatalogFieldOptionsResponse` /
  `EditCatalogOptionsRequest`. Those two generics currently live in
  `frame_types/models.py` — **relocate them to a shared module** (`catalogs/_shared.py`
  or `catalogs/_options_models.py`) so glazing doesn't import from frame (small,
  generic, allowed). See phase-01 for the relocate vs. import trade-off.
- **Service:** `glazing_types/options_service.py` — `list_glazing_type_options`,
  `edit_glazing_type_options` (validate field ∈ {manufacturer, brand} →
  `validate_option_list` → in-place renames rewrite rows → delete/merge cascade →
  `replace_options` → `recompute_names`), and reusable `seed_glazing_type_options(conn)`.
  Direct mirror of `frame_types/options_service.py`.
- **Routes:** `GET/PUT /api/v1/catalogs/glazing-types/options`, declared **before**
  `/{record_id}` (Starlette declaration-order).
- **Seed migration:** `00XX_seed_catalog_glazing_type_options.py` (next free rev) —
  materialize `GLAZING_TYPE_OPTION_SEEDS`, `ON CONFLICT DO NOTHING`. Mirror `20260623_0038`.

**Verify:** pytest for option CRUD + cascade guard (mirror
`tests/test_catalog_field_options.py`, parameterized for `glazing_types`);
`GET/PUT …/glazing-types/options` reachable; seed produces the expected sets.

---

## Phase 2 — Strict write-validation on `manufacturer` + `brand` ✅

- `_validate_single_selects(conn, values)` in `glazing_types/service.py` (mirror
  `frame_types/service.py:36-60`), checking the two fields against the live option
  store; null/empty allowed; unknown → `catalog_option_unknown` (422). Wire into
  `create_glazing_type` + `update_glazing_type`.
- Move existing glazing test fixtures to canonical option values + add an autouse
  option-reset (mirror the frame Phase 2 fixture note).

**Verify:** pytest — unknown value rejected; known value succeeds; add-option-then-use
succeeds. Import path still bypasses validation (handled in Phase 4). `make ci` green.

---

## Phase 3 — Derived `name` ✅

- `glazing_types/_name.py` — `compose_glazing_name(fields)`: parts `("manufacturer",
  "brand", "suffix")`, ` | ` join, drop null/empty, clamp 200. Mirror `frame_types/_name.py`.
- `repository._COMPOSE_NAME_SQL` (the `concat_ws`/`NULLIF(btrim(...))` twin) +
  `repository.recompute_names(conn)` skipping `APERTURE_DEFAULT_GLAZING_ID`.
- Service: compute `name` on create; recompute on patch when a part changes; the
  `model_dump()` already excludes `name` once it's dropped from the write models.
- **Models:** make `name` server-derived — drop it from
  `CatalogGlazingTypeCreateRequest`/`UpdateRequest` (rely on `extra="forbid"` to
  reject inbound `name`), mirroring `CatalogFrameTypeCreateRequest`.
- **Backfill migration:** `00YY_glazing_type_name_backfill.py` — recompute `name`
  for all rows except the sentinel. Mirror `20260623_0039`.
- **Drift:** drop `"name"` from `_GLAZING_KEYS` (`aperture_drift/comparator.py:41`)
  + update the comment (mirror the frame `_FRAME_KEYS` change).
- **Duplicate:** with derived name, a copy has an identical name — drop the
  `(copy)` suffix logic (`service.duplicate_glazing_type` `next_copy_suffix`),
  mirroring frame's duplicate (distinguished by id, not a suffixed name).

**Verify:** pytest — composer matches every existing seed `name` (regression
corpus from the cleaned seed); sentinel keeps its label + still resolves; drift no
longer reports name deltas. `make ci` green.

---

## Phase 4 — Import / export v2 ✅

- Bump `glazing_types/import_export/file_format.CURRENT_SCHEMA_VERSION` 1 → 2.
- `_name.py` import in `coerce.py`; **drop the `ERR_MISSING_NAME` gate**; compute
  `name = compose_glazing_name(cleaned)` after the parts coerce.
- `upgrade.py`: add `_upgrade_v1_to_v2` (fold `INTUS`/`ZOLA` casing via
  `GLAZING_TYPE_VALUE_FOLDS`; **drop** `DEFAULT` rows → `None` + `dropped` count,
  per D-6); allow `None` return + step entry `1:`.
- `pipeline.py`: add `known_options` param, dropped-row handling, `_new_option_fields`
  detection (→ `new_option:<field>` warnings + `new_options` accumulation),
  `dropped` on `PreviewCounts`, pass `new_options` to `WriteSet`.
- `tokens.py`: add `new_options` field to `WriteSet`.
- `service.py`: `_read_known_options` + pass to `build_preview`; `_auto_add_new_options`
  (→ `_options_repository.append_options`, case-insensitive) called on commit before
  row inserts.

All six glazing import/export files change; **direct mirrors of the frame v2 files.**

**Verify:** round-trip pytest (export → import → identical rows); a v1 file with
`INTUS` and a missing `name` imports clean as v2; unknown brand auto-adds with a
`new_option:brand` warning. `make ci` green.

---

## Phase 5 — Frontend single-select + read-only name ⬜

- **Shared frontend** (`catalogs/api.ts`, `query-keys.ts`, `hooks.ts`, `types.ts`):
  add `getGlazingTypeOptions`/`putGlazingTypeOptions`, `glazingTypeOptions()` key,
  `useGlazingTypeOptionsQuery()`, and the option/edit TS types — mirror the frame
  additions.
- `glazing-types/fieldDefs.ts`: `manufacturer`/`brand` → `single_select`; `name`
  `read_only: true`; add `GLAZING_TYPES_SINGLE_SELECT_FIELDS` +
  `buildGlazingTypesFieldOverlay(optionsByField)` (options unlocked so inline-add
  works; `field_type` locked).
- `glazing-types/controller.ts`: id↔label maps (`buildGlazingTypeOptionMaps`),
  drop `name` from create/update payloads, inline-add persists option before the
  row write, `legacyOptions` schemaMutation → `PUT …/options` (logic only — modal
  unreachable per D-4). Mirror `frame-types/controller.ts`.
- `routes/GlazingTypesCatalogPage.tsx`: wire the options query, build the overlay,
  pass `optionsByField` to the controller.
- `glazing-types/import_export/types.ts`: `CURRENT_SCHEMA_VERSION` 1→2; add
  `dropped` to `PreviewCounts` (the `ImportDialog` already renders both).

**Verify:** vitest for fieldDefs/controller/export (mirror the frame `__tests__`);
Playwright MCP smoke — pick option, add new option (persists across reload), name
recomposes from parts, name read-only. `pnpm run format`; `make ci` green.

---

## Phase 6 — Cleanup, docs, closeout ⬜

- Fold accepted decisions into `context/` (note glazing now on the
  `catalog_field_options` store in `DATA_STORAGE.md` / `data-model.md §6.6.4`;
  update any "frame-types only" qualifier).
- Run `simplify` + `docs-pass` skills on the diff; `make format`; `make ci`.
- Update STATUS to Complete with evidence; archive per
  `planning/.instructions.md`.

---

## Risk / sequencing notes

- **Lower risk than frame.** The two highest-risk frame items — the net-new option
  store and the default-resolution change — are **already shipped** (research §0).
  Glazing's changes are thin mirrors against proven code.
- **Highest remaining risk:** the import v2 upgrade (Phase 4 — six files) and the
  frontend id↔label translation (Phase 5). Both have a fully-worked frame template.
- **Lowest risk:** drift-key removal, seed migration, write-validation.
- **Dependency order:** Phase 0 (clean values) → 1 (store wiring) → 2 (validation)
  → 3 (derived name) → 4 (import v2) → 5 (frontend) → 6.
- **No backwards-compat constraint** (no users/deploy — project CLAUDE.md Status),
  so the seed/dev DB can be rewritten/reseeded freely.
- **Public repo:** keep all seed/option data generic; no PHI/PHPP/licensed values.
