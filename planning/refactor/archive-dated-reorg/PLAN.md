---
DATE: 2026-06-24
TIME: 10:45
STATUS: Planned (not started)
AUTHOR: Ed May + Claude
SCOPE: Reorganize planning/archive into dated buckets + add a chronological index
RELATED:
  - planning/.instructions.md
  - planning/README.md
  - planning/archive/
---

# Plan — Dated Reorg + Index for `planning/archive/`

## Why

`planning/archive/` is a flat folder of ~48 completed feature packets plus a
`dated/` subfolder of pre-convention plans. The flat list has no map and grows
unbounded. The archive is an **append-only audit trail**, not a knowledge base
(durable truth already migrates to `context/` per `.instructions.md` rule #4),
so the fix is: **index it + bucket it by date, then leave it alone.** Domain
bucketing was considered and rejected as low-value / boundary-dispute-prone; the
index handles discovery.

## Decisions (settled)

1. **Granularity: per-day** `archive/dated/<YYYY-MM-DD>/<feature-slug>/` —
   matches the existing `.instructions.md` convention and the current `dated/`
   contents. No monthly rollup.
2. **Date source: archival date** — the date the folder first landed under
   `archive/` (git first-add at the archive path = "completed on"). This is the
   sequence-bearing date Ed cares about ("this before that"). One exception:
   `equipment-custom-fields` has no clean add-record (rename chain); use its
   last-commit date `2026-06-13`.
3. **Index is primary discovery.** `archive/README.md`, newest-date-first, one
   line per feature: `date · slug · one-line outcome · merge commit`. Outcomes
   pulled from each feature's `STATUS.md`/`README.md` at execution time.
4. **No domain buckets.** Flat-by-date only.

## Guardrail — DO NOT run on the current feature branch

This is ~48 folder moves + doc edits and must NOT clutter the active
`data-table-status-field-addendum` PR. Execute on a dedicated branch off `main`
(e.g. `chore/planning-archive-dated-reorg`), as its own small PR. This PLAN file
is currently untracked; it travels with a branch checkout and should be
committed on the reorg branch, not the addendum branch.

## Execution steps

1. **Branch.** From `main`: `git switch -c chore/planning-archive-dated-reorg`.
   (If `main` lacks the latest archived folders, branch off the most recent
   merged base that has them; re-run the date query below to confirm the set.)
2. **Move folders with history preserved.** For each row in the mapping table,
   `git mv planning/archive/<slug> planning/archive/dated/<date>/<slug>`.
   `git mv` preserves rename history. Create date dirs as needed.
   - Loose plan files already under existing `dated/<date>/` are left in place;
     feature folders join as sibling subfolders under the same date.
   - No slug collisions exist within any single date (verified — slugs unique).
3. **Drop `.DS_Store` noise.** Do not move `.DS_Store`; ensure it stays
   gitignored. (`planning/archive/.DS_Store`, `dated/.DS_Store` are not tracked.)
4. **Generate `archive/README.md` index.** Newest-date-first. For each feature
   read its `STATUS.md` (fallback `README.md`) for a one-line outcome and the
   landing commit. Fan this out across folders for speed. Format:

   ```markdown
   # Archive Index — Completed Planning Packets

   Append-only audit trail. Durable decisions live in `context/`; this records
   how/when each feature landed. Newest first. Grep by slug.

   ## 2026-06-24
   - `data-table-status-field` — per-row status enum + chip column. (618fc21f)
   - `phpp-uvalue-export` — …

   ## 2026-06-23
   - `envelope-hbjson-import` — …
   ...
   ```
5. **Update `planning/.instructions.md`.** Extend the archive rules so
   *completed feature folders* (not just loose dated plans) archive to
   `archive/dated/<completion-date>/<slug>/`, and the going-forward archival
   step names that path. Update the "Naming" line accordingly.
6. **Update `planning/README.md`.** In Layout, change the `archive/dated/…`
   bullet to cover completed feature packets, and add `archive/README.md` to the
   read order as the archive's index/entry point.
7. **Verify** (see below), then open the PR.

## Going-forward convention (fold into `.instructions.md` in step 5)

When a feature completes, move `planning/features/<slug>/` →
`planning/archive/dated/<YYYY-MM-DD>/<slug>/` (date = completion/merge date) and
add one line to `archive/README.md`. Never re-bucket or re-date afterward.

## Verification

- `ls planning/archive/` shows only `dated/` and `README.md` (+ untracked
  `.DS_Store`). No flat feature folders remain.
- Count check: feature folders under `dated/` (excluding pre-existing loose
  plans) == 48.
- `git log --follow` on a sampled moved folder still reaches its original
  history (rename preserved).
- Every slug in the mapping table appears exactly once in `archive/README.md`.
- `make format` clean; no code touched so `make ci` not required (docs-only).

## Date → slug mapping (move targets)

Target path = `planning/archive/dated/<DATE>/<slug>/`.

### 2026-06-03
- color-field
- data-table-unit-number-field
- delete-project
- ip-si-unit-switching
- materials-catalog-datatable
- materials-catalog-import-export

### 2026-06-04
- assembly-builder
- assembly-builder-foundation
- auth-session-perf
- catalog-perf
- editable-fields
- row-context-menu

### 2026-06-05
- apertures
- assembly-builder-tools
- frame-types-catalog
- glazing-types-catalog

### 2026-06-07
- apertures-cleanup
- assembly-builder-hardening

### 2026-06-09
- backend-hygiene-pass
- heat-pumps
- record-linking

### 2026-06-13
- equipment-custom-fields   (last-commit date; no clean add-record)
- model-viewer
- project-location

### 2026-06-14
- climate
- css-brand-dependency-resilience
- css-rationalization
- css-structure-discoverability
- css-token-guard-sweep

### 2026-06-15
- attachments
- climate-reference-data-seeding

### 2026-06-16
- heat-pump-link-fields

### 2026-06-17
- data-table-consolidation
- record-identity-model
- spaces-refactor

### 2026-06-19
- data-table-maintenance
- data-table-regression-suite
- model-viewer-performance

### 2026-06-20
- data-table-field-config-modal

### 2026-06-21
- data-table-formula-builder
- table-csv-download

### 2026-06-22
- climate-auto-populate
- climate-dataset-picker
- climate-weather-file

### 2026-06-23
- envelope-hbjson-import
- model-viewer-legend-filter
- model-viewer-sun-path
- window-frames-catalog-enums

### 2026-06-24
- data-table-status-field
- phpp-uvalue-export

**Total: 48 feature folders.**

> Note: a few folders (`climate`, `frame-types-catalog`, `heat-pumps`,
> `model-viewer`, `assembly-builder`) have later last-commit dates than their
> archival date due to follow-on cross-references; they bucket by **archival**
> date as listed. Re-run the date query at execution time if more features have
> been archived since 2026-06-24.
