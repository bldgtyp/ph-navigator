---
DATE: 2026-08-26
TIME: 22:10 EDT
STATUS: Complete — every decision accepted and implemented
AUTHOR: Claude with Ed May
SCOPE: Accepted answers to PRD §7 open questions Q1-Q5, plus deliberate
  deviations from PLAN.md, for the spec-status batch-editing packet.
RELATED:
  - ./PRD.md
  - ./PLAN.md
  - ./STATUS.md
---

# Decisions — Spec. Status batch editing

## D-1 (answers PRD Q1) — only shallow row-field commands are journaled

**Accepted.** A command goes through `SliceWriteJournal` only when its
optimistic effect is a shallow field patch on one row that already exists in
the read model. Everything else stays on the awaited path.

Journaled today:

| Surface | Command | Journaled when |
| --- | --- | --- |
| Envelope / Materials | `update_project_material` | it carries only `specification_status` and/or `datasheet_not_required` |
| Apertures / Glazings | `update_project_glazing` | field-level (phase 03) |
| Apertures / Frames | `update_project_frame` | field-level (phase 03) |

**Why the field allowlist and not the whole command kind.** The backend applies
`update_project_material` with `model_dump(exclude_unset=True)` and then runs
`changed_project_material_values`, which adds any touched
`PROJECT_MATERIAL_OVERRIDE_FIELDS` key to `catalog_origin.local_overrides`.
`specification_status` and `datasheet_not_required` are not override fields, so
a status-only command has an effect the client can reproduce exactly. A command
that also carries `conductivity_w_mk` does not — the client would have to mirror
the drift bookkeeping to render it honestly. That command comes from
`ProjectMaterialEditorModal`, a modal with its own busy/error affordances and no
lag complaint, so it stays awaited.

`update_segment_use_site_notes` is field-level but lives three levels deep
(assembly → layer → segment) and is submitted from a form, not a pill. Left
awaited; revisit only if it is ever reported as slow.

## D-2 (answers PRD Q2) — one apply function, kept small by construction

**Accepted.** The optimistic apply is hand-written per journaled kind, as PRD Q2
expected. D-1's field allowlist is what keeps the set from growing: a kind only
qualifies while its journaled fields are ones the client can apply exactly.
Two apply functions exist at the end of the packet (materials, aperture
products), both a `{...row, ...patch}` over one list.

## D-3 — structural commands keep their in-flight gate, and join the queue

**Deviates from PLAN Phase 01 step 2**, which said to delete
`commandInFlightRef` outright.

Deleting it would let a double-clicked "Create assembly" or a double-submitted
import dialog fire twice. That gate is a double-submit guard for dialog-driven
structural commands, and it is the right thing there. What it must not do is
drop a status write (PRD S-2) — and after D-1, status writes never reach it.

So: the gate stays on the awaited path, and journaled writes route around it.
Structural commands are additionally scheduled through the same
`DraftWriteCoordinator` as journaled ones, so the two kinds cannot interleave
and Save flushes both (PRD S-8).

## D-4 — no new per-row pending affordance

**Deviates from PLAN Phase 01 step 3**, which said to add a per-material pending
set mirroring `isRecordWriting`.

With the write optimistic and queued, the pill already shows the user's value
the moment they click. A per-row "writing" marker would be a state the design
system does not define (`context/DESIGN_SYSTEM.md` § Interaction states has
hover / selected / armed / focus / disabled and no pending), and inventing one
to mark a write the user cannot perceive is noise, not feedback.

Instead the existing grid-level `busy` narrows on its own: it is
`commandMutation.isPending`, and status writes no longer use that mutation, so
the grid stays live during them. `busy` still disables the grid during a
structural command, where the row set is genuinely about to change. Pending
writes remain visible where the app already reports them — the version header's
draft state and the `beforeunload` guard, both driven by the coordinator.

## D-5 (answers PRD Q3) — `ReportTable` gets a local selection prop

**Accepted, phase 04.** `useGridRowSelection` is built around DataTable's cell
cursor and range anchor; `ReportTable` has neither. It takes one optional
`selection` prop (`{rowIds, onToggle}`) and owns no selection state, matching
how it already treats expansion (`expandedRowId` + `onToggleExpand`).

Two refinements the build produced:

- **No select-all in the table.** A report page renders *three* tables
  (in-scope / N/A / unused) over one selection, and "select all" means
  everything the current filter shows — which no single table knows. It lives
  in the toolbar with the rest of the bulk action.
- **One prop, not three.** Separate `selectedRowIds` / `onToggleRowSelection` /
  `onToggleAllRows` props let a caller pass one and get inert checkboxes with
  no compile error. Bundled, selection is structurally all-or-nothing.

The state above the table is `useReportSelection`, shared by both surfaces: it
prunes the selection to the visible set, toggles, and clears after a batch.
Each surface supplies only its row-id list and a status-command factory.

## D-6 (answers PRD Q4) — the batch action goes in the filter toolbar row

**Accepted, phase 04.** `StatusFilterChips` already renders a toolbar row with a
chips group and a `summary` slot. The bulk action replaces the summary slot's
content while rows are selected. A floating selection bar is more conventional
but has no precedent in the app, and the design system requires reuse before
invention.

## D-7 (answers PRD Q5) — S-6 (Documentation spec status) is deferred

**Accepted.** Documentation writes go through a different hook against a
different read model (the summary, not the envelope slice), so folding it in
means a third optimistic apply, not a shared one. It has not been reported as
slow. Recorded as residual work in `STATUS.md` rather than closed silently.

## D-8 — the batch enabler is a command list, not a multi-id command

**Extends PRD §6**, which proposed a multi-id `update_project_material`.

`POST /draft/envelope/commands` takes `{command}`. It gains an optional
`commands: [...]` form applied as one `apply_document_write` — one parse, one
serialize, one document rewrite, one audit row for the whole batch. This is
strictly more general than a multi-id command: it is what lets the journal's
`buildBatchPayload` coalesce writes across *different* rows (PRD §5(4)), and
phase 04's "select 20 rows → Complete" inherits it as a single round trip.
The single-command form is unchanged, so the MCP surface and every existing
caller are untouched.

## D-9 — the batch is one round trip, not one validation

**Measured, 2026-08-26.** Folding N commands inside one `apply_document_write`
collapses the per-request costs — draft-basis parse, ETag, draft row rewrite,
audit entry, response build — to one each. It does **not** collapse the fold
itself: every command runs `ops.replace_*`, which re-dumps and re-validates the
whole document on its way out. Measured on a 69 KiB document with 20 materials
and 8 assemblies:

| commands | fold | per command |
| ---: | ---: | ---: |
| 1 | 1.4 ms | 1.43 ms |
| 5 | 7.6 ms | 1.52 ms |
| 20 | 30.5 ms | 1.52 ms |
| 50 | 77.4 ms | 1.55 ms |
| 200 | 394.8 ms | 1.97 ms |

Linear, and worth it anyway: a 20-row batch is ~30 ms of fold plus one ~100 ms
round trip, against 20 round trips at ~200-350 ms each. That is the win, and
the docstrings say so in those terms rather than claiming a validation the
code does not save.

Making the fold sub-linear would mean letting command handlers compose on the
in-memory `ProjectDocumentV1` and validating once at the end, which changes the
contract of all 30 handlers (`dispatch_envelope_command` currently returns a
validated document). Deliberately not done here. `MAX_ENVELOPE_COMMAND_BATCH`
is 200 because that is what bounds one request's server time, not because a
batch that size is expected.

## D-10 — two wire shapes, one parsed field

**Kept, against one reviewer's objection.** The endpoint accepts both
`{"command": {...}}` and `{"commands": [...]}`, and the journal sends the
singular form for a batch of one. That is the point of D-8: every existing
caller — MCP, the awaited editor path, and each of this repo's pinned
request-shape tests — keeps sending exactly what it sent before, and only a
genuinely coalesced run takes the new shape.

The duplication a reviewer flagged is real but is confined to the wire.
`EnvelopeCommandRequest` normalizes both forms in a `mode="before"` validator,
so there is exactly one field (`commands`) for every caller inside the backend
to read, and the audit row has one shape whichever form arrived.

## D-11 — `useJournaledSliceCommit` stays separate from `useCommandJournal`

**Kept separate, against two reviewers' objection.** With Envelope and
Apertures both needing the same wiring, the shared piece was extracted to
`project_document/useCommandJournal.ts`. Reviewers then asked why the
DataTable's `useJournaledSliceCommit` is not a third binding of it, since both
construct a `SliceWriteJournal` with the same six callbacks.

Because the two are journals of different things:

| | `useCommandJournal` | `useJournaledSliceCommit` |
| --- | --- | --- |
| payload | a run of semantic commands | one `TPayload` built per call |
| optimistic apply | a per-command function | `mergeSlicePayload`, a shallow merge |
| retry eligibility | the target row still exists | `canRetryWriteMetadata` over observed cell values |
| failure side effect | set an error string | clear undo history, route through `runWithConflictHandling` |
| non-journaled fallback | the caller awaits its own mutation | `runCoordinatedWrite` on the controller |
| entry point | `submit` (fire) + `enqueue` (await) | one async `commit` |

Merging them means a hook whose every parameter is meaningful to one caller and
inert for the other — the false-generality trap, not a shared abstraction. What
*is* genuinely common is already shared: `SliceWriteJournal` itself, its
options-object constructor, `refreshInvalidatedBase`, and — added in response to
this review — `discardedWriteFailureMessage`, so the two do not drift on error
wording.

Revisit if a third non-command journal appears.

## D-12 — the journaled-field allowlist is pinned on both sides

Two things rest on an invariant the type system cannot state: that
`specification_status`, `datasheet_not_required` and `photo_not_required` are
documentation metadata — not catalog-override fields, and not inputs to any
U-value, condensation, or drift result. The optimistic apply is exact only
because of the first; skipping the derived-value refetches (S-5, and the
aperture equivalent) is safe only because of the second.

It was a comment in two files. It is now pinned from both directions:

- Frontend change-detector tests assert each allowlist verbatim, so widening
  one is a deliberate edit that puts the note in front of the author.
- `backend/tests/envelope/test_envelope_commands_materials.py::test_journaled_evidence_fields_are_not_catalog_overrides`
  asserts those names are disjoint from `PROJECT_MATERIAL_OVERRIDE_FIELDS`,
  `_PROJECT_GLAZING_OVERRIDE_FIELDS`, and `_PROJECT_FRAME_OVERRIDE_FIELDS`, so
  a backend edit that reclassifies one of them fails there.

## D-13 — a batch is one journal entry, not N coalesced writes

`submitAll` exists because N `submit` calls would not actually produce one
request. The coordinator pumps as soon as the first task is scheduled, so a
synchronous loop of N sends row 1 alone and coalesces rows 2..N behind it — two
round trips for one gesture, and the split is invisible in the UI but real in
the audit log. `submitAll` builds a single journal entry whose payload is the
whole run, so "select 20 rows → Complete" is one entry, one request, one
document write, one audit row.

## D-14 — the checkbox mark became a shared recipe

The DataTable's `.data-table-gutter-checkbox` was the only square check mark in
the app. Rather than copy its paint into the report tables, the paint moved to
`.phn-check` in `styles/base.css` and both grids compose it; each keeps its own
placement and reveal rules (the DataTable's is hover-revealed from the row
number, the report tables' is always visible because there is no row number to
reveal it from).

This reaches into `DataTable`, which `context/DESIGN_SYSTEM.md` calls an
iron-law uniform component — deliberately, and in the direction the doctrine
asks for: the rule there is that basic affordances are uniform and parent-owned,
which is an argument for one checkbox recipe app-wide, not two. Nothing about
the DataTable's own behaviour changed; only where its paint is declared.
