---
DATE: 2026-05-07T00:00:00.000Z
TIME: 1230
STATUS: Pre-populated for the Ed + John 90-minute gate session. Every entry below is a *pre-assessment* based on the shipped Phase 1–5 sandbox, the test suite, and the lessons file. The Ed + John session in §6 is what turns these into decisions.
RELATED: airtable-parity-phases.md §11 (gate criteria), catalog-poc-plan.md §2 (binding success criterion), catalog-poc-plan.md §9 (decision framework), airtable-wishlist.md (per-item descriptions), poc-lessons-for-real-build.md (carry-forward for the real build), tracker NIM-6 (this gate as a tracked task)
---
# Phase 5 Gate Evaluation — Pre-Populated Worksheet

## 1. Purpose

`airtable-parity-phases.md` §11 defines the gate review session that
follows the Phase 5 demo. `catalog-poc-plan.md` §2 sets the binding
criterion: *the POC succeeds only if `<DataTable>`'s style and behavior
is **as good as AirTable for our limited use** (browse, filter, sort,
group, color, drag-reorder columns, inline edit, bulk select against
real Materials and Frames data). "Almost as good" is a fail.*

This document is the structured pre-read for that session. It walks
every wishlist item, records the evidence already in hand, and proposes
a verdict. The Ed + John walkthrough confirms or revises each line and
finalizes the three decisions in §7.

## 2. What is being evaluated

**Scope of the gate**: the parity surface defined in `airtable-wishlist.md`
items 1, 1b, 1c, 1d, 1e, 1g, 1h, 2. Item 1f (inline schema editor) is
itself a gate question — does Phase 6 need to be in scope? — handled
separately in §7.2.

**Out of scope of the gate**: persistence, attachments, R2, second-table
validation, versioning UX. Those are the post-gate work blocks in
`airtable-parity-phases.md` §11.2 and `catalog-poc-plan.md` §§7–9. They
are independent of the parity question.

## 3. Evidence already in hand

- Phase 1 → Phase 5 all demo-passed in the live browser
  (`airtable-parity-phases.md` §15). Each phase's findings + bug fixes
  are in `weekly-notes.md`.
- `frontend/src/features/catalog/_components/SandboxTanStack.tsx` plus
  `sandboxPhase5.ts` carry the working code; ~2.5 k LOC total in the
  sandbox file at gate time.
- `npm test` reports 172 / 172 passing as of 2026-05-07 — including the
  Phase 3 / Phase 4 / Phase 5 helper specs that lock in clipboard
  parsing, write-pipeline coercion, paste planner, single-select
  match-or-create, condition evaluator, tint role derivation, and
  aggregation math.
- `poc-lessons-for-real-build.md` consolidates 25+ rules across
  indexing, component architecture, styling, clipboard, write
  pipeline, keyboard/focus, view state, aggregation, and color. Every
  rule cites its originating phase.

## 4. Per-item pre-assessment

Format per the §11.1 rule: **clear yes / clear no / qualified yes**.
"Qualified yes" means the parity behavior works *and* there is a known
follow-up (already captured elsewhere) — not "this is broken."

### 4.1 Item 1 — Excel-style cell range selection + copy

**Pre-verdict.** Clear yes.

**Why.** Phase 2 demo passed. Drag rectangle (mouse + Shift+arrow + Shift
+click) produces a single contiguous outline. ⌘C emits both `text/plain`
TSV and `text/html` `<table>`. Round-tripped to Excel (macOS), Numbers,
Google Sheets, and AirTable preserving rows × columns. Auto-scroll
during drag works under TanStack Virtual recycling
(`poc-lessons-for-real-build.md` L5.3).

**Carry-forward to real build.** L4.1 (use the native `copy` event),
L4.2 (TSV + HTML pair), L3.2 (focus = `outline`, selection = box-shadow),
L5.3 (document-level pointer tracking with `elementFromPoint`).

**Confirm in the session.** Drag past the bottom of the viewport,
verify auto-scroll continues to extend the range without dropping.

---

### 4.2 Item 1b — Excel-style paste with auto-add-rows prompt

**Pre-verdict.** Qualified yes.

**Why.** Phase 3 demo passed. TSV parser handles trailing newline,
quoted cells, internal newlines. Three-shape rectangle planner
(single-cell-into-selection / single-cell-anchor / same-shape) is
isolated as a pure helper (L4.3). Per-column type coercion runs through
the shared write primitive. Overflow accept fires on `window.confirm`,
which is acceptable POC scope and will become a real modal in the real
build (L7.2). One ⌘Z reverts the whole paste *and* the auto-added rows
as one op (L6.4).

**Qualifications.** (a) `window.confirm` is the POC overflow prompt;
the real app needs a styled modal. (b) Paste is intentionally disabled
while grouped (matches AirTable). (c) Column overflow drops with a
toast — matches AirTable.

**Confirm in the session.** Paste a 50-row block 15 rows from the end,
accept the prompt, verify the 50 cells write and ⌘Z reverts the whole
operation including the appended rows.

---

### 4.3 Item 1c — Single-Select field type with paste-aware option creation

**Pre-verdict.** Qualified yes.

**Why.** Phase 4 demo passed for the killer feature: pills with
palette colors, inline picker with search + create, **paste a column
of category strings → match-or-create with a consolidated toast**.
`Materials.category` migration runs through the same pipeline and
proves the seed-loader path works without a new code branch (L2.3).
Sort by option position, not name, is wired (L2.4).

**Qualifications.** Header-level option-management modal (drag-reorder
options, recolor, delete-with-row-warning) was explicitly deferred
from Phase 4 per the parity-phases.md §15 note. Inline create from the
cell popover ships; the dedicated header modal does not. This was a
conscious cut to keep Phase 4 sized; it does not affect the gate's
question.

**Confirm in the session.** Paste a 20-row mixed column (existing,
case-mismatched, brand-new) and visually confirm the toast lists
exactly the new options created. Then ⌘Z and verify both the cell
writes and the new options roll back together (L6.5).

---

### 4.4 Item 1d — Stacked group-by with accordion UI

**Pre-verdict.** Clear yes.

**Why.** Phase 5 ships a stacked Group popover — column picker +
asc/desc + delete, up to 3 levels, with a synthetic pre-sort entry so
asc/desc actually flips bucket order (L8.3). Per-column aggregation
picker (`count` / `sum` / `mean` / `min` / `max` / `none`) renders into
group headers via a custom `aggregationFn` + `aggregatedCell` (L9.1).
Tint cascades into the grouped column header and cells (L9.2).

**Carry-forward.** L8.3 group-direction-as-pre-sort. L9.1 custom
aggregation closures over user state.

**Confirm in the session.** Group by `category` desc, then sub-group
by `source`. Verify (a) bucket order flips when toggling desc, (b)
mean conductivity per group matches a manual spot-check.

---

### 4.5 Item 1e — Stacked filter / sort + toolbar tinting

**Pre-verdict.** Qualified yes.

**Why.** Phase 5 ships stacked AND filter conditions per the canonical
user-intent list (L8.1), an ordered sort list, three toolbar buttons
that read as sentence fragments and tint when active, and the
column-tint cascade for the seven non-empty role combinations from a
pre-mixed 14-entry palette (L9.2). The single-mutation-channel
constraint (toolbar OR per-header, not both) is enforced — per-header
filter inputs were removed in Phase 5 (L8.2). Dormant conditions
short-circuit so the table doesn't blank when a row is half-edited
(L8.4). Multi-column sort via Shift+click is wired.

**Qualifications.** OR mode is intentionally deferred per the wishlist
1e note ("POC: implement AND only; flag OR as follow-up if tier-1 demo
doesn't need it"). Nested AND/OR groups are not built — also flagged
follow-up.

**Confirm in the session.** Stack 2 filters + 2 sorts + 2 group levels.
Verify column tints layer correctly (7 combos × header/body = 14
distinct backgrounds). Decide whether OR mode is gating — the
wishlist's own note says it's not.

---

### 4.6 Item 1g — Excel-style fill handle

**Pre-verdict.** Qualified yes.

**Why.** Phase 3 demo passed. Handle renders at the bottom-right of
the active range, drag previews a dashed target rectangle, axis-locked
to the dominant drag direction, single-row source fills uniformly,
multi-row source repeats cyclically. Reuses the Phase 2 selection
controller pattern (L7.1). Same write primitive as paste (L6.1) — one
fill is one undo op.

**Qualifications.** Pattern detection (`1, 2, 3 …`, `Mon, Tue …`) is
explicitly out of POC scope per the wishlist note. The cyclic-repeat
case covers the everyday workflow.

**Confirm in the session.** Drag the handle from a 3-row source down
20 rows, verify the cycle. Then ⌘D and ⌘R from a multi-cell selection,
verify the same write path runs.

---

### 4.7 Item 1h — Bounded undo

**Pre-verdict.** Clear yes.

**Why.** Phase 3 ships an 8-entry in-memory undo / redo stack with
semantic ops (`cell` / `paste` / `fill` / `rowInsert` / `rowDelete`),
not per-cell deltas (L6.2). Each op records `before` / `after` per
cell plus side-effect tracking (`optionsAdded`, `rowsAdded`). One ⌘Z
reverts a whole paste / fill / overflow-accept as one user gesture
(L6.4). Field-def mutations (single-select option creation) are
inside the same op envelope as the cell writes that needed them (L6.5).

**Carry-forward.** L6.3 — bounded in-memory is fine for parity, but
the production system needs explicit rules around 409 conflicts,
backend refetch invalidation, and persisted row creation. That's a
post-gate persistence concern, not a parity concern.

**Confirm in the session.** Make 9 distinct edits, ⌘Z 9 times, verify
the 9th has no effect (oldest fell off the cap).

---

### 4.8 Item 2 — Full-row / full-column select via gutter / header click

**Pre-verdict.** Qualified yes.

**Why.** Phase 2 demo passed. Sticky 32 px row gutter outside the
TanStack column model (L2.2) handles full-row click and Shift+click
range. Dedicated thin header-strip affordance handles full-column
click and Shift+extend. Selected rows / columns participate in ⌘C
under the same TSV serializer.

**Qualifications.** ⌘+click non-contiguous selection is explicitly
deferred — moves the selection model from `{anchor, head}` to
`{ranges: Range[]}` and the wishlist itself flags this as a
post-gate follow-up. The contiguous case covers the bulk of the
workflow.

**Confirm in the session.** Click row 50 gutter, Shift+click row 60
gutter, ⌘C, paste into Excel — verify the 11-row block lands
correctly.

---

## 5. Cross-cutting health check

These are not wishlist items but are gating in the *quality* sense.

- **Test suite.** 172 / 172 pass. Phase 3 / 4 / 5 helper specs lock in
  the brittle parts (clipboard, paste planner, single-select pipeline,
  filter evaluator, aggregation math, tint roles).
- **Lessons file.** 25+ rules consolidated, organized by topic, each
  citing originating phase. Sufficient as the design input to the
  §11.1 `<DataTable>` extraction.
- **Sandbox cost.** ~2.5 k LOC in `SandboxTanStack.tsx`. The
  §11.1 extraction estimate was originally "1 evening"; L10.1 raises
  it to "2–3 evenings extraction + API design." Acceptable, but plan
  for it.
- **Visual taste.** Per `airtable-parity-phases.md` §10 cross-cutting
  risk: "a lot of 'is it as good as AirTable' comes down to spacing,
  color, hover states, animation curves." This pre-assessment cannot
  judge that — it is the dominant input to the live Ed + John
  walkthrough.

## 6. Live walkthrough checklist (Ed + John, 90 minutes)

**Setup.** Open two browser windows side by side: the local sandbox at
`/catalog-poc/sandbox-tanstack` and the live AirTable Materials view.

**For each item below, record one verdict per row in §7.1: clear yes /
clear no / qualified yes (and the qualification's specific gap). Where
this document already has a pre-verdict, accept, override, or refine.**

1. Item 1 — drag a 10×3 rectangle, ⌘C, paste into Excel; verify shape.
2. Item 1b — paste a 50-row block from Excel into a position 15 rows
   from end, accept the auto-add prompt, ⌘Z to revert.
3. Item 1c — paste a mixed column into `category`; visually verify
   pills, toast, and undo of paste-with-option-creation.
4. Item 1d — group by `category` then `source`, set per-column
   aggregations, toggle desc, expand/collapse.
5. Item 1e — stack 2 filters + 2 sorts + 2 group levels; observe the
   tint cascade and the toolbar button labels.
6. Item 1g — fill handle from 1-cell, then 3-row cyclic source;
   ⌘D / ⌘R from a selection.
7. Item 1h — 9 sequential edits, ⌘Z 9 times, observe the cap.
8. Item 2 — full-row gutter select, Shift+extend, full-column header
   select.

**Then the time-to-task comparison.** Pick three real workflows we
actually do in AirTable today and time them in both surfaces:

- "Pull all conductivity_w_mk values for Insulation, sorted asc, into
  PHPP" — AirTable vs sandbox.
- "Bulk-set `source` to a manufacturer name across 50 rows."
- "Group by `category` and visually scan for outlier conductivities."

If any of those is materially worse in the sandbox than in AirTable,
that is an "Iterate" trigger — record the specific gap.

## 7. Decisions

**Ratified by Ed 2026-05-07.** All three pre-verdicts below stand as
the gate decisions of record. The §6 live walkthrough was waived in
favor of the evidence already documented across the per-phase demo
passes, the 172/172 test suite, and the lessons file. If a regression
or visual-taste concern surfaces during the post-gate
`<DataTable>` extraction, that is its own iteration and gets logged
against NIM-7 — it does not retroactively reopen the gate.

### 7.1 Decision A — Proceed / Iterate / Stop

**Decision: Proceed.** (Ratified 2026-05-07.)

**Reasoning.** Every wishlist item lands at *clear yes* or *qualified
yes*. Every qualification is either (a) an explicit deferral the
wishlist itself flagged in advance, (b) a polish concern (modal vs.
`window.confirm`) handled by the post-gate work block, or (c) an
optional polish lane (OR filter mode, ⌘+click non-contiguous, fill
pattern detection) that the original wishlist marked as
"follow-up if not gating."

No qualification on this list reads as "this behavior does not work."
That is the standard the binding success criterion sets ("almost as
good is a fail" — but the qualifications above are *missing
finishing-polish*, not \*missing parity*).

**What would change this verdict in the live session.**

- A visual taste judgment that the tint palette, popover layout, or
  density doesn't read as well as AirTable side-by-side. Ed and John
  see the live UI; this document cannot.
- A time-to-task gap on one of the three workflows in §6 where the
  sandbox is meaningfully slower than AirTable.
- A cross-browser regression that didn't show up in the per-phase
  smoke tests.

If any of those fire → §7.1 becomes **Iterate**, and §7.3 records
which specific gaps trigger the next phase per
`airtable-parity-phases.md` §11.3.

### 7.2 Decision B — Phase 6 (1f schema editor) in or out of post-gate scope

**Decision: Out of post-gate scope. Defer 1f to a follow-up.**
(Ratified 2026-05-07.)

**Reasoning.**

- The parity gate's own question is *"is the table-feel as good as
  AirTable for our use?"* — and the answer to that question (per §7.1)
  does not depend on whether the user can change a column's type
  inline.
- Phase 6 is mostly *backend* work (conversion engine, preview API,
  field-def CRUD, audit log). Per
  `airtable-parity-phases.md` §9.5: *"unlike Phases 1–5 (no backend),
  Phase 6 is mostly backend… building it speculatively before the
  gate is wasted work if the gate says skip 1f for now."*
- The wishlist's own 1f entry flagged the conflict with PRD §13.2 /
  plan §12 ("schema editor UI: out of scope") and offered the
  decision rule: *"finish 1a–1e first, then revisit. If the answer to
  'is this as good as AirTable?' at that point is 'almost, but I miss
  the inline schema editing' → bring it in. If the answer is 'yes' →
  leave it out."*
- The sandbox already has the field-def state shape Phase 6 would
  edit (the registry from L2.3); adding a schema-editing UI on top
  later is not blocked by anything we're shipping or not shipping
  now. The capacity to defer is durable.
- Concrete alternative path for *adding* a column in the meantime:
  the §3.4 seed-loader YAML schema. Annoying but feasible — same
  reasoning that made it acceptable up front.

**What would change this verdict in the live session.**

- If, while doing the §6 workflow comparison, *adding a new column*
  is one of the moves we found ourselves wanting and the YAML route
  felt prohibitive in practice — then 1f is back in scope and Phase 6
  goes onto the post-gate work block.

### 7.3 Decision C — Post-gate work block start order

**Decision: extraction → persistence first, then versioning →
attachments → Frames → view-state persistence in sequence.**
(Ratified 2026-05-07.) Tracked under NIM-7. Concretely, the work
block is `airtable-parity-phases.md` §11.2:

1. `<DataTable>` extraction from the sandbox (revised estimate: 2–3
   evenings + API design pass per L10.1).
2. Persistence — wire `apiClient` stubs to real fetches, build
   `POST /records` / `PATCH /records/<id>` / `PATCH /fields/<id>`,
   migrate edits to optimistic-PATCH with rollback per PRD §6.2.
3. Versioning UX (`catalog-poc-plan.md` §7).
4. Attachments + R2 + content-hash dedup
   (`catalog-poc-plan.md` §8).
5. Second-table validation against Frames
   (`catalog-poc-plan.md` §9.1).
6. Phase 6 (schema editor) only if §7.2 changed the verdict.
7. Per-user view-state persistence in the DB.

**Recommended start order — 1 → 2 in immediate sequence.** L8.1 said
the persistence contract should be designed against the extracted
component API, not the inline sandbox state — which means the
extraction must happen first, but persistence should follow it
without intervening work. Items 3–5 then run in sequence.

## 8. Status

| Item | State |
| --- | --- |
| §4 per-item pre-verdicts | Authored 2026-05-07 |
| §6 live walkthrough | **Waived** — Ed ratified pre-verdicts 2026-05-07 |
| §7.1 Proceed / Iterate / Stop | **Decided: Proceed** (2026-05-07) |
| §7.2 Phase 6 in/out | **Decided: Out / defer** (2026-05-07) |
| §7.3 Work-block start order | **Decided: extraction → persistence** (2026-05-07); tracked under NIM-7 |

Tracker: NIM-6 → done. Post-gate work continues under NIM-7.
