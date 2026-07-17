# PRD — Catalog Option Management

DATE: 2026-07-17
TIME: 12:07
STATUS: Active
AUTHOR: Ed + Claude (Fable 5)
SCOPE: Behavior contract for member-editable catalog single-select options and
the project-wide rename cascade.
RELATED: README.md, decisions.md, research.md,
context/technical-requirements/envelope-catalog-drift.md

## 1. Problem

The Window Frame and Window Glazing catalogs use strict single-select fields
whose option vocabularies live in the `catalog_field_options` store. The full
options CRUD (REST + service + frontend controller) already exists, but:

- No catalog page passes `onEditCustomFieldBundle` to DataTable, so
  `editConfigEnabled` is false and the field-config modal — the only surface
  for rename/reorder/recolor/delete/merge — is unreachable. Header
  double-click does nothing; the header menu shows only Sort/Filter/Group/Hide.
- `catalog.edit` is held only by staff/admin/explicit grants, so ordinary
  members cannot manage options (or catalog rows) at all.
- A manufacturer rename leaves stale label strings inside project documents
  (`ManufacturerFilters` allow-lists and, until refreshed, `FrameRef`/
  `GlazingRef` snapshots). Filters silently stop matching; refs surface as
  per-ref drift that is tedious to resolve for a pure relabel.

## 2. Users and authorization

- **Members (any signed-in user):** full option management and catalog row
  editing. Implemented by adding `CATALOG_EDIT` to `MEMBER_CAPS`
  (`backend/features/access/capabilities.py:74`) — see decisions.md D-1.
- **Certifiers / anonymous viewers:** no change. The `certifier` audience
  resolves to an empty capability set (fails closed); `CLIENT_CAPS` has no
  `catalog.edit`. No new gating code is needed on this side.

## 3. Behavior contract

### 3.1 Option management UI (Phase 1)

- On `/catalog/frame-types` and `/catalog/glazing-types`, an editor can open
  the field-config modal on the promoted single-select fields (frames:
  Manufacturer, Brand, Use, Operation, Location, Mull type; glazing:
  Manufacturer) via header double-click / Enter / header context menu — same
  affordances as project tables.
- The modal supports: add option, rename label, reorder, recolor, delete.
  `field_type` and the other built-in attributes stay locked (existing
  overlays already enforce this).
- Deleting an option still used by catalog rows requires picking a cascade
  target (existing DataTable flow) → backend folds via `replacements`, or
  rejects with 409 `catalog_option_in_use` if none supplied.
- Non-editable fields (e.g. glazing Brand, which is free text) never show the
  options section. The controller's existing guard
  (`Cannot edit options for <field>`) stays as the backstop.
- Save routes through the existing pipeline: DataTable `schemaMutation`
  (variant `legacyOptions`) → controller `editFrameTypeOptions` /
  glazing twin → `PUT /api/v1/catalogs/<table>/options`.
- Inline "Find or create…" option creation in the cell popover keeps working
  unchanged (it already persists via `persistNewOptions`).

### 3.2 Rename cascade (Phases 2–3) — Ed's decision

Rename is a **cosmetic relabel of the same entity**, so it propagates
project-wide in one heavyweight, properly-done operation (infrequent — 1-2×
per year) instead of leaking into per-ref drift resolution:

1. Catalog rows: rewritten synchronously by the existing options service
   (unchanged).
2. Project cascade (new, async job): for every project document that contains
   the old label,
   - rewrite matching entries in `ManufacturerFilters`
     (`frame_manufacturers_enabled` / `glazing_manufacturers_enabled`),
   - rewrite `FrameRef`/`GlazingRef` field values that (a) belong to a ref
     with `catalog_origin` set and (b) string-equal the old label. The
     string-equality rule naturally skips hand-overridden values that already
     differ; `local_overrides` and `synced_at` are left untouched so unrelated
     drift stays visible.
3. Versioning: saved versions are immutable. The cascade edits the project's
   **draft** if one exists, and otherwise appends a **system-authored version**
   ("Catalog rename: <old> → <new>") on top of the latest version. Historical
   versions correctly keep the old label.
4. UX: the rename confirm in the field-config modal warns "N catalog rows and
   M projects reference this label", then shows a **working modal** with
   per-project progress while the job runs, ending in a summary (projects
   touched, refs rewritten, filters rewritten, failures). Further option edits
   on that catalog are blocked while a cascade job is running.
5. The job is idempotent (string rewrite; re-running skips already-new
   labels) and resumable after failure.

Non-manufacturer fields (use/operation/location/mull_type/brand) follow the
same ref-rewrite rule; they have no filter allow-lists, so only step 2's
second bullet applies.

### 3.3 Delete / merge semantics

- Deleting an **unused** option: immediate, no cascade.
- Deleting an **in-use** option (merge into a target): catalog rows are folded
  by the existing backend. Project **filters** are cascaded like a rename
  (old label → target label, deduplicated) so allow-lists never orphan.
  Project **refs are NOT rewritten** — a merge changes semantic identity, so
  affected refs surface as ordinary drift for per-project review via the
  existing Refresh dialog. See decisions.md D-3.

## 4. Out of scope

- Materials catalog option management (materials edit via a dedicated modal,
  not the grid field-config; revisit separately).
- Custom fields on catalog tables (explicit non-goal; controller throws).
- Tolerant/ID-based matching for `ManufacturerFilters` (superseded by the
  rewrite cascade, D-2).
- Any change to the drift/refresh mechanism itself.

## 5. Verification

- Backend: service tests for the cascade — draft-present, no-draft (system
  version appended), override-preserving string-match rule, filter dedupe on
  merge, idempotent re-run, 409 paths unchanged.
- Frontend: controller/page tests that the modal opens on the promoted fields
  only, saves route to `PUT /options`, and viewers/certifier sessions see
  read-only.
- E2E (agent-browser probe): rename a manufacturer used by the AGENT-BROWSER
  fixture project; verify catalog rows, project filter list, ref labels, and
  that a new version appears in the project history. ⚠️ Re-identify grid rows
  after every write (derived names re-sort rows) and never mutate
  `recPHNDefFrame001` — restore via baseline-migration values if touched.
