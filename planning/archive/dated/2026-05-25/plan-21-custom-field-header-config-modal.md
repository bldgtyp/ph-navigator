---
DATE: 2026-05-25
TIME: planning (proposal — ready to scope into PRs)
STATUS: Proposal. Open questions Q1–Q6 resolved 2026-05-25 (see §7).
        Revised 2026-05-25 after architectural review:
          - Q1 resolution flipped to Option-A (new backend mutation
            kind `editFieldBundle`). The previous Q1.B fallback was
            invalid — `dispatchWrite` accepts one `WriteOp` per call
            and one undo entry per dispatch (see
            `useGridWriteReducer.ts:18-22`), so there is no existing
            "batch primitive" to lean on.
          - New §3.3a covers the backend mutation contract.
          - New §3.6 covers stale-draft / concurrent-edit semantics.
          - Phase guards (intra-session interactions, partial-failure
            rollback, re-entrancy) folded into §§3.6, 4, 6.
        Ready to break Phase 5a into PR-sized sub-phases.
PARENT-STORIES:
  - context/user-stories/32-custom-fields.md
    (US-CF-1 header context menu; US-CF-2 add field; US-CF-3
     rename; US-CF-4 change type; US-CF-7 single-select options;
     US-CF-8 formula editor; US-CF-14 description)
RELATED:
  - planning/archive/dated/2026-05-24/plan-13-custom-fields-overview.md
    (overall custom-fields architecture — typed schema mutations,
     WriteOp contract, error taxonomy)
  - planning/archive/dated/2026-05-24/plan-15-custom-fields-phase-2-schema-editor.md
    (current popover-per-concern surface — the shape this plan
     consolidates)
  - planning/archive/dated/2026-05-24/plan-16-custom-fields-phase-3-type-change-and-single-select.md
    (ChangeTypePopover + single-select options editor — both
     fold into the new modal as tabs)
  - planning/archive/dated/2026-05-25/plan-17-custom-fields-phase-4-formula-fields.md
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
  - frontend/src/shared/ui/data-table/hooks/useGridWriteReducer.ts
    (one WriteOp per dispatch, one undo entry — drove the Q1
     resolution flip)
  - backend/features/project_document/schema_mutations.py
    (`FieldSchemaMutation` discriminated union; `editFieldBundle`
     is added here in P5a.0)
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
  Phase 5c of this plan revisits whether add-field should share the
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
4. The chevron (`<ColumnHeaderMenu>`) — which today is meaningful
   only for editable single-selects — becomes meaningful for **every
   custom field**, opens the same modal, and its tooltip text changes
   from "Edit options" to "Edit field". Core fields keep no chevron
   action (the chevron is hidden for them today and stays hidden).
5. The modal is a true modal (Radix `Dialog`, not `Popover`):
   - focus-trapped while open,
   - dismissible by Esc and by clicking the backdrop,
   - returns focus to the originating header `<th>` on close.
6. Viewer mode (`readOnly` / no write handler) suppresses the
   double-click action **and** the chevron click — same gating as the
   current context menu (US-CF-9 criterion 2). Keyboard `Enter` on a
   focused header in viewer mode is also a no-op.
7. Keyboard equivalent: Enter on a focused custom header (when no
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
   3. **Type-specific config** — rendered conditionally; only the
      section matching the current draft type is mounted (perf — see
      R8). Exactly one of:
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
        the currently-selected default within the same modal
        session auto-clears it back to blank in the draft (no
        confirmation — it is a derived constraint, not a user
        choice). Defaults are forward-only: pre-existing rows with
        `null` values are **not** backfilled when a Default is set
        (R6 — AirTable parity). MCP / paste / JSON-import requests
        that explicitly send `null` keep `null` — defaults only
        fire when the request omits `custom.<cf_id>` entirely (R5).
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
   5. **Description** (optional, ≤ `MAX_DESCRIPTION` = 280 chars,
      matching `CUSTOM_FIELD_DESCRIPTION_MAX` per US-CF-14
      criterion 5; same constant used by `AddFieldPopover` and the
      backend `setDescription` clamp — single source of truth).
2. The footer has **Cancel** and **Save** buttons. Save is disabled
   until at least one property changed and every changed property
   passes its local validators.
3. Save emits **one `WriteOp` of `kind: "schemaMutation", variant:
   "typed"` carrying a single `editFieldBundle` mutation** (see
   §3.3a) whose `after` `FieldDef` reflects every property the user
   touched. The reducer pushes **one history entry** and Undo restores
   the original `FieldDef` (and any cascaded row clears) in one step
   — US-CF-4 criterion 5, US-CF-7 criterion 5.
4. Cancel discards the draft without dirtying the document state
   (matches the existing popovers' open-transition seeding rule).
5. The modal preserves the field's stable `cf_*` id on every save
   path (rename, type change, options edit, formula edit, default
   change) — US-CF-3 criterion 3 / US-CF-4 criterion 6 / US-CF-7
   criterion 4. The mutation's `field_id` is the source of truth;
   `after.id` MUST equal it server-side.
6. While Save is pending, the modal disables every input, shows a
   "Saving…" footer state, and **suppresses Esc / backdrop / Cancel
   gestures** until the dispatch promise resolves. On rejection the
   modal stays open with the rejected draft intact and surfaces the
   server error inline (see §3.6 R-S2).
7. If the user changes Type to a new value, the **type-change
   preflight** (today's `ChangeTypePopover`) renders **inline as a
   sub-panel** above the type-specific config section. Save is
   gated on the acknowledgement checkbox when the preflight reports
   incompatible rows. Reverting the Type back to its original value
   removes the sub-panel and any ack requirement. The preflight also
   re-runs (and the ack is invalidated) whenever the underlying row
   data changes while the modal is open — see §3.6 R-S3.
8. Forbidden type transitions (per `CONVERSION_MATRIX` — formula
   in/out is forbidden in both directions) render the destination
   pill as `aria-disabled` with the existing tooltip copy from
   `ChangeTypePopover`. There is no "Phase 4 coming soon" tooltip
   any more (Phase 4 shipped).
9. **Intra-session derived-state rules.** When a change in one
   section makes another section's draft invalid, the modal **fixes
   the dependent state in the draft automatically** rather than
   blocking Save:
   - Changing Type away from `single_select` clears
     `config.default_option_id` from the draft `after`.
   - Deleting an option that is currently `config.default_option_id`
     clears the default in the draft `after`.
   - Changing Type away from `formula` clears `config.source` /
     `config.ast` / `config.deps` / `config.result_type` from the
     draft `after`.
   These derivations are computed on every draft edit; they are
   visible in the diff Save sends so the server applies them
   atomically with the user-driven change.

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
   open closes the modal (except during pending Save — US-CF-16
   criterion 6).

---

## 3. Architecture

### 3.1 New components

- **`FieldConfigModal.tsx`** (new). The single modal shell. Owns the
  open/closed state, the form-wide draft, the per-section validity
  flags, the unified Save dispatcher, the pending-save lock, and the
  external-change watcher (see §3.6). Built on
  `@radix-ui/react-dialog` (we already pull this in for
  `ConfirmDestructiveDialog`) rather than `@radix-ui/react-popover`.
- **`FieldConfigForm.tsx`** (new). The presentational form body —
  receives a draft `FieldDef`, a set of section-update callbacks,
  and per-section validation results, and renders the sections.
  Kept separate from the modal shell so the form can be unit-tested
  without mounting Radix dialog internals.
- **Per-section sub-components** carved out of the existing popovers:
  - `FieldConfigSectionOptions.tsx` — extracted from
    `FieldEditorPopover` (DnD, color picker, cascade-on-delete) +
    the new Default picker.
  - `FieldConfigSectionFormula.tsx` — extracted from
    `FormulaEditorPopover` (source input + palette + preview).
  - `FieldConfigSectionNumber.tsx` — precision input (today inline
    in `AddFieldPopover`).
  - `FieldConfigSectionTypeChange.tsx` — extracted from
    `ChangeTypePopover` (target picker + preflight + ack).
  - `FieldConfigSectionDescription.tsx` — extracted from
    `EditFieldDescriptionPopover` (textarea + counter).
  - `FieldConfigSectionFormatting.tsx` (Phase 5b — see §3.5).
- **`SingleSelectDefaultPicker.tsx`** (new, **shared from day one**).
  Used by both `FieldConfigSectionOptions` and `AddFieldPopover`'s
  `single_select` branch. Inputs: `(options, value, onChange,
  disabled)`. Built up front rather than copied-and-then-extracted to
  avoid the known drift R3 calls out — see §3.7.

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

### 3.3 Single dispatch path — resolved: Option-A

Today each popover dispatches its own `WriteOp`:

- `FieldEditorPopover` → `schemaMutation/legacyOptions`
- `FormulaEditorPopover` → `schemaMutation` `setFormula`
- `EditFieldDescriptionPopover` → `schemaMutation` `setDescription`
- `ChangeTypePopover` → `schemaMutation` `changeType`
- Inline header rename → `schemaMutation` `renameField`

The original draft of this plan proposed two options:

- **Q1.A** — add a new server-side bundle mutation that diffs
  before/after `FieldDef` and applies every changed property in one
  transaction. One `WriteOp`, one history entry.
- **Q1.B** — keep the modal client-side smart enough to emit
  multiple `WriteOp`s in a single transactional batch on the
  existing `dispatchWrite` primitive.

The reviewer correctly flagged that Q1.B's premise was wrong:
`DispatchWrite` is typed `(op, inverse, options?) => Promise<void>`
— **one op per call, one undo entry per dispatch**
(`useGridWriteReducer.ts:18-22`). There is no array-of-ops `WriteOp`
variant, and rebuilding the reducer to grow one would touch every
caller in the data table.

The app is pre-deploy with no live users (CLAUDE.md / PRD §16), so
the backend change is cheap. **Resolution: Option-A.** Add a new
`editFieldBundle` mutation kind to the existing
`FieldSchemaMutation` discriminated union and one
`schemaMutation/typed` `WriteOp` carries it from frontend to backend.
One undo step. One audit log row. No reducer changes. No
legacy-popover drift between the modal and the existing per-property
dispatchers (they continue to exist until P5a.6 deletes them, and
they keep using their existing mutation kinds — only the modal uses
`editFieldBundle`).

### 3.3a Backend mutation: `editFieldBundle`

New variant in `backend/features/project_document/schema_mutations.py`'s
`FieldSchemaMutation` union. Pydantic shape (extra="forbid",
camelCase alias):

```python
class EditFieldBundleMutation(BaseModel):
    model_config = _SCHEMA_MUTATION_MODEL_CONFIG

    kind: Literal["editFieldBundle"]
    table_key: str
    field_id: str
    # Full target FieldDef. Server diffs vs. the stored field and
    # applies the union of property changes atomically. `after.id`
    # must equal `field_id` (mirrors `changeType`'s identity rule).
    after: CustomFieldDef
    # Required when `after.field_type` differs from the stored
    # field_type AND the per-row preflight is non-empty. Mirrors
    # `ChangeTypeMutation.acknowledge_destructive` semantics.
    acknowledge_destructive: bool = False
    # Required when `after.field_type == single_select` AND the
    # diff against the stored option list contains required-core
    # deletes — same shape as `EditOptionsMutation.replacements`.
    # Always empty for custom fields (custom single-selects never
    # have required-core deletes).
    option_replacements: dict[str, str] = Field(default_factory=dict)
    expected_schema_fingerprint: str
```

Audit kind: `project_version_custom_field_edit_bundle`.

**Diff order inside `_apply_edit_field_bundle`.** The dispatcher must
apply changes in an order that matches the per-property dispatchers'
existing semantics so we don't subtly diverge:

1. Validate identity: `after.id == field_id`, field exists, not
   forbidden by `CONVERSION_MATRIX` if type changed.
2. Validate display-name uniqueness (skipping `field_id`).
3. Clamp description to `CUSTOM_FIELD_DESCRIPTION_MAX`.
4. Compute the option-list diff against the stored options (only
   meaningful when both before and after types are `single_select`).
5. If `after.field_type != existing.field_type`, run the
   `_apply_change_type` core (preflight → coerce → row writes → swap
   option-list namespace). The ack rule mirrors `changeType`. Note
   that when changing type **into** `single_select`, the bundle's
   `after.config.default_option_id` is validated against the
   freshly-materialized option list (the `create_options` policy
   generates options from text values; the default must point at one
   of those ids — or be null).
6. If type did not change but options did, run the
   `_apply_edit_options` core (cascade deletes → replace option
   list). Validate `after.config.default_option_id ∈ next_option_ids
   ∪ {null}` atomically with the option mutation — the existing
   `EditOptionsMutation` does not know about defaults; the bundle
   dispatcher adds this check.
7. Replace the field def with `after` (preserving `created_by` and
   `created_at` from the stored field — same rule as `_apply_change_type`).
8. Rename does not need a separate step: the `display_name` change
   rides in the field-def replace at step 7, and uniqueness was
   already validated at step 2.
9. Run `validate_document` on the result (same as every other
   mutation).

**Audit payload** mirrors the per-property dispatchers' shape but
adds a `properties_changed` list (`["display_name", "field_type",
"options", "default_option_id", "description", "formula_source"]`
subset) so the log filterer can reconstruct what happened from one
row.

**Stale-fingerprint behavior** is identical to every other mutation
(409 on mismatch — see `_check_stale_fingerprint`). The frontend
recomputes the fingerprint on each modal open and stamps the value
into the WriteOp at Save time, not at open time, so a refetch that
lands between open and Save is detected as a 409 rather than silently
saved against a stale base.

**Partial-failure semantics.** Because the dispatcher runs inside one
SQL transaction (`apply_schema_mutation_to_draft` opens a single
`transaction()` block in `drafts.py:158`), any rejection — duplicate
name, ack required, option-replacement missing, formula parse error
— rolls back the whole bundle. The frontend rolls back the optimistic
apply per the existing `data-table.md "Write Pipeline"` rule.

**No-op handling.** If the diff is empty (user opened the modal,
changed nothing, hit Save), the dispatcher follows the existing
`setDescription`-no-op pattern at `drafts.py:196-210` — return the
current envelope without writing or audit-logging. The frontend
should not let this happen (Save is disabled when the draft equals
source), but the server is defensive.

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
  from "Edit options" to "Edit field". This is a deliberate UX
  expansion called out in US-CF-15 criterion 4.

In `HeaderContextMenu.tsx`: collapse the existing five custom-field
items (`Rename field`, `Edit description`, `Edit formula…`,
`Change type`, the menu-driven entry into options) into one
`Edit field…` item that calls the same `onEditField`. `Delete field`
and `Duplicate field` stay separate (they are not properties).

**DataTable public surface.** A new prop is added:

```ts
onEditCustomField?: (fieldKey: string, triggerEl: HTMLElement | null) => void;
```

Mounted in `DataTableProps<TRow>` alongside `onAddCustomField` and
`onDeleteCustomField`. Consumers (Rooms today, Pumps when plan-20
lands) wire it to a single `<FieldConfigModal>` mounted at the
consumer level (the modal needs access to the project document for
preview row + fingerprint + dispatcher; mounting it inside the
generic `DataTable` would require pushing those concerns into the
shared primitive). The `triggerEl` is stored for focus-return on
close.

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

### 3.6 Stale-draft / concurrent-edit semantics

The modal session can last minutes — long enough for another write
(cell edit, paste, MCP) to land. The popovers got away with this
because their sessions were seconds long; the modal needs explicit
rules.

**R-S1 — Source field disappears while the modal is open.** If the
field referenced by `field_id` is no longer in `useTableSchema`'s
merged `FieldDef[]` when a re-render happens (deleted by an MCP
write, deleted by undoing an earlier insert), the modal closes
itself and surfaces a toast: "This field was removed in another
edit. Your changes were discarded." Save is blocked from the moment
the field disappears.

**R-S2 — External edit to the same field while the modal is open.**
The modal watches the resolved `FieldDef` for `field_id` by
reference equality. When it changes (rename via MCP, options edited
externally, description changed), the modal:

1. Suspends Save (the footer shows "This field changed elsewhere —
   review the new value to continue").
2. Renders a non-destructive banner showing the conflicting property
   and offering two buttons: **Keep my changes** (rebases the draft
   on the new source, keeping the user's diffs property-by-property)
   and **Discard my changes** (re-seeds the draft from the new
   source and re-enables Save).

This is intentionally explicit — silent merge would let the user
overwrite an MCP write without noticing. The fingerprint check on
Save is the backstop (409), but R-S2 catches the case before the
network round-trip.

**R-S3 — Preflight staleness during type change.** The change-type
preflight (US-CF-16 criterion 7) evaluates against the current row
data. The modal subscribes to row changes for the table; on any row
mutation while the preflight is showing, it re-runs the preflight
and **invalidates the ack checkbox** (the user must re-tick to
acknowledge the new set of incompatible rows). The Save button
disables for the moment between the row change and the
re-preflight's resolution.

**R-S4 — Preview-row snapshot is value-copied.** Q5's "snapshot last-
focused row at modal-open time" is a **deep value copy** of the
row's `custom` dict and core columns, not an id-reference. If the
underlying row is deleted (by another write) while the modal is
open, the formula preview continues to evaluate against the
snapshot. The preview header shows "Preview based on row at modal
open" with a stale indicator after any row mutation, so the user
isn't confused about why the preview diverges from the visible
table.

**R-S5 — Pending-save re-entrancy.** While the dispatch promise is
unresolved (`isSaving` true):
- Esc, backdrop click, and Cancel are suppressed.
- All form inputs are disabled (US-CF-16 criterion 6).
- A second Save gesture (Enter on focused Save button, repeat
  click) is a no-op.
- On rejection, the modal stays open, the error renders inline
  (mapped from `api_error.code` — `custom_field_duplicate_name`
  surfaces on the Name input; `custom_field_coercion_preflight_required`
  re-displays the preflight with the server's row list;
  `custom_field_formula_*` errors surface on the formula section;
  `custom_field_stale_schema_fingerprint` triggers the R-S2 banner
  and the user re-picks Keep / Discard).

### 3.7 `AddFieldPopover` consistency in P5a.3b

AirTable parity requires the Default picker in the Create flow too
(see Q6 resolution). To avoid the known drift R3 calls out, the
picker is built as `SingleSelectDefaultPicker.tsx` from day one and
**both** surfaces consume it (the modal's `FieldConfigSectionOptions`
and `AddFieldPopover`'s `single_select` branch).

This also means `AddCustomFieldRequest.config` gains the optional
`default_option_id` field at the same time as the modal carries it
— shared backend contract from the first sub-phase. True
unification of the modal shell with `AddFieldPopover` is still
deferred to Phase 5c per §1's out-of-scope note; this is only about
the picker component itself.

---

## 4. Phasing

Each phase is one PR that leaves `make typecheck`, `make test`,
`make lint`, `make smoke` green.

### Phase 5a — Modal shell, single entry point

- [x] **P5a.0 — Backend: `editFieldBundle` mutation + `default_option_id`
  on single-select config.** Two backend changes in one PR (both are
  pure-additions to the wire contract):

  1. Add `EditFieldBundleMutation` to the `FieldSchemaMutation` union
     in `schema_mutations.py` and the matching
     `_apply_edit_field_bundle` dispatcher per §3.3a. Register the
     audit kind. Add pytest coverage for: no-op diff, name-only
     change, name + description, name + type-change-with-preflight
     (ack required and ack provided), name + options-edit + default
     change, fingerprint mismatch (409), forbidden type transition,
     identity violation (`after.id != field_id`), required-core
     option-replacement enforcement (custom single-selects skip this
     branch), and option-default validation (default not in option
     set → 422).
  2. Extend `CustomFieldDef.config` for `field_type ==
     single_select` to accept an optional `default_option_id: str |
     None`. Validated atomically with option mutations — `editOptions`
     and `editFieldBundle` both check `default_option_id ∈
     option_ids ∪ {null}`. Update the row-creation paths
     (`POST /tables/<table>/rows`, optimistic insertion in the
     frontend) to pre-fill `custom.<cf_id> = default_option_id`
     **only when the incoming request omits the key entirely** (R5
     — explicit `null` from MCP / paste / JSON-import is preserved
     as `null`, never silently overwritten). Defaults are
     **forward-only**: setting a Default does **not** backfill any
     existing row with a `null` value for that column (R6, AirTable
     parity).

  **Scope guard:** only custom single-selects get a configurable
  default. Core single-selects (`floor_level`, etc.) keep their
  current required-or-null behavior — defaults for core fields are
  out of scope (their `required: true` semantics interact with row
  validation in ways that belong in their own plan).

  Pure-backend PR; no UI surface yet. Frontend mirrors the
  `editFieldBundle` Pydantic shape in `types.ts` so the next
  sub-phase can dispatch it.

- [x]  **P5a.1 — Skeleton modal.** Build `FieldConfigModal` +
  `FieldConfigForm` with only the Name + Description sections wired.
  Hook double-click + chevron + a new `Edit field…` menu item to it
  via the new `onEditCustomField` prop on `DataTableProps`. Save
  dispatches one `editFieldBundle` `WriteOp`. Implement R-S1, R-S2,
  R-S5 in this PR — they need to ship with the very first version
  of the modal because the dispatcher is real. R-S3 / R-S4 land in
  P5a.2 / P5a.5 alongside the features they protect.

- [x] **P5a.2 — Type picker + change-type sub-panel.** Port
  `ChangeTypePopover`'s preflight + ack into
  `FieldConfigSectionTypeChange`. Save bundles the type change into
  the same `editFieldBundle`. Implement R-S3 here (preflight re-run
  on row mutation, ack invalidation).

- [x] **P5a.3 — Options section + Default picker.** Port
  `FieldEditorPopover` into `FieldConfigSectionOptions` (drag-handles,
  color swatches, Color-code toggle, Alphabetize, delete-with-
  cascade). Build `SingleSelectDefaultPicker` (shared per §3.7);
  mount it below the option list. Wire it to the backend
  `config.default_option_id` from P5a.0. Re-mount
  `ConfirmDeleteOptionDialog` as the same nested alert it is today.
  Implement US-CF-16 criterion 9 (delete-default auto-clear,
  change-type-away-from-single-select auto-clear). Also: rewire the
  header chevron + the menu's old "Edit options" entry to the new
  modal and **delete** the in-grid options popover that today opens
  on chevron-click / single-select-header double-click.

- [x] **P5a.3b — Default picker in `AddFieldPopover`.** Drop the shared
  `SingleSelectDefaultPicker` into `AddFieldPopover`'s
  `single_select` branch; carry `default_option_id` through
  `AddCustomFieldRequest.config`. `AddFieldPopover` stays a
  separate component in 5a — true unification with the modal is
  still Phase 5c per §1's out-of-scope note.

- [x] **P5a.4 — Number precision section.** Port from `AddFieldPopover`
  inline; trivially small.

- [x] **P5a.5 — Formula section.** Port `FormulaEditorPopover` into
  `FieldConfigSectionFormula`. Live preview against the snapshot
  row works the same. Implement R-S4 here (value-copy snapshot,
  stale indicator after any row mutation). Also implement US-CF-16
  criterion 9 (change-type-away-from-formula auto-clears
  `config.source` / `ast` / `deps` / `result_type`).

- [x] **P5a.6 — Decommission popovers.** Delete the four superseded
  popover components, their tests, and their menu-item handlers.
  Update `__tests__/HeaderContextMenu.test.tsx` and
  `columnHeaderDoubleClick.test.tsx` to assert the new modal
  opens. Update `tests/e2e/custom-fields-phase-4.spec.ts` (and the
  Phase 2 + Phase 3 e2e specs) to drive the modal. Confirm Rename
  re-emits one `renameField` legacy WriteOp from no surface (it
  is replaced entirely by the bundle path) and that no production
  code still imports the deleted components.

- [x] **P5a.7 — Acceptance.** Wire the new modal into every
  `<DataTable>` consumer (Rooms today, Pumps when plan-20 lands).
  Manual QA pass per US-CF-15 / US-CF-16 / US-CF-17. Append the
  modal's focus-trap + Esc + screen-reader behavior to
  `planning/archive/dated/2026-05-25/plan-17-a11y-notes.md` (single source —
  do not also duplicate the checklist in this plan).

### Phase 5b — Formatting (deferred)

Its own plan. Out of scope for the consolidation PRs.

### Phase 5c — Unify with Add Field (implemented)

**Implemented 2026-05-25.** The create flow now uses
`CreateFieldConfigModal` plus shared field-config sections, and the
legacy `AddFieldPopover` component/test were removed. The mutation
boundary stayed unchanged: create dispatches `addField`; edit
dispatches `editFieldBundle`.

Phase 5a has shipped, so the evaluation gate is resolved: the add
flow should move onto the same `FieldConfigModal` chrome in **create
mode**. Keep the backend mutation paths distinct:

- Create mode still dispatches `addField` through
  `AddCustomFieldRequest` / `onAddCustomField`.
- Edit mode still dispatches `editFieldBundle` through
  `EditCustomFieldBundleRequest` / `onEditCustomFieldBundle`.
- The shared surface is the modal shell + form model, not a shared
  write mutation.

#### Pre-implementation review (2026-05-25)

Before Phase 5c, `AddFieldPopover.tsx` was the last custom-field
popover. It owned:

- Radix `Popover` shell anchored to the tail `+` cell or header
  insert menu.
- Add-specific draft state (`displayName`, `fieldType`,
  `descriptionEnabled`, `description`, `numberPrecision`, `options`,
  `defaultOptionId`, `formulaSource`).
- Its own type-pill row and validation.
- Its own single-select option editor, which is simpler than the
  edit modal's `FieldConfigSectionOptions` and lacks the richer
  modal section behavior.
- Its own inline formula source input, even though edit mode now
  uses `FieldConfigSectionFormula`.
- Its own optional-description toggle, while edit mode always shows
  the Description section.

`FieldConfigModal.tsx` already owned the better shell and the reusable
sections:

- Radix `Dialog` focus trap, pending-save lock, close behavior, and
  footer.
- Name + Type + type-specific section + Description order.
- `FieldConfigSectionOptions`, `FieldConfigSectionNumber`,
  `FieldConfigSectionFormula`, and `SingleSelectDefaultPicker`.
- Edit-only guards: source snapshot, R-S1 removed-field close, R-S2
  external conflict banner, R-S3 type-change preflight, R-S4 formula
  preview staleness.

Therefore Phase 5c was an extraction/refactor PR, not a backend PR.
The main risk was accidentally pulling edit-only concurrency and
type-conversion semantics into create mode. Create mode has no source
field, no stale field, no type-change preflight, and no dirty-vs-source
comparison; its Save gate is simply `name valid && type config valid &&
!pending`.

#### P5c.1 — Extract shared form constants and draft helpers

Create a small shared module, for example
`components/fieldConfigModel.ts`, that contains:

- `FIELD_TYPE_CHOICES` (the current enabled type list; one source for
  add + edit labels).
- `FieldConfigDraft` or `CreateFieldDraft` helpers for the add-mode
  defaults.
- Pure helpers to build add-mode config:
  `buildCreateFieldConfig(draft, formulaState)` and
  `buildInitialOptions(draft)`.
- Shared validation helpers for display-name length, duplicate-name,
  option-list validity, and formula validity.

Keep mutation builders in `lib/customFieldMutations.ts`; do not move
wire-shape construction into React components.

#### P5c.2 — Extract create-mode form body

Replace `AddFieldPopover`'s inline form with a create-mode body that
uses the same visual sections as edit mode:

- Name input.
- Type pill row.
- Conditional type-specific section:
  - Number -> `FieldConfigSectionNumber`.
  - Single select -> either a create-capable
    `FieldConfigSectionOptions` mode, or a small
    `FieldConfigSectionCreateOptions` that shares lower-level option
    row/default-picker helpers. Prefer extending the existing section
    only if the props stay clear; it currently assumes edit-mode
    `sourceOptions`, `sourceDefaultOptionId`, row cascade checks, and
    dirty reporting.
  - Formula -> `FieldConfigSectionFormula` with no preview row and a
    create-mode empty initial source.
  - Text / URL -> no section.
- Description section, always visible, with empty value by default.
  Drop the `descriptionEnabled` checkbox unless there is a UX reason
  to preserve it; empty text still serializes to `null`.

This removes the duplicated option editor and inline formula editor
from `AddFieldPopover.tsx`.

#### P5c.3 — Convert add shell from popover to modal

Replace `<AddFieldPopover>` with a modal component, either:

- `FieldConfigModal mode="create"` / `mode="edit"` discriminated
  props, if the edit-only effects can stay cleanly isolated, or
- `CreateFieldConfigModal` plus shared lower-level
  `FieldConfigDialogShell` and form sections.

Prefer the second option if `FieldConfigModal` starts accumulating
too many nullable edit-only props. The important outcome is shared
chrome and shared sections, not one overloaded component.

Opening behavior stays unchanged:

- Tail `+` and `Insert field left/right` open create mode.
- Create mode still stores `insertAfterFieldKey`.
- Save still awaits `onAddCustomField`, closes only on success, and
  sets `pendingFocusFieldKey` from `{ newFieldKey }`.
- Pending save suppresses Esc / backdrop / Cancel, matching edit
  mode's R-S5 behavior.
- Close returns focus to the originating tail/header trigger.

#### P5c.4 — DataTable wiring cleanup

Replace `addFieldPopover` state with `createFieldModal` state:

```ts
type CreateFieldModalState = {
  triggerElement: HTMLElement | null;
  insertAfterFieldKey: string | null;
};
```

Keep `openAddFieldPopover`'s call sites conceptually intact but
rename them to modal language. Remove `useElementAnchorRef` from the
add flow once no popover remains.

`DataTableProps.onAddCustomField` does not change. This avoids
touching Rooms/Equipment mutation assembly except for any import
rename if `AddCustomFieldRequest` moves out of
`AddFieldPopover.tsx` into `types.ts` or a shared model file.

#### P5c.5 — Tests and acceptance

Update tests in the same PR:

- Rename or rewrite `AddFieldPopover.test.tsx` as
  `CreateFieldConfigModal.test.tsx`.
- Preserve current add coverage: happy path, type selection, number
  precision, duplicate-name preflight, server duplicate/stale errors,
  single-select initial options + default, formula config, and
  insert-after key.
- Add modal-shell coverage for create mode: focus lands on Name,
  Esc/backdrop close when idle, pending save suppresses dismissal,
  Cancel keeps dispatch uncalled, and failed save leaves the modal
  open with draft intact.
- Update `AddFieldTailCell` / `HeaderContextMenu` integration tests
  only where accessible role/name changes from popover-dialog to
  modal-dialog affect queries.
- Run `pnpm run format`, `pnpm test`, `pnpm run build`, and the
  custom-field e2e/spec subset that covers add + edit flows.

#### Not in P5c

- No backend changes.
- No changes to `addField` / `editFieldBundle` semantics.
- No formatting section from Phase 5b.
- No create-mode type-change preflight; create mode has no existing
  row values to coerce.

---

## 5. Data shape & contracts

This plan adds:

1. **Backend mutation `editFieldBundle`** per §3.3a — new variant
   on the `FieldSchemaMutation` discriminated union; one audit kind;
   one transactional dispatcher that composes the existing per-
   property dispatchers' cores.
2. **`CustomFieldDef.config.default_option_id`** for `field_type ==
   single_select` — optional `str | None`. Validated atomically with
   option mutations inside both `editOptions` and `editFieldBundle`.
3. **Row-creation default-fill rule** per R5 — apply the default
   only when the request omits `custom.<cf_id>`; preserve explicit
   `null`. Forward-only per R6 — no backfill.
4. **Frontend `DataTableProps.onEditCustomField`** — new optional
   prop wiring the gesture from the generic `DataTable` to the
   consumer-mounted `FieldConfigModal`.
5. **Frontend `WriteOp`** — no new `kind`; `editFieldBundle` rides
   on the existing `kind: "schemaMutation", variant: "typed"`
   discriminator and the existing `/custom-fields:mutate` endpoint.
6. **Shared `MAX_DESCRIPTION` constant** — surface the backend's
   `CUSTOM_FIELD_DESCRIPTION_MAX` (280) into the frontend so the edit
   modal, create modal, and the backend `setDescription` clamp all use
   one source of truth. If a frontend mirror does not exist yet, add it
   in P5a.1 alongside the Description section.

The app is pre-deploy with no live users, so there is **no
backwards-compatibility requirement** for documents or saved
Versions written before P5a.0 — if simpler code falls out of
breaking older fixtures, take it. Drop or regenerate any test
fixtures that would otherwise pin the old shape.

Phase 5b may add a `format` slice on `CustomFieldDef.config`; that
decision belongs in its own plan.

---

## 6. Test plan

### Backend (pytest)

- **`test_schema_mutations_edit_field_bundle.py`** (new) — exhaustive
  coverage of `editFieldBundle` per §3.3a. Required cases:
  - no-op diff returns current envelope, no audit row;
  - name-only change == result of `renameField`;
  - description-only change == result of `setDescription` (clamp
    at `CUSTOM_FIELD_DESCRIPTION_MAX`);
  - options-only change (add / rename / reorder / delete-with-
    cascade) == result of `editOptions`;
  - type-change (with ack required and ack provided) == result of
    `changeType`, including text→single_select option
    materialization and the default validated against the
    materialized list;
  - formula source change (Phase 4) === result of `setFormula`,
    including parse / cycle / missing-ref error paths bubbling
    through the bundle path;
  - rename + description + options + default-change in one
    bundle, single audit row, `properties_changed` lists all four;
  - fingerprint mismatch (409);
  - identity violation (`after.id != field_id` → 422);
  - forbidden type transition → 422;
  - default points at an option not in `next_options` → 422;
  - changing type away from `single_select` with a default still
    present in `after.config` → 422 (the frontend strips this per
    US-CF-16 criterion 9; the backend rejects defensively to keep
    the wire contract narrow).

### Backend regression

- **`test_drafts_apply_schema_mutation_bundle.py`** — bundle rolls
  back atomically on validation failure (insert duplicate name +
  change type in one bundle, server rejects, draft body unchanged).
- **`test_default_option_id_row_create.py`** — POST row omits key
  → pre-filled with default; POST row sends explicit `null` → stays
  `null`; backfill check (existing null rows are not touched when
  default is set via `editFieldBundle`).

### Unit (Vitest + Testing Library)

- **`FieldConfigModal.test.tsx`** — opens on header double-click,
  closes on Esc + backdrop, returns focus to the originating `<th>`;
  R-S1 (field disappears) closes + toasts; R-S2 (external rename)
  shows the banner and offers Keep / Discard; R-S5 (pending Save)
  suppresses Esc / backdrop / Cancel.
- **`FieldConfigForm.test.tsx`** — per-section show/hide based on
  draft type (asserts only one type-specific section is mounted at
  a time per R8); Save disabled until dirty + valid; per-section
  validators (name uniqueness, formula parse, options uniqueness);
  US-CF-16 criterion 9 auto-derivations (type change clears
  default, option delete clears default, type change clears
  formula config).
- **`FieldConfigSectionTypeChange.test.tsx`** — inline preflight,
  ack gating, server-preflight 422 re-render, forbidden-pair tooltip,
  R-S3 (row mutation invalidates ack).
- **`FieldConfigSectionOptions.test.tsx`** — DnD reorder, color
  swatch, delete-with-cascade nested dialog, Default picker
  integration (delete-default clears the picker).
- **`SingleSelectDefaultPicker.test.tsx`** (new) — blank-default
  semantics, option-list change preserves selection when option
  still exists, drops selection when it doesn't.
- **`FieldConfigSectionFormula.test.tsx`** — source input, palette
  insert, live preview against the value-copied snapshot, stale
  indicator after row mutation, error states, modal-escalation
  threshold.
- **`HeaderContextMenu.test.tsx`** — only `Edit field…` (plus the
  view-state items + delete/duplicate/insert) is rendered for custom
  fields; core fields show only view-state.
- **`columnHeaderDoubleClick.test.tsx`** — custom header opens modal;
  core header does nothing; viewer mode does nothing on double-click
  and on Enter and on chevron click; chevron tooltip reads "Edit
  field" for non-single-select customs.

### E2E (Playwright)

- **`custom-fields-config-modal.spec.ts`** (new) — full round-trip:
  open modal, change name + change type + edit options + set default
  + add description, Save, assert **one** optimistic apply, **one**
  network POST to `/custom-fields:mutate` with `kind:
  "editFieldBundle"`, and **one** entry on the undo stack. Then Undo
  restores original `FieldDef`.
- **`custom-fields-config-modal-conflict.spec.ts`** (new) — open
  modal, simulate an external write to the same field via a second
  page, assert R-S2 banner appears and Save is suppressed until the
  user picks Keep or Discard.
- Update existing custom-field e2e specs to drive the new modal.

### Test budget — files touched (per R3 estimate)

- **New unit specs (~8):** FieldConfigModal, FieldConfigForm,
  FieldConfigSectionTypeChange, FieldConfigSectionOptions,
  FieldConfigSectionFormula, FieldConfigSectionNumber,
  FieldConfigSectionDescription, SingleSelectDefaultPicker.
- **Rewritten unit specs (~6):** FieldEditorPopover.test (becomes
  FieldConfigSectionOptions.test), FormulaEditorPopover.test (→
  FieldConfigSectionFormula.test), EditFieldDescriptionPopover.test
  (→ FieldConfigSectionDescription.test), ChangeTypePopover.test
  (→ FieldConfigSectionTypeChange.test), HeaderContextMenu.test,
  columnHeaderDoubleClick.test.
- **New backend pytest specs (~6):** edit_field_bundle (per-case),
  drafts_apply_bundle_atomicity, default_option_id_row_create,
  plus three regressions in existing per-property suites confirming
  they still pass (bundle and per-property dispatchers must agree
  on every diff result).
- **New e2e specs (~2):** custom-fields-config-modal,
  custom-fields-config-modal-conflict. Update Phase 2 / 3 / 4 e2e
  specs to drive the modal (~4 files touched).

A11y notes for the modal land in
`planning/archive/dated/2026-05-25/plan-17-a11y-notes.md` (single source). At
minimum: `aria-labelledby` points to the heading carrying the
field's current display name; focus order is Name → Type →
(sub-panels in declaration order) → Description → Cancel → Save;
Esc closes the innermost layer; sub-panel changes are announced
via `aria-live="polite"`.

---

## 7. Resolved decisions (2026-05-25)

**Q1 — One WriteOp or many?** §3.3, §3.3a. **Resolved: Option-A.**
Add a new backend `editFieldBundle` mutation kind on the existing
`FieldSchemaMutation` union. The modal's Save handler emits one
`schemaMutation/typed` `WriteOp` carrying the bundle; the reducer
pushes one history entry; Undo restores the original `FieldDef` in
one step. (The original draft proposed a frontend-only Q1.B
batching path; review found that `dispatchWrite` is one-op-per-call
with no array-of-ops variant, so Q1.B was structurally infeasible.
Since the app is pre-deploy, the backend change is cheap and
keeps the contract narrow.)

**Q2 — Inline vs. nested-alert for the type-change preflight.**
**Resolved: inline.** Matches AirTable. Both the local preflight and
the server-side `422` preflight payload render inline in
`FieldConfigSectionTypeChange`, with `role="alert"` on the
incompatible-rows diff. The ack is invalidated when the underlying
row data changes (R-S3).

**Q3 — Allow rename + change-type in the same Save?** **Resolved:
combine.** AirTable parity. Single "Saving…" spinner; single undo
step labeled `Edit field <name>`. The `editFieldBundle` dispatcher
applies them in the order specified in §3.3a (uniqueness check →
preflight → row writes → swap → field-def replace).

**Q4 — Keep inline rename as a "fast path"?** **Resolved: no.** The
existing double-click-to-rename behavior in
`GridHeader.tsx:285-297` (`HeaderRenameEditor`) is **removed**;
double-click is remapped exclusively to the new modal. The Name
input is auto-focused + selected on modal open, so rename remains a
one-gesture-plus-one-keystroke action. No `F2` fallback in 5a.

**Q5 — Focused row for formula preview.** **Resolved: snapshot
last-focused row at modal-open time; default to row 0 (first
visible row) when no row has been focused yet.** Snapshot is
**value-copied** (R-S4), not id-referenced, so deletion of the
underlying row does not break the preview. A stale indicator
appears after any row mutation so the user knows the preview no
longer matches a live row.

**Q6 — Default option picker for single-select.** **Resolved: Q6.A
(include in Phase 5a) — AirTable parity.** Adds an optional
`config.default_option_id` to single-select `CustomFieldDef`,
validated atomically with the option-list mutation (inside both
`editOptions` and `editFieldBundle`). Surfaces in both the new
modal's options section (P5a.3) **and** the existing
`AddFieldPopover`'s Create flow (P5a.3b) via the shared
`SingleSelectDefaultPicker` component (§3.7). Scope guard recorded
in P5a.0: only custom single-selects get a configurable default;
core single-selects (`floor_level`, etc.) keep current
required-or-null behavior and are out of scope.

---

## 8. Risks

All risks below were walked through with the user on 2026-05-25;
responses are recorded inline. The 2026-05-25 review added R8.

- **R1 — Bundle size.** The new modal pulls in
  `@radix-ui/react-dialog`. We already use it transitively via
  `ConfirmDestructiveDialog`, so this is a no-op.
  *Resolution: accepted as housekeeping; no action.*

- **R2 — Behavior change on header double-click.** Today's
  double-click on a custom header runs either the inline rename
  editor or the single-select options popover; after Phase 5a it
  opens the new modal instead. AirTable parity is explicitly the
  goal, and users expect AirTable behavior on this surface. The
  chevron also gains a new meaning for all custom fields (US-CF-15
  criterion 4) — same justification.
  *Resolution: accepted as desired UX; no mitigation needed.*

- **R3 — Test churn.** Every custom-fields unit/e2e test today
  asserts against a specific popover's DOM and will need to be
  rewritten against the modal. Q6.A also adds backend tests for
  `default_option_id` validation + row-creation defaults, and
  Option-A adds the `editFieldBundle` pytest suite. Revised
  estimate: **~14 unit specs + ~6 backend pytest specs + ~2 new
  e2e specs + ~4 e2e spec updates.** §6 lists the files; P5a.6
  explicitly budgets for this.
  *Resolution: accepted; tests will be updated as part of each
  sub-phase rather than batched at the end. The shared
  `SingleSelectDefaultPicker` (§3.7) prevents the AddFieldPopover
  / modal drift that an earlier draft would have created.*

- **R4 — Migration window during P5a.1 → P5a.6.** Between the
  modal landing and the legacy popovers being deleted, two
  dispatcher paths exist for the same `FieldSchemaMutation`s. The
  modal uses `editFieldBundle`; the legacy popovers continue to
  use their per-property kinds (`renameField`, `setDescription`,
  `editOptions`, `changeType`, `setFormula`). The original draft
  proposed a Settings feature flag to gate the modal's gesture
  wiring. **The app is pre-deploy with no live users, so the flag
  is unnecessary** — sub-phases can ship the modal as the *only*
  path the moment it covers a given property, deleting the matching
  popover in the same PR.
  *Resolution: drop the feature flag from the phasing. Each P5a.N
  PR is a hard cut-over for the property it covers. Because both
  dispatchers go through `apply_schema_mutation` they share the
  same per-property cores; the backend tests in §6 assert the
  bundle and per-property dispatchers produce identical diffs.*

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

- **R8 — Modal mount cost (added 2026-05-25 review).** A naïve
  modal would mount every section component up front (options
  with DnD-kit, formula with parser + palette, type-change with
  preflight), which is a lot of JS to evaluate every time a user
  opens a single-select field config. The formula section in
  particular pulls in the AST parser and the palette.
  *Resolution: type-specific sections are **conditionally
  rendered** — only the section matching the current draft type
  is mounted (US-CF-16 criterion 1.iii). Name / Type picker /
  Description / Formatting are always mounted; Number / Options /
  Formula are mounted only when active. Switching type
  unmount-then-mounts; the type-change sub-panel renders inline
  above the type-specific section and is the only piece that
  bridges the transition. This also simplifies the focus order
  defined in §6's a11y notes.*

- **R9 — Concurrent-edit safety (added 2026-05-25 review).** The
  modal session can outlast cell writes, paste, MCP edits, and
  even row deletions; without explicit rules the optimistic-apply
  + fingerprint backstop could let a stale draft silently
  overwrite a recent external change at Save time.
  *Resolution: covered in §3.6 R-S1 through R-S5 with concrete
  behavior for field-disappears, external-edit-to-same-field,
  preflight-staleness, preview-row-snapshot, and pending-save
  re-entrancy. Backstop is the existing
  `custom_field_stale_schema_fingerprint` 409, which is mapped
  to the R-S2 banner on the modal side.*

- **R10 — Editor-only authorization (added 2026-05-25 review).**
  The `editFieldBundle` mutation MUST be rejected for viewer
  tokens (Q-CF-3) and for unauthenticated MCP requests.
  *Resolution: no new surface needed — the endpoint
  `/custom-fields:mutate` is already gated by `ProjectEditAccess`
  in `routes.py:127` (`require_editor_user` in
  `drafts.py:137`). The bundle path inherits this gate
  unchanged. The frontend's `readOnly` mode also suppresses the
  modal-open gesture (US-CF-15 criterion 6) as a defense-in-depth
  layer. Pytest coverage in P5a.0 includes a viewer-token
  rejection case.*
