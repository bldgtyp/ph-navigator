# STATUS — Catalog Option Management

DATE: 2026-07-17
TIME: 12:53
STATUS: Active
AUTHOR: Ed + Claude (Fable 5)
SCOPE: Current state, next step, blockers, verification state.
RELATED: README.md, PRD.md, decisions.md, research.md

## Current state

Phases 1–2 are complete. Every signed-in member now receives `catalog.edit`;
certifier/client viewer bundles remain unchanged. The frame/glazing pages wire
the unified field-config modal only on promoted single-select fields, lock
catalog field names/descriptions/types, and route option edits through the
existing `legacyOptions` controller path. Exact deleted-option replacement
maps survive the modal boundary, including multiple merges in one save.

Ed's direction (2026-07-17): renames cascade project-wide via a heavy rewrite
behind a working modal — infrequent (1-2×/year), so heavyweight is fine.

Phase 2 persists a catalog-scoped cascade job in the same transaction as the
option edit, then runs it after the response. It rewrites only active-version
drafts (bumping every affected editor's draft ETag); without a draft it appends
a `Catalog rename: …` version authored by the member who made the catalog
edit. Historical versions and their drafts are untouched. Jobs retain
per-project results, recover an expired worker lease as retryable failure, and
block further option edits until a failed cascade is retried.

## Next step

Phase 3: add the rename confirmation, working/progress modal, polling and
retry path; thread the `cascade_job` returned by `PUT /options` through the
catalog controllers; then run the AGENT-BROWSER end-to-end rename probe.

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
- `simplify`: shared catalog option bridge extracted; dead config affordances
  and stale capability semantics removed; Phase 2 additionally gained the
  catalog edit lock, durable retry lease, and safe migration downgrade.
- Browser verification remains for Phase 3 after the async cascade UI lands.
