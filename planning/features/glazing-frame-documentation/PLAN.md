---
DATE: 2026-06-24
TIME: 17:30 EDT
STATUS: Planning — ready to execute
AUTHOR: Claude (Opus 4.8)
SCOPE: High-level phased sequence for glazing+frame documentation.
RELATED: ./README.md, ./PRD.md, ./decisions.md, ./phases/
---

# PLAN — Glazing + Frame Documentation

Six phases. Phases 0–3 are backend (each ends green on `make ci`); Phase 4 is
the only frontend phase; Phase 5 is closeout. Phases 0 and 1 **co-land** (the
model change makes the old document shape invalid, so the migration must ship
with it).

```
P0  Models + tables + FK + cross-table validation + ensure_project_* helpers
P1  Document migration v11→v12 (before-validator) + seeds/templates + golden corpus     ⟵ co-land with P0
P2  Rewire write path: pick handlers, factories, default_refs, _ref_helpers, refresh,
    HBJSON import → upsert flat + set FK; drift comparator re-source
P3  Documentation commands (update_/remove_project_glazing/frame) + datasheet
    asset-registry extension + write-validation
P4  Frontend builder rewire: resolve FK → flat entity for canvas/inspector; types;
    visual parity; no user-facing change
P5  Closeout: context docs, simplify + docs-pass + make ci, hand off to report-pages
```

## Dependency order

`(P0 + P1)` → `P2` → `P3` → `P4` → `P5`.

- **P0+P1** establish the new schema and migrate existing docs. They must be one
  PR — the app cannot read an apertures document between the model change and the
  migration.
- **P2** is the riskiest phase: it touches every site that builds an inline ref.
  It depends on the `ensure_project_*` helpers from P0. (**D-2 settled: Option A**
  — catalog refs dedup by record id, hand-entered always append.)
- **P3** depends on the entities existing (P0) and being populated correctly
  (P2). Backend-only; verified by API/integration tests (no UI yet).
- **P4** depends on the apertures read slice exposing FK + flat tables (P2/P3).
  After P4 the builder reads FK and resolves for display; the user sees no change.
- **P5** folds decisions into `context/technical-requirements/data-model.md` and
  clears the way for the sibling **apertures-glazings-frames-reports** feature.

## Verification per phase

Each backend phase ends with: targeted unit/contract tests green, full backend
suite green, `ruff` + `ty` clean (`make ci`). Phase 1 adds a **golden-corpus
test**: a captured v11 apertures document migrates to a v12 document whose
flat tables + element FKs are exactly as expected. Phase 4 ends with a frontend
type-check + `make frontend-dev-check`; the full browser smoke is owned by the
sibling report-pages feature (Phase 3 there), since that is where the new data
first becomes user-visible.

## Recommended execution

Run via the `implement-loop` skill phase-by-phase (or `implement` per phase),
with the closeout gate after Phase 4. Watch the **concurrent-committer** rule:
stage + commit atomically; do not assume the working tree is yours alone.
