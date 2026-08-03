---
DATE: 2026-08-03
TIME: 11:22 EDT
STATUS: Complete
AUTHOR: Claude with Ed May
SCOPE: Fold accepted decisions into context/, run the repo closeout gate, and
  record follow-ups.
RELATED:
  - ../PRD.md
  - ../STATUS.md
  - ../../../../CLAUDE.md
---

# Phase 06 — Closeout

## Goal

The reference-gate policy is documented where it belongs, the repo closeout gate
is satisfied, and the deferred follow-up is recorded rather than forgotten.

## Depends on

Phases 01–05 green.

## Documentation

**1. `context/DATA_STORAGE.md`** — add the anonymous reference gate as an
explicit, stated policy:

> A signed-out viewer may fetch an asset only if it is referenced by an
> attachment column of the project's saved active document (plus the separate
> location/weather allowance). The resolver is
> `list_asset_references` / `iter_rows_for_raw_tables`; anonymous reads, the
> orphan sweeper, write-time reference validation, and bulk download consume
> that gate. Attach/detach share the attachment-field registry and the direct-
> table row walker, while nested assembly segments use a dedicated lookup.

That coupling is the load-bearing part. The bug was survivable-looking because
nobody documented that the attachment registry and row-shape authorities feed
five workflows at once.

**2. `context/DATA_STORAGE.md` or `backend/.instructions.md`** — state the
invariant Phase 01 encodes in a comment: *tables migrate between a bare list and
a `{field_defs, rows}` envelope as they gain FieldDefs; any code walking table
rows must tolerate both.*

**3. `context/ui/pages/thermal-bridges.md`** — note that PDF Report is an
attachment column subject to the same anonymous gate as datasheets and photos,
if the page doc describes the column at all.

**4. Do not** add a memory or context note that merely restates the fix. The
durable lesson is the invariant and the five-subsystem coupling, not the diff.

## Repo closeout gate

Per the root `CLAUDE.md`, in order, waiting for each to finish:

1. `simplify` **skill** on the diff.
2. `docs-pass` **skill** on the diff.
3. `make format` from the repo root.
4. `make ci` — this is a substantial change, so it is required.
5. If `make format` changed files, re-inspect the diff and rerun `make ci`.
6. Nothing is done while any `make ci` step is red.

## Status hygiene

- Update `../STATUS.md`: current state, what shipped, Phase 00 findings
  retained.
- If any decision was made that the packet did not anticipate — notably the
  PDF-only vs `DATASHEET_CONTENT_TYPES` call from Phase 00 — record it in a
  `decisions.md` in this folder.
- Under the active `implement-loop`, archive the packet after the local scope is
  implemented and the closeout gate is green. Here, archive means the planning
  scope is complete; it does **not** claim production deployment or production
  verification. Keep that external handoff explicit in `STATUS.md` and add the
  required line to `planning/archive/README.md`.

## Follow-up to record, not to do

**Unify attachment reference and mutation row traversal.**
`iter_rows_for_raw_tables` is a hand-written if-chain that must be kept in sync
with document shape. Phase 01 makes it shape-tolerant and Phase 03 guards it,
but registry derivation covers only contract-backed mappings. The structural
follow-up must also add contracts or adapters for unregistered frame/glazing
tables, preserve explicit flattening for the registered nested assembly path,
and consolidate the separate mutation row lookup. Deliberately out of scope for
this bug fix; it is recorded in
`planning/refactor/attachment-reference-walker-unification/`.

## Completion evidence

- `context/DATA_STORAGE.md` documents the active-saved-version anonymous gate,
  list/envelope row-shape invariant, actual reference/mutation coupling, and the
  deferred traversal-unification pointer.
- `context/technical-requirements/attachments.md` now agrees with that canonical
  security boundary; `context/ui/pages/thermal-bridges.md` documents PDF Report
  as a PDF-only saved-version-gated attachment.
- `../decisions.md` records the Phase 00 evidence for keeping PDF Report
  PDF-only. The separate
  `planning/refactor/attachment-reference-walker-unification/` packet scopes
  registry-backed mappings, irregular adapters, and mutation lookup without
  implementing them here.
- Three parallel `simplify` reviews and rechecks completed with no remaining
  correctness, reuse, or efficiency findings.
- The `docs-pass` found no additional ADR or lesson-log update was warranted;
  every durable fact is recorded once in its established source of truth.
- Ordered closeout: `make format` completed without code changes; full `make ci`
  passed with backend `1830 passed, 7 skipped` and frontend `2389 passed`, plus
  formatting, lint, types, boundaries, contract checks, and production build.
- No deployment or production write was performed. Deployment remains Ed's
  explicit action.

## Deploy

**Deploying is Ed's call, never an agent's.** Merging to `main` does not deploy.
The deploy event is the "Deploy Production" GitHub Actions workflow. Leave
`main` deployable and stop.

## Done when

- The context updates above are merged.
- The closeout gate is fully green.
- `STATUS.md` reflects reality and the follow-up is recorded.
