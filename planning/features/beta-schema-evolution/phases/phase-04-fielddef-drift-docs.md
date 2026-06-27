---
DATE: 2026-06-27
TIME: 13:05 EDT
STATUS: Implemented on branch.
AUTHOR: Codex with Ed May
SCOPE: Phase 4 - built-in FieldDef drift reporting and schema-bump docs.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
  - ../decisions.md
---

# Phase 4 - FieldDef Drift And Schema-Bump Docs

## Goal

Make built-in table contract drift explicit before stale persisted `field_defs`
create beta surprises.

## Scope

- Added a helper and CLI mode that compares persisted built-in `field_defs` to
  current code-defined built-ins (the per-table `*_BUILT_IN_FIELD_DEFS` tuples
  registered in `tables/contracts.py`).
- Reports differences by table and `field_key`, classifying with the persisted
  `TableFieldDef.origin` (`built_in` vs `custom`) rather than re-matching keys.
- Distinguishes built-in product fields from user-created custom fields.
- Added a **structural schema-bump guard** (see below) so the checklist is
  enforced by CI, not by memory.
- Added schema-bump checklist docs.
- Reconciled docs that still describe the migration mechanism as deferred,
  **including editing `llm-mcp-schema.md` §10.5 item 9** to drop per-version
  Pydantic models per D8 (not just re-labeling the section).
- Clarified scope vs the existing catalog-drift tooling (see below).
- Kept table-view migration lightweight unless real product requirements change.

## Structural Schema-Bump Guard

A checklist in docs is discipline; a red build is enforcement.
`backend/tests/test_project_document_schema_guard.py` fails when the guarded
ProjectDocument fingerprint changes without updating
`backend/tests/project_document_schema/schema_fingerprint.json`. The
fingerprint covers the Pydantic JSON schema, built-in `field_defs`, and
built-in single-select option namespaces.

The guard file also records the current schema version and fixture count. The
test detects structural drift against this committed file. When a future bump
updates the fingerprint file, the checklist and review gate require a version
bump and old-shape fixture addition before the guard is refreshed.

## Scope vs Existing Catalog-Drift Tooling

Project materials / glazings / frames are project-local copies seeded from the
global catalogs, and drift reporters already exist for them
(`get_project_material_drift_report`, the apertures
`tool_report_aperture_catalog_drift`). This phase's reporter is specifically
**built-in `field_defs`** drift. State explicitly whether embedded
catalog-derived row drift is in scope here or deferred to that existing tooling,
so the two drift concepts are not conflated or duplicated.

Decision: catalog-derived row drift stays out of this reporter and remains with
the existing catalog drift tools. This phase reports only product-seeded
FieldDef shape and namespace drift.

Persisted option-list contents (`id`, `label`, `color`, `order`) are also out
of this reporter because those lists are project data and may be edited through
the schema/option surface. The reporter guards the built-in FieldDef default
value and option-list namespace, not project-specific option labels.

## Versioned-Structure Inventory

Document the full set of versioned persisted structures so the gate's coverage
is unambiguous: `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` (in scope),
`SUPPORTED_VIEW_STATE_SCHEMA_VERSION` (cache - lightweight per P2), and
`BUNDLE_SCHEMA_VERSION` in `climate/bundle.py` (a static object-store asset on
its own evolution lane - out of scope for this packet, named here so it is not
silently missed).

## Drift Reporter Should Flag

- missing built-in fields;
- extra persisted built-in fields;
- `field_type` changes;
- number unit config changes;
- linked-record config changes;
- option namespace/default changes;
- display-name changes;
- origin mismatches.

## Acceptance Criteria

- Seeded/current project documents produce an understandable drift report.
- A deliberately stale built-in `FieldDef` fixture produces a useful warning.
- User custom fields are not reported as product drift.
- The schema-bump checklist exists and points developers to the upgrade tests
  and audit CLI.
- The structural schema-bump guard test fails on a fingerprint change without a
  committed guard-file refresh; the checklist requires the matching version bump
  and old-shape fixture evidence before that refresh is acceptable.
- Technical requirements docs reflect that this is now a beta gate, and
  `llm-mcp-schema.md` §10.5 item 9 is edited to match D8 (no per-version models).

Status: acceptance criteria met on branch.

## Verification

- Focused tests around drift classification.
- Docs check with `git diff --check`.
- Any code changes covered by backend focused tests.

Evidence:

```bash
cd backend && uv run ruff check features/project_document/fielddef_drift.py scripts/check_project_document_upgrade.py tests/test_project_document_fielddef_drift.py tests/test_project_document_schema_guard.py tests/test_project_document_upgrade_audit_cli.py
cd backend && uv run ty check features/project_document/fielddef_drift.py scripts/check_project_document_upgrade.py tests/test_project_document_fielddef_drift.py tests/test_project_document_schema_guard.py tests/test_project_document_upgrade_audit_cli.py
cd backend && uv run pytest tests/test_project_document_fielddef_drift.py tests/test_project_document_schema_guard.py tests/test_project_document_upgrade_audit_cli.py
```

Result: 12 passed.
