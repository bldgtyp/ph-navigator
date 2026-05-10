---
DATE: 2026-05-06
TIME: -
STATUS: PAUSED 2026-05-09 — gated on project-side versioning prerequisite.
        See status note below; resume reading from
        docs/plans/2026-05-09/project-versioning.md.
AUTHOR: Ed May (with Claude)
SCOPE: New feature area within PH-Navigator. Long-running, multi-phase migration off AirTable.
---

# Native Catalog Manager — Product Requirements

> **STATUS NOTE — 2026-05-09.** Implementation paused. The post-gate work
> in `docs/plans/2026-05-06/poc-evaluation.md` §7.3 surfaced a structural
> prerequisite this PRD did not anticipate: PHN's project-side data model
> has no save / revision concept, so the catalog's pin-on-close mechanism
> (the original UC3-style "closed project should not auto-update from
> vendor changes" requirement) has nowhere to write. That work is being
> designed first — see `docs/plans/2026-05-09/project-versioning.md`.
>
> **Wave 1** (catalog editor + catalog-side identity-plus-versions on
> the existing typed schema) is unblocked and can proceed in parallel.
> **Wave 3** (catalog × project pinning, project-specific overrides,
> stale-pin notifications) waits on project-versioning. See the wave
> structure in `docs/plans/2026-05-09/project-versioning.md` §3.
>
> Sections to revise on resume:
>
> - **§4** — the generic JSONB / `catalog_field_def` model is being
>   replaced with a typed-tables-plus-versions retrofit on the existing
>   `assembly_materials`, `aperture_frame_types`, and
>   `aperture_glazing_types` schema. Schema flexibility (add column
>   without migration) is no longer a goal; columns are added via
>   Alembic.
> - **§4.2** and **§4.3.1** — versioning semantics and project-scope
>   resolution are now coupled to project-side revision capture, not to
>   catalog-side scope flags.
> - **§6.3** — schema editor UI is out of scope (POC §7.2 ratified
>   2026-05-07).
> - **§9** — migration plan needs to be re-sequenced around Waves 1 / 2 / 3.
>
> When resuming: open `docs/plans/2026-05-09/project-versioning.md`
> first.

## 1. Goal

Replace BLDGTYP's reliance on AirTable for shared "catalog" databases (Materials,
Apertures, Frames, Glazings, Fans, Pumps, etc.) with a native catalog feature in
PH-Navigator. The catalog must be:

1. **Editable in-app** with a spreadsheet-like UI that the team finds at least as
   pleasant as AirTable for bulk data entry and review.
2. **Schema-flexible** — adding a new column to a catalog table must not require
   a code deploy or a database migration written by hand.
3. **Versioned** — records can have multiple dated versions; old versions are
   never lost and remain referenceable by downstream consumers.
4. **Reliable** — daily backups, tested restore, redundant object storage. This
   is production company data.
5. **Reusable** — the same data-table component should serve every catalog table
   (and eventually project-scoped tables like fan/pump selections), so we are
   not building one-off pages per entity.
6. **Multi-product** — eventually consumed by ph-navigator, ph-dash, and the
   Grasshopper plugins via a stable API. (MVP: PH-Navigator only.)

## 2. Non-goals (MVP)

- Real-time multi-user collaboration (presence cursors, OT/CRDT).
- Comment threads, @mentions, notifications.
- Per-user / per-row permissions or role-based access control beyond
  "logged-in users can edit, anonymous cannot."
- Formula DSL / arbitrary spreadsheet-style expressions. Computed values are
  expressed in Python (Pydantic computed fields) or as Postgres generated
  columns — not as user-authored formulas.
- Public Grasshopper API (deferred to a later phase).
- Linked-record graphs across catalog tables (will be added per-table as needed
  via foreign keys, not as a generic feature).
- Mobile / phone optimization.

## 3. Users & access

- **Users**: Ed May, John Mitchell. (Two users for the foreseeable future.)
- **Auth model (MVP)**: any authenticated PH-Navigator user can view and edit
  any catalog record. Anonymous users have no access to catalog management
  routes. No role differentiation, no per-table permissions.
- **Provenance**: every write records `created_by` / `updated_by` (user id) and
  timestamps. This is for the audit log, not access control.

## 4. Data model

### 4.1 Identity vs version

Catalog records are split into two layers:

- **Identity row** — stable identifier for "this material" / "this window
  frame." Holds the slug, display name, category, and a pointer to the current
  default version. Soft-deletable.
- **Version row** — an immutable (in practice, append-only) snapshot of the
  record's data at a point in time. Holds the actual field values.

Downstream consumers (project models, energy models, the GH plugin) reference a
**specific version id**, never the identity id. This guarantees that an old
project's energy model continues to resolve to exactly the material data it
was built against, even if the manufacturer changes the spec years later.

```
catalog_table          (id, slug, display_name, schema_version, created_at, ...)
catalog_record         (id, table_id, slug, display_name, category,
                        current_version_id, created_at, deleted_at,
                        created_by, updated_at, updated_by)
catalog_record_version (id, record_id, version_label, version_date,
                        fields JSONB, notes, source_provenance,
                        created_at, created_by)
catalog_attachment     (id, version_id, file_key, label, kind, page_ref,
                        uploaded_at, uploaded_by)
catalog_field_def      (id, table_id, field_key, label, type, unit,
                        choices JSONB, validators JSONB, display_order)
catalog_audit_log      (id, table_id, record_id, version_id, user_id,
                        action, before JSONB, after JSONB, at)
```

### 4.2 Versioning semantics

- Editing a field on the **current version** in place is permitted for typo
  fixes and small corrections. These edits are captured in `catalog_audit_log`.
- Creating a **new version** is an explicit user action ("New version of this
  material") and is the right path whenever the underlying *thing* has changed
  (manufacturer reformulated, new datasheet issued, switching to a different
  product line under the same logical record). The new version becomes the
  current version; the prior version remains queryable and referenceable.
- Versions have a `version_label` (free text, e.g. "2024 datasheet",
  "post-reformulation") and a `version_date` (the date that version became
  effective). Display shows version timeline.
- Deleting a record is a soft delete on the identity row; versions are never
  hard-deleted.

### 4.3 Schema flexibility

Per-table fields are defined in `catalog_field_def`. The `fields` column on
`catalog_record_version` is a JSONB blob keyed by `field_key`. The UI is
fully driven by `catalog_field_def` — adding a column to a table means
inserting a row into `catalog_field_def`, no migration, no deploy.

### 4.3.1 Table scope (global vs project-scoped)

Catalog tables fall into three scope categories, expressed as a `scope`
column on `catalog_table`:

- **`global`** — single shared row set used across all projects. Cannot be
  overridden per-project. Examples: Materials, Apertures, Frames, Glazings.
- **`global_with_project_overrides`** — a global catalog exists, but a
  project may add its own rows or override a specific record with a
  project-scoped version. Resolution order at read time: project-scoped row
  first, then global. Examples: Pumps, Fans, Heat-Pumps, ERVs.
- **`project_scoped`** — every row belongs to exactly one project; no global
  catalog. Examples: Rooms, Thermal Bridges.

Project-scoped and override rows carry a `project_id` foreign key on
`catalog_record`. Global rows have `project_id = NULL`. Versions inherit
their record's scope.

The exact set of tables and their scope assignments will be enumerated in
the design stage by inventorying the live AirTable bases.

Field types supported in MVP:

- `text`, `long_text`
- `number` (with optional `unit` — uses `PH_units`)
- `integer`
- `boolean`
- `select` (single, choices in `choices` JSONB)
- `multi_select`
- `date`
- `attachment` (one or more files in object storage)
- `link` (URL)
- `computed` — read-only, evaluated server-side. Replaces AirTable formula
  fields. Two flavors:
  1. **Expression** — a small whitelisted expression stored in
     `catalog_field_def.expression`, evaluated by a safe interpreter
     (e.g. `simpleeval`). Allowed: arithmetic operators (`+ - * / // % **`),
     parentheses, references to other field keys in the same record, numeric
     literals, string literals, string concatenation, basic string functions
     (`upper`, `lower`, `strip`, `len`, slicing, `f"{x} - {y}"`-style
     interpolation). Disallowed: imports, attribute access, function
     definitions, comprehensions, anything not on the whitelist. Covers cases
     like `r_value = thickness / conductivity` or
     `display_name = manufacturer + " - " + product_name`.
  2. **Registered function** — a Python function in `catalog/computed.py`
     bound to a `field_key`, used for anything more involved than basic math
     or string ops (PH-domain calculations, unit-aware math via `PH_units`,
     etc.). Wired in code, not user-editable.

Validators (`validators` JSONB) cover the simple cases: `required`, `min`,
`max`, `regex`, `unique_in_table`. Domain-specific validation (e.g. PH-rule
sanity checks on a U-value) lives in Python and is wired in by `field_key`.

### 4.4 Provenance

Each version has:

- A free-text `notes` field (where the value came from, why this version was
  created, etc.).
- A `source_provenance` JSONB array of `{kind, label, attachment_id?, page_ref?,
  url?}` entries — each entry points at one or more PDFs (in object storage)
  or external URLs that justify the data in this version. This is the
  field-level provenance equivalent of AirTable's `DATA_SHEET` /
  `SPECIFICATION` attachments, generalized.

## 5. Object storage

Single Cloudflare R2 bucket (e.g. `ph-data`), structured by prefix:

```
ph-data/
  catalog/<table_slug>/<record_id>/<version_id>/<filename>
  projects/<project_id>/photos/<filename>
  projects/<project_id>/specs/<filename>
```

- Browser uploads use **presigned PUT URLs** issued by the backend. File bytes
  do not flow through the FastAPI process.
- Downloads use presigned GET URLs (short TTL) so attachments are not publicly
  enumerable.
- The `catalog_attachment` and project-asset rows store the R2 object key plus
  metadata; the backend never assumes the file is locally present.
- Replication: enable R2 cross-region replication, plus a nightly `rclone sync`
  to a Backblaze B2 bucket as a cold copy.
- Supersedes the current Google Cloud Storage usage for project images and
  spec PDFs. Existing GCS contents migrate via `rclone` during phase 1.

## 6. UI

### 6.1 Generic `<DataTable>` component

One reusable React component renders any catalog table, driven by the table's
`catalog_field_def` rows.

**MVP requirements:**

- Virtualized rendering (10k+ rows performant).
- Per-column filter (text contains, number range, select equals, date range).
- Multi-column sort.
- Group-by a column (collapsible groups).
- Show / hide columns; reorder columns by drag; resize columns; persist these
  view settings per-user-per-table in `localStorage` for MVP, in DB later.
- Color a row or cell based on a column value (configurable).
- Inline cell edit for primitive types; modal edit for attachments and
  long-text.
- Bulk select → bulk delete / bulk-edit-one-field.
- CSV export of the current view (filters + column selection respected).
- CSV import with column-mapping step (used for AirTable migration).

**Recommended library**: AG Grid Community as the base, wrapped in our own
`<DataTable>` so the dependency is swappable. TanStack Table is the fallback
if licensing or weight becomes a concern.

### 6.2 Record detail / version timeline

A side-panel or dedicated route per record showing:

- Field values for the currently selected version.
- A vertical timeline of all versions with `version_date` and `version_label`.
- "Create new version" action (clones current version's fields as a starting
  point, prompts for `version_date`, `version_label`, and `notes`).
- Attachments grouped by kind, with PDF preview inline.
- The provenance list, with each entry linking to its supporting PDF or URL.

### 6.3 Schema editor

Per-table admin view for adding / renaming / reordering fields, editing
choices for `select` fields, marking fields required, etc. Writes to
`catalog_field_def`. Available to any logged-in user (MVP).

## 7. Reliability

- **Postgres**: Render Postgres on a tier that includes point-in-time
  recovery. Verify PITR works by performing a test restore before relying on
  it.
- **Application-level backups**: nightly `pg_dump` of the catalog schema to R2,
  retained 90 days. Implemented as a scheduled task (cron on Render or a
  small worker).
- **Restore drill**: documented and rehearsed quarterly. Spin up a fresh local
  Postgres from the latest R2 dump, confirm row counts and a spot-checked
  record. Calendar reminder.
- **Object storage redundancy**: R2 cross-region replication + nightly B2 sync
  (see §5).
- **App availability**: at least two Render web instances behind the load
  balancer so a deploy or crash does not take catalog editing offline.
- **Observability**: Sentry for errors (free tier sufficient at this scale),
  Better Stack or UptimeRobot for uptime checks on the catalog API endpoints,
  structured JSON logs.
- **Data integrity**:
  - Foreign keys enforced in Postgres, not just in the app.
  - Soft delete only for catalog records; never hard-delete a referenced row.
  - Optimistic locking via a `version` (row-version, not record-version)
    column on `catalog_record_version` to prevent silent overwrites if two
    users edit simultaneously.
  - Append-only `catalog_audit_log` capturing every write with before/after
    JSON and the acting user.

## 8. Architecture

### 8.1 MVP: module within PH-Navigator backend

The catalog lives as a self-contained module inside the existing FastAPI
backend, with a clean API surface, but is not yet a separate service. This
defers ops complexity until a second consumer actually exists.

```
ph-navigator/
  backend/
    catalog/
      models/              SQLAlchemy + Pydantic
      routes/              REST: /api/catalog/<table>/...
      schemas/             field-def loaders, validators
      versioning.py        new-version logic, current-version pointer
      storage.py           R2 client (presigned URLs, upload/download)
      audit.py             change log
      backup.py            nightly pg_dump → R2
      computed.py          registry of Python computed-field functions
    projects/              existing module — also uses storage.py
  frontend/
    components/
      DataTable/
        DataTable.tsx
        FieldRenderers/    text, number, select, attachment, computed, ...
        SchemaForm.tsx     edit modal driven by field schema
        viewState.ts       per-user view persistence
    routes/
      catalog/
        materials/
        apertures/
        frames/
        glazings/
        ...
```

### 8.2 Future: extract to `ph-catalog` service

When the second consumer (ph-dash or the GH plugin's Python client) is real,
extract the catalog module into its own FastAPI service with the API contract
already in place. Consumers will be:

- PH-Navigator (existing).
- ph-dash (existing internal tool).
- A `ph_catalog_client` Python package used by `honeybee_ph` / Grasshopper
  components — public, since the open-source PH-Tools repos need it.

This extraction is **out of scope for MVP** but the in-process module should
be designed with this split in mind: no cross-imports between `catalog/` and
the rest of the backend except through the public `routes/` and a small
typed Python client wrapper.

## 9. Migration plan

Phased, table-by-table. AirTable and existing GH components remain in
production throughout — no flag-day cutover.

1. **R2 + storage module + presigned-URL upload flow.** Migrate existing GCS
   project images and spec PDFs to R2 with `rclone`. Update PH-Navigator to
   read from R2. (Reversible if R2 turns out to be wrong.)
2. **`<DataTable>` prototype** rendered against an existing read-only
   PH-Navigator table (Fans or Pumps). Validates the UI approach with no
   migration risk.
3. **Catalog Postgres schema, audit log, backup job, restore drill.** Nothing
   user-facing yet.
4. **First catalog migration: Materials.** One-time CSV import from AirTable
   plus PDF migration from AirTable attachment URLs into R2. Backend reads
   Postgres-first, falls back to AirTable if not found (dual-source). Run
   for two to four weeks with both sources live to catch gaps.
5. **Cut the Materials AirTable to read-only**, then **drop the
   AirTable-fallback path** for Materials.
6. **Repeat for Apertures, Frames, Glazings**, then for Fans and Pumps once
   we are confident in the UI and round-trip.
7. **Public client + service extraction** — only after at least two non-PHN
   consumers actually need it.

Each table's migration includes:

- CSV export from AirTable.
- Field-mapping spec written into `catalog_field_def`.
- Attachment download script (AirTable URLs → R2 keys).
- Dual-read window with a metric counting AirTable fallbacks.
- Round-trip test: read a record from Postgres, hand it to the consumer that
  used to read AirTable, confirm identical behavior.

## 10. Cost & ops

- **R2**: ~$15/TB-month storage, $0 egress. Current PHN asset volumes are
  modest; expected <$5/month for storage at MVP scale.
- **Postgres**: existing Render Postgres line item; a tier bump to enable PITR
  and HA may be warranted.
- **Backblaze B2 cold copy**: ~$6/TB-month storage, modest egress.
- **Sentry / uptime**: free tiers cover current scale.
- **AirTable seats**: retained during migration. Drop seats only as tables are
  fully migrated and dual-read windows close.

Dominant cost is engineering time, not infrastructure.

## 11. Resolved decisions (2026-05-06)

- **Computed fields**: support both a small whitelisted expression language
  (basic math + string ops only — see §4.3) and code-registered Python
  functions for anything more involved. Expression evaluator must be a safe
  interpreter (e.g. `simpleeval`), not raw `eval`.
- **Per-user view persistence**: `localStorage` for MVP. Promote to a
  DB-backed `user_view_state` table if it becomes annoying across
  devices/browsers. Named saved views (AirTable-style "view tabs") are out
  of scope for MVP.
- **Validation lives in the catalog module** — `catalog/validators` keyed by
  `field_key`, so bad data is rejected at catalog write time. Consuming
  models (e.g. `honeybee_ph`) still perform their own model-level checks as
  a second line of defense.
- **Table scope**: three-way scope (`global`, `global_with_project_overrides`,
  `project_scoped`) on `catalog_table`. Same `<DataTable>` component and
  same backend module serve all three. Specific table assignments to be
  enumerated in design stage from the live AirTable bases. (See §4.3.1.)
- **Attachment de-duplication**: enabled. `catalog_attachment` keyed by
  content hash (e.g. SHA-256) so the same datasheet referenced from many
  records / versions stores once. Reference-counted; an attachment row is
  only physically removed from R2 once no version still points at it.

## 12. Remaining open questions

(none at this stage — to be revisited after design)

## 13. Behavior / UI POC (precedes full implementation)

Before committing to the full PRD, build an isolated sandbox POC inside this
repo to validate the table UI feel, the version timeline interaction, the
attachment upload flow, and the schema-driven field renderer. This is a
disposable-by-design exploration whose only deliverable is a confident
answer to: *does this approach actually work for how we use catalogs?*

### 13.1 Isolation strategy

Same repo, long-lived branch (`poc/catalog`). Three layers of isolation so
the POC cannot touch dev or prod data:

1. **Database** — separate Postgres database
   (`ph_navigator_catalog_poc`) on the same local Docker instance. Selected
   via a `.env.poc` `DATABASE_URL`. No shared tables with PHN. Migrations
   live in `backend/catalog/migrations/` independent of the main Alembic
   tree.
2. **Backend** — new `backend/catalog/` module mounted only when
   `CATALOG_POC_ENABLED=true`. All routes prefixed `/api/catalog-poc/`.
   Strict no-cross-import rule: `catalog/` does not import from existing
   PHN modules and vice versa. Auth piggy-backs on the existing PHN login
   (any logged-in user) so the POC is gated but no new auth code is
   written.
3. **Frontend** — new route at `/catalog-poc`, not linked from the main nav.
   Own component tree under `frontend/src/catalog/`. Own state, own API
   client, own styling tokens (can borrow PHN's but not depend on them).

Object storage: separate Cloudflare R2 bucket (`ph-data-poc`) with its own
credentials in `.env.poc`. Attachment experiments cannot touch real assets.

### 13.2 POC scope

**In scope:**

- One catalog table only: **Materials** (highest field count + most
  attachment activity → hardest UX case; if it works here it works
  everywhere).
- The generic `<DataTable>` component end-to-end: virtualized rendering,
  per-column filter, multi-column sort, group-by, show/hide/reorder/resize
  columns, row/cell coloring, inline edit, bulk select.
- Schema-driven field renderers for: `text`, `long_text`, `number` (with
  unit), `select`, `multi_select`, `date`, `attachment`, `link`, `computed`
  (expression flavor only).
- Record detail panel with the version timeline and "create new version"
  flow.
- Attachment upload via presigned PUT to R2, PDF inline preview,
  content-hash de-duplication.
- CSV import of one real Materials AirTable export (read-only seed) so the
  POC is exercised against realistic shape and volume.
- View-state persistence via `localStorage` (per §6.1).

**Out of scope for POC:**

- The schema editor UI (§6.3) — for the POC, edit `catalog_field_def`
  directly via SQL or a seed script.
- Audit log surfacing in the UI (the table is still written; just not
  displayed).
- Project-scoped tables and `global_with_project_overrides` resolution
  (§4.3.1) — POC tests global scope only.
- Backups, restore drills, replication, monitoring — these are
  reliability concerns for production, not for a sandbox.
- Code-registered Python computed fields — expression flavor only is
  sufficient to validate the UI pattern.
- Migration tooling / dual-read fallback — POC reads its own DB only.
- Any change to existing PHN code paths.

### 13.3 Library spike (week 0)

One-day-each spike comparing **AG Grid Community** and **TanStack Table**
against a representative Materials dataset. Pick on:

- Feel of inline edit and column resize.
- Filter/sort/group ergonomics out of the box.
- Bundle weight.
- Effort to wrap behind our `<DataTable>` abstraction.
- License clarity (especially AG Grid Community vs Enterprise feature
  boundaries).

Commit to one. No re-litigating mid-POC.

### 13.4 Questions the POC must answer

Each is a go/no-go input to the real PRD finalization:

1. Does the generic table UI feel at least as fast and pleasant as AirTable
   for routine catalog browsing and bulk edits, on a real Materials
   dataset?
2. Is the version-timeline interaction (current version vs. historical
   versions, "create new version" flow) intuitive for the team, or does it
   confuse the basic "edit a row" mental model?
3. Does schema-driven rendering hold up when we add unusual fields, or
   does every new field type require custom one-off UI work?
4. Is the expression flavor of computed fields actually sufficient for the
   formulas we currently rely on in AirTable, or do we hit walls
   immediately?
5. Does the presigned-PUT-to-R2 upload flow work cleanly for our typical
   PDF sizes, including inline preview and de-duplication?
6. Is `<DataTable>` reusable as-is for a second table (Apertures), or
   does each table need significant customization?

### 13.5 Kill criteria

The POC is abandoned (and we reconsider the whole approach) if any of:

- After four weeks of focused work, routine Materials operations still
  feel materially worse than AirTable.
- The generic-table abstraction starts requiring per-table forks to
  remain usable.
- Versioning UX confuses the team in practice ("I just wanted to fix a
  typo, why is there a modal asking about version dates?").
- Cumulative POC effort exceeds six engineer-weeks without clear
  resolution on the questions above.

### 13.6 Exit conditions (POC → real PRD)

When the POC answers the §13.4 questions positively, the real-PRD work
begins by:

- Folding any concrete UX or data-model corrections back into this
  document (sections §4, §6, §11 in particular).
- Promoting `backend/catalog/` from POC-flagged to a real module on
  `main`, behind the same feature flag until the first table migration is
  ready.
- Discarding the POC database and R2 bucket. POC data is throwaway by
  design — nothing in it is treated as authoritative.
- Beginning the migration plan in §9 with Materials as the first real
  table.

## 14. Success criteria

- Materials, Apertures, Frames, Glazings fully managed in PH-Navigator with no
  AirTable reads remaining.
- Fans and Pumps editable in PH-Navigator (no longer display-only).
- Round-trip: a project built against catalog data in PH-Navigator produces
  the same energy-model inputs as the AirTable-sourced version did.
- Restore drill performed at least twice on real backups, both successful.
- Team subjectively reports the new UI is "fine" or better for catalog work.
  Not "as good as AirTable in every way" — "fine for what we actually do."
