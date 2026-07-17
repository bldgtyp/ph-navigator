# Catalog Option Management

DATE: 2026-07-17
TIME: 12:07
STATUS: Active
AUTHOR: Ed + Claude (Fable 5)
SCOPE: Expose add/rename/reorder/recolor/delete/merge of catalog single-select
options (frame-types: manufacturer, brand, use, operation, location, mull_type;
glazing-types: manufacturer) to all signed-in members, with a project-wide
rename cascade.
RELATED: context/technical-requirements/envelope-catalog-drift.md,
context/ui/pages/apertures-tab.md, backend/features/catalogs/

## What this is

Feature packet for the "Catalog Pages UX" items 1+2 (2026-07-17 session):
users need to manage the option labels behind the catalog single-select
fields — today the entire mechanism exists end-to-end **except** the UI entry
point and the authorization policy. Renames must propagate to projects
"properly, once" (Ed's call): a heavy rewrite behind a working/progress modal,
acceptable because renames happen roughly once or twice a year.

## Read order

1. This README.
2. `STATUS.md` — current state and next step.
3. `PRD.md` — behavior contract and phase map.
4. `decisions.md` — accepted decisions (auth model, rename-cascade semantics,
   merge semantics) and the open questions.
5. `research.md` — code map with file:line pointers (what already exists;
   verified 2026-07-17 by live-browser probe).

## Phase map

| Phase | Deliverable | Ships alone? |
| --- | --- | --- |
| 1 — Complete | Authorization (`catalog.edit` → members) + field-config modal wired on the frame/glazing catalog pages | Yes — core ask; renames work catalog-side, projects see drift |
| 2 | Rename-cascade backend: job that rewrites project `ManufacturerFilters` + snapshot ref labels, system-authored version per project | No UI yet |
| 3 | Working modal (progress, summary), rename path routed through the job, e2e verification | Yes — completes the feature |
