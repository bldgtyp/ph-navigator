---
DATE: 2026-06-23
TIME: 18:25 EDT
STATUS: Complete (2026-06-24) — decisions folded into context/; PRD D4 flipped; refactor archived (5b modal wiring tracked as a follow-up in §5b)
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 6 — fold decisions into context/, flip PRD D4, run closeout gate, mark Complete
RELATED:
  - ../../../.instructions.md (planning source-of-truth rules §4)
  - ../../../../CLAUDE.md (closeout gate)
  - planning/archive/frame-types-catalog/PRD.md (D4 to flip)
---

# Phase 6 — Cleanup, docs, closeout

## Goal

Land the accepted decisions back into the canonical `context/` layer, flip the
original feature's deferral note, run the full closeout gate, and mark this
refactor Complete with evidence — per planning `.instructions.md` rule 4
("accepted decisions must be folded back into `context/` … in the same docs
pass").

## Depends on

All of Phases 1–5 merged and green.

## Work items

### 6.1 Fold decisions into `context/`

- **Catalog option store** is now a real persistence class. Document it where
  catalog data-tables / storage boundaries are described:
  - `context/DATA_STORAGE.md` — add `catalog_field_options` as a global relational
    reference table (Postgres-owned), distinct from the project-document
    `single_select_options` JSON map. Note the catalog-vs-document option-store
    split (research §3) so the next person doesn't re-discover the tension.
  - `context/technical-requirements/data-model.md` — if catalog options become a
    documented store, add a short subsection cross-referencing §6.6.4 (the
    document-side option lists) and stating that catalogs use a parallel
    relational store keyed `(catalog_table, field_key)`.
- **Derived catalog `name`** — note in the catalog data-table notes that
  frame-type `name` is server-computed/read-only and that default
  frame/glazing resolve by sentinel **id** (`recPHNDefFrame001`/`recPHNDefGlazng01`),
  not name.
- **GLOSSARY** — if "option store" / "catalog vocabulary" warrant terms.

### 6.2 Flip the original deferral

- `planning/archive/frame-types-catalog/PRD.md:377` (D4 — "Soft-enum stays as
  text-with-suggestions for v1"): mark resolved/superseded, pointing at this
  refactor folder. Update that feature's `STATUS.md` if it still implies the
  soft-enum is the end state.

### 6.3 Generic-store note for D-7 follow-on

- Leave a short pointer (in `context/DATA_STORAGE.md` or a
  `planning/refactor/` note) that glazing-types and materials `category` can adopt
  `catalog_field_options` next: glazing has the same shape; materials `category`
  could graduate off its `ck_catalog_materials_category` CHECK constraint
  (`20260603_0015`) onto the store. Out of scope here, but record the path.

### 6.4 Closeout gate (CLAUDE.md)

Run, in order, on the full diff:
1. `simplify` skill on the diff; wait.
2. `docs-pass` skill on the diff; wait.
3. `make format` (root).
4. `make ci` (substantial change — not a trivial tweak).
5. If `make format` changed files, re-inspect diff + rerun `make ci`.
6. No green-until-all-green: fix and rerun any red step.
7. `graphify update .` (per project CLAUDE.md) after code changes.

### 6.5 Mark Complete

- Update this folder's `STATUS.md` → `Complete` with evidence (migration ids,
  test names, CI run, smoke screenshots under `assets/`).
- Fill the `STATUS.md` verification ledger (currently "pending implementation")
  with per-phase evidence.

## Exit criteria

- `context/` reflects the option store + derived name + default-by-id.
- `frame-types-catalog` PRD D4 flipped.
- Closeout gate fully green; `graphify` updated.
- STATUS = Complete with linked evidence.

## Risks / notes

- Public-repo gate one last time: confirm no licensed/PHI values landed in seed,
  option lists, or docs (`project_public_repo_licensed_data` memory).
- This phase is docs + verification only — no new behavior. Keep it surgical.
