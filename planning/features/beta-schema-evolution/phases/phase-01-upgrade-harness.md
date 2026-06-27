---
DATE: 2026-06-27
TIME: 11:00 EDT
STATUS: Planned - implementation not started.
AUTHOR: Codex with Ed May
SCOPE: Phase 1 - project-document upgrade harness.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
  - ../decisions.md
---

# Phase 1 - Project-Document Upgrade Harness

## Goal

Create the minimal project-document migration seam before real beta data exists.
The first version can be mostly no-op, but the API, error model, and read/save
semantics should be real.

## Scope

- Add a `backend/features/project_document/migrations/` package.
- Add a public upgrade entry point that accepts raw mappings and returns a typed
  result.
- Add a no-op v1 baseline.
- Reject future schema versions clearly.
- Place the upgrade seam inside the single validation funnel (see "Seam
  Placement" below) so every read path inherits it.
- Apply D6 draft semantics: lazy drafts snapshot the upgraded version body;
  older persisted draft rows upgrade-and-rewrite in place.
- Ensure save/save-as writes current schema.
- Keep read-safe recovery for invalid bodies that cannot upgrade.

## Seam Placement

There is exactly one validation funnel today: `validate_document()` /
`validate_document_with_errors()` in
`backend/features/project_document/validation.py`. Roughly 30 read consumers
reach it through `store.py` `get_saved_document()`,
`get_current_document_view()`, and `load_document_body()` - including table
slices, diff, the MCP `get_document` / `get_table` tools, and the
envelope/PHPP/HBJSON exports.

Insert the upgrade step at that funnel (the `store.py` entry points immediately
before `validate_document`, **and** the read-safe `validate_document_with_errors`
path so an upgradeable old body is upgraded rather than shown as recovery).
Detect the source version with the existing `schema_version_from_raw()`
(`store.py`) before Pydantic runs, because `schema_version` is `Literal[1]` and
the current model rejects any other value generically.

Do **not** wire only the top-level `/document` and `/draft` reads. Those leave
the fail-closed table-slice, diff, and MCP paths still 422-ing on an
old-but-upgradeable body - i.e. a project that opens at the shell but cannot be
edited table-by-table.

Excluded by design (D9): `GET .../download` (`get_raw_saved_document`) stays
un-upgraded as the recovery valve.

## Suggested API Shape

```python
upgrade_project_document(raw: Mapping[str, object]) -> UpgradeResult
```

`UpgradeResult` should carry:

- original schema version;
- target schema version;
- applied step names;
- warnings;
- upgraded raw body;
- validated current `ProjectDocument`.

## Acceptance Criteria

- Current v1 bodies validate through the upgrade entry point.
- Future schema versions produce a stable typed error (mirror the catalog
  `SchemaVersionTooNewError` precedent).
- Invalid or unsupported bodies still reach read-safe recovery where appropriate.
- Saved-version and draft reads use the same upgrade entry point.
- The fail-closed consumers inherit the seam: a deliberately old-schema body can
  be read through a table slice, the diff endpoint, and an MCP `get_table` call
  without a 422.
- Drafts follow D6: a lazy draft from an old version starts at current shape; an
  old persisted draft row is upgraded-and-rewritten (body + new `draft_etag`).
- ETag follows D7: the ETag returned for an upgraded read is stable across
  repeated reads, and an open-then-save across a simulated `CURRENT` bump
  surfaces a clean 409 rather than silent corruption.
- Body-size guard: define and test behavior when an upgraded body exceeds
  `project_document_max_body_bytes` (recommended: read surfaces read-safe, save
  is blocked with a clear error).
- Save/save-as persists current schema.
- No `project_versions` row is mutated merely because it was read (drafts are
  exempt per D6).

## Verification

Focused backend tests should cover:

- v1 no-op upgrade;
- missing/invalid schema version;
- future schema version (typed `SchemaVersionTooNewError`-style error);
- draft read path (lazy-from-old-version and old-persisted-draft cases per D6);
- saved-version read path;
- fail-closed inheritance: table-slice, diff, and MCP `get_table` reads of an
  old-schema body;
- ETag stability across an upgraded read, and open-then-save across a simulated
  `CURRENT` bump (D7);
- upgraded body over the size limit;
- save/save-as current-schema persistence.

