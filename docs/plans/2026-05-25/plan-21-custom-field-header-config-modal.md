---
DATE: 2026-05-25
TIME: planning (proposal — ready to scope into PRs)
STATUS: Proposal. Open questions Q1–Q6 resolved 2026-05-25 (see §7).
        Ready to break Phase 5a into PR-sized sub-phases.
PARENT-STORIES:
  - context/user-stories/32-custom-fields.md
    (US-CF-1 header context menu; US-CF-2 add field; US-CF-3
     rename; US-CF-4 change type; US-CF-7 single-select options;
     US-CF-8 formula editor; US-CF-14 description)
RELATED:
  - docs/plans/2026-05-24/plan-13-custom-fields-overview.md
    (overall custom-fields architecture — typed schema mutations,
     WriteOp contract, error taxonomy)
  - docs/plans/2026-05-24/plan-15-custom-fields-phase-2-schema-editor.md
    (current popover-per-concern surface — the shape this plan
     consolidates)
  - docs/plans/2026-05-24/plan-16-custom-fields-phase-3-type-change-and-single-select.md
    (ChangeTypePopover + single-select options editor — both
     fold into the new modal as tabs)
  - docs/plans/2026-05-25/plan-17-custom-fields-phase-4-formula-fields.md
    (FormulaEditorPopover + palette + live preview — folds in)
  - context/technical-requirements/data-table.md
    (Interaction Requirements §, Header affordances)
  - context/UI_UX.md
    (dialog/modal conventions, focus management)
  - frontend/src/shared/ui/data-table/components/
    HeaderContextMenu.tsx
    GridHeader.tsx                       (current double-click target)
    FieldEditorPopover.tsx               (single-select options)
    FormulaEditorPopover.tsx             (formula source + preview)
    EditFieldDescriptionPopover.tsx      (description text)
    ChangeTypePopover.tsx                (type-change preflight)
    AddFieldPopover.tsx                  (add-new-field flow — shares
                                          most of the same form fields)
---

# Plan 21 — Custom-field config modal on header double-click

## 1. Goal

Replace the current "one popover per concern" custom-field UI with a
single **field config modal** that opens when the user double-clicks a
custom-field header, modelled on AirTable's field editor.

Today, configuring a single custom field requires the user to discover
**five different surfaces** depending on which property they want to
change:

| Property                | Today's entry point                       |
| ----------------------- | ----------------------------------------- |
| Rename                  | Header context menu → inline header input |
| Description             | Header context menu → description popover |
| Change type (+ preflight) | Header context menu → ChangeTypePopover |
| Single-select options   | Header chevron / dbl-click → FieldEditorPopover |
| Formula source          | Header context menu → FormulaEditorPopover |

Each surface uses its own Radix popover, its own draft state, and its
own validation rules. The user has to **know in advance which menu
item drives which property** before they can change it. AirTable
collapses all of this into one modal where name + type + type-specific
config + formatting + description are sibling fields on one form.

This plan consolidates the five surfaces into one modal opened by a
single canonical gesture (double-click) and reachable from one menu
item ("Edit field…"). The five existing components stay in the repo
during the migration but become **sections inside the new modal**; once
the modal is the only entry point, the standalone popovers can be
deleted.

### Out of scope

- `AddFieldPopover` (the add-new-field flow). It already collects
  display-name + type + type-specific config on one surface and is
  reached from a different gesture (tail `+` cell / "Insert field
  left|right"). We may reuse its inner form components but the
  *open-on-double-click* gesture is for editing existing fields.
  Phase 4 of this plan revisits whether add-field should share the
  same modal shell.
- Core (`read_only_schema: true`) fields. Double-clicking a core
  header continues to do nothing — these fields are app-managed and
  have no editable config surface.
- View-state (sort / filter / group / hide). Those stay on the right-
  click context menu; they are not field-definition properties.

---

## 2. User stories

These are additions to / refinements of the existing US-CF-* stories
in `context/user-stories/32-custom-fields.md`. None of the existing
acceptance criteria are dropped — they are re-homed onto the new modal
surface.

### US-CF-15 (NEW) — Open field config from header double-click

**Status:** Draft · **Priority:** Phase 5

> As an editor, I want to double-click a custom-field column header to
> open one modal that lets me edit every property of that field — its
> name, type, type-specific config, formatting, and description —
> without having to remember which menu item drives which property.

**Acceptance criteria**

1. Double-clicking a **custom** (non-`read_only_schema`) column header
   opens the **FieldConfigModal** anchored to the page (centered
   modal, not a header-anchored popover), with the focused field's
   current values pre-filled and the **Name** input focused and
   selected.
2. Double-clicking a **core** (`read_only_schema: true`) column header
   does nothing (matches current behavior — US-CF-6 criterion 2).
3. The header context menu's existing items collapse to **one** new
   item — **"Edit field…"** — that opens the same modal. The legacy
   per-concern items (`Rename field`, `Edit description`, `Change
   type`, `Edit formula…`) are removed. View-state items (Sort /
   Filter / Group / Hide / Insert field left|right / Delete field /
   Duplicate field) stay on the context menu unchanged.
4. The modal is a true modal (Radix `Dialog`, not `Popover`):
   - focus-trapped while open,
   - dismissible by Esc and by clicking the backdrop,
   - returns focus to the originating header `<th>` on close.
5. Viewer mode (`readOnly` / no write handler) suppresses the
   double-click action entirely — same gating as the current context
   menu (US-CF-9 criterion 2).
6. Keyboard equivalent: Enter on a focused custom header (when no
   pickup/drag is active) opens the modal. This matches the cell
   convention ("Enter or double-click to edit" — US-CF-1 sibling
   convention from `context/UI_UX.md`).

---

### US-CF-16 (NEW) — Unified field config modal

**Status:** Draft · **Priority:** Phase 5

> As an editor, when I open the field config modal I want every
> editable property to be visible on one form, with type-specific
> sections appearing only when relevant, so I can see and change
> everything in one place.

**Acceptance criteria**

1. The modal renders the following sections, top to bottom:

   1. **Name** (text input, required, ≤ `MAX_DISPLAY_NAME`, validated
      for uniqueness per US-CF-12).
   2. **Type** (current value displayed as a select / pill row;
      changing it opens the type-change confirmation flow described
      in criterion 7).
   3. **Type-specific config** — exactly one of:
      - *Number* → decimal precision (`number.precision`).
      - *Single select* → option list editor (add / rename /
        reorder / color / delete) with the existing **Color-code
        options** toggle and **Alphabetize** button hoisted from
        `FieldEditorPopover`; same DnD UX. This **fully replaces**
        the current chevron-anchored single-select management
        popover — there is no separate "Edit options…" surface
        after Phase 5a. Adds a new **Default option** picker
        (resolved Q6.A — AirTable parity): selecting an option in
        the picker pre-fills it into every newly-created row's
        `custom.<cf_id>` value. The picker shows a blank entry
        (meaning "no default — leave new rows null") plus every
        option in the current draft list. Reordering / renaming /
        recoloring options does not unset the default. Deleting
        the currently-selected default clears it back to blank.
        Defaults are forward-only: pre-existing rows with `null`
        values are **not** backfilled when a Default is set
        (R6 — AirTable parity). MCP / paste / JSON-import requests
        that explicitly send `null` keep `null` — defaults only
        fire when the request omits `custom.<cf_id>` entirely
        (R5).
      - *Formula* (a.k.a. `computed` in the merged schema) → source
        textarea + field palette + live preview against the
        **preview row** (snapshot of the last-focused row at
        modal-open time; falls back to row 0 / first visible row
        when no row has been focused — see §7 Q5). Same UX as
        today's `FormulaEditorPopover` including the
        `FORMULA_TEXTAREA_THRESHOLD` / `FORMULA_MODAL_THRESHOLD`
        sizing rules.
      - *URL / Short text / Long text* → no config section (just an
        explanatory hint line, mirroring AirTable's "Enter a URL"
        copy).
   4. **Formatting** (Phase 5b — see §3.5). For *Number* fields this
      surfaces presets, thousands/decimal separator locale, the
      "show thousands separator" toggle, and a live example string.
      For other types this section is omitted in v1.
   5. **Description** (optional, ≤ `MAX_DESCRIPTION`; same store as
      today's `EditFieldDescriptionPopover`).
2. The footer has **Cancel** and **Save** buttons. Save is disabled
   until at least one property changed and every changed property
   passes its local validators.
3. Save emits **one `FieldDefMutation` `WriteOp`** carrying the full
   before/after `FieldDef` (covering every property that changed in
   this open session) plus any `CellWrite[]` cascades produced by an
   embedded type-change or single-select delete (atomic from an
   undo perspective — US-CF-4 criterion 5, US-CF-7 criterion 5).
4. Cancel discards the draft without dirtying the document state
   (matches the existing popovers' open-transition seeding rule).
5. The modal preserves the field's stable `cf_*` id on every save
   path (rename, type change, options edit, formula edit) —
   US-CF-3 criterion 3 / US-CF-4 criterion 6 / US-CF-7 criterion 4.
6. While Save is pending, the modal disables every input and shows
   a "Saving…" footer state.
7. If the user changes Type to a new value, the **type-change
   preflight** (today's `ChangeTypePopover`) renders **inline as a
   sub-panel** above the type-specific config section. Save is
   gated on the acknowledgement checkbox when the preflight reports
   incompatible rows. Reverting the Type back to its original value
   removes the sub-panel and any ack requirement.
8. Forbidden type transitions (per `CONVERSION_MATRIX` — formula
   in/out is forbidden in both directions) render the destination
   pill as `aria-disabled` with the existing tooltip copy from
   `ChangeTypePopover`. There is no "Phase 4 coming soon" tooltip
   any more (Phase 4 shipped).

---

### US-CF-17 (NEW) — Modal layering with nested confirmations

**Status:** Draft · **Priority:** Phase 5

> As an editor, when an action inside the modal needs a destructive
> confirmation (delete an option that's referenced by rows, change
> type that would clear values), the confirmation should appear on
> top of the modal without closing it, so my draft state is
> preserved if I cancel the confirmation.

**Acceptance criteria**

1. The single-select option-delete confirmation
   (`ConfirmDeleteOptionDialog`) opens as a nested `AlertDialog`
   above the modal — same Portal pattern that today's
   `FieldEditorPopover` already uses (`handleOutsideInteraction`
   guards against the popover closing when the alert is clicked).
2. The type-change preflight is **not** a nested dialog — it renders
   inline (US-CF-16 criterion 7) because it has to be visible at the
   same time as the Type picker and the type-specific config.
3. Esc on a nested confirmation closes only the confirmation, not
   the parent modal. Esc on the modal with no nested confirmation
   open closes the modal.

---

## 3. Architecture

### 3.1 New components

- **`FieldConfigModal.tsx`** (new). The single modal shell. Owns the
  open/closed state, the form-wide draft, the per-section validity
  flags, and the unified Save dispatcher. Built on
  `@radix-ui/react-dialog` (we already pull this in for
  `ConfirmDestructiveDialog`) rather than `@radix-ui/react-popover`.
- **`FieldConfigForm.tsx`** (new). The presentational form body —
  receives a draft `FieldDef`, a set of section-update callbacks,
  and per-section validation results, and renders the sections.
  Kept separate from the modal shell so the form can be unit-tested
  without mounting Radix dialog internals.
- **Per-section sub-components** carved out of the existing popovers:
  - `FieldConfigSectionOptions.tsx` — extracted from
    `FieldEditorPopover` (DnD, color picker, cascade-on-delete).
  - `FieldConfigSectionFormula.tsx` — extracted from
    `FormulaEditorPopover` (source input + palette + preview).
  - `FieldConfigSectionNumber.tsx` — precision input (today inline
    in `AddFieldPopover`).
  - `FieldConfigSectionTypeChange.tsx` — extracted from
    `ChangeTypePopover` (target picker + preflight + ack).
  - `FieldConfigSectionDescription.tsx` — extracted from
    `EditFieldDescriptionPopover` (textarea + counter).
  - `FieldConfigSectionFormatting.tsx` (Phase 5b — see §3.5).

### 3.2 Components to delete after migration

Once the modal is the only entry point and the new e2e specs pass:

- `FieldEditorPopover.tsx` — superseded by
  `FieldConfigSectionOptions` inside the modal.
- `FormulaEditorPopover.tsx` — superseded by
  `FieldConfigSectionFormula`.
- `EditFieldDescriptionPopover.tsx` — superseded by
  `FieldConfigSectionDescription`.
- `ChangeTypePopover.tsx` — superseded by
  `FieldConfigSectionTypeChange`.

`AddFieldPopover.tsx` stays (out of scope; see §1).

### 3.3 Single dispatch path

Today each popover dispatches its own `WriteOp`:

- `FieldEditorPopover` → `schemaMutation/legacyOptions`
- `FormulaEditorPopover` → `schemaMutation/formula`
- `EditFieldDescriptionPopover` → `schemaMutation/description`
- `ChangeTypePopover` → `schemaMutation/changeType`
- Inline header rename → `schemaMutation/rename`

The modal's Save handler instead diffs draft vs. source and emits
**one** `FieldDefMutation` carrying every changed property. Backend
already accepts a single discriminated mutation per save (see
`backend/features/project_document/schema_mutations.py`), but the
existing variants are property-scoped. Two options for the bundled
case (see §7 Q1):

- **Q1.A:** Add a new `schemaMutation/full` variant that just diffs
  before/after `FieldDef` server-side and applies the same coercion +
  cascade logic as the property-scoped variants.
- **Q1.B:** Keep the modal client-side smart enough to **emit
  multiple `WriteOp`s in a single transactional batch** (the
  existing batch primitive in `dispatchWrite` already supports
  multiple ops per call). The undo stack would group them with a
  single user-visible label ("Edit field <name>").

Q1.B is the lower-risk path because it leaves the backend untouched.
Q1.A is cleaner semantically and matches the "one WriteOp per
modal save" promise of US-CF-16 criterion 3. **Recommendation: Q1.B
for Phase 5a (ship the UI on the existing backend); revisit Q1.A as
part of the cleanup pass once the modal is the only path.**

### 3.4 Header gesture wiring

In `GridHeader.tsx::DataTableHeaderCell`:

- Remove the existing `isEditableSingleSelect` doubleClick branch
  (which opens `FieldEditorPopover` only for editable single-selects).
- Remove the `canRenameCustomField` doubleClick branch (inline
  rename).
- Add a new `canEditCustomField` branch that fires
  `headerActions.onEditField(column.fieldKey, triggerRef.current)`
  for any custom field. Core fields keep no doubleClick action.
- The `<ColumnHeaderMenu>` chevron (today only meaningful for
  editable single-selects) becomes meaningful for **every** custom
  field — clicking it opens the same modal. Its tooltip changes
  from "Edit options" to "Edit field".

In `HeaderContextMenu.tsx`: collapse the existing five custom-field
items (`Rename field`, `Edit description`, `Edit formula…`,
`Change type`, the menu-driven entry into options) into one
`Edit field…` item that calls the same `onEditField`. `Delete field`
and `Duplicate field` stay separate (they are not properties).

### 3.5 Formatting section (Phase 5b)

AirTable's modal includes a Number formatting section with presets
(currency, percent, duration), decimal places, thousands/decimal
separator locale, "show thousands separator" toggle, large-number
abbreviation, allow-negative, and a live example string. Most of
this is purely cosmetic (frontend-only render rules) and is not
modelled in V2's current `CustomFieldDef.config` shape.

This plan **defers** the Formatting section to Phase 5b. Phase 5a
ships the modal shell with just the existing properties (name, type,
type-config, description). The Formatting section gets its own
sub-plan once we decide how much of AirTable's format vocabulary to
adopt and whether formatting lives in `CustomFieldDef.config` or as
a separate `FieldFormat` document slice.

The screenshot the user attached drives the eventual shape — but
shipping the modal shell first unblocks the consolidation benefit
without waiting for the formatting design.

---

## 4. Phasing

Each phase is one PR that leaves `make typecheck`, `make test`,
`make lint`, `make smoke` green.

### Phase 5a — Modal shell, single entry point

- **P5a.0 — Backend: `default_option_id` on single-select config.**
  Extend `CustomFieldDef.config` for `field_type === "single_select"`
  to accept an optional `default_option_id` (validated against the
  field's own option list — typed `FieldSchemaMutation` rejects any
  id not present in the option set, atomic with option mutations
  per US-CF-7 criterion 5). Update the row-creation paths
  (`POST /tables/<table>/rows`, optimistic insertion in the
  frontend) to pre-fill `custom.<cf_id> = default_option_id` **only
  when the incoming request omits the key entirely** (R5 rule —
  explicit `null` from MCP / paste / JSON-import is preserved as
  `null`, never silently overwritten by the default). Defaults are
  **forward-only**: setting a Default does **not** backfill any
  existing row with a `null` value for that column (R6, AirTable
  parity). Pure-backend PR; no UI surface yet.
  **Scope guard:** only custom single-selects get a configurable
  default. Core single-selects (`floor_level`, etc.) keep their
  current required-or-null behavior — defaults for core fields are
  out of scope (their `required: true` semantics interact with row
  validation in ways that belong in their own plan).
- **P5a.1 — Skeleton modal.** Build `FieldConfigModal` + empty
  `FieldConfigForm` with only the Name + Description sections wired.
  Hook double-click + chevron + a new `Edit field…` menu item to it.
  Save dispatches today's `rename` and `description` WriteOps as a
  batch.
- **P5a.2 — Type picker + change-type sub-panel.** Port
  `ChangeTypePopover`'s preflight + ack into
  `FieldConfigSectionTypeChange`. Save batches the changeType
  mutation alongside any name/description edit.
- **P5a.3 — Options section + Default picker.** Port
  `FieldEditorPopover` into `FieldConfigSectionOptions` (drag-handles,
  color swatches, Color-code toggle, Alphabetize, delete-with-
  cascade). Add the new **Default** picker below the option list,
  surfaced as a labelled `<select>` whose entries are `(blank)` + the
  current draft options. Wire it to the backend
  `config.default_option_id` from P5a.0. Re-mount
  `ConfirmDeleteOptionDialog` as the same nested alert it is today.
  Save batches the `legacyOptions` mutation (now also carrying
  `default_option_id` in the `after` `FieldDef`). Also: rewire the
  header chevron + the menu's old "Edit options" entry to the new
  modal and **delete** the in-grid options popover that today opens
  on chevron-click / single-select-header double-click.
- **P5a.3b — Default picker in `AddFieldPopover`.** AirTable parity
  requires the Default picker in the Create flow too (see Q6
  resolution and the user-supplied "starting" single-select
  screenshot). Add the same `<select>` to `AddFieldPopover`'s
  `single_select` branch; carry `default_option_id` through
  `AddCustomFieldRequest.config`. `AddFieldPopover` stays a
  separate component in 5a — true unification with the modal is
  still Phase 5c per §1's out-of-scope note.
- **P5a.4 — Number precision section.** Port from `AddFieldPopover`
  inline; trivially small.
- **P5a.5 — Formula section.** Port `FormulaEditorPopover` into
  `FieldConfigSectionFormula`. Live preview against focused row
  works the same.
- **P5a.6 — Decommission popovers.** Delete the four superseded
  popover components, their tests, and their menu-item handlers.
  Update `__tests__/HeaderContextMenu.test.tsx` and
  `columnHeaderDoubleClick.test.tsx` to assert the new modal
  opens. Update `tests/e2e/custom-fields-phase-4.spec.ts` (and the
  Phase 2 + Phase 3 e2e specs) to drive the modal.
- **P5a.7 — Acceptance.** Wire the new modal into every
  `<DataTable>` consumer (Rooms today, Pumps when plan-20 lands).
  Manual QA pass per US-CF-15 / US-CF-16 / US-CF-17. Update
  `docs/plans/2026-05-25/plan-17-a11y-notes.md` with the modal's
  focus-trap + Esc + screen-reader behavior.

### Phase 5b — Formatting (deferred)

Its own plan. Out of scope for the consolidation PRs.

### Phase 5c — Unify with Add Field (deferred, optional)

Once Phase 5a ships, evaluate whether `AddFieldPopover` should also
become "the same modal in 'create' mode" (with no `before`
`FieldDef`). The form bodies are already 80% identical; the open
question is whether double-clicking-to-edit and clicking-`+`-to-add
should share a single chrome.

---

## 5. Data shape & contracts

The modal is a frontend refactor over the existing typed
`FieldSchemaMutation` variants (per §3.3 Q1.B), with **one** backend
schema addition driven by Q6: `CustomFieldDef.config` for
`field_type === "single_select"` gains an optional
`default_option_id: string | null`. Validated against the field's
own option list inside the same `legacyOptions` mutation that
mutates the options themselves (atomic — no way to commit a default
that points at a missing option). Row-creation paths read it and
pre-fill `custom.<cf_id>` on the new row **only when the incoming
request omits the key** (R5); defaults are forward-only and never
backfill existing nulls (R6).

The app is pre-deploy with no live users, so there is **no
backwards-compatibility requirement** for documents or saved
Versions written before P5a.0 — if simpler code falls out of
breaking older fixtures, take it. Drop or regenerate any test
fixtures that would otherwise pin the old shape.

Phase 5b/c may add a `schemaMutation/full` variant and a `format`
slice on `CustomFieldDef.config`; those decisions belong in their
own plans.

---

## 6. Test plan

### Unit (Vitest + Testing Library)

- **`FieldConfigModal.test.tsx`** — opens on header double-click,
  closes on Esc + backdrop, returns focus to the originating `<th>`.
- **`FieldConfigForm.test.tsx`** — per-section show/hide based on
  draft type; Save disabled until dirty + valid; per-section
  validators (name uniqueness, formula parse, options uniqueness).
- **`FieldConfigSectionTypeChange.test.tsx`** — inline preflight,
  ack gating, server-preflight 422 re-render, forbidden-pair tooltip.
- **`FieldConfigSectionOptions.test.tsx`** — DnD reorder, color
  swatch, delete-with-cascade nested dialog.
- **`FieldConfigSectionFormula.test.tsx`** — source input, palette
  insert, live preview, error states, modal-escalation threshold.
- **`HeaderContextMenu.test.tsx`** — only `Edit field…` (plus the
  view-state items + delete/duplicate/insert) is rendered for custom
  fields; core fields show only view-state.
- **`columnHeaderDoubleClick.test.tsx`** — custom header opens modal;
  core header does nothing; viewer mode does nothing.

### E2E (Playwright)

- **`custom-fields-config-modal.spec.ts`** (new) — full round-trip:
  open modal, change name + change type + edit options + add
  description, Save, assert one combined optimistic apply + one
  server roundtrip. Then Undo restores original `FieldDef`.
- Update existing custom-field e2e specs to drive the new modal.

### A11y notes

Append to `docs/plans/2026-05-25/plan-17-a11y-notes.md`:

- Modal `aria-labelledby` points to a heading containing the field's
  current display name.
- Focus order: Name → Type → (sub-panels in declaration order) →
  Description → Cancel → Save.
- Esc: closes innermost layer (nested alert first, then modal).
- Sub-panel changes are announced via `aria-live="polite"`.

---

## 7. Resolved decisions (2026-05-25)

**Q1 — One WriteOp or many?** §3.3. **Resolved: many.** Phase 5a
client-side batches multiple existing typed `FieldSchemaMutation`s
into one `dispatchWrite` call (Q1.B). Backend untouched. Revisit a
unified `schemaMutation/full` variant in Phase 5c if the batch shape
proves clumsy in practice.

**Q2 — Inline vs. nested-alert for the type-change preflight.**
**Resolved: inline.** Matches AirTable. Both the local preflight and
the server-side `422` preflight payload render inline in
`FieldConfigSectionTypeChange`, with `role="alert"` on the
incompatible-rows diff.

**Q3 — Allow rename + change-type in the same Save?** **Resolved:
combine.** AirTable parity. Single "Saving…" spinner; single undo
step labeled `Edit field <name>`.

**Q4 — Keep inline rename as a "fast path"?** **Resolved: no.** The
existing double-click-to-rename behavior in
`GridHeader.tsx:285-297` (`HeaderRenameEditor`) is **removed**;
double-click is remapped exclusively to the new modal. The Name
input is auto-focused + selected on modal open, so rename remains a
one-gesture-plus-one-keystroke action. No `F2` fallback in 5a.

**Q5 — Focused row for formula preview.** **Resolved: snapshot
last-focused row at modal-open time; default to row 0 (first
visible row) when no row has been focused yet.** Snapshot is held
for the lifetime of the modal session — the preview does not retarget
even if the underlying focus state changes while the modal is open.

**Q6 — Default option picker for single-select.** **Resolved: Q6.A
(include in Phase 5a) — AirTable parity.** Adds an optional
`config.default_option_id` to single-select `CustomFieldDef`,
validated atomically with the option-list mutation. Surfaces in
both the new modal's options section (P5a.3) **and** the existing
`AddFieldPopover`'s Create flow (P5a.3b) — the AirTable "starting
single-select" screenshot is the Create form, so parity requires
the picker in both surfaces. Scope guard recorded in P5a.0: only
custom single-selects get a configurable default; core
single-selects (`floor_level`, etc.) keep current
required-or-null behavior and are out of scope.

---

## 8. Risks

All risks below were walked through with the user on 2026-05-25;
responses are recorded inline.

- **R1 — Bundle size.** The new modal pulls in
  `@radix-ui/react-dialog`. We already use it transitively via
  `ConfirmDestructiveDialog`, so this is a no-op.
  *Resolution: accepted as housekeeping; no action.*
- **R2 — Behavior change on header double-click.** Today's
  double-click on a custom header runs either the inline rename
  editor or the single-select options popover; after Phase 5a it
  opens the new modal instead. AirTable parity is explicitly the
  goal, and users expect AirTable behavior on this surface.
  *Resolution: accepted as desired UX; no mitigation needed.*
- **R3 — Test churn.** Every custom-fields unit/e2e test today
  asserts against a specific popover's DOM and will need to be
  rewritten against the modal. Q6.A also adds backend tests for
  `default_option_id` validation + row-creation defaults. Revised
  estimate: **~14 unit specs + ~6 backend pytest specs + ~4 e2e
  specs.** P5a.6 explicitly budgets for this.
  *Resolution: accepted; tests will be updated as part of each
  sub-phase rather than batched at the end.*
- **R4 — Migration window during P5a.1 → P5a.6.** Between the
  modal landing and the legacy popovers being deleted, two
  dispatcher paths exist for the same `FieldSchemaMutation`s.
  The original draft proposed a Settings feature flag to gate
  the modal's gesture wiring. **The app is pre-deploy with no
  live users, so the flag is unnecessary** — sub-phases can ship
  the modal as the *only* path the moment it covers a given
  property, deleting the matching popover in the same PR.
  *Resolution: drop the feature flag from the phasing. Each
  P5a.N PR is a hard cut-over for the property it covers.*
- **R5 — Default-fill semantics for non-UI row creation.** A row
  created via MCP / JSON import / paste must not have an
  explicit `null` silently overwritten by a column's Default.
  *Resolution: the backend applies a Default **only when the
  request omits `custom.<cf_id>` entirely**; explicit `null` is
  preserved. Recorded as a hard rule in P5a.0 and US-CF-16
  1.iii.b.*
- **R6 — Backfill of existing rows when Default is set.** Setting
  a Default on a field with pre-existing null rows could either
  backfill those rows or leave them untouched.
  *Resolution: **no backfill — defaults are forward-only.**
  Matches AirTable. Recorded in P5a.0 and US-CF-16 1.iii.b.*
- **~~R7 — Backwards-compatibility for documents saved before
  P5a.0.~~** *Resolution: dropped. The app is in early dev with
  no users and no deploy — there is no requirement to read
  pre-P5a.0 documents. §5 now explicitly allows breaking old
  fixtures if it simplifies the code.*
