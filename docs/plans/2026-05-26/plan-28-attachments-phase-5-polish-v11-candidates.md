---
DATE: 2026-05-26
TIME: planning
STATUS: Proposed post-MVP plan for Attachments Phase 5.
AUTHOR: Codex
SCOPE: Attachment polish and v1.1 candidates after the core v1 workflow
       ships in Phases 0-4.
RELATED:
  - context/technical-requirements/attachments.md
  - docs/plans/2026-05-25/feature-attachments-prd.md §17
  - docs/plans/2026-05-26/plan-24-attachments-phase-1-site-photo-cell.md
  - docs/plans/2026-05-26/plan-25-attachments-phase-2-datasheet-cells.md
  - docs/plans/2026-05-26/plan-26-attachments-phase-3-thermal-bridge-cells.md
  - docs/plans/2026-05-26/plan-27-attachments-phase-4-bulk-jobs-mcp.md
---

# Plan 28 - Attachments Phase 5: Polish And V1.1 Candidates

## P0. Why this slice

Phase 5 is intentionally not a single feature PR. It is the post-MVP
backlog for attachment polish and deferred AirTable behaviors after the
core v1 workflow is proven:

- fixed pre-set attachment cells;
- direct upload / preview / detach / replace;
- datasheet and site-photo workflows;
- thermal-bridge simulation files;
- bulk downloads and MCP tools.

Every item below should be re-triaged against real project use before
implementation. The default is to keep v1 lean unless the workflow shows
up repeatedly in BLDGTYP production work.

## P1. Acceptance - Phase 5 Planning Done When

1. Production or staging usage from Phases 1-4 has been reviewed.
2. Each candidate below is classified as `ship`, `defer`, or `reject`.
3. Any `ship` item has its own dated implementation plan with a narrow
   acceptance checklist.
4. No candidate is merged by expanding the attachment core without an
   explicit decision record.

## P2. Candidate Backlog

### P2.1 User-Extensible Attachment Columns

Status: v1.1 candidate.

Problem: users may eventually want ad hoc attachment columns beyond the
PHN-defined roster.

Scope if accepted:

- add `attachment` to the user-extensible custom-field type set;
- schema mutation support for add / rename / duplicate / delete;
- field config for allowed MIME, max count, and max size;
- migration/fingerprint behavior;
- MCP field-discovery and write support.

Risks:

- substantially increases schema-mutation complexity;
- cross-field MIME config becomes user-authored data;
- copy/fill/paste semantics need sharper rules.

Gate: do not ship until at least two real project workflows need a
custom attachment column that cannot be modeled as a PHN core field.

### P2.2 Recently Deleted / Restore UI

Status: v1.1 candidate.

Problem: v1 detach is silent and relies on saved-version references plus
90-day GC. That is acceptable for MVP but may be too opaque for editors.

Scope if accepted:

- project-level "Recently detached assets" view;
- restore into a selected compatible attachment field;
- show saved versions / active drafts that still reference the asset;
- admin-only hard purge after retention.

Gate: ship only if accidental detach becomes a real support issue.

### P2.3 Clipboard Paste Image

Status: v1.1 candidate.

Problem: screenshots from site visits or submittal emails may be faster
to paste than save to disk.

Scope if accepted:

- paste image from clipboard into focused attachment cell;
- synthesize filename from timestamp / source MIME;
- use the normal upload coordinator and CellWrite path;
- disable in public/locked modes.

Gate: useful for site-photo cells; less important for datasheets, where
original PDFs matter.

### P2.4 Cross-Cell Drop Targets

Status: v1.1 candidate.

Problem: AirTable highlights every attachment cell while dragging files
over the table.

Scope if accepted:

- table-level drag tracking;
- per-cell compatibility highlights;
- drop target determined by pointer location, not active cell;
- accessible fallback remains click-to-pick on active cell.

Risk: can conflict with DataTable row/column virtualization and
selection behavior. Ship only after the basic cell drop path is stable.

### P2.5 Gallery View

Status: defer unless project photo review becomes common.

Problem: segment photos can become hard to scan one cell at a time.

Scope if accepted:

- table/column gallery mode;
- grouping by assembly/layer/segment;
- bulk download / select / detach from gallery;
- keyboard navigation and read-only behavior.

Gate: likely useful for site-photo QA, not for datasheets.

### P2.6 Reorder UX Polish

Status: likely ship as a small polish item if modal rail reorder feels
rough in practice.

Scope:

- drag handles or clearer insertion marker;
- keyboard reorder;
- better focus return after modal close;
- clearer undo toast.

Gate: low-risk if the Phase 1-3 reorder implementation is already
stable.

### P2.7 Multipart / Resumable Uploads

Status: defer.

Problem: v1 caps individual files at 25 MB. Larger PDFs or simulation
files may eventually appear.

Scope if accepted:

- multipart R2 upload intent;
- resumable browser upload coordinator;
- abandoned-part cleanup;
- progress UI with retry.

Gate: only if real project files exceed the 25 MB cap often enough to
matter. Do not implement for theoretical large files.

### P2.8 Worker-Rendered Thumbnails

Status: defer.

Problem: FastAPI `BackgroundTasks` may contend with request workers if
large upload bursts occur.

Scope if accepted:

- Cloudflare Worker or dedicated backend worker;
- job queue / retry semantics;
- thumbnail regeneration command;
- operational metrics.

Gate: measured contention or slow completion from Phases 2-4.

### P2.9 Additional Simulation Formats

Status: defer until workflow-specific.

Candidate formats:

- DXF;
- Flixo exports;
- Dartwin files;
- THERM files;
- arbitrary zip bundles.

Gate: add one format at a time with a concrete MIME/extension policy and
security review. Do not add a broad "anything" allow-list.

### P2.10 Datasheet OCR / Auto-Extract

Status: separate agentic workflow, not attachment core.

Problem: users may want PHN to pull conductivity, SHGC, fan power, model
numbers, or other values from uploaded datasheets.

Scope if accepted:

- extraction job reads existing `project_assets`;
- proposed field updates require review;
- source page / confidence metadata stored separately;
- never mutate attachment bytes.

Gate: should be planned as an LLM/data-extraction feature on top of
attachments, not as part of the cell renderer.

## P3. Recommended Execution Order

After Phases 0-4 are accepted, triage in this order:

1. Reorder/focus/accessibility polish from observed browser testing.
2. Recently Deleted UI if support risk appears.
3. Clipboard paste-image if site-photo workflows demand it.
4. Additional simulation formats one at a time.
5. Multipart upload only after real files exceed caps.
6. User-extensible attachment columns last, because that changes the
   schema-mutation contract.

## P4. Verification Pattern For Any Accepted Candidate

Each candidate gets a focused plan with:

- exact user workflow and table/field surface;
- source-of-truth doc updates required;
- backend and frontend acceptance checks;
- locked/public read-only behavior;
- browser smoke;
- migration/backfill impact if any;
- explicit rollback/defer criteria.

Do not close a Phase 5 candidate on unit tests alone. Any accepted item
must include browser evidence because every candidate changes interaction
behavior.

## P5. Done Definition

Phase 5 is not "complete" as a monolith. It is complete when the
post-MVP candidates have been triaged against real usage and each
accepted candidate has been split into its own implementation plan.
