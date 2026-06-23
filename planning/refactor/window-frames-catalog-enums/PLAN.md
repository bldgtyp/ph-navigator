---
DATE: 2026-06-23
TIME: 17:51 EDT
STATUS: Active — decisions resolved; Phases 0–1 complete, Phase 2 next
AUTHOR: Claude (Opus 4.8)
SCOPE: Phased implementation plan for window-frames-catalog-enums
RELATED: ./research.md, ./decisions.md, ./STATUS.md
---

# PLAN — window-frames-catalog-enums

> **This file is the high-level overview.** Detailed, file-level implementation
> plans (targets, signatures, SQL, tests, exit gates) now live under `phases/` —
> one file per phase below. See the README phase map. Start at
> `phases/phase-00-canonical-vocab-and-cleanup.md`.

Assumes the resolved decisions: D-1 all six single-select; D-2 option **store
(B)** with **label-string** storage; D-3 **backend-computed** name; D-5 default
resolution **by id**.

All work is backend + catalog-frontend; **no aperture-consumer changes** beyond
the default-frame lookup. Each phase is independently shippable and ends green on
`make ci` (per the closeout gate).

---

## Phase 0 — Canonical vocab + data cleanup ✅ Complete (2026-06-23)

- Resolve `decisions.md` (esp. D-1, D-2, D-3, D-6). ✓
- Finalize the canonical option sets per field from research §1 (cleaned), frozen
  in `backend/features/catalogs/_option_seeds.py`. ✓
- Resolve the `Default` / swapped-`Mercury` / `OP-TO-FIX` seed defects (D-6):
  `backend/seeds/catalogs/frame-types.v1.json` cleaned (190→189 rows). ✓

**Verified:** every distinct seed value per field is canonical (cross-checked vs
`FRAME_TYPE_OPTION_SEEDS`). See `phases/phase-00-…md` Completion section.

---

## Phase 1 — Catalog option store (backend, requirement #4 foundation) ✅ Complete (2026-06-23)

Build the generic, catalog-scoped, user-extensible option store.

- **Migration:** `catalog_field_options(catalog_table TEXT, field_key TEXT,
  option_id TEXT, label TEXT, color TEXT, "order" REAL, …)`, PK
  `(catalog_table, field_key, option_id)`; uniqueness on
  `(catalog_table, field_key, lower(trim(label)))`.
- **Repository:** `backend/features/catalogs/_options_repository.py` (shared) —
  read/replace/add/remove/reorder. Reuse `SingleSelectOption` and
  `project_document/options.py` validators (`validate_option_list`,
  `mint_option_id`).
- **Service + routes:** option CRUD under the frame-types feature
  (`…/frame_types/options/*`), with cascade-guard on delete (reject/merge if any
  active row references the label).
- **Pydantic:** `CatalogFrameTypeOptionsResponse` etc. in
  `frame_types/models.py`.
- **Seed:** migration that materializes the cleaned distinct values (research §1)
  as the initial option lists for the six fields.

**Verify:** new pytest for option CRUD + cascade guard; `make ci` green. Options
list/add/remove reachable via API; seed produces the expected option sets.

---

## Phase 2 — Strict write-validation on the six fields (backend)

- On create/patch, validate each of the six against its option list. Permissive
  **add-on-write** is allowed only through the explicit option-add path (D-4),
  not by silently accepting arbitrary strings.
- Keep columns TEXT storing the label (D-2).

**Verify:** pytest — writing an unknown value is rejected; writing a known
option succeeds; adding an option then using it succeeds. `make ci` green.

---

## Phase 3 — Derived `name` (backend) + default-frame-by-id

- Implement `compose_frame_name(...)` in the service: `manufacturer | prefix |
  brand | use | operation | location | mull_type | suffix`, ` | ` separator,
  drop null/empty. (Mirror the AirTable formula; covered by research §2.)
- Compute `name` on create/patch; **reject** inbound `name`
  (`CatalogFrameTypeCreateRequest`/`UpdateRequest` in `models.py:131-148`).
- Keep the `name` column + index; backfill via migration using the composer.
- **Default resolution:** switch `default_refs._fetch_by_name` →
  `_fetch_by_id` using `recPHNDefFrame001` / `recPHNDefGlazng01`
  (`default_refs.py:75,87,98-104`).
- **Drift:** drop `"name"` from `_FRAME_KEYS`
  (`aperture_drift/comparator.py:21-22`) and update the comment.

**Verify:** pytest — composer matches every existing seed `name` (regression
corpus from the current seed); default-frame dispatch still resolves; drift no
longer reports name deltas. `make ci` green.

---

## Phase 4 — Import / export v2 (backend)

- Bump `schema_version` 1 → 2 (`import_export/file_format.py`,
  `tokens.py`/`upgrade.py`).
- **Upgrade step:** map legacy/typo values into canonical options
  (`OP-TO-FIX → OP-to-FX`, casing, Mercury/CURRIES swap); resolve each of the six
  to a known option (unknown → auto-add via the store, or flag — pick per D-4).
- **Coerce:** drop `ERR_MISSING_NAME` (`coerce.py:29,100-110`); compute `name`
  after the six are resolved; keep the 200-char guard.
- Export: `name` continues to serialize (computed); single-selects serialize as
  **labels** (consistent with `planning/archive/table-csv-download` D4).

**Verify:** round-trip pytest (export → import → identical rows); a v1 file with
`OP-TO-FIX` and a missing `name` imports clean as v2. `make ci` green.

---

## Phase 5 — Frontend single-select + read-only name + manage-options

- `frame-types/fieldDefs.ts`: change the six from `short_text` → `single_select`;
  fetch options from the new endpoint (TanStack Query); leave `options`
  **unlocked** (unlike materials) so inline add works.
- `name`: render read-only/derived; remove it from create/update payloads in
  `controller.ts`; optionally mirror `compose_frame_name` in TS for optimistic
  display.
- Wire inline "+ Add option" (`OptionListDelta`/`newOptions`) to the option
  store; add a field-config "manage options" path (rename/merge/reorder/delete)
  — merge is the `OP-TO-FIX` cleanup tool.
- Update `import_export` frontend types/dialog to v2.

**Verify:** vitest for fieldDefs/controller; Playwright MCP smoke — pick option,
add new option (persists across reload), name updates from parts, read-only name.
`pnpm run format`; `make ci` green.

---

## Phase 6 — Cleanup, docs, closeout

- Fold accepted decisions back into `context/` (catalog data-table notes;
  `data-model.md` if catalog options become a documented store) and flip
  `frame-types-catalog` PRD D4 status.
- Run `simplify` + `docs-pass` skills on the diff; `make format`; `make ci`.
- Update this folder's STATUS to Complete with evidence.

---

## Risk / sequencing notes

- **Highest risk:** default-frame lookup (Phase 3, D-5) and import upgrade
  (Phase 4). Both have verified single points (`default_refs.py:104`,
  `coerce.py:100-110`) and clear fixes.
- **Lowest risk:** drift comparator, frontend display.
- **Dependency order:** option store (P1) → write validation (P2) → derived name
  (P3, needs clean values) → import v2 (P4, needs both) → frontend (P5).
- **No backwards-compat constraint** (no users/deploy yet — see project CLAUDE.md
  Status), so the migration can rewrite seed/data freely.
- **Public repo:** keep all seed/option data generic; no PHI/PHPP/licensed values
  (per `project_public_repo_licensed_data` memory).
