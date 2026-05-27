---
DATE: 2026-05-26
TIME: 15:30 ET (rev 2026-05-26 19:50 ET — backend cohort landed)
STATUS: BACKEND COHORT LANDED 2026-05-26 — matrix extension, apply
        path, lock guard, audit-log per-row before/after, circular-
        import fix all shipped on `worktree-plan-31-phase-3-bundle`.
        Frontend cohort (P4.3 / P4.4 / P4.5 / P4.6) bundles with the
        deferred Phase 1c frontend reshape (tasks #10 / #11) and Phase
        2 frontend identifier deletion (tasks #18 / #19); see
        `plan-31-customizable-fields-prd.md` §P6 Phase 3 for the
        original full-cohort intent and `complete/plan-31-phase-2-
        record-id-field.md` for the predecessor.
        Lifts the Phase 1a hard rule that disables the type picker on
        built-in fields. Extends the conversion matrix to cover
        `formula` source and target.
AUTHOR: Claude (Opus 4.7)
SCOPE: Allow user-driven `field_type` changes on built-in fields whose
       `"field_type"` lock is absent. Extend the (frontend + backend)
       conversion matrix to handle `formula → primitive` (snapshot
       computed value) and `primitive → formula` (discard previous
       values, author new expression). Allow formula editing on
       `record_id` and any other built-in whose `"formula"` lock is
       absent. Make refresh-from-catalog (US-WIN-11) skip mutable-type
       fields cleanly. Rename audit-log entries to log built-in
       retypes uniformly with custom-field retypes.
RELATED:
  - docs/plans/2026-05-26/plan-31-customizable-fields-prd.md (master PRD, §P4.5, §P4.6)
  - docs/plans/2026-05-26/plan-31-phase-2-record-id-field.md (predecessor)
  - context/technical-requirements/data-table.md
  - context/technical-requirements/data-model.md §6.6
  - frontend/src/shared/ui/data-table/lib/typeConversionMatrix.ts
  - frontend/src/shared/ui/data-table/lib/coerceCustomFieldType.ts
  - frontend/src/shared/ui/data-table/components/FieldConfigSectionTypeChange.tsx
  - frontend/src/shared/ui/data-table/components/FieldConfigSectionFormula.tsx
  - frontend/src/shared/ui/data-table/components/FieldConfigModal.tsx
  - backend/features/project_document/mutations/models.py (CONVERSION_MATRIX)
  - backend/features/project_document/mutations/type_conversion.py
  - backend/features/project_document/mutations/formula_ops.py
  - backend/features/project_document/mutations/bundle.py
---

# Plan 31 — Phase 3 — Built-In Field Type Changes

## P0. Phase Intent

Phase 1a banned type changes on built-ins regardless of lock-list,
because the value-storage path hadn't been reshaped. Phase 1b reshaped
the storage. Phase 2 added `record_id` and retired the synthetic
identifier. Phase 3 is the payoff phase: built-in fields whose
`"field_type"` lock is absent become user-retypeable through the same
modal that custom fields already use; `record_id` becomes
formula-editable.

The conversion matrix has to grow to cover `formula` as a source and
target — that's new logic, not reuse of the existing matrix (PRD §P4.5).

## P1. Preconditions

- Phase 2 shipped: `record_id` is a real persisted FieldDef with its
  seed formula; `IdentifierConfig` is gone; the pinning rule is
  `field_key === "record_id"`.
- Phase 1a's hard rule "type-picker disabled on built-ins regardless
  of lock-list" still in effect — Phase 3 removes it.
- Q-F1, Q-F13 confirmed (PRD-resolved).
- `EditFieldBundleMutation` continues to handle the unified save
  path; Phase 3 changes what flows through it, not the gesture-
  per-undo contract.

## P2. Scope

### P2.1 In scope

1. Remove the Phase 1a hard rule. The type picker is enabled on any
   FieldDef whose `"field_type"` lock is absent — built-in or custom.
2. Extend `CONVERSION_MATRIX` (frontend `typeConversionMatrix.ts` +
   backend `mutations/models.py`) to cover `formula` as source and
   target, per PRD §P4.5 table:
   - `short_text / long_text / number / url / single_select → formula`:
     no preservation of prior cell values; the user authors a new
     expression. Preflight surfaces a count of non-empty rows that
     will be replaced.
   - `formula → short_text / long_text`: snapshot the computed value
     as text.
   - `formula → number`: snapshot the computed value, parse to
     number, null on parse failure (lossy on parse failure).
   - `formula → url`: snapshot as text; the URL validator applies on
     the snapshot value; rows that fail validation land in the
     incompatible-row preflight count.
   - `formula → single_select`: snapshot the computed value's text
     form, then run `substitute_labels` against the target option
     list (existing logic — same as `long_text → single_select`).
3. Extend `coerceCustomFieldType.computeLocalPreflight` to handle
   `formula` as source (read from the computed overlay) and as
   target (always-replace count).
4. Extend the backend `type_conversion` apply path to do the
   snapshot-on-formula-source operation: read the row's computed
   overlay, write the snapshot into `custom_values[field_key]`,
   drop the FieldDef's `formula_config`, change the `field_type`,
   re-run validation.
5. Formula editing on `record_id`:
   - The `record_id` FieldDef's `locked` array on Rooms is
     `["display_name", "delete", "duplicate"]` — `"formula"` is
     **not** in the lock list. Phase 3's modal lights up the
     formula section.
   - Pumps' `record_id` is `text`, not formula. The user can
     convert it to formula (text → formula) via the new matrix
     entry; or convert any other unlocked-`field_type` built-in to
     formula similarly.
6. Catalog-origin awareness:
   - `refresh-from-catalog` (US-WIN-11) consults each project field's
     current `field_type`. Fields whose live `field_type` differs
     from the catalog's typed shape are silently skipped in the
     refresh diff; the user sees a "skipped — field type changed"
     note next to those rows.
   - Catalog *pick* (initial copy) targets only locked-type fields
     in v1; Phase 1b already enforced this on document write. Phase
     3 keeps the rule and adds the refresh-time skip behavior.
7. Audit-log entries: every type-change mutation logs
   `project_version_field_change_type` with per-row before/after
   values. The existing custom-field audit shape extends; the kind
   key was already renamed in Phase 1b.
8. Update the field-config modal's TypeChange section to render the
   formula-target preflight differently from a normal lossy
   preflight: the message reads "Authoring a new formula will
   replace 14 existing values" rather than the lossy "14 values will
   be cleared." Distinct copy keys; same ack mechanism.
9. Update the field-config modal's Formula section so authoring a
   new formula on a previously-non-formula field disables the
   inline-edit path until the user acks the destructive preflight
   (single ack covers both type change + formula author in one
   gesture).
10. Documentation:
    - `context/technical-requirements/data-table.md`: document the
      formula entries in the conversion matrix.
    - `context/technical-requirements/data-model.md §6.6`: update
      the matrix description to include formula source/target.

### P2.2 Out of scope (deferred)

- New built-in seed FieldDef lists for tables beyond Rooms / Pumps →
  Phase 4.
- Catalog tables' lock-list audit → Phase 4.
- "Duplicate record" right-click action → Phase 5.
- Lossy-conversion completion toast → Phase 5 (optional polish).
- Visual treatment of locked attributes (muted icon on section
  headings) → Phase 5 (optional polish).

## P3. Rules & Constraints

1. **Locked-type fields still reject type changes.** Phase 3 unlocks
   the type picker only on FieldDefs whose `"field_type"` lock is
   absent. `icfa_factor`, `floor_level`, `building_zone`,
   `device_type`, `phase`, `link`, etc. stay locked; the picker is
   disabled with the "Field Locked" tooltip.
2. **Conversion matrix is the closed truth.** Pairs absent from the
   matrix remain forbidden — the target option in the picker
   renders disabled with the existing tooltip. The frontend
   `typeConversionMatrix.ts` and the backend `CONVERSION_MATRIX`
   must agree byte-for-byte (existing rule; Phase 3 just adds new
   entries to both).
3. **`record_id`'s `formula` lock is absent by default** on tables
   where `record_id`'s seed is a formula (Rooms). On tables where
   `record_id`'s seed is plain text (Pumps), the lock list is the
   same `["display_name", "delete", "duplicate"]`; the user can
   convert text → formula through the new matrix entry.
4. **Snapshot semantics for `formula → primitive`:**
   - The snapshot runs once at the moment of the type change.
   - The previously-stored `formula_config` is removed from the
     FieldDef.
   - Snapshot values land in `custom_values[field_key]` (matches
     the storage shape for any other custom-value field).
   - Future cell edits write to `custom_values` directly; the
     formula evaluator no longer runs on this field.
5. **`primitive → formula` discards data without recovery.** The
   preflight surfaces the count of non-empty rows that will be
   replaced. The user acks. The previously-stored cell values are
   dropped (not archived). This matches AirTable behavior and the
   PRD §P4.5 contract.
6. **Audit-log entries include per-row before/after** for type
   changes on built-ins as well as customs. The action-log payload
   shape is uniform across origins.
7. **Catalog refresh skips mutable-type-mismatched fields silently
   in the diff stage.** The refresh UI surfaces the skip with a
   per-row note ("Skipped — field type changed in this project");
   the catalog row isn't applied. This is the only place the
   per-row note exists; in the normal grid view it's just a regular
   field.
8. **R-S2 / R-S3 concurrency guards continue to work.** The existing
   external-edit and row-mutation-during-preflight handling fires
   the same way for built-ins as for customs.
9. **No new schema-version bump.** Phase 3 is a pure
   capability-extension — the wire format does not change. New
   matrix entries don't change `ProjectDocumentV1`'s shape.

## P4. Workstreams

### P4.1 Conversion matrix extension (frontend + backend)

- Add the new row/column entries to `CONVERSION_MATRIX` on both
  sides.
- Add the `formula → primitive` policies (`"lossless"` for text;
  `"lossy"` for number / url; `"substitute_labels"` for
  single_select).
- Add the `primitive → formula` policies (introduce a new
  `ConversionPolicy` variant if the existing four don't fit — a
  candidate name: `"discard_then_author"`; covers
  `short_text / long_text / number / url / single_select → formula`).
- Round-trip a fingerprinted test fixture through the matrix on
  both sides to confirm byte-equivalence.

### P4.2 Apply path (backend)

- `type_conversion.py` grows two new branches:
  - `formula → primitive`: read computed overlay, run target-type
    coercion, build cell writes.
  - `primitive → formula`: synthesize the new
    `formula_config` from the user-supplied source (existing
    `setFormula` parse/resolve/cycle-check), build cell writes that
    null out the previously-stored `custom_values[field_key]`.
- `formula_ops.py` already handles formula source parsing; reuse it.
- `bundle.py` (the `EditFieldBundleMutation` dispatcher) routes
  `formula_source` + `acknowledge_destructive` per the new policies.

### P4.3 Preflight (frontend)

- `coerceCustomFieldType.computeLocalPreflight` handles `formula`
  source: walks the computed overlay (passed in as the source-row
  view), produces the same `{ compatible, incompatible }` shape.
- Same for `formula` target: every non-null row counts as
  "incompatible" (the value will be discarded), so the preflight
  count is always = `rows.filter(r => sourceVal(r) !== null).length`.

### P4.4 Modal copy + UX

- TypeChange section: new copy keys for the formula-target
  preflight ("Authoring a new formula will replace N existing
  values"). Frontend i18n / copy file updates.
- Formula section: when authoring a new formula on a
  previously-non-formula field, render the destructive preflight
  inline (or above the Save button) so the ack is visible.

### P4.5 Phase 1a hard rule removal

- Find every site where the type picker / type-change ack is hard-
  coded "disabled on built-ins regardless of lock-list." Remove
  the override; let the lock-list checks run as the sole gate.
- Confirm `record_id`'s formula section enables on Rooms and the
  modal's `formula → text` conversion lands cleanly.

### P4.6 Catalog refresh

- `refresh-from-catalog` diff stage consults each project field's
  current `field_type` from the persisted FieldDef list. If a
  project field's type differs from the catalog row's type, the
  diff entry for that field carries a `skip_reason:
  "field_type_changed"` flag.
- Refresh UI renders skipped fields with the explanatory note.
- Refresh apply path does not touch skipped fields.

### P4.7 Audit-log payload

- `project_version_field_change_type` entries include the
  per-row before/after values (or a representative sample if the
  affected row count exceeds the existing payload-size limit; pick
  a sane cap — e.g. 100 rows — and add a `truncated: true` flag
  beyond it).

### P4.8 Docs

- `data-table.md`: add the formula matrix entries.
- `data-model.md §6.6`: same.

## P5. Evaluation Method

### Backend
- **Matrix-conformance test:** the new entries match frontend
  byte-for-byte (existing pattern; Phase 3 extends).
- **Snapshot test (formula → text):** load a Rooms project with a
  `record_id` formula; convert `record_id` to text; assert each
  row's stored `custom_values["record_id"]` matches the computed
  overlay's text at the moment of conversion.
- **Snapshot test (formula → number) — happy path:** numeric
  formula result snapshots as number.
- **Snapshot test (formula → number) — null path:** non-numeric
  formula result snapshots as null; the row lands in the
  incompatible-row preflight count.
- **Discard test (text → formula):** previously-stored cell values
  are gone from `custom_values` after the conversion.
- **Acknowledge-destructive test:** missing ack → structured 422
  with the inline preflight payload; ack present → conversion
  proceeds.
- **Audit-log test:** type-change on a built-in writes
  `project_version_field_change_type` with per-row before/after.
- **Cycle test:** a `primitive → formula` where the new formula
  references itself (or another formula that references it back)
  fails with the existing cycle error.

### Frontend
- **Local preflight test (formula → text):** preflight reads the
  computed overlay; incompatible-row count is 0 (text is always
  lossless from formula).
- **Local preflight test (formula → number):** rows whose
  computed value doesn't parse as number land in the incompatible
  set.
- **Modal UX test:** opening the modal on Rooms' `record_id` shows
  the formula section enabled; typing a new formula source +
  saving updates the rendered identifier.
- **Catalog refresh test:** load a catalog refresh diff where one
  project field has a changed type; confirm the diff entry shows
  the skip note and the apply step doesn't touch the field.

### End-to-end
- **Playwright (Rooms):** open `Number` modal; change type from
  text → number; ack the preflight; save; cells re-render as
  numbers; row that had "R-101A" shows null with the
  incompatible-row affordance.
- **Playwright (Rooms `record_id`):** open the modal; edit the
  formula source from `"{Number} — {Name}"` to `"Room {Number}:
  {Name}"`; save; the pinned column re-renders with the new
  format.
- **Playwright (Pumps):** convert `record_id` from text to
  formula `"{Manufacturer}-{Model}"`; ack the preflight; save;
  the pinned column re-renders.
- **Playwright (catalog refresh):** a project where the user has
  changed `manufacturer` type from text to number on a Materials
  row (synthetic test setup); run refresh; that field is skipped
  with the explanatory note.

## P6. Success Criteria (Gating)

Phase 3 is done when **all** of the following are true:

1. The Phase 1a hard rule ("type picker disabled on built-ins
   regardless of lock-list") is removed. The picker's enabled
   state derives entirely from `"field_type"` lock presence.
2. `CONVERSION_MATRIX` (frontend + backend) covers every cell in
   PRD §P4.5's table. Backend / frontend matrices match byte-for-
   byte.
3. A user can convert `Number` (Rooms, text) to `number` via the
   modal; the conversion runs through the existing matrix preflight
   and lands.
4. A user can edit Rooms' `record_id` formula source through the
   modal; the rendered identifier updates immediately.
5. A user can convert Pumps' `record_id` from text to formula
   through the new matrix entry; the ack-destructive preflight
   shows the row count and the conversion lands.
6. A user can convert a formula field back to text / number / url /
   single_select; the computed value at the moment of conversion is
   snapshotted into `custom_values[field_key]`.
7. Locked-type fields (`icfa_factor`, `floor_level`, `phase`, …)
   still reject type changes with the "Field Locked" tooltip.
8. The catalog refresh flow surfaces skipped fields with the
   explanatory note when the project field's `field_type` differs
   from the catalog's typed shape.
9. Audit-log entries for type changes on built-ins include
   per-row before/after under the renamed
   `project_version_field_change_type` kind.
10. `context/technical-requirements/data-table.md` and
    `context/technical-requirements/data-model.md §6.6` document
    the formula matrix entries.
11. Test suite green; Playwright smoke green.

## P7. Risks & Mitigations

- **Risk:** Frontend / backend matrix drift (one side ships a new
  entry but the other doesn't).
  - **Mitigation:** byte-equivalence test in CI for the matrix
    payload across both languages, run with the same JSON
    serialization.
- **Risk:** Snapshotting `formula → number` against a computed
  overlay that's stale (e.g. evaluator hasn't re-run after a recent
  cell write).
  - **Mitigation:** the apply path re-evaluates the formula one
    last time on the live document before snapshotting. Existing
    `evaluate_table_formulas` is fast enough; one extra pass is
    fine.
- **Risk:** `primitive → formula` discards user data with no
  recovery, and the user only acks because the count is small.
  - **Mitigation:** the destructive preflight has its own copy
    ("Replace 14 existing values with a computed expression?") and
    the existing audit log retains the previous values for
    after-the-fact recovery (US-C1 retention rule).
- **Risk:** A formula field is converted to text and the snapshot
  lands as a localized number string (e.g. `"1,234.56"` in a locale
  that uses comma separators), breaking downstream parsers.
  - **Mitigation:** the snapshot serializer uses the
    project's SI / canonical representation (the same one the
    formula evaluator uses for numbers). No locale-aware
    formatting.
- **Risk:** Catalog refresh silently skips a field the user wanted
  refreshed.
  - **Mitigation:** the per-row "skipped — field type changed"
    note is visible and actionable. User can convert the project
    field back to the catalog's type and re-run refresh.
- **Risk:** `record_id`'s `formula` lock isn't absent on a
  consumer's seed list (e.g. Pumps mistakenly locks `formula` on
  `record_id`).
  - **Mitigation:** test asserts `formula` is not in `record_id`'s
    `locked` array on every table contract that opts into formula
    identifiers. Catalog and other text-only `record_id` tables
    explicitly do *not* assert this — they don't need formula
    editing.

## P8. Out-Of-Band Considerations

- The matrix extension touches the published JSON Schema if the
  schema currently exposes the conversion matrix shape (it
  shouldn't — the matrix is server-internal). Confirm before merge.
- Phase 3 unlocks a workflow the user has not previously had. The
  detail copy ("Authoring a new formula will replace N existing
  values") deserves a UX review with John before merge.

## P9. Follow-Ups Out Of This Phase

- Phase 4 picks up remaining tables; catalog tables especially want
  most fields' `"field_type"` locked to keep refresh coherent.
- Phase 5 (optional) lossy-completion toast and locked-section
  visual treatment.
- Long-term: archive snapshots of discarded values from
  `primitive → formula` conversions in the user-action-log for
  after-the-fact recovery beyond the existing audit retention.
  Out of v1 scope.
