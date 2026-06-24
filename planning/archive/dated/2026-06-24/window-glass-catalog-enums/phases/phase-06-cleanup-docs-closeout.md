---
DATE: 2026-06-24
TIME: 16:10 EDT
STATUS: Done (2026-06-24) — context/ folded; closeout gate green; smoke run; packet archived
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 6 — fold decisions into context/, run the closeout gate, mark Complete
RELATED:
  - ../README.md, ../decisions.md
  - context/DATA_STORAGE.md, context/technical-requirements/data-model.md §6.6.4
  - CLAUDE.md "Closeout gate"
---

# Phase 6 — Cleanup, docs, closeout

## Goal

Land the refactor: fold the accepted decisions back into `context/`, run the repo
closeout gate, and archive this feature folder.

## Work items

### 6.1 Fold decisions into `context/`

The frame refactor documented the `catalog_field_options` store in
`context/DATA_STORAGE.md` and `data-model.md §6.6.4` as "generic for glazing/
materials reuse (D-7)". Update those to reflect that **glazing is now wired** onto
the store (manufacturer + brand), with the 3-part derived name. Remove or soften
any "frame-types only" qualifier. Keep it concise — the store design is unchanged;
this is just a second consumer.

### 6.2 Closeout gate (CLAUDE.md)

1. Run the `simplify` skill on the diff; wait for it to finish. (As frame did, a
   small multi-agent check that the three name implementations —`_name.py`,
   `_COMPOSE_NAME_SQL`, the backfill migration— agree is cheap insurance.)
2. Run the `docs-pass` skill on the diff; wait for it to finish.
3. `make format` from repo root.
4. `make ci` (substantial change — backend + frontend).
5. If `make format` changed files, re-inspect the diff and re-run `make ci`.
6. Do not call it done while any `make ci` step is red.

### 6.3 STATUS → Complete + archive

- Update `STATUS.md` to `Complete (<date>)` with the verification ledger (per-phase
  test counts + final `make ci` result), mirroring the frame STATUS.
- Archive per `planning/.instructions.md`: move
  `planning/features/window-glass-catalog-enums/` →
  `planning/archive/dated/<YYYY-MM-DD>/window-glass-catalog-enums/` and add one
  newest-first line to `planning/archive/README.md`.

## Carry-forward / known follow-ups

- **Manage-options modal (D-4)** stays open and shared — both catalog pages still
  lack the field-config bundle wiring. It remains tracked under
  `planning/features_v1.1/catalog-manage-options-modal/`; this refactor does not
  close it.
- **Materials** is now the only un-migrated catalog (D-7) — a future, separate
  effort; the store is already generic for it.
- **Unify the per-catalog option + import services (rule-of-three).** `frame_types`
  and `glazing_types` now have ~95%-identical `options_service.py` modules (differing
  only in catalog table, the editable-fields constant, the response model, and
  frame's `recompute_names` hook) and near-identical `import_export/` helpers
  (`_read_known_options` / `_auto_add_new_options` differ only by the single-select
  constant). Deliberately left as parallel modules per the codebase convention
  (Phase 1 + Phase 4 reuse reviews). When **materials** adopts the store — the third
  consumer — fold these into parameterized shared helpers (catalog table + seeds +
  optional on-rows-rewritten hook). Not before.

## Exit criteria

- `context/` reflects glazing-on-the-store. Closeout gate green. STATUS = Complete;
  folder archived; archive README updated.
