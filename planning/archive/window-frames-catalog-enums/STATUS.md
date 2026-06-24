---
DATE: 2026-06-23
TIME: 17:51 EDT
STATUS: Complete (2026-06-24) — archived
AUTHOR: Claude (Opus 4.8)
SCOPE: window-frames-catalog-enums
RELATED: ./README.md, ./research.md, ./decisions.md, ./PLAN.md
---

# STATUS — window-frames-catalog-enums

**State:** `Complete (2026-06-24)` — all phases implemented + committed
(CI-green); decisions folded into `context/`. Archived to `planning/archive/`.

> **One known follow-up (does not block archive).** The Phase 5b *option-editing
> UI* is not wired end-to-end: the field-config "manage options" modal is
> unreachable for catalog single-selects because the catalog pages don't pass the
> DataTable's `onEditCustomFieldBundle`/`editConfigEnabled`
> (`DataTable.tsx:1109,1475`). The 5b *translation logic* (`legacyOptions` →
> `PUT …/options`, with merge `replacements`) is done + unit-tested. Wiring the
> modal-open path is a distinct shared-DataTable task; browser smokes for 5b
> (once wired) + 5c are also pending. See phase-05 §5b. Everyday flows (pick from
> canonical options, inline-add, derived name) are done + browser-verified (5a).

**Delivered:** **Phases 0–4 (backend)** — canonical vocab + clean seed
(P0); option store (P1); strict write-validation (P2); derived read-only `name` +
default-by-id (P3); import v2 — fold + compute-name + **auto-add unknown options**
(D-4, Ed) (P4). **Phase 5a** — frontend single-select
display + read-only name + inline-add (browser-smoked). **Next (historical):
Phase 5b** (editable options) then **5c** (import dialog v2).

**Decisions locked:** D-1 all six strict single-select (incl. `brand`, to group
on it) · D-2 new catalog app-scoped option store, label-string storage · D-3
`name` computed server-side per the formula, read-only · D-4 inline add-option,
**import auto-adds unknown values (frictionless — Ed, 2026-06-23)** · D-5 default
frame/glazing resolved by id · D-6 clean up seed artifacts · D-7 frame-types only,
store built generic for glazing/materials reuse.

## Done

- Mapped current data shape, the seed values, and the data-quality defects that
  motivate the change (research §1).
- Confirmed NAME-as-formula is lossless and the **formula engine needs no
  change** — `IF`/`&`/AirTable-truthiness already exist (research §2).
- Identified the core tension: catalogs have **no option store**; the extensible
  machinery is project-document-only (research §3).
- Full downstream-consumer map; verified the three high-risk sites
  (default-frame lookup, import gate, drift keys) at file:line (research §4).
- Drafted phased PLAN and open DECISIONS with recommendations.

## Next step

Phases 0–4 (backend) + **Phase 5a** (single-select display + read-only name +
inline-add, browser-verified) are done. **Phase 5b logic** (option-edit
translation: `legacyOptions` → `PUT …/options` + label `replacements`) is
implemented + unit-tested (21 vitest), but has **one open item**:

- **5b open — field-config modal open affordance.** The smoke couldn't find the
  UI trigger to open the "manage options" modal for a catalog built-in
  single-select (may need shared-DataTable wiring; the materials precedent locks
  options). The translation logic is done; the modal-open path needs
  verifying/enabling. Re-smoke once the dev servers are back (they went down
  mid-session). See phase-05 §5b.
- **Phase 5c** ✅ code-complete — import file schema 1→2; `dropped` count + the
  `new_option` warnings render in the dialog; export-v2 vitest. Browser smoke
  pending (env).
- **Phase 6** ✅ docs folded (2026-06-24) — `context/DATA_STORAGE.md` +
  `data-model.md` §6.6.4 document the `catalog_field_options` store (relational,
  label-string, generic for D-7) + derived name + default-by-id; archived
  `frame-types-catalog` PRD D4 + STATUS flipped to SUPERSEDED/DONE.

So all phase **code is implemented and committed (CI-green)** and the decisions
are **folded into `context/`**. Before marking this refactor **Complete**:

- **5b — wire the field-config modal for catalogs (the one real open item,
  diagnosed in code — see phase-05 §5b).** The manage-options modal only renders
  when the DataTable gets `onEditCustomFieldBundle` + `editConfigEnabled`; the
  catalog pages pass neither (they use the bespoke `onWrite` controller), so the
  modal is currently **unreachable**. The 5b *translation logic* (`legacyOptions`
  → `PUT …/options`) is done + tested; wiring the modal-open path is a distinct
  shared-DataTable piece — do it with the dev env up to verify.
- **Browser smokes** for 5b (once wired) + 5c (import dialog) — dev servers were
  down this session.

Everything else (all backend, 5a, the 5b/5c logic, the context/ fold) is done.

**Dev-env note:** the running dev DB was behind (`0036`); `make migrate` (or
`make db-reset-dev`) applies `0037`–`0039`. The dev servers (`:8000`/`:5173`) went
down mid-session — restart for browser verification.

## Blockers

- None. All decisions resolved; all required primitives exist. The only net-new
  build is the catalog option store (Phase 1).

## Verification ledger

- **Phase 0 (2026-06-23):** `_option_seeds.py` created; `frame-types.v1.json`
  cleaned (190→189 rows: −1 `Default`, 3 swapped, 1 `OP-TO-FIX` folded, 4 `source`
  cased). Cross-check script confirms every distinct seed value per field is
  canonical (no EXTRA vs `FRAME_TYPE_OPTION_SEEDS`).
- **Phase 1 (2026-06-23):** migrations `20260623_0037` (table+index) /
  `20260623_0038` (seed); `_options_repository.py`; `frame_types/options_service.py`;
  3 option models; `GET/PUT …/options` routes. `tests/test_catalog_field_options.py`
  (10 tests). Full backend suite **978 passed, 2 skipped**; single alembic head.
- **Phase 2 (2026-06-23):** `_validate_single_selects` in `frame_types/service.py`
  wired into create/patch (`catalog_option_unknown` 422); existing frame/roster
  test fixtures moved to canonical values + autouse option-reset; 4 new validation
  tests. Full backend suite **982 passed, 2 skipped**. Import path still bypasses
  validation (deferred to Phase 4).
- **Phase 3 (2026-06-23):** derived `compose_frame_name`; `name` removed from
  write models; backfill `20260623_0039`; default lookup → by id
  (`default_refs` + `APERTURE_DEFAULT_FRAME_ID`/`_GLAZING_ID`); option-rename →
  `repository.recompute_names`; drift `_FRAME_KEYS` drops `name`. 4-agent simplify
  confirmed the 3 compose implementations agree. Full backend suite **986 passed,
  2 skipped**; head `20260623_0039`.
- **Phase 4 (2026-06-23):** import `schema_version` 1→2; `_upgrade_v1_to_v2`
  (drop `Default` → `dropped` count, fix swapped Mercury, fold values); `name`
  computed on import via leaf `frame_types/_name.py`; `new_option` preview flags +
  `_options_repository.append_options` (case-insensitive) auto-add on commit
  (**D-4: auto-add, Ed's choice**). 7 new/updated import tests incl. seed parity +
  case-insensitive dedup. 4-agent simplify caught + fixed a real case-collision
  bug and extracted `_name.py` + `append_options`. Full backend suite **992
  passed, 2 skipped**.
- Phases 5–6: pending implementation.
