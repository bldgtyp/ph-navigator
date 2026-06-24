---
DATE: 2026-06-24
TIME: 16:10 EDT
STATUS: Planning — plan complete; all decisions resolved; ready to execute
AUTHOR: Claude (Opus 4.8)
SCOPE: window-glass-catalog-enums
RELATED: ./README.md, ./research.md, ./decisions.md, ./PLAN.md, ./phases/
---

# STATUS — window-glass-catalog-enums

**State:** `Backend complete — PAUSED before Phase 5 (frontend)`. The entire
**backend** half of the refactor (Phases 0–4) is implemented, committed, and
green (full backend suite 1087 passed; ruff/ty clean). Stopped here at Ed's
direction (2026-06-24) — the only remaining work is **Phase 5 (frontend)** and
**Phase 6 (closeout + archive)**, and Phase 5 overlaps a frontend area Ed is
editing in parallel, so it is deferred until Ed resumes it. All decisions
resolved (D-6 settled by Ed 2026-06-24: drop the two `DEFAULT` rows, keep one
sentinel renamed `PHN-Default-Glass`).

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

## Next step — RESUME HERE (deferred at Ed's direction)

**Phase 5 (frontend)** is the next phase, deferred until Ed picks it back up
(see `phases/phase-05-frontend-single-select.md` for the full plan):
`manufacturer` + `brand` → `single_select` with options fetched from the store,
read-only derived `name`, inline-add wired to `PUT …/options`; id↔label
translation in `glazing-types/controller.ts`; import dialog shows the new
`dropped` count. It is the only frontend phase and the first to need a dev-server
**browser smoke** (sign in as Ed; the seeded project is `ed@example.com`'s). It
overlaps a frontend area Ed is actively editing — coordinate before starting.

Then **Phase 6** closeout: fold decisions into `context/`, run the
`simplify` + `docs-pass` + `make ci` gate, mark Complete, and archive the packet
to `planning/archive/dated/<date>/`.

**Pre-resume sanity:** the backend is at migration head `20260624_0042`; a fresh
`make db-seed` (clear DB first — seeds duplicate otherwise) loads the cleaned
41-row glazing catalog + the 13 manufacturer / 39 brand options for the smoke.

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
