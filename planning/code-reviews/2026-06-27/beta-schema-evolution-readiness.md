---
DATE: 2026-06-27
TIME: 10:46 EDT
STATUS: Promoted - recommendations accepted and turned into `planning/features/beta-schema-evolution/`.
AUTHOR: Codex with Ed May
SCOPE: Beta rollout data-structure flexibility, project-document schema evolution, updater mechanisms, recovery posture, and related table/cache contracts.
METHOD: Graphify query plus targeted source review of project-document models, validation, write spine, table contracts, table-view persistence, catalog upgrade chains, and existing planning/technical requirements.
RELATED:
  - planning/features/beta-schema-evolution/
  - planning/code-reviews/2026-06-24/backend-data-architecture-review.md
  - planning/archive/dated/2026-06-24/backend-data-architecture-cleanup/phases/phase-07-schema-migration-mechanism.md
  - context/technical-requirements/llm-mcp-schema.md
  - context/technical-requirements/data-model.md
  - context/technical-requirements/save-versioning.md
---

# Beta Schema Evolution Readiness

## Executive Answer

The current architecture is basically the right shape for beta:

- Project data is stored as versioned JSONB documents, with relational metadata only where it buys workflow semantics.
- Tables use `field_defs` plus per-row `custom_values`, which gives us Airtable-like flexibility without requiring a relational migration for every project-specific field.
- The table contract registry centralizes built-in fields, field configs, links, formulas, and write behavior.
- Read-safe recovery already prevents a broken document from fully bricking the project shell.
- Table-view state is treated as an opaque cache with its own schema version and table schema fingerprint.

The main missing beta mechanism is not another storage model. It is a disciplined document-schema evolution lane. Before any real beta project data exists, we should turn the deferred Phase 7 idea into a beta gate:

1. Add a small forward-only project-document upgrade harness.
2. Start a golden corpus with v1 documents now.
3. Add a local corpus/DB audit command that proves old bodies can upgrade and validate.
4. Add a schema-bump checklist that every persisted data-shape change must follow.
5. Add a built-in `FieldDef` drift reporter so table contract changes are reviewed intentionally.

This is deliberately smaller than a full migration framework. The goal is to make schema changes boring during beta, not to design an enterprise migration system before there is production data.

## Current State Verified

### Project Document Baseline

The current project document is a clean pre-beta v1 baseline:

- `backend/features/project_document/document.py`
  - `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION = 1`
  - `ProjectDocument.schema_version: Literal[1]`
  - Typed table buckets: assemblies, project materials, project glazings, project frames, apertures, rooms, space types, thermal bridges, equipment, manufacturer filters.
  - Comments retain old internal dev bump history, but the active document contract has been reset to v1.

There is currently no read-time migration chain for project documents. That is acceptable only while there is no real project corpus to preserve.

### Validation And Failure Mode

Validation is strict:

- `backend/features/project_document/validation.py`
  - Validates saved bodies through Pydantic.
  - Derives canonical ETags from serialized document bodies.
  - Enforces `project_document_max_body_bytes`.
- `backend/config.py`
  - Default project document body limit is 8 MiB.
- `backend/features/project_document/store.py`
  - Top-level project shell reads can fall back to a `ProjectDocumentReadSafeEnvelope`.
  - Table slice routes still depend on typed validation and are expected to fail closed for invalid documents.
- `frontend/src/features/projects/routes/ProjectShell.tsx`
  - Shows a read-safe recovery panel when the document cannot be typed.
  - Exposes raw JSON download and diagnostics.

This is a good emergency posture, but it is not the update mechanism. Read-safe recovery lets us recover or inspect a broken body; it does not let the beta team keep working normally after a schema bump.

### Write Spine

Draft and save writes are centralized:

- `backend/features/project_document/write_spine.py`
  - Owns draft context loading, version locking, ETag checks, body-size enforcement, mutation execution, and audit hooks.
- `backend/features/project_document/drafts.py`
  - Table slice replacement, table schema mutation, save, and save-as all flow through the shared spine.
- `backend/features/project_document/repository.py`
  - `project_versions` and `project_version_drafts` store the body, schema version, body size, and ETags.

This is useful because schema-upgrade work can be inserted at the document load/save boundary without chasing every table route.

### FieldDefs And Custom Values

The flexible table layer is strong:

- `backend/features/project_document/custom_fields.py`
  - `TableFieldDef` is the durable field config for built-in and custom fields.
  - `custom_values` stores scalar row values by field key.
  - Number unit configs, linked-record configs, select options, defaults, formulas, and field origins are validated.
- `backend/features/project_document/tables/contracts.py`
  - `TableFieldRegistry` and `TableContract` centralize field keys, schema fingerprints, field mutation behavior, option lists, overlays, formulas, and dependent links.
- `backend/features/project_document/templates.py`
  - New project documents seed built-in `field_defs` into the document.
- `backend/features/project_document/_validators.py`
  - Validates required `record_id` fields, unknown custom values, option ids, linked-record configs, custom links, formulas, and duplicate field names.

This buys flexibility during beta, but it also creates one subtle migration risk: built-in fields are persisted into each document. If we change a built-in display name, field type, config shape, unit semantics, option namespace, or key, old documents will keep old `field_defs` unless a migration or render-time overlay handles it.

The prior Equipment unit-field work already exposed this: changing code defaults alone does not update persisted built-in `field_defs`.

### Table View State

Table view state is already treated as disposable/cache-like state:

- `backend/features/table_views/models.py`
  - `SUPPORTED_VIEW_STATE_SCHEMA_VERSION = 1`
  - `MAX_VIEW_STATE_BYTES = 65536`
  - Backend validates envelope/shape/size but treats `view_state` as opaque frontend data.
- `frontend/src/features/table_views/types.ts`
  - `TABLE_VIEW_SCHEMA_VERSION = 1`
  - Persisted envelope includes `schema_fingerprint`.
- `frontend/src/features/table_views/hooks.ts`
  - Mismatched schema fingerprints can be loaded for render but are not silently rewritten until the user edits view state.
- `frontend/src/shared/ui/data-table/lib/view/sanitize.ts`
  - Render-only sanitizer drops references to missing columns/options.

This is the right level of durability for view preferences. It should not be promoted into a first-class migration problem unless table views become user-critical deliverables.

### Existing Upgrade Precedent

Catalog import/export already has a small versioned upgrade pattern:

- `backend/features/catalogs/materials/import_export/upgrade.py`
- `backend/features/catalogs/frame_types/import_export/upgrade.py`
- `backend/features/catalogs/glazing_types/import_export/upgrade.py`

Those upgrade rows by piping raw dicts through `upgrade_steps[v]` until the current version. The project document needs a similar pattern, but at whole-document grain and with immutable saved versions. It should not blindly mutate database rows on read.

## Beta Risk Model

The schema-change risks are concentrated in a few places:

1. **Document shape changes**
   - Adding required Pydantic fields.
   - Moving a value between a typed row column and `custom_values`.
   - Renaming table buckets or row keys.
   - Changing relationship storage.
   - Tightening validation that old bodies did not satisfy.

2. **Built-in field contract changes**
   - Changing `field_key`.
   - Changing `field_type`.
   - Changing number unit config, linked-record config, or option namespace.
   - Changing default select options.
   - Changing display names where persisted old names should not survive.

3. **Relationship changes**
   - Adding inverse links.
   - Reclassifying orphan behavior.
   - Changing `max_links`.
   - Changing same-table or cross-table link validation rules.

4. **Version/draft lifecycle changes**
   - Saving a draft created under an older shape.
   - Loading a saved version while a draft exists with incompatible shape.
   - Save-as from an older version.

5. **Cache/preference changes**
   - Renaming column ids that table view state references.
   - Deleting option ids that filters/grouping/sorting reference.

The first four categories can block project loading or editing. The fifth should degrade gracefully and is already close to the desired behavior.

## Recommended Pre-Beta Mechanisms

### P0 - Make Project Document Migration A Beta Gate

Treat the existing Phase 7 plan as deferred from MVP implementation but required before first real beta project save.

Recommended minimum:

- Create `backend/features/project_document/migrations/`.
- Add a pure function entry point:

```python
upgrade_project_document(raw: Mapping[str, object]) -> UpgradeResult
```

- `UpgradeResult` should report:
  - original schema version
  - target schema version
  - list of applied steps
  - warnings
  - upgraded raw dict
  - validated current `ProjectDocument`

The harness should:

- Reject future schema versions with a clear error.
- Upgrade only forward.
- Keep individual steps as pure dict-to-dict functions.
- Validate only after applying all needed steps.
- Keep old step functions indefinitely once beta data exists.
- Never silently mutate DB rows on read.

For v1, the first implementation can be mostly no-op. That is still valuable because it gives us the lane, tests, and review checklist before the first real bump.

### P0 - Start A Golden Corpus Now

Before beta, save a small fixture corpus under tests, for example:

```text
backend/tests/project_document_schema/fixtures/v1/
  empty_project.json
  demo_project.json
  equipment_unit_fields.json
  linked_rooms_space_types.json
  apertures_flat_refs.json
  formulas_and_custom_fields.json
```

Each fixture should be a raw project document body at a known `schema_version`, not a Python object factory. The point is to lock down the external serialized contract.

Every future schema bump should add at least one old-version fixture that reproduces the changed shape.

Tests should prove:

- Each fixture upgrades to the current schema.
- The upgraded body validates as the current `ProjectDocument`.
- Upgrade is idempotent when run on the current schema.
- Canonical serialization succeeds.
- Body size remains under the configured limit.

### P0 - Add A Corpus/DB Audit Command

Add a script that can be run before and after every schema change:

```text
backend/scripts/check_project_document_upgrade.py
```

Suggested modes:

```bash
python backend/scripts/check_project_document_upgrade.py --fixtures
python backend/scripts/check_project_document_upgrade.py --json-dir path/to/exported/project-documents
python backend/scripts/check_project_document_upgrade.py --db --strict
```

The script should report:

- count by `schema_version`
- future versions
- invalid current bodies
- bodies requiring upgrade
- applied steps
- validation errors
- body sizes and largest body
- output path for upgraded preview JSON, if requested

It should not write back to the DB by default. During beta, this becomes the pre-deploy drill: export or query the current project corpus, run the audit, fix failures, then deploy.

### P0 - Add A Schema-Bump Checklist

Every PR that changes durable project document shape should answer these questions:

- Did `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` change?
- Is the change read-compatible with all existing beta bodies?
- If not, is there a migration step from every prior beta version?
- Did the golden corpus gain a fixture covering the old shape?
- Did the corpus/DB audit pass locally?
- Are `field_defs` and built-in seed changes handled intentionally?
- Are drafts and saved versions both covered?
- Are table-view fingerprints expected to change?
- Does read-safe recovery still work for truly invalid bodies?
- Is the technical-requirements doc updated?

This checklist can live in the Phase 7 planning packet or a new `context/engineering/schema-evolution.md` page. The important part is that the rule is short and unavoidable.

### P1 - Add A Built-In FieldDef Drift Reporter

Add a helper that compares a document's persisted built-in `field_defs` to the current code-defined built-ins by table and `field_key`.

Report:

- missing built-in fields
- extra persisted built-in fields
- `field_type` changes
- config changes
- option namespace changes
- display-name changes
- default changes
- origin mismatches

This should start as a reporting tool, not an automatic mutator.

Why this matters:

- New-project seeds and old-project persisted `field_defs` naturally diverge during beta.
- Some divergence is intentional user customization.
- Some divergence is a product schema change that needs migration.
- Reviewing the diff explicitly is cheaper than discovering stale field names or wrong unit semantics in a beta project.

This helper would have caught the class of issue where code-level fallback field definitions changed but existing documents still rendered stale persisted definitions.

### P1 - Make Draft Upgrade Semantics Explicit

Saved versions and drafts both store bodies. The migration design should specify:

- Reads upgrade old saved versions in memory.
- Reads upgrade old drafts in memory.
- Saving an upgraded draft writes the current schema version.
- Save-as from an older version writes the current schema version.
- Conflicting ETags still compare against the stored body, not an implicit DB rewrite.

This belongs in tests because stale draft behavior is easy to miss.

### P1 - Add A Manual Recovery Runbook

Raw JSON download already exists. Add a short operator runbook:

1. Identify project/version/draft.
2. Download raw body from read-safe panel or DB export.
3. Run upgrade/audit script locally.
4. Inspect upgraded preview JSON.
5. Apply a manual repair path only after validation.

Do not build a broad admin UI until beta usage shows the actual recovery workflow. A CLI plus raw download is enough for early beta.

### P1 - Add Change-Pattern Tests

Keep these as small migration unit tests with artificial old bodies:

- Add required table-level field with default.
- Rename a built-in `field_key`.
- Move typed column to `custom_values`.
- Change a number field's unit config.
- Add or rename a linked-record field.
- Delete or merge a select option id.
- Add a new table bucket.

These tests are more important than a large abstract framework because they model the exact kinds of beta churn this app is likely to have.

### P2 - Keep Table View Migration Lightweight

For table views, the current fingerprint/sanitize behavior is good enough.

Potential additions:

- A "clear stale saved table views for project/table" CLI.
- A best-effort view-state migration hook only if we rename table ids or column ids frequently.

Avoid making table view state part of the durable project-document guarantee unless users start treating saved table views as deliverables.

### P2 - Revisit Catalog Schema Evolution Later

Catalog import/export already has row-level upgrade functions. That is enough for beta unless:

- catalog rows become project-specific saved evidence,
- imported catalog packages become long-lived external artifacts, or
- row schemas start changing often.

For now, the project document is the higher-risk contract.

## Schema Change Classifier

Use this classifier during beta planning and PR review.

### No Schema Bump Usually Needed

- Pure CSS or UI layout changes.
- Render-only labels that do not come from persisted `field_defs`.
- New frontend-only derived state.
- New API response field that old clients can ignore.
- New optional document field with a default that current validators truly tolerate as absent.

Even here, be careful: if a "label" is actually persisted as a built-in `TableFieldDef.display_name`, old documents will not update unless we migrate or overlay it.

### Schema Bump Usually Needed

- Any change to `ProjectDocument` or row Pydantic fields that makes old serialized bodies invalid.
- New required field in a table row, table bucket, relationship object, or field config.
- Changed `field_type` for a built-in field.
- Changed number unit config or unit semantic.
- Changed linked-record config.
- Changed option id namespace.
- Renamed table path, row key, or durable field key.
- Moved data between typed columns and `custom_values`.
- Changed formula storage or formula dependency contract.
- Changed orphan-link validation from permissive to strict.

### Migration Step Usually Needed Even If Validation Still Passes

- Built-in display-name changes that old projects should adopt.
- New default options that old documents should receive.
- Renamed status values.
- Changes to `field_defs` where persisted old definitions remain valid but semantically wrong.
- Backfills that should affect old project reports, not only new projects.

This middle class is the dangerous one. It will not always crash loading, but it can produce stale or misleading project data.

## What To Do Now, Before Users And DB Data

1. Lock the current v1 contract with fixtures.
2. Add the migration harness while it is still a no-op.
3. Add the audit CLI before there is a production corpus.
4. Document the schema-bump checklist and make it part of code review.
5. Add a built-in `FieldDef` drift reporter before field changes pile up.
6. Decide that read-safe recovery is emergency access, not normal migration.
7. Decide that automatic DB rewrites are not the default path for project versions.

The highest-leverage thing is to build the boring path now. Once beta projects exist, every schema change should have a standard question: "Did the old corpus upgrade?"

## What Not To Do

- Do not move project tables into relational tables just to make future migrations feel familiar. The JSONB document is a better fit for immutable versions, LLM/MCP consumption, raw recovery, export, and beta flexibility.
- Do not silently rewrite saved project bodies on read. It hides risk and makes ETag/version behavior harder to reason about.
- Do not rely on Pydantic `mode="before"` validators inside the current model as the whole migration strategy. Those become hard to audit once several versions exist.
- Do not treat table-view state migration as project-data migration. Table views are preferences/cache unless product requirements change.
- Do not let code-defined built-in fields and persisted built-in fields drift without a review tool.
- Do not wait until the first breaking schema change to design the migration interface.

## Proposed Implementation Sequence

This is a planning artifact, not an implementation request. If/when we start, I would sequence it this way:

1. Create the `project_document/migrations` package with no-op v1 support.
2. Generate and commit v1 golden fixtures from current seeded documents.
3. Add migration tests around validation, idempotence, and future-version rejection.
4. Add the corpus/DB audit CLI.
5. Add the built-in `FieldDef` drift reporter and test it against seeded docs.
6. Update `context/technical-requirements/llm-mcp-schema.md` and the Phase 7 packet from "deferred" to "beta gate".
7. Run the audit against any local/demo project versions before opening beta.

This is small enough to do as one focused feature packet, but it should be done before real beta users create durable project versions.

## Accepted Decisions

Accepted by Ed on 2026-06-27 and folded into
`planning/features/beta-schema-evolution/decisions.md`.

1. **When is beta data considered real?**
   - Decision: the first project created by someone other than the development agents for an actual BLDGTYP job counts as real and activates the forever-readable guarantee.

2. **Should old saved versions remain stored in old schema forever?**
   - Decision: yes. Upgrade on read and write current schema only when saving a draft, save-as, or explicit manual repair.

3. **Should we ever run a DB body rewrite?**
   - Decision: only as an explicit maintenance operation with export, audit, backup, and rollback. It is not the normal deploy path.

4. **Do we need a UI importer for repaired project JSON before beta?**
   - Decision: no. Raw download plus CLI repair is enough for early beta. Add importer only if recovery happens often enough to justify it.

5. **How strict should field display-name migration be?**
   - Decision: built-in field display names are product schema, but explicit custom/user-created field names are preserved. The drift reporter must distinguish built-in origin from custom origin.

## Source Breadcrumbs

Primary source files reviewed:

- `backend/features/project_document/document.py`
- `backend/features/project_document/validation.py`
- `backend/features/project_document/store.py`
- `backend/features/project_document/models.py`
- `backend/features/project_document/write_spine.py`
- `backend/features/project_document/drafts.py`
- `backend/features/project_document/repository.py`
- `backend/features/project_document/custom_fields.py`
- `backend/features/project_document/tables/contracts.py`
- `backend/features/project_document/templates.py`
- `backend/features/project_document/_validators.py`
- `backend/features/table_views/models.py`
- `backend/features/table_views/service.py`
- `frontend/src/features/table_views/types.ts`
- `frontend/src/features/table_views/hooks.ts`
- `frontend/src/shared/ui/data-table/lib/view/sanitize.ts`
- `frontend/src/features/projects/routes/ProjectShell.tsx`
- `frontend/src/features/project_document/lib.ts`
- `backend/features/catalogs/materials/import_export/upgrade.py`
- `backend/features/catalogs/frame_types/import_export/upgrade.py`
- `backend/features/catalogs/glazing_types/import_export/upgrade.py`

Planning and requirements references:

- `planning/code-reviews/2026-06-24/backend-data-architecture-review.md`
- `planning/archive/dated/2026-06-24/backend-data-architecture-cleanup/phases/phase-07-schema-migration-mechanism.md`
- `context/technical-requirements/llm-mcp-schema.md`
- `context/technical-requirements/data-model.md`
- `context/technical-requirements/save-versioning.md`
