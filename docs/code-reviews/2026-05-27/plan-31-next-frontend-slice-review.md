---
DATE: 2026-05-27
TIME: 08:25 ET
STATUS: REVIEW — code review of the work landed on
        `codex/plan-31-next-frontend-slice` (commits P2.2 → P2.6).
        Architectural moves are correct and net-simplifying; two HIGH
        findings (an unbuilt backend producer for the catalog-refresh
        skip surface, and test debt exceeding what P2.6 acknowledges)
        block merge. Production code typechecks clean.
AUTHOR: Claude (Opus 4.7)
REVIEWED: 11 commits on `codex/plan-31-next-frontend-slice`
          (`c0f874e` → `4c41c41`), ~12.8 kLOC diff vs `origin/main`.
SCOPE: Code review only. No implementation changes. Branch is held by
       a sibling worktree at
       `../ph-navigator-v2-plan31-next-frontend-slice`.
RELATED:
  - docs/plans/2026-05-26/editable-fields/plan-31-phase-3-frontend-bundle.md (slice plan)
  - docs/plans/2026-05-26/editable-fields/plan-31-customizable-fields-prd.md (master PRD)
  - docs/plans/2026-05-26/editable-fields/_complete/plan-30-datatable-identifier-column.md (predecessor)
  - docs/code-reviews/2026-05-26/plan-31-customizable-fields-prd-review.md (PRD review)
  - backend/features/project_document/refresh.py
  - backend/features/project_document/mutations/models.py
  - frontend/src/shared/ui/data-table/lib/identifier/recordId.ts
  - frontend/src/shared/ui/data-table/lib/customFieldAccessor.ts
  - frontend/src/features/equipment/lib.ts
  - frontend/src/features/equipment/lib/customValueReaders.ts
---

# Plan 31 — Next Frontend Slice — Code Review

## Scope

Eleven commits, ~12.8 kLOC diff vs `origin/main`. Slices P2.2–P2.6 of
the Plan-31 editable-fields migration:

- **P2.2** — equipment rows migrated to `row.custom_values`
- **P2.3** — `IdentifierConfig` deleted; pinning keyed on `record_id`
  FieldDef
- **P2.4** — built-in retype lock removed; conversion matrix expanded
  with formula entries
- **P2.5** — catalog-refresh skip surface added (frontend UX only —
  see H1 below)
- **P2.6** — partial test rewrite (one file only)

## Executive verdict

The architectural moves are right. The delta is a net simplification:
**−744 / +365 in the data-table core alone**, with `IdentifierConfig`,
`IDENTIFIER_COLUMN_ID`, `IDENTIFIER_HEADER_LABEL`, `__record_id__`,
the broken-identifier ERROR state, and the resolver module all
retired. The new `record_id`-as-FieldDef rule is enforced by a single
small file (`recordId.ts`, 75 lines), and the row-shape migration to
`custom_values` consolidates Rooms and Pumps onto the same accessor
surface.

But the branch is **not ready to merge as-is.** Two HIGH issues block
it (one half-built P2.5 feature, one broken-test debt that overflows
what the plan acknowledges) and several MEDIUM issues are worth
fixing now rather than letting calcify.

Production code (`pnpm exec tsc -b`) typechecks clean — all 150
tsc errors are in `__tests__/` fixtures, matching the documented
known-broken state.

## HIGH

### H1. P2.5 catalog-refresh skip surface is half-built — backend producer is missing

`backend/features/project_document/refresh.py:75,102` adds the
`RefreshSkipReason = Literal["field_type_changed"]` type and the
optional `skip_reason` field on `RefreshFieldDelta`, but **nothing
populates it**. `_slot_report` at `refresh.py:218-262` still
constructs every delta with `is_overridden=key in overrides` and no
type-mismatch branch — there is no comparison against the project's
`field_defs` anywhere on this branch.

The frontend UX (the "Skipped" pill, the disabled radio rows,
`canApplyRefresh` returning `false` when every field is skipped) only
fires from `RefreshDialog.test.tsx`'s hand-authored fixture. In real
use today, no field will ever carry `skip_reason`, so the new surface
is dead UI.

The plan doc at
`plan-31-phase-3-frontend-bundle.md:288-324` even admits "Spec gap:
backend response shape for 'field skipped' needs to be checked.
Investigate before writing the slice." The slice landed without that
investigation.

**Action:** either ship the backend producer (compare ref/catalog
field types against the project's `field_defs` for the table where
the ref's catalog field lives) before merging, or back out the FE
surface and split the bundle.

### H2. Test debt exceeds what the plan acknowledges

- **Backend:** 4 test modules **fail at collection**
  (`test_mcp_custom_fields.py`,
  `test_project_document_custom_fields_phase_2.py`,
  `test_project_document_custom_fields_phase_4.py`,
  `test_project_document_schema_mutation_endpoint.py`) due to a
  missing `ROOMS_CORE_FIELD_KEYS` import. Once those are excluded,
  the suite still reports **41 failed tests** across multiple modules
  — `test_project_document_pumps.py`,
  `test_project_document_window_types.py`, plus others. The plan's
  P2.6 only names `test_project_document_schema_mutations.py` (which
  is fixed and passes 56/56), but it left these other modules behind.

- **Frontend:** equipment suite is **35 failed / 28 passing across 10
  files**, with stale `roomsTableFieldDefs`, `slice.custom_fields`,
  typed `RoomRow.number` references everywhere. Overall frontend:
  **42 failed / 889 passing / 12 files red**. The plan-31 doc
  explicitly admits this as accepted state until P2.6 lands fully —
  but the slice that landed (`4c41c41` "Simplify P2.6 schema mutation
  fixtures") only fixed one backend file.

The production code itself typechecks clean (`tsc -b` shows no
production errors — all 150 errors are in `__tests__/`). So **the
work landed safely but the test cleanup that P2.6 was supposed to do
is largely outstanding**. The PR cannot merge to main with the suite
this red; the bundle needs a real P2.6 pass that touches more than
one file.

### H3. Hardcoded `"record_id"` literals in equipment production code defeat the centralization

`frontend/src/shared/ui/data-table/lib/identifier/recordId.ts:4`
exports `RECORD_ID_FIELD_KEY = "record_id"` as the single source of
truth. The data-table layer uses it correctly. But the equipment
feature still inlines the raw string four times in production:

- `frontend/src/features/equipment/lib.ts:93` (column-key list)
- `frontend/src/features/equipment/lib.ts:292` (`sortedPumps`
  accessor)
- `frontend/src/features/equipment/lib.ts:798`
  (`normalizePumpForPayload`)
- `frontend/src/features/equipment/lib/buildEmptyPumpRow.ts:21`
  (default seeding)

Plus the object-key form `record_id:` in the overlay registries at
`lib.ts:106,167,236` and `buildEmptyPumpRow.ts:18` (those would need
computed-property syntax to use the constant).

The PRD calls out "record_id is a reserved field_key" — exactly the
kind of value that should not appear inline. A rename in the future
would silently miss these. The simplify commit `c845fbc` claimed to
centralize this; it missed the equipment side.

## MEDIUM

### M1. `customValueReaders` vs `getCustomValue` — two helper sets for one storage bag

`frontend/src/features/equipment/lib/customValueReaders.ts` provides
`customTextValue` / `customTextValueOrNull` / `customNumberValue`
that wrap the data-table layer's `getCustomValue` with safe coercion.
Inside the equipment feature, both are used: `RoomsTable.tsx:93`
reads custom fields with raw `getCustomValue`, while built-in mutable
fields at `:108-130` use the coercing readers. Same data path,
different safety guarantees — a custom field of type `number` typed
in by the user could come back as a string from formula coercion,
but the raw-`getCustomValue` codepath has no coercion. Pick one
helper surface for the feature.

### M2. Three-copy duplication of the built-in bag field key set

The set "which built-in fields live in `custom_values`" is repeated
three times in `equipment/lib.ts`:

- `ROOM_CUSTOM_VALUE_FIELD_KEYS` (`:96`) and
  `PUMP_CUSTOM_VALUE_FIELD_KEYS` (`:97-107`)
- `emptyRoom()` / `emptyPump()` (`:223-249`)
- `normalizeRoomForPayload()` / `normalizePumpForPayload()`
  (`:780-810`)

And again in `buildEmptyRoomRow.ts:26-36` and
`buildEmptyPumpRow.ts:11-43`. A single registry
`ROOM_BUILT_IN_BAG_FIELDS: { key, type, default }[]` would derive all
of these from one source — this becomes painful the moment a
built-in field gets added or removed.

### M3. `applyWriteToPump` has no `customFieldKeys` allowlist

`applyWriteToRoom` (`lib.ts:741-755`) accepts `customFieldKeys` and
silently drops writes to unknown `cf_*` keys (covered by a test).
`applyWriteToPump` (`:770-789`) only gates on
`PUMP_CUSTOM_VALUE_FIELD_KEYS` and has no equivalent guard for
unknown `cf_*` keys. Either Pumps doesn't yet support custom fields
(intentional gap) or this is a parity bug. Either way, document the
intent inline.

### M4. `getCustomValue` semantics were widened silently

`customFieldAccessor.ts:13-18` no longer rejects non-`cf_*` keys.
The file comment was updated, but the function name still says
"Custom" and `isCustomFieldKey` is exported from the same module —
confusing. Consider either renaming to `getFieldValue` / `setFieldValue`
(the storage bag is `custom_values` but every FieldDef now reads
through this helper) or splitting built-in writes through a separate
helper. The new test asserts the wider semantics, so this is
intentional — flagging for clarity.

### M5. `override-badge` CSS class reused for "Skipped" — semantically wrong

`RefreshDialog.tsx:41-42` renders both `<span className="override-badge">Override</span>`
and `<span className="override-badge">Skipped</span>` — same class,
different concepts (user-modified vs system-skipped). Add a sibling
`.refresh-skipped-badge` or generalize to `.refresh-field-tag` with
modifiers.

### M6. No skip-count summary in the dialog

When some fields are skipped, the only signal is the inline per-row
pill. There's no aggregate "N of M fields cannot refresh because
their type changed" line. Users will not understand why some
Update-from-catalog radios are disabled.

### M7. `roomFingerprint` blob-stringifies `custom_values` without key sort

`equipment/lib.ts:864-873` stringifies `room.custom_values` as one
JSON blob to detect "active room changed remotely." JS object
iteration order is preserved for string keys in practice, but the
fingerprint is fragile — adding a new `cf_*` key from any path
produces a `roomFingerprint` change. Worth a short comment or a
sorted serialization.

### M8. `roomsTableColumnsForSanitize` mapping is fragile

`equipment/lib.ts:142-148` hand-maps two single-select fields to
physical column ids; every other field is `fieldDef.field_key`. If
someone adds a column whose `id` in `RoomsTable.tsx` doesn't match
the field_key, drag-reorder will silently break and the existing
regression test (`lib.test.ts:454-471`) won't catch it because that
test only verifies the current mapping. Consider deriving sanitize
columns from the real column registry.

## LOW

### L1. `coerceCustomValue(_, "formula")` returns `{ok: true, value: null}`

`coerceCustomFieldType.ts:133` — a category violation for a "coerce"
function. Add a docstring noting this is the discard policy, not a
real coercion. The preflight short-circuits before reaching this
branch in practice.

### L2. `roomsFormulaRegistry.ts` simplification dropped the only doc of an invariant

The old `ROOMS_FORMULA_FIELD_ID_BY_COLUMN_KEY` map carried a comment
explaining `rooms.floor_level → floor_level`. The new pass-through
assumes "field_key === formula_id" without naming where that
invariant was established. Add `// Rooms field_keys equal backend
formula field_ids since Phase 1b rename`.

### L3. `emptyPump()` initializes `record_id: null` in `custom_values`

`lib.ts:236` — if `record_id` is supposed to be a *formula* on Pumps
(PRD §P4.6), pre-seeding `null` in the bag could collide with the
formula evaluator. Verify against backend Pump default-row.

### L4. Stale "Plan 30 D13" / "Plan 30 D5" references in comments

E.g., `GridBody.tsx:241` points to a now-superseded plan. Either
remove the reference or update to plan-31 §P2.x.

### L5. `MAX_DUPLICATE_ROW_NUMBERS = 3` is implicit

`recordId.ts:46`'s loop guard. A named constant would be one-line
clearer.

### L6. `describeDuplicateRows` is untested directly

Only exercised via the chip render. Pure-function tests would be
cheap.

### L7. `RefreshDialog.test.tsx` is happy-path only

One mixed-case test. Missing: all-skipped → Apply disabled;
zero-skipped → no pill rendered; `source_deactivated` × `skip_reason`
interaction.

### L8. `coerceCustomFieldType.test.ts` covers matrix parity only

By string-compare. No behavioral tests for the `formula → X`
direction (`lossless`, `lossy`, `create_options` branches). A
regression in the formula source-side preflight wouldn't be caught.

### L9. `HeaderContextMenuProps` declares `onFilterBy` / `onGroupBy` optional

`HeaderContextMenu.tsx:37-38` — `HeaderActionHandlers` requires
them. Inconsistency rather than bug — only `GridHeader` consumes
both, and it always supplies them.

### L10. `*FieldOverlay` lock lists need a header comment

`equipment/lib.ts:101-138` and `:163-203` — the inline
`// icfa_factor ∈ [0, 1]` and URL-validator notes are great. The
blanket `DEFAULT_BUILT_IN_LOCKS` cases (`name`, `manufacturer`, etc.)
have no comment. A header "these accept the default lock set; rename
ok, delete/duplicate forbidden" would let a reader skim past 80% of
rows.

## What's clean

- `IdentifierConfig`, `IDENTIFIER_COLUMN_ID`,
  `IDENTIFIER_HEADER_LABEL`, `__record_id__`, the broken-identifier
  error glyph, the `resolve.ts` resolver — **all gone**, no orphan
  imports.
- CSS cleanup is real: `.data-table-header-warning` removed;
  `.data-table-identifier-duplicate` retained with updated comment.
  The DataTable.css doesn't have orphan classes.
- `paste/plan.ts`, `view/sanitize.ts`, `useGridClipboard.ts`,
  `useGridColumns.ts` simplifications fall out naturally because
  `record_id` is now a normal column rather than a synthetic.
- `FieldConfigModal` correctly drops the Phase-1a hard
  `isBuiltInField` lock and falls back to per-attribute
  `locked: ["field_type"]`. Test asserts both rules.
- Conversion matrix parity is **exact**: 25 entries byte-match the
  backend `CONVERSION_MATRIX` in `mutations/models.py:79`.
- `recordId.ts` and `customValueReaders.ts` are small, well-commented
  modules. `recordId.ts` explains WHY each function exists (the
  "Empty / whitespace identifiers do not warn" comment is the kind
  of WHY the CLAUDE.md guidance calls for).
- The slice ordering in the plan doc (P2.1 → P2.6) was correctly
  followed; each commit has a clear "Known-broken until P2.6"
  disclosure.

## Recommendations, ordered

1. **Land H1 (backend producer for `skip_reason`)** before merge, or
   back the FE surface out.
2. **Do a real P2.6 sweep** of the broken backend modules
   (`test_mcp_custom_fields.py`, `test_project_document_pumps.py`,
   `test_project_document_window_types.py`, the three custom_fields
   phase modules) and the 10 broken frontend equipment test files.
   The plan owns this; it hasn't been executed.
3. **Fix H3** — 5-minute change: import `RECORD_ID_FIELD_KEY` into
   `equipment/lib.ts` and `buildEmptyPumpRow.ts`, replace the four
   string literals.
4. **Address M2** — collapse the three copies of
   `ROOM/PUMP_CUSTOM_VALUE_FIELD_KEYS` into one registry. Will save
   real pain on the next built-in field add/remove.
5. **Address M5 / M6** — refresh dialog UX touches before users see
   "Skipped" pills with no aggregate explanation.
6. Sweep the LOW items as opportunistic cleanup — none block merge.

## Verification commands used during the review

```sh
# Branch state
git log codex/plan-31-next-frontend-slice --not main --stat

# Production code typecheck (in the worktree)
cd ../ph-navigator-v2-plan31-next-frontend-slice/frontend \
  && pnpm exec tsc -b --pretty false 2>&1 \
  | grep -v "__tests__\|\.test\."   # → 0 production errors

# Frontend test state
cd ../ph-navigator-v2-plan31-next-frontend-slice/frontend \
  && pnpm exec vitest run            # → 42 failed / 889 passing

# Backend test collection
cd ../ph-navigator-v2-plan31-next-frontend-slice/backend \
  && uv run pytest --collect-only -q # → 4 modules fail at import

# Backend test state (excluding broken-at-import)
cd ../ph-navigator-v2-plan31-next-frontend-slice/backend \
  && uv run pytest \
       --ignore=tests/test_mcp_custom_fields.py \
       --ignore=tests/test_project_document_custom_fields_phase_2.py \
       --ignore=tests/test_project_document_custom_fields_phase_4.py \
       --ignore=tests/test_project_document_schema_mutation_endpoint.py \
       -q                            # → 41 failed / 334 passed

# Hardcoded record_id audit (production only)
cd ../ph-navigator-v2-plan31-next-frontend-slice/frontend \
  && grep -rn '"record_id"' src/ \
       --include='*.ts' --include='*.tsx' \
  | grep -v "__tests__\|\.test\."    # → 5 hits, 4 are H3 violations
```
