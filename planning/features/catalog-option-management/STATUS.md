# STATUS — Catalog Option Management

DATE: 2026-07-17
TIME: 12:53
STATUS: Active
AUTHOR: Ed + Claude (Fable 5)
SCOPE: Current state, next step, blockers, verification state.
RELATED: README.md, PRD.md, decisions.md, research.md

## Current state

Phase 1 is complete. Every signed-in member now receives `catalog.edit`;
certifier/client viewer bundles remain unchanged. The frame/glazing pages wire
the unified field-config modal only on promoted single-select fields, lock
catalog field names/descriptions/types, and route option edits through the
existing `legacyOptions` controller path. Exact deleted-option replacement
maps survive the modal boundary, including multiple merges in one save.

Ed's direction (2026-07-17): renames cascade project-wide via a heavy rewrite
behind a working modal — infrequent (1-2×/year), so heavyweight is fine.

## Next step

Phase 2: implement the resumable backend rename cascade, including draft vs.
system-version writes, filter/ref rewrite rules, per-project progress, and
tests. Resolve O-1..O-3 against the existing persistence/job infrastructure.

## Blockers

None. Open decisions O-1..O-3 (decisions.md) are implementation-time, not
blockers for Phase 1.

## Verification

- Phase 1 targeted backend: `16 passed` (`test_access_resolver.py`,
  `test_access_phase3_deltas.py`).
- Phase 1 targeted frontend: `57 passed` across catalog controller/field-def
  and DataTable field-config suites.
- `simplify`: shared catalog option bridge extracted; dead config affordances
  and stale capability semantics removed.
- Browser verification remains for Phase 3 after the async cascade UI lands.
