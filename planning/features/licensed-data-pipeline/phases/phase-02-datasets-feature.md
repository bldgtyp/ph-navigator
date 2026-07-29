---
DATE: 2026-07-28
TIME: 12:05 EDT
STATUS: Implemented on branch — code, migration, CLIs, Make targets, tests,
  local operator drill, and docs pass complete 2026-07-28
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Phase 2 — the PHN `datasets` backend feature and the film-loader
  migration onto manifest-pinned keys.
RELATED: ../PRD.md §6, ../decisions.md §D-9, ../STATUS.md
---

# Phase 2 — The PHN `datasets` feature

## Goal

PHN can read, apply, and audit pipeline datasets; the surface-film table is
the first consumer migrated onto manifest-pinned versioned keys.

## Work

1. **`backend/features/datasets/`** (standard layering; no routes in v1):
   - `manifest.py` — fetch/parse/cache `datasets/manifest.json` from the
     object store (reuse the `AssetStorage`-protocol seam the film store
     uses, so tests inject fakes); typed errors for absent manifest and for
     sha256 mismatch on any fetched object (AC 8); cache-reset hook.
   - `registry.py` — `DatasetSpec` per `PRD.md` §6.1; initial entries:
     `ashrae-surface-films` (`runtime_read`).
   - `apply.py` — the `db_seed` engine: fetch → verify → parse → applier →
     upsert `applied_datasets`. `ApplyReport` with per-row outcomes (E-10).
2. **Alembic migration**: `applied_datasets` per `PRD.md` §6.2.
3. **CLIs + make targets**: `scripts/datasets_status.py` (`make
   datasets-status`) covering all four mismatch classes (AC 6);
   `scripts/datasets_apply.py` with the `PHN_DATASETS_ALLOW_PRODUCTION=1`
   guard (AC 11). `make datasets-publish-local` (thin wrapper shelling to the
   `PHN_DATA_DIR` checkout's `tools/publish.py --target local`; default
   `~/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator-data`).
4. **Film-loader migration**: `surface_film_store.py` resolves through the
   manifest to `datasets/ashrae-surface-films/<v>/dataset.json`; payload
   parsing, the typed 409, and `reset_surface_film_cache` unchanged. Keep a
   **legacy-key fallback** (`standards/ashrae/surface_films.json`) for the
   cutover window only, with a log line when it fires; removal is Phase 3.
5. **Tests** — synthetic fixtures throughout (AC 1/10): manifest round-trip,
   checksum-mismatch error, unknown-slug skip (E-4), unpublished typed error
   (E-5), apply idempotency (AC 7), film loader via manifest + via legacy
   fallback, empty-store boot (E-7).

## Out of scope

Production anything (Phase 3); the µ dataset (Phase 4); MCP/route exposure.

## Verification

Passed before the phase commit:

- focused Ruff + Ty checks;
- 76 focused dataset/envelope tests, covering manifest cache/integrity,
  absent manifest vs missing pinned object, sanitized malformed payload,
  all mismatch classes, unknown-slug skip, apply idempotency/audit row,
  per-slug lock ordering, production guard/audit identity, manifest and
  legacy film paths, typed unavailable behavior, and existing thermal routes;
- backend feature-boundary check;
- Alembic current/head = `20260728_0010`;
- `make datasets-publish-local`;
- `make datasets-status` → films published=1, loaded=1, checksum match,
  mismatches=none;
- `make datasets-apply ARGS=--all-pending` → no pending db-seed datasets;
- direct local runtime load → manifest-pinned `ashrae-surface-films` v1.

- `make format`;
- full `PYTEST_WORKERS=0 make ci`: backend `1661 passed, 7 skipped`; frontend
  `247` test files / `2312` tests passed; production build and version-marker
  check passed.
