# STATUS — Catalog Option Management

DATE: 2026-07-17
TIME: 14:41
STATUS: Complete — archive next
AUTHOR: Ed + Claude (Fable 5)
SCOPE: Current state, next step, blockers, verification state.
RELATED: README.md, PRD.md, decisions.md, research.md

## Current state

All three phases are complete. Every signed-in member now receives
`catalog.edit`; certifier/client viewer bundles remain unchanged. The
frame/glazing pages wire the unified field-config modal only on promoted
single-select fields, lock catalog field names/descriptions/types, and route
option edits through the existing `legacyOptions` controller path. Exact
deleted-option replacement maps survive the modal boundary, including multiple
merges in one save.

Ed's direction (2026-07-17): renames cascade project-wide via a heavy rewrite
behind a working modal — infrequent (1-2×/year), so heavyweight is fine.

The catalog option edit now previews affected active project documents before
confirmation. On confirmation, the PUT response supplies the durable cascade
job; the field-config modal closes before the page-level working modal mounts,
so focus traps never overlap. That modal polls progress, exposes totals and
per-project errors, supports retry after a failure, and reopens an unresolved
job after the catalog page remounts. The job remains created in the same
transaction as the option edit, rewrites only active-version drafts (bumping
every affected editor's draft ETag), and otherwise appends a `Catalog rename:
…` version authored by the triggering member. Historical versions and their
drafts are untouched. Jobs retain per-project results, recover an expired
worker lease as retryable failure, and block further option edits until a
failed cascade is retried.

## Next step

Archive this packet after the final `make ci` result. No implementation work
remains.

## Blockers

None. Open decisions O-1..O-3 (decisions.md) are implementation-time, not
blockers for Phase 1.

## Verification

- Phase 1 targeted backend: `16 passed` (`test_access_resolver.py`,
  `test_access_phase3_deltas.py`).
- Phase 1 targeted frontend: `57 passed` across catalog controller/field-def
  and DataTable field-config suites.
- Phase 2 targeted backend: `29 passed` across cascade engine, frame options,
  and glazing options tests; `uv run ruff check …` and `uv run ty check` pass.
- Phase 3 targeted backend: `31 passed` across the cascade engine, frame
  options, and glazing options tests; `ruff` and `ty` pass.
- Phase 3 frontend: `26` catalog-controller tests and `47` field-config modal
  tests pass; TypeScript and ESLint pass.
- Live browser: member session on `/catalog/frame-types` renamed a temporary
  manufacturer option, showed the focused confirmation, closed the editor,
  and completed the job modal; the option was restored. The standard
  AGENT-BROWSER fixture currently has no catalog-origin frame/glazing refs, so
  that live job correctly reported zero targets. The nonzero draft/version,
  filter, idempotency, retry, and failure cases remain covered by backend
  tests.
- `simplify`: fixed focus semantics with a nested Radix alert dialog, delayed
  page-level progress until the field editor closes, recovered unresolved jobs
  after remount, and surfaced per-project failure text. The deliberately
  retained tradeoff is a full-document preview scan and short job polling:
  option renames occur only once or twice a year and the modal needs exact
  project counts plus per-project status.
- Final `make format`, `graphify update .`, and `make ci` pass. Full CI:
  backend `1406 passed, 7 skipped`; frontend tests, static guards, and
  production build pass.
