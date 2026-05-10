---
DATE: 2026-05-06
TIME: -
STATUS: READY — kickoff decisions resolved 2026-05-06 (see §2)
RELATED-PRD: docs/features/2026-05-06-native-catalog-manager.md (§13)
BRANCH: poc/catalog (to be created)
---

# Catalog Manager — Behavior / UI POC Plan

## 1. Purpose

Validate the data-table UI feel, the version-timeline interaction, the
attachment flow, and the schema-driven field renderer in a fully isolated
sandbox before committing the real implementation. Every choice in this
plan is in service of answering the six go/no-go questions in PRD §13.4.

This plan is the baseline POC scaffold. The PRD records *what we want to
build*; this document records the broader POC setup, week-based budget,
and post-gate work blocks. The operative execution sequence for the
current sandbox work lives in `airtable-parity-phases.md`, which
supersedes the week-based build order in §4-§5 and is the one active
checklist through the Phase 5 evaluation gate.

## 2. Kickoff decisions (resolved 2026-05-06)

- **POC operator** — Ed does all implementation work. John reviews
  weekly and participates in the week 4 versioning-UX evaluation
  (§7.3) and the week 6 go/no-go (§9.2).
- **Cloudflare / R2** — BLDGTYP does not yet have a Cloudflare account.
  Account creation and bucket provisioning is a discrete step in the
  plan; see §3.1a. Two buckets: `ph-data-poc` (this POC) and
  `ph-data` (reserved, untouched until real implementation begins).
- **AirTable export** — corrected IDs (the earlier draft had base/table
  IDs swapped). Verified against `backend/config.py` 2026-05-06:
  - Materials: base `appvuwBhK0he4PbVi`, table `tbl6GnWtkPX0OALMu`
  - Aperture-data base `applZMqlNTg2Oldiq` (frames + glazings live
    here):
    - Frame Data: table `tbllusBTIP0x50vEf`
    - Glazing Data: table `tbl8hxFgJSKjlIDi9`

  CSVs pulled 2026-05-06 to
  `backend/features/catalog/poc_seeds/airtable_export/` (gitignored
  except for `.gitkeep`):
  - `Material Data-Grid view.csv` — 405 rows
  - `Frame Data-ALL DATA.csv` — 189 rows
  - `Glazing Data-ALL DATA.csv` — 40 rows

  No real attachments downloaded — POC uses synthetic PDFs only
  (decision recorded 2026-05-06; §8.3).
- **Table role assignments (decided 2026-05-06)** —
  empirical attachment density across the live exports informed this:
  - **Materials** (405 rows, 13 fields, 12 categories) — primary POC
    table. Drives §13.4 questions Q1, Q3, Q4, Q6 (table UI, schema-
    driven rendering, computed-field expressions, second-table reuse
    *baseline*). Numeric-heavy, attachment-light (6 / 405 = ~1.5%).
  - **Frames** (189 rows, 20 fields) — attachment stress-test table for
    week 5 (§8.3) and the week-6 second-table validation (§9.1). Many
    text fields, many attachments in real life (159 / 189 = ~84%) —
    structurally most-different from Materials, making it the strongest
    `<DataTable>` reusability test.
  - **Glazings** (40 rows, 10 fields) — held in reserve. Not exercised
    during the POC unless time permits a third-table sanity check.
- **Time budget** — six engineer-weeks of focused work, then evaluate
  per §9.3. Recalibrate honestly at week 2 if pacing is off (§11).
- **Grid library spike rule** — pick one at the end of week 0; no
  re-litigation mid-POC.
- **Success requirement (binding)** — the POC succeeds only if the
  final `<DataTable>` style and behavior is **as good as AirTable for
  our limited use** (browse, filter, sort, group, color, drag-reorder
  columns, inline edit, bulk select against real Materials and
  Frames data). "Almost as good" is a fail. This is the dominant
  evaluation criterion in §9.2; everything else (versioning UX,
  attachments, computed fields) is necessary but not sufficient.

## 3. Week 0 — kickoff and library spike

**Goal**: pick the table library, scaffold isolation, prove an end-to-end
"render a row from Postgres in the browser" loop on the new branch.

### 3.0 Cloudflare account + R2 bucket provisioning

First step of the POC, blocking only on §3.5 (week-5 attachment work).
Done up front so credentials exist when needed and there's no surprise
onboarding friction mid-POC.

- Create a Cloudflare account in BLDGTYP's name. Use a shared admin
  email both Ed and John can access; enable 2FA.
- Enable R2. Note the account-id and R2-specific S3 endpoint URL.
- Create two buckets:
  - `ph-data-poc` — this POC. All POC attachments land here.
  - `ph-data` — reserved for real use. Created now to claim the name;
    no objects written until real implementation begins.
- Generate an R2 API token scoped to **`ph-data-poc` only** (read +
  write + list). The reserved `ph-data` bucket is intentionally not in
  the token's scope.
- Store credentials in 1Password (or BLDGTYP's secret store). Add to
  `.env.poc` in §3.1 — never commit the file.
- Configure CORS on `ph-data-poc` to allow PUT from
  `http://localhost:*` and (later) the POC's deployed origin if any.
- Smoke-test from the command line: `aws s3 ls s3://ph-data-poc
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com`
  returns success with empty listing.
- Cost note: free tier covers ~10 GB storage and millions of Class A
  ops/month; POC will not exceed this.

**Done when**: both buckets exist, the POC-scoped API token is in
1Password, CLI smoke test passes, and the credentials are loaded from
`.env.poc` by the placeholder backend.

### 3.1 Branch & isolation scaffolding

- Create `poc/catalog` branch off `main`.
- Add `.env.poc` with `DATABASE_URL=postgresql://.../ph_navigator_catalog_poc`,
  `CATALOG_POC_ENABLED=true`, R2 credentials.
- Add `ph_navigator_catalog_poc` as a second database to
  `backend/docker-compose.yml` (or just a second `CREATE DATABASE` —
  cheaper).
- Create `backend/features/catalog/` (matching the existing
  `features/<area>/` convention used by `aperture`, `assembly`, etc.).
  Empty skeleton: `__init__.py`, `routes.py`, `models/`, `schemas/`,
  `migrations/` (Alembic env independent of the main tree, or namespaced
  inside it — decide during scaffolding).
- Wire the catalog router into `api.py` only when `CATALOG_POC_ENABLED`
  is truthy in `config.py`. Confirm the route mounts at
  `/api/catalog-poc/...`.
- Create `frontend/src/features/catalog/` (matching the existing
  `features/` layout). Add a `/catalog-poc` route to `Routes.tsx` that
  renders a placeholder. Not linked from any nav.

**Done when**: a hello-world `GET /api/catalog-poc/ping` returns 200,
visible from `/catalog-poc` in the browser, with the flag off it 404s.

### 3.2 Cross-import lint rule

Add a small static check (a pytest test or an ESLint rule, whichever is
faster) that fails CI if anything outside `backend/features/catalog/`
imports from inside it, or vice versa. This is the mechanism that
enforces the no-cross-import rule in PRD §13.1.

**Done when**: a deliberate cross-import in either direction fails CI
locally.

### 3.3 Library spike — AG Grid Community vs TanStack Table

One day on each, against ~500 rows of realistic Materials data (use the
AirTable export from §2). For each:

- Render the rows with all visible fields.
- Inline-edit a text cell and a number cell.
- Filter on a `select` column.
- Sort on a numeric column.
- Resize and reorder a column.
- Group by `category`.
- Note: bundle weight added, license clarity, time-to-first-render,
  any features that required Enterprise.

Write findings into `docs/plans/2026-05-06/grid-spike-results.md`.
Pick one. Commit. Move on.

**Done when**: the spike doc exists, a decision is recorded with
rationale, and the loser's prototype branch is deleted.

### 3.4 Materials seed data ingest

A one-shot Python script `backend/features/catalog/poc_seeds/load_materials.py`
that:

- Reads the AirTable CSV export.
- Infers an initial `catalog_field_def` shape from column headers and
  cell types (manual review and override expected — write the inferred
  schema to a YAML file the script then reads back).
- Inserts one `catalog_record` + one `catalog_record_version` per row,
  with `version_label = "AirTable import 2026-05-06"`.
- Skips attachments for now (handled in week 5 with synthetic test PDFs —
  see §8.3).

**Done when**: running the script against an empty POC DB populates real
Materials rows and the seeded YAML schema lives next to the script.

### 3.4.1 Materials dataset profile (observed 2026-05-06)

For reference when shaping the inferred schema:

- 405 rows, 13 fields, 12 categories.
- Fields: `name`, `category`, `density_kg_m3`, `specific_heat_capacity_J_kg_K`,
  `conductivity_w_mk`, `conductivity_btu_hr_ft_F`,
  `resistivity_hr_ft2_F_Btu_in`, `emissivity`, `ARGB_COLOR`,
  `display_name`, `source`, `DATASHEET`, `comments`.
- `density_kg_m3` and `specific_heat_capacity_J_kg_K` are missing on ~46%
  of rows (mostly air layers and legacy entries). The schema-driven
  renderer must handle nulls cleanly — confirm during week 1.
- `conductivity_w_mk`, `conductivity_btu_hr_ft_F`, and
  `resistivity_hr_ft2_F_Btu_in` are mutually derivable. Use these as the
  natural test cases for the week-3 `computed` expression flavor
  (PRD §4.3): seed only `conductivity_w_mk` as primary, express the
  other two as expressions of it.
- `ARGB_COLOR` is a quoted comma-separated tuple (`"255,128,64,0"`).
  Treat as `text` for the POC; a typed `color_argb` field-type is a
  post-POC follow-up.
- `DATASHEET` is populated on **6 / 405** rows — Materials is **not** the
  attachment-heavy case. Attachment stress-testing moves to Frames in
  §8.3 (decision recorded 2026-05-06).

## 4. Week 1 — read-only `<DataTable>` against fixtures

**Goal**: the table component is the centerpiece of the POC. Get it
rendering, filtering, sorting, grouping, and column-managing against
hand-crafted fixtures before introducing backend complexity.

### 4.1 Component scaffold

- `frontend/src/features/catalog/components/DataTable/` with a tiny
  internal API: `<DataTable schema={...} rows={...} onEdit={...} />`.
- Schema descriptor type that drives column generation (lives next to
  the component for now; will move to a shared types package later).
- Field-renderer registry: `text`, `number`, `select`, `date` for week
  1; rest land in week 2.

### 4.2 Fixtures

- A JSON fixture with ~100 mock Material rows, all field types
  represented, varied lengths to stress layout.
- Storybook-style harness (or just a route under `/catalog-poc/sandbox`)
  to render the table against fixtures with no backend. Speeds
  iteration.

### 4.3 Behaviors to land

- Per-column filter UI (text contains, number range, select equals).
- Multi-column sort with visible sort indicators.
- Column show/hide menu.
- Column drag-reorder.
- Column resize with persistence to `localStorage`.
- Group-by-column with collapsible groups.
- Row coloring driven by a configurable rule on a column value.
- Virtualized rendering verified against 10k synthetic rows.

**Done when**: all of the above work against fixtures, recorded as a
short Loom or a checklist Ed can self-demo to John.

## 5. Week 2 — wire to backend, schema-driven rendering, all field types

**Goal**: replace the fixture path with real reads from Postgres,
broaden field-type coverage, and prove that the schema-driven approach
holds up when `catalog_field_def` is the source of truth.

### 5.1 Backend models & read API

- SQLAlchemy models for `catalog_table`, `catalog_record`,
  `catalog_record_version`, `catalog_field_def`, `catalog_attachment`,
  `catalog_audit_log`. Match PRD §4.
- Alembic migration creating these tables in the POC DB.
- `GET /api/catalog-poc/tables/<slug>/fields` → returns
  `catalog_field_def` rows.
- `GET /api/catalog-poc/tables/<slug>/records` → returns current-version
  rows, with pagination params even if the POC doesn't paginate yet
  (shape the API for later).
- `GET /api/catalog-poc/records/<id>/versions` → version timeline.
- `GET /api/catalog-poc/records/<id>/versions/<vid>` → one version's
  full data.

### 5.2 Frontend wiring

- Drop the fixtures, swap in a typed API client at
  `frontend/src/features/catalog/api/`.
- Schema is fetched from the backend, not hard-coded — confirm a
  field added via SQL appears in the table without a frontend rebuild.

### 5.3 Remaining field renderers

- `long_text` (modal edit), `multi_select`, `attachment` (placeholder
  for now), `link`, `boolean`, `integer`, `computed` (display only —
  evaluation lands in week 3).

**Done when**: the table is reading the seeded Materials data from
Postgres, all field types render, and adding a column via SQL surfaces
in the UI on next refresh.

## 6. Week 3 — editing, validation, computed expressions

**Goal**: the table becomes write-capable. This is the highest-risk UX
week.

### 6.1 Inline & modal edit

- Inline edit for primitive types (commits on blur / Enter).
- Modal edit for `long_text`, `multi_select`, and any field marked
  `edit_in_modal` in `catalog_field_def`.
- Optimistic UI with rollback on backend rejection.

### 6.2 Edit endpoints

- `PATCH /api/catalog-poc/records/<id>/versions/<vid>` — edit fields on
  the current version. Honors `version` (row-version) for optimistic
  locking; returns 409 on conflict.
- Writes `catalog_audit_log` rows on every successful PATCH.

### 6.3 Validation

- Server-side validators registered in `backend/features/catalog/validators/`
  keyed by `field_key`. MVP set: `required`, `min`, `max`, `regex`,
  `unique_in_table`.
- Client surfaces validation errors inline on the failing cell, not
  as a generic toast.

### 6.4 Computed expression evaluator

- Adopt `simpleeval` (or equivalent) in
  `backend/features/catalog/computed.py`.
- Whitelist exactly the operators and functions in PRD §4.3 — no
  attribute access, no imports, no comprehensions.
- `computed` fields evaluated at read time and on save (so the UI
  shows the new computed value immediately).
- Tests: a known-good expression returns the right value; a known-bad
  expression (e.g. `__import__('os')`) is rejected at field-def save
  time, not at evaluation time.

**Done when**: Ed can edit a Materials row end-to-end (text, number,
select, computed shows updated value), validation rejects bad input
inline, and the audit log shows the change.

## 7. Week 4 — versioning UX and record detail

**Goal**: validate the version-timeline mental model. This is the most
novel UX in the POC and the second-highest risk after the table itself.

### 7.1 Record detail panel

- Side panel (or dedicated route) showing the current version's full
  field set, including `notes` and `source_provenance`.
- Vertical timeline of all versions with `version_date` and
  `version_label`.
- Switching to a historical version puts the panel in read-only mode
  with a clear visual indicator.

### 7.2 New version flow

- "Create new version" action on the record.
- Modal prompts for `version_label`, `version_date`, `notes`. Fields
  pre-populate from the current version; the user edits what changed.
- On save: insert new `catalog_record_version`, point
  `catalog_record.current_version_id` at it, return refreshed record.
- The old version remains visible in the timeline.

### 7.3 The "I just wanted to fix a typo" question

- Decide and document the rule for when an in-place edit of the
  current version is offered vs. when a new-version flow is required.
  Working default: *all edits are in-place by default; "create new
  version" is an explicit user action triggered from a button on the
  record detail*. Validate this in practice with John.

**Done when**: Ed and John can each successfully (a) edit a typo on a
material in place, and (b) create a new version of a material when the
manufacturer changes specs, without confusion. If the second flow is
confusing, document why and what we'd change.

## 8. Week 5 — R2, attachments, content-hash de-duplication

**Goal**: prove the storage architecture from PRD §5 end to end.

### 8.1 R2 client and presigned URLs

- `backend/features/catalog/storage.py` wrapping the S3 SDK pointed at
  R2.
- `POST /api/catalog-poc/attachments/upload-url` → returns a presigned
  PUT URL plus a draft `catalog_attachment` row in `pending` state,
  keyed by the file's client-computed SHA-256.
- `POST /api/catalog-poc/attachments/confirm` → flips `pending` to
  `active`, attaches it to a version's field, increments refcount.
- De-duplication: if an `attachment` row with the same SHA-256 already
  exists in `active` state, the upload-URL endpoint short-circuits and
  returns the existing key without issuing a new PUT.

### 8.2 Frontend upload UX

- Attachment-field renderer: drop zone, progress bar, post-upload
  preview.
- PDF inline preview using `pdf.js` (already pulled in by the existing
  PHN bundle? — check during week 5).

### 8.3 Attachment stress-testing with synthetic PDFs

**Decision recorded 2026-05-06**: do not migrate real AirTable attachments
during the POC. The POC validates the *upload + dedup + preview*
mechanics, not the migration tooling. Real-attachment migration is a
post-POC concern (PRD §9 step 4).

- Generate a small synthetic PDF set (10–20 distinct PDFs of varied
  size, plus deliberate duplicates of a few) under
  `backend/features/catalog/poc_seeds/test_attachments/` (gitignored).
  Trivial generator script using `reportlab` or similar.
- Upload these against a handful of seeded records to exercise:
  - The presigned PUT flow end-to-end.
  - Inline PDF preview.
  - Content-hash de-duplication: uploading the same PDF twice yields
    one R2 object and one `catalog_attachment` row with refcount 2.
- Empirical context: in the live AirTable bases, **Frames** is the
  attachment-heavy table (159 / 190 rows have a DATASHEET, ~84%) — far
  more than Materials (6 / 405, ~1.5%). When the migration plan
  (PRD §9) actually runs, Frames is the harder real-data case; flag
  this in `poc-decisions-fold-back.md`.

**Done when**: a synthetic PDF is uploaded, visible inline in the
record detail, and uploading the same PDF twice produces one R2 object
and one `catalog_attachment` row with refcount 2.

## 9. Week 6 — second-table validation and evaluation

**Goal**: answer PRD §13.4 question 6 — is `<DataTable>` reusable
as-is for a different table? — and run the final go/no-go evaluation.

### 9.1 Frames as the second table

(Originally drafted as "Apertures." Updated 2026-05-06: the AirTable
"Aperture-data" base contains Frames and Glazings tables, not a single
"Apertures" table — and Frames is structurally most-different from
Materials, so it's the harder reusability test. See §2 for the full
table-role rationale.)

- Use the already-pulled `Frame Data-ALL DATA.csv` from
  `backend/features/catalog/poc_seeds/airtable_export/` (no second
  AirTable pull needed).
- Define `catalog_field_def` rows for Frames.
- Seed into the POC DB.
- Render at `/catalog-poc/tables/frames` with **zero changes** to
  `<DataTable>`. If changes are required, log every one — that list is
  the answer to PRD §13.4 Q6.

### 9.2 Evaluation against PRD §13.4

A working session (Ed + John, 90 minutes) walking through each of the
six questions with the live POC. For each: clear yes / clear no /
qualified yes (with what would have to change). Recorded in
`docs/plans/2026-05-06/poc-evaluation.md`.

### 9.3 Decision

One of:

- **Proceed** → fold POC learnings back into PRD §4, §6, §11; promote
  `backend/features/catalog/` to a permanent flagged module on `main`;
  begin Materials migration per PRD §9.
- **Iterate** → identified specific UX problems are worth fixing; one
  more two-week iteration with a new evaluation date.
- **Stop** → a kill criterion (PRD §13.5) was hit; reconsider the
  approach or stay on AirTable.

## 10. Tracking & artifacts

Created over the POC lifecycle, all under `docs/plans/2026-05-06/`:

- `catalog-poc-plan.md` — this doc.
- `grid-spike-results.md` — week 0 library decision.
- `weekly-notes.md` — running log, one short entry per week.
- `poc-evaluation.md` — week 6 go/no-go.
- `poc-decisions-fold-back.md` — list of changes to push back into
  the PRD (week 6).

## 11. Risks specific to this POC

- **Time slippage** — six weeks of focused work assumes ~Ed's evenings
  and weekends, not full days. Recalibrate the cap honestly at week 2.
- **AirTable export fidelity** — attachment URLs in CSV exports
  expire. Not a POC risk per the 2026-05-06 decision (§8.3 uses
  synthetic PDFs); becomes relevant only when the real-data migration
  in PRD §9 begins, at which point CSV pull and attachment download
  must happen in the same session.
- **R2 account provisioning friction** — if Cloudflare onboarding
  drags, fall back to MinIO locally for the storage POC; the S3 API is
  the same.
- **AG Grid licensing surprise** — Community is permissive but some
  features (e.g. server-side row model, certain filters) are
  Enterprise-only. The week-0 spike must explicitly confirm every
  POC-scope behavior is in Community.
- **Versioning UX confuses the basic edit case** — the highest
  conceptual risk in the POC. If §7.3 evaluation comes back unclear,
  do not paper over it; this is exactly what the POC is for.
- **Scope creep into the schema editor UI** — tempting because adding
  a column via SQL is annoying. Resist; that UI is explicitly out of
  scope (PRD §13.2).

## 12. Out of scope reminders (will be tempting; do not do)

Repeating from PRD §13.2 for visibility during execution:

- Schema editor UI.
- Audit log surfacing.
- Project-scoped tables and override resolution.
- Backups, restore drills, monitoring.
- Code-registered Python computed fields beyond the expression
  evaluator.
- Migration tooling / dual-read fallback against AirTable.
- Any change to existing PHN code paths.

## 13. Next concrete actions

In order. Each is small enough to start tomorrow.

**Status as of 2026-05-06 EOD** (branch `poc/catalog` pushed, at
commit `bb2e299`). See `weekly-notes.md` for the running log and the
"how to resume" guide.

- [x] Branch `poc/catalog` created and pushed to GitHub.
- [x] `backend/features/catalog/` and `frontend/src/features/catalog/`
  skeletons landed; `/api/catalog-poc/ping` round-trip verified flag-on
  (200) and flag-off (404).
- [x] Cross-import lint pytest in place (plan §3.2); verified to catch
  a deliberately injected violation.
- [x] `.env.poc.example` template, `backend/.env.poc` populated,
  `backend/scripts/create_poc_db.sh` helper (with the `psql -d` fix —
  see weekly-notes lessons-learned), and
  `backend/features/catalog/README.md` setup notes landed.
- [x] AirTable CSVs pulled for Materials (405 rows), Frames (189),
  Glazings (40).
- [x] Cloudflare account activated, both R2 buckets created, scoped
  API token issued + rotated, smoke-tested end-to-end (read scoped
  bucket OK; reserved bucket access denied; PUT/GET/DELETE round-trip
  OK in scoped bucket).
- [x] `boto3==1.43.5` added to `backend/requirements.txt`.
- [x] POC Postgres DB `ph_navigator_catalog_poc` created on the
  existing Docker container; SQLAlchemy connection verified end-to-end.
- [x] **AG Grid Community vs TanStack Table spike (§3.3) against the
  Materials CSV** — both spikes built; TanStack chosen. Findings in
  `grid-spike-results.md` (2026-05-07).
- [x] **Wishlist of AirTable behaviors to replicate** —
  `airtable-wishlist.md` (2026-05-07).
- [x] **Phase plan** translating the wishlist into vertical-slice
  phases — `airtable-parity-phases.md` (2026-05-07). Supersedes the
  per-week scope of §4–§5 of this plan.
- [x] **Phase 1 — active cell + keyboard nav + ⌘C** — landed and
  demo-passed 2026-05-07. Lessons in `poc-lessons-for-real-build.md`.
- [x] **Phase 2 — range selection + structured copy + row/column
  select** — landed and demo-passed 2026-05-07. Lessons in
  `poc-lessons-for-real-build.md`; detailed findings addendum in
  `airtable-parity-phases.md` §5.10.
- [ ] **Phase 3 — bulk write gestures + undo safety net** ← *next
  concrete action* (parity-phases.md §6).
- [ ] Materials seed loader script per §3.4 (deferred until post-gate
  per parity-phases.md §2.3 in-memory rule).
- [ ] Synthetic test PDFs for week-5 attachment work (§8.3).
