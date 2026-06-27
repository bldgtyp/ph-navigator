---
DATE: 2026-06-27
TIME: 11:00 EDT
STATUS: Active - phase plan drafted; implementation not started.
AUTHOR: Codex with Ed May
SCOPE: Phase map and sequencing for beta schema evolution.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./decisions.md
  - ./STATUS.md
  - ./phases/
---

# PLAN - Phase Map And Sequencing

## Dependency Graph

```text
Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5
  |          |          |          |          |
  |          |          |          |          beta gate drill
  |          |          |          FieldDef drift + docs
  |          |          audit CLI + recovery runbook
  |          golden corpus + regression tests
  project-document upgrade harness
```

The phases can be implemented in one feature branch, but the order matters:
the fixture corpus depends on the upgrader API, the audit CLI depends on the
same entry point, and the beta drill depends on all previous phases.

## Phase 1 - Project-Document Upgrade Harness

Establish the schema-evolution seam.

Primary outcomes:

- Add a project-document migrations package.
- Add a no-op v1 baseline step and current-schema validation path.
- Add typed errors for future or malformed schema versions.
- Insert the upgrade seam in the single validation funnel so all read consumers
  (table slices, diff, MCP, exports) inherit it - not just top-level reads.
- Apply D6 draft semantics (upgrade-in-place allowed for drafts; versions exempt
  from D2's no-rewrite rule only because drafts are cache).
- Preserve no DB mutation on read for `project_versions` (drafts exempt per D6).
- Preserve save/save-as writes at current schema.

Phase doc: `phases/phase-01-upgrade-harness.md`

## Phase 2 - Golden Corpus And Regression Tests

Lock the serialized v1 project-document contract before beta data exists.

Primary outcomes:

- Add raw JSON fixtures for representative v1 project documents.
- Commit expected upgraded-output snapshots and assert byte-equality, not just
  "validates."
- Test every fixture through upgrade, validation, canonical serialization, body
  size, and idempotence.
- Add at least one artificial future-version rejection test.
- Document how future schema bumps add fixtures, and the frozen-fixture (never
  regenerate old fixtures) rule.

Phase doc: `phases/phase-02-golden-corpus.md`

## Phase 3 - Audit CLI And Recovery Runbook

Make schema changes operationally checkable.

Primary outcomes:

- Add a script that can audit fixtures, JSON exports, and local DB bodies.
- Report schema versions, upgrade steps, validation errors, and body sizes.
- Default to read-only inspection; preview upgraded JSON only when requested.
- Add a short beta recovery runbook using raw JSON download plus CLI repair.

Phase doc: `phases/phase-03-audit-cli-runbook.md`

## Phase 4 - FieldDef Drift And Schema-Bump Docs

Make built-in table contract drift reviewable.

Primary outcomes:

- Add a built-in `FieldDef` drift reporter (classify by `TableFieldDef.origin`).
- Distinguish built-in product fields from user custom fields.
- Add a structural schema-bump guard test (fingerprint change without a version
  bump + fixture fails CI), plus the schema-bump checklist docs.
- Reconcile current technical requirements that still describe Phase 7 as
  deferred instead of a beta gate, including editing `llm-mcp-schema.md` §10.5
  item 9 to match D8 (no per-version models).
- Note the catalog-derived-row drift scope boundary and the full versioned
  structure inventory (incl. `BUNDLE_SCHEMA_VERSION`).
- Add optional table-view stale-state cleanup guidance only if cheap.

Phase doc: `phases/phase-04-fielddef-drift-docs.md`

## Phase 5 - Beta Gate Drill And Closeout

Prove the mechanism before real beta data starts.

Primary outcomes:

- Run the audit against fixtures and local/demo project versions.
- If a staging/demo DB exists, run the corpus drill against it.
- Verify read-safe recovery still works for truly invalid bodies.
- Run appropriate test gates.
- Run `graphify update .` after code changes.
- Fold final decisions back into context docs.

Phase doc: `phases/phase-05-beta-gate-drill.md`

## Closeout Criteria

This feature is done when the first real beta save can happen with a documented
answer to:

```text
Can every known old project document body upgrade to the current schema?
```

The required evidence is:

- test output for fixture corpus upgrade;
- audit CLI output for local/demo or staging corpus;
- docs updated with accepted decisions and operator steps;
- no unresolved future-version or read-safe regressions.

