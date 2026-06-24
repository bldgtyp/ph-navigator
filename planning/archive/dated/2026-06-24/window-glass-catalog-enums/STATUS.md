---
DATE: 2026-06-24
TIME: 16:10 EDT
STATUS: Complete (2026-06-24) — all phases shipped, gate green, context/ folded, packet archived
AUTHOR: Claude (Opus 4.8)
SCOPE: window-glass-catalog-enums
RELATED: ./README.md, ./research.md, ./decisions.md, ./PLAN.md, ./phases/
---

# STATUS — window-glass-catalog-enums

**State:** `Phases 0–5 done — Phase 6 closeout in progress`. The **backend**
(Phases 0–4) and the **frontend** (Phase 5) are both implemented and green.
Phase 5 was resumed 2026-06-24 when Ed re-ran the implement-loop on this packet;
it shipped the glazing single-select wiring as a faithful mirror of the merged
frame-types code. All decisions resolved (D-6 settled by Ed 2026-06-24: drop the
two `DEFAULT` rows, keep one sentinel renamed `PHN-Default-Glass`).

> **Concurrent-edit note (2026-06-24):** while Phase 5 was implemented, Ed had
> unrelated frontend WIP (envelope: `AssemblyHeader.tsx`, `AssemblyWorkspace.tsx`,
> `envelope.css`) in the working tree. The Phase 5 commit was scoped to
> `frontend/src/features/catalogs/` only, leaving that WIP unstaged.

**Phase 5 (done 2026-06-24):** glazing-types DataTable now renders `manufacturer`
+ `brand` as `single_select` fed from the catalog option store, `name` as a
read-only server-derived cell, and inline "+ Add option" persisting to
`PUT …/glazing-types/options` before the row PATCH. Added the shared FE plumbing
(`getGlazingTypeOptions`/`putGlazingTypeOptions`, `glazingTypeOptions` query key,
`useGlazingTypeOptionsQuery`, glazing option types in `types.ts`; dropped `name`
from the create payload). Rewrote `glazing-types/{fieldDefs,controller}.ts` and
the `GlazingTypesCatalogPage` wiring with id↔label translation at the REST
boundary; bumped import schema v1→v2 (`dropped` count surfaced in `ImportDialog`).
Reworked `fieldDefs`/`controller` tests + added `export.test.ts` (21 catalog tests
green). Verified: `tsc -b` + `vite build` clean; `make frontend-dev-check` green.
The `simplify` pass found no code changes (one reuse note — `CatalogGlazingTypeOption`
vs shared `FieldOption` — deferred to the v1.1 shared-abstraction task to preserve
mirror symmetry). **Browser smoke still pending** (Phase 6).

> **Commit-history note (2026-06-24):** Phase 4 landed in commit `4f6e95a1`
> ("glazing-types: import v2 fold+auto-add options"), which a concurrent commit
> on Ed's side **bundled together with unrelated frontend WIP** (apertures /
> envelope) under an auto-generated message rather than the prepared Phase 4
> message. Left as-is per Ed — the Phase 4 backend content is correct and
> complete; the bundling is cosmetic. Phases 0–3 are clean single-purpose
> commits (`344f8a65`, `125c4d95`, `f015b342`, `8aea9dfd`).

**Phase 4 (done 2026-06-24):** glazing import/export upgraded schema **v1→v2**
(mirror of frame). `file_format.CURRENT_SCHEMA_VERSION` 1→2; `upgrade.py` adds
`_upgrade_v1_to_v2` (drops `DEFAULT` rows → `None`/`dropped` count, folds
`INTUS`/`ZOLA` casing); `coerce.py` computes `name` from the folded parts and
drops the missing-name gate; `pipeline.py` flags `new_option:<field>` + carries
`dropped`/`new_options`; `service.py` reads known options for the preview and
auto-adds unknowns on commit (the import path stays lenient — create/patch reject,
D-4). Reworked the import tests for v2 + added a seed-parity test. Verified: full
backend suite green (1087 passed); ruff/ty clean.

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

**Phase 6 (done 2026-06-24):** folded glazing-on-the-store into
`context/DATA_STORAGE.md` (the `catalog_field_options` row now lists frame-types
**and** glazing-types as wired, materials as the only holdout; added the
`20260624_0041` glazing seed migration to the provenance). `data-model.md`
§6.6.4 was already catalog-generic — no change. Ran the closeout gate (simplify
→ no code changes; docs-pass; `make format`; `make ci` green). Browser smoke run
against the dev server (see ledger). Marked Complete and archived the packet to
`planning/archive/dated/2026-06-24/window-glass-catalog-enums/`.

## Carry-forward (open after this packet)

- **Manage-options modal (D-4)** stays open + shared — both catalog pages still
  lack the field-config bundle wiring; tracked under
  `planning/features_v1.1/catalog-manage-options-modal/`.
- **Materials** is the only un-migrated catalog (D-7) — separate future effort;
  the store is already generic for it.
- **Rule-of-three unify** the per-catalog option/import services + the
  `CatalogFrameTypeOption`/`CatalogGlazingTypeOption` vs shared `FieldOption`
  duplication — fold into parameterized shared helpers when materials becomes the
  third consumer, not before (deferred; flagged by the Phase 5 reuse review).
- **Dev DB was stale** at smoke time (legacy `DEFAULT`/uppercase-`INTUS` rows);
  the committed seed is clean. A clear-first `make db-seed` refreshes it. Not a
  code defect — see ledger + the `project_dev_db_stale_vs_seed` memory.

## Inherited decisions (from the frame refactor — no re-litigation)

D-1 `manufacturer` + `brand` single-select (brand is near-unique — flagged, not
blocking) · D-2 existing `catalog_field_options` store, label-string · D-3
`name` computed server-side, read-only · D-4 inline-add + import auto-add;
manage-options modal deferred to v1.1 · D-5 default-by-id **already shipped** ·
D-7 glazing-only (materials next, separately).

## Verification ledger

- **Phase 0–4 (backend):** full backend suite green across the cohort
  (1079 → 1087 passed as each phase landed); ruff/ty clean. Seed↔option
  cross-check clean; fresh-migrate sentinel reads `PHN-Default-Glass`.
- **Phase 5 (frontend):** 21 catalog vitest tests green (fieldDefs 7, controller
  11, export 1, query-keys 2); `tsc -b` + `vite build` clean.
- **Closeout gate:** `simplify` (4-agent pass) found **no** code changes — one
  reuse note (`CatalogGlazingTypeOption` vs `FieldOption`) deferred to v1.1 to
  preserve frame mirror symmetry. `make ci` green: **1902 frontend tests**,
  build clean, backend suite green.
- **Browser smoke (2026-06-24, dev server, signed in as `codex@example.com` —
  catalog data is global, not project-scoped):** confirmed live on
  `/catalog/glazing-types` — `manufacturer` + `brand` render as `single_select`
  fed from the option store (valid labels Alpen/Internorm/Kawneer/Lamilux/…
  resolve to pills); `name` is server-derived and displays
  `manufacturer | brand | suffix` (e.g. `Kawneer | GL-1 | S`); `suffix` is plain
  text (not a select); the `PHN-Default-Glass` sentinel renders correctly; the
  single-select editor opens on Enter; unknown labels fall back to "Missing
  option". The full inline-add-persists-across-reload click-through was **not**
  exercised live — the dev DB was stale (legacy `DEFAULT`/uppercase-`INTUS` rows;
  the committed seed is clean) and a clear-first re-seed would have wiped Ed's
  active session — but that path is covered by the controller unit tests
  (inline-add persists the option before the PATCH; create omits `name`).
