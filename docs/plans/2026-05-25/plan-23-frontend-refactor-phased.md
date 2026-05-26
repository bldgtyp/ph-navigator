---
DATE: 2026-05-25
TIME: planning (multi-PR phased implementation)
STATUS: Proposed. Phased refactor of the frontend ahead of the next
        feature wave (ERV/Pumps/Fans/Thermal-Bridge DataTables,
        Windows/Assemblies builder pages, 3D-Model-Viewer feature).
        Each phase below is a single reviewable PR that lands on
        `main` independently. Ordering reflects "cheapest wins first,
        then the leverage abstractions, then large file splits,
        then convention cleanup."
PARENT-DOC: docs/code-reviews/2026-05-25/frontend-code-review.md
SIBLING-DOC: docs/plans/2026-05-25/plan-22-backend-refactor-phased.md
RELATED:
  - context/CODING_STANDARDS.md (frontend section)
  - context/PRD.md
  - context/TECH_STACK.md
  - frontend/src/shared/ui/data-table/DataTable.tsx (1,219 lines — split target)
  - frontend/src/shared/ui/data-table/lib.ts (1,189 lines — split target)
  - frontend/src/features/equipment/routes/EquipmentTab.tsx (785 lines — controller extraction target)
  - frontend/src/features/project_document/components/VersionControls.tsx (727 lines — split target)
  - frontend/src/features/windows/routes/WindowsTab.tsx (557 lines — 7-component split target)
  - frontend/src/App.css (4,085 lines — per-feature split target)
---

# Plan 23 — Frontend Refactor (Phased)

## 0. Why

The frontend code-review at `docs/code-reviews/2026-05-25/frontend-code-review.md`
identified seventeen prioritized issues across SRP violations, cross-
feature duplication, hard-coded CSS spacing/z-index, feature-shape
inconsistency, and complex hook composition. Three are structurally
urgent because the next feature wave will land directly on top of the
affected files:

- **ERV / Pumps / Fans / Thermal-Bridge DataTables** will copy the
  current `EquipmentTab.tsx` (785 lines) pattern. Without a shared
  `useSliceTableController` abstraction, four new feature tabs add
  ~3,000 lines of near-identical orchestration that all five tabs
  then have to maintain.
- **Windows / Assemblies builder pages** will mirror the current
  `WindowsTab.tsx` shape. That file currently packs 7 components
  into a single 557-line file with no `components/` directory —
  Assemblies should not inherit that anti-pattern.
- **3D-Model-Viewer** will add ~800 lines of viewer chrome CSS and
  a new overlay/HUD/tooltip layer that fights for `z-index` with
  modals and popovers. The 35 untokenized `z-index` literals and
  the 4,085-line `App.css` need to be addressed first.

The remaining items are smaller correctness, consistency, and
maintainability fixes. They are batched into thematic PRs that are
safe to land in any order after Phase 1.

This plan is **structural only** — no behavior changes, no new
features, no API contract changes. Every phase preserves user-visible
behavior, TanStack Query keys, view-state shapes, and audit semantics.

## 1. Goal

After all phases land:

- A generic `useSliceTableController<TSlice, TRow>` hook owns the
  draft / conflict / write-dispatch / schema-mutation orchestration.
  `EquipmentTab.tsx` is ~150 lines composing it; ERV/Pumps/Fans/TB
  follow the same template.
- `shared/ui/data-table/lib.ts` (1,189 lines, 63 exports) is replaced
  by `shared/ui/data-table/lib/{filter,sort,range,paste,fill,body,options}/`.
- `WindowsTab.tsx` is ~150 lines; its five inline components live in
  `features/windows/components/`.
- `VersionControls.tsx` is ~250 lines; its inline dialog and 9 useState
  declarations have moved into `components/DocumentConfirmationDialog.tsx`,
  `hooks/useVersionControlsState.ts`, and `hooks/useDraftLifecycle.ts`.
- Every `features/<feature>/` follows the same shape: `api.ts`,
  `hooks.ts`, `types.ts`, `query-keys.ts`, `lib.ts`, `routes/`,
  `components/`.
- `App.css` (4,085 lines) is split into per-feature stylesheets co-
  located with their feature.
- `--z-*`, `--space-*`, and `--shadow-elev-*` token ramps exist and
  the 35 raw `z-index` values use them.
- A CI guard fails any frontend file over 500 lines without a
  documented exception.

## 2. Verification (applies to every phase)

Every PR is done only when **all** of the following pass:

1. `cd frontend && pnpm run build`
2. `cd frontend && pnpm test`
3. `cd frontend && pnpm run lint`
4. `cd frontend && pnpm run format:check`
5. `make smoke` from repo root.
6. `make e2e` (Playwright) — should be unchanged, since no UI
   behavior changes.
7. `git diff` shows no changes to TanStack Query key shapes
   (verify by grepping for `queryKey:`, `*QueryKeys.`).
8. Manual smoke via Playwright MCP on the affected feature(s) —
   run through golden path + the edge cases listed in the phase's
   §V.

Each phase additionally lists phase-specific verification under
its own §V.

## 3. Phase Ordering & Dependencies

### 3.1 Recommended Execution Order

**Land the PRs in this order:**

| Execute | Phase | Title | Rationale |
|---|---|---|---|
| **1st** | Phase 7 | Naming, sentinels, ID-prefix constants | Cheapest wins, smallest review surface, no risk |
| **2nd** | Phase 6 | Feature-shape standardization | Locks in the four/seven-layer pattern before any new feature lands |
| **3rd** | Phase 1 | Split `data-table/lib.ts` into `lib/{concern}/` | Pure file move; prerequisite for Phase 2 import targets |
| **4th** | Phase 2 | Extract `useSliceTableController` + split `EquipmentTab.tsx` | **Biggest leverage** — must precede ERV/Pumps/Fans/TB tabs |
| **5th** | Phase 3 | Split `WindowsTab.tsx` into `components/` | Must precede Assemblies builder |
| **6th** | Phase 4 | Split `VersionControls.tsx` + extract state machine | Independent; do before more modals stack |
| **7th** | Phase 5 | CSS tokenization + per-feature CSS split | **Must precede** 3D-Model-Viewer |
| **8th** | Phase 8 | CI guards (file size, module shape) | Locks in everything above |

### 3.2 Dependency Map

```
Phase 7 (naming/sentinels) ──────────┐
                                     │
Phase 6 (feature shape) ─────────────┤
                                     │
Phase 1 (lib.ts split) ──────────────┼── prerequisite for Phase 2
                                     │
Phase 2 (slice controller) ──────────┤── unblocks ERV/Pumps/Fans/TB
                                     │
Phase 3 (WindowsTab split) ──────────┤── unblocks Assemblies builder
                                     │
Phase 4 (VersionControls split) ─────┤
                                     │
Phase 5 (CSS tokens + split) ────────┤── unblocks 3D-Model-Viewer
                                     │
Phase 8 (CI guards) ─────────────────┘── locks in conventions
```

- Phases 1, 3, 4, 5, 6, 7 are independent at the file level — any
  can be done first if circumstances require it. The execution order
  in §3.1 is the recommended sequence, not a hard dependency chain.
- **Hard constraints** (not just recommendations):
  - **Phase 1 must precede Phase 2.** The slice controller imports
    from the new `lib/filter`, `lib/range`, etc. paths.
  - **Phase 2 must land before the next DataTable-based feature tab
    (ERV / Pumps / Fans / Thermal-Bridge).** Otherwise each new tab
    inherits the 785-line `EquipmentTab.tsx` template.
  - **Phase 3 must land before the Assemblies builder starts.**
    Assemblies will mirror the Windows shape.
  - **Phase 5 must land before the 3D-Model-Viewer starts.** The
    viewer adds new overlay/HUD/tooltip layers that compete with
    modals and popovers for `z-index`; tokenizing first prevents a
    bug that only surfaces at viewer launch.
  - **Phase 8 should be last.** Earlier phases are easier to land
    without the size guard fighting in-progress moves.

---

## Phase 1 — Split `shared/ui/data-table/lib.ts` *(execute 3rd)*

### 1.1 Scope

Replace `frontend/src/shared/ui/data-table/lib.ts` (1,189 lines,
63 exports) with a concern-grouped sub-package under
`shared/ui/data-table/lib/`. Pure structural refactor — every
function, type, and constant moves to a new file unchanged.

### 1.2 Target Layout

```
shared/ui/data-table/lib/
    index.ts              # re-export the same public surface as today's lib.ts
    filter/
        apply.ts          # applyFilters, defaultOperatorForField
    sort/
        sortRows.ts       # sortRows, compareSingleSelectValues, optionSortRank
    range/
        normalize.ts      # NormalizedRange, normalizeRange, isCellInRange,
                          # isCellInNormalizedRange, clampCellCoord, clampRange
        edgeBits.ts       # EdgeBits, computeEdgeBits
        move.ts           # moveActiveCell, nextCell
    paste/
        tsv.ts            # rangeToTsv, rangeToHtml, parseTsv, formatClipboardValue,
                          # formatClipboardCellValue, escapeHtml
        plan.ts           # planPaste, CoercePasteResult, coercePasteWrites
    fill/
        axis.ts           # FillAxis, FillDirection, chooseFillAxis, chooseFillDirection
        target.ts         # buildFillTargetFromPointer, clampRangeToGroup, splitRangeByGroup
        plan.ts           # PlanFillResult, planFill
    body/
        plan.ts           # buildBodyPlan, resolveGroupRules, isAncestorCollapsed,
                          # groupPathKey, isPathFullyExpanded, firstDivergeIndex,
                          # groupPathByRowIdFromBodyPlan
        aggregates.ts     # computeAggregatesByPath
        prune.ts          # pruneExpandedGroups
    options/
        create.ts         # OPTION_COLOR_PALETTE, createFieldOption,
                          # nextOptionColor, nextOptionOrder, normalizeOptionLabel
        references.ts     # optionReferenceCounts, missingOptionReferences,
                          # findFieldOptionByLabel, hasDuplicateFieldOptionLabels
        normalize.ts      # normalizeOptionOrders
    rows/
        defaults.ts       # extractRowDefaults, buildEmptyRowDefaults, naturalZero,
                          # coerceFieldValue
        format.ts         # formatDisplayCellValue, singleSelectOption
    view/
        sanitize.ts       # sanitizeViewStateForSchema, effectiveSortFromView
    internal/
        fieldDefForColumn.ts
        fieldKeyFieldDefMap.ts
        fieldKeyColumnMap.ts
```

### 1.3 Additionally in this PR

- `mapToFormulaType` from `EquipmentTab.tsx:731` moves to
  `shared/ui/data-table/lib/formula/mapToFormulaType.ts`. Every
  feature tab will need it.
- `insertAfterColumnOrder` from `EquipmentTab.tsx:771` moves to
  `shared/ui/data-table/lib/view/columnOrder.ts`. Also feature-
  agnostic.
- `lib.ts` becomes a 5-line re-export shim from `lib/index.ts` for
  one release cycle; delete in Phase 1.5 (separate PR).

### 1.4 Backward-compatibility shim

`lib/index.ts` re-exports the entire public surface of today's
`lib.ts` (verify by `git diff` of the export list). Existing
imports — `from "./lib"` or `from "../lib"` — keep working. Within
this PR, update internal `data-table/` callers to import from the
new concrete paths; leave external callers (route files, hooks)
on the shim. Phase 1.5 migrates those and deletes the shim.

### 1.5 Verification (phase-specific)

- `git grep -E "from .*data-table/lib(\b|/index)"` — every hit
  is either the shim or a deliberately retained import.
- `cd frontend && pnpm test --filter "data-table"` — all pass with
  zero changes.
- No file under `lib/` exceeds 300 lines. (Stretch: no file
  exceeds 200.)

### 1.6 Risks

- Largest single PR in the plan by file count (10+ new files,
  ~30 internal import updates).
- Mitigation: do the move in **one mechanical commit** (file
  moves + `lib/index.ts` shim only, no internal-import changes),
  then a second commit updating internal `data-table/` imports.
  Two commits in one PR makes review tractable. No logic edits
  in either commit.

---

## Phase 2 — Extract `useSliceTableController` and split `EquipmentTab.tsx` *(execute 4th)*

### 2.1 Scope

The highest-leverage change in this plan. Today, `EquipmentTab.tsx`
contains 785 lines of orchestration that ERV / Pumps / Fans /
Thermal-Bridge will all need verbatim. Extract that orchestration
into a generic hook + shell component, then rewrite `EquipmentTab`
as a thin composer (~150 lines) on top. This is the validation
implementation for the abstraction; the four new tabs that follow
will reuse the same pieces.

### 2.2 Target Structure

```
shared/ui/data-table/feature/
    useSliceTableController.ts    # NEW — generic orchestrator
    SliceTableShell.tsx           # NEW — banners, blockers, download menu,
                                  # conflict UI, locked banner, action error
    types.ts                      # NEW — SlicePayloadBuilders<TSlice, TRow>,
                                  # ConflictMessages, SliceTableController<TRow>
```

```ts
// shared/ui/data-table/feature/types.ts
export interface SlicePayloadBuilders<TSlice, TRow extends { id: string }, TPayload> {
  fromCellWrites(slice: TSlice, writes: CellWrite[],
                 newOptions: OptionDelta, removedOptions: OptionDelta): TPayload;
  fromRowInsert(slice: TSlice, rows: RowInsert[], build: BuildEmptyRow<TRow>): TPayload;
  fromRowDelete(slice: TSlice, rows: RowDelete[]): TPayload;
  validate(payload: TPayload): string | null;
  replaceOptions?(slice: TSlice, optionKey: string,
                  options: FieldOption[], replacements: Record<string, string | null>): TPayload;
  remoteSliceChangesActiveRow?(slice: TSlice, incoming: TSlice, activeRow: TRow): boolean;
}

export interface ConflictMessages {
  activeRowConflict: string;
  deleteConflict: string;
  versionLocked: string;
}
```

```ts
// shared/ui/data-table/feature/useSliceTableController.ts
export function useSliceTableController<TSlice, TRow extends { id: string }, TPayload>(args: {
  projectId: string;
  activeVersionId: string | null;
  accessMode: AccessMode;
  tableKey: string;
  slice: TSlice;
  coreFieldDefs: FieldDef[];
  fingerprintCoreFieldKeys: readonly string[];
  customFields: CustomFieldDef[];
  singleSelectOptions: SingleSelectOptions | null;
  payloadBuilders: SlicePayloadBuilders<TSlice, TRow, TPayload>;
  conflictMessages: ConflictMessages;
  formulaFieldRegistry: FieldRegistryEntry[];
  getFormulaRowValues: (row: TRow) => Record<string, unknown>;
  publishSlice: (slice: TSlice) => void;
  refetch: () => Promise<unknown>;
  replaceMutation: UseMutationResult<unknown, Error, ReplaceArgs<TSlice, TPayload>>;
  schemaMutation: UseMutationResult<unknown, Error, SchemaMutationArgs<TSlice>>;
}): SliceTableController<TRow>;
```

The returned controller exposes: `tableSchema`, `view`, `onViewChange`,
`onResetView`, `onWrite`, `handleAddCustomField`, `handleEditCustomFieldBundle`,
`handleDeleteCustomField`, `handleDuplicateCustomField`, `editBlocker`,
`actionError`, `canEdit`, `isLocked`, `buildEmptyRow`, `reloadDraft`.

### 2.3 Equipment Tab after split

```
features/equipment/
    routes/EquipmentTab.tsx              # ~150 lines: composes controller + RoomsTable + RoomModal
    lib/roomsController.ts               # SlicePayloadBuilders<RoomsSlice, RoomRow, RoomsPayload>
    lib/roomsFormulaRegistry.ts          # buildRoomsFormulaRegistry, buildRoomFormulaRowValues,
                                         # readRoomsFormulaValue, ROOMS_FORMULA_FIELD_ID_BY_COLUMN_KEY
    lib/collapseRoomCellWritesToReplacements.ts
    lib/roomIdPrefix.ts                  # ROOM_ID_PREFIX = "rm" (per §2.7 of review)
    lib.ts                               # existing — slim down; payload builders move
                                         # into lib/payloads.ts (already split candidate)
```

### 2.4 Additionally in this PR

- Move the `buildNextConfigForFieldTypeChange(source, request)` logic
  from `EquipmentTab.tsx:412–460` (`handleEditCustomFieldBundle`)
  into `shared/ui/data-table/lib/customFieldMutations.ts`. Every
  new feature tab would otherwise re-implement the same
  `delete nextConfig.precision` / `delete nextConfig.source`
  ceremony.
- Rename `schemaMutationMutation` → `roomsSchemaMutation`
  (per review §2.7).
- Replace `generatedId("rm")` with `generatedId(ROOM_ID_PREFIX)`
  pulled from the new `lib/roomIdPrefix.ts`.

### 2.5 Backward-compatibility / behavior preservation

This is a structural refactor — **the user-visible behavior of the
Equipment tab must be identical before and after**. Concretely:

- Every existing test under `features/equipment/__tests__/` must
  pass unchanged. Add no new tests in this PR (those land with the
  new ERV tab).
- The Playwright `make e2e` Rooms suite must pass unchanged.
- TanStack Query keys for rooms data are unchanged.
- View-state persistence shape (`view.columnOrder`, `view.hiddenColumns`,
  etc.) is unchanged.
- Audit-log payload shapes are unchanged (back-end concern, but
  spot-check by running a schema mutation and inspecting the
  request payload).

### 2.6 Verification (phase-specific)

- All existing `RoomsTable.*.test.tsx` tests pass unchanged.
- Playwright MCP smoke: create a new project, add a room via the
  modal, edit a cell, paste a 3×3 range, undo, add a custom
  single-select field, change a field type, delete a custom field,
  hide a column, group by floor level. All must work identically.
- `wc -l features/equipment/routes/EquipmentTab.tsx` ≤ 200.
- `wc -l shared/ui/data-table/feature/useSliceTableController.ts` ≤ 400.

### 2.7 Risks

- This is **the** load-bearing refactor in this plan. If the
  abstraction is wrong, fixing it later when 5 tabs depend on it
  costs 5×.
- **Mitigation:** before opening the PR, draft a one-page sketch
  of how the next tab (ERV — the simplest of the four) would
  consume the controller. If the sketch reveals the controller
  needs a leaky-abstraction prop, redesign first.
- **Mitigation 2:** the PR ships with `EquipmentTab` as the only
  consumer. The next-tab proof comes when ERV lands as a separate
  PR. If ERV needs the controller to grow, that's a follow-up to
  this plan — not a redesign of in-flight code.

---

## Phase 3 — Split `WindowsTab.tsx` into `components/` *(execute 5th)*

### 3.1 Scope

`features/windows/routes/WindowsTab.tsx` (557 lines) contains seven
components in one file. The Assemblies builder will mirror this
shape — split first so Assemblies gets a clean template.

### 3.2 Target Layout

```
features/windows/
    routes/WindowsTab.tsx                 # ~150 lines: composes the sub-components
    components/                           # NEW directory
        WindowTypeSidebar.tsx             # moved from WindowsTab.tsx:285
        WindowTypeDetail.tsx              # moved from WindowsTab.tsx:320
        WindowElementCard.tsx             # moved from WindowsTab.tsx:368
        CatalogPickerSlot.tsx             # moved from WindowsTab.tsx:430 (see §3.3)
        UValueOverrideInput.tsx           # moved from WindowsTab.tsx:516
    lib/
        formatters.ts                     # formatNumber (currently WindowsTab.tsx:555)
        emptyDetailMessage.ts             # currently WindowsTab.tsx:274
        isReviewableRefreshState.ts       # currently WindowsTab.tsx:281
```

### 3.3 `CatalogPickerSlot` — shared or feature-local?

`CatalogPickerSlot<TRow extends CatalogPickableRow, TRef extends PickableRef>`
is generic over the catalog row + ref types. The Assemblies builder
will need an identical pattern for material picking.

**Recommendation: keep it feature-local in this PR; promote to
`shared/ui/` only when Assemblies actually needs it.** Premature
sharing creates a dependency from `shared/` back into catalog-
specific types. The Assemblies-builder PR can promote it as part
of its own scope.

### 3.4 Verification (phase-specific)

- All existing windows tests pass unchanged.
- Playwright MCP smoke: open a project with windows, pick a frame
  type, pick a glazing type, set a U-value override, refresh from
  catalog. All must work identically.
- `wc -l features/windows/routes/WindowsTab.tsx` ≤ 200.
- No new file exceeds 200 lines.

### 3.5 Risks

- Low. Pure file moves; sub-components are already self-contained
  (they take typed props, hold their own narrow state).
- Watch for shared private helpers that are referenced from two
  sub-components — those go in `lib/`, not duplicated.

---

## Phase 4 — Split `VersionControls.tsx` + extract state machine *(execute 6th)*

### 4.1 Scope

`features/project_document/components/VersionControls.tsx` (727 lines,
16 hook calls, 9 `useState` declarations on lines 67–77) breaches the
500-line hard limit and packs an inline `DocumentConfirmationDialog`.

### 4.2 Target Layout

```
features/project_document/
    components/
        VersionControls.tsx                  # ~250 lines: render + event-binding only
        DocumentConfirmationDialog.tsx       # moved from VersionControls.tsx:595
    hooks/                                    # NEW directory
        useVersionControlsState.ts            # owns the 9 useStates + confirmation/draftRestorePrompt
                                              # state machine; returns a typed view + actions
        useDraftLifecycle.ts                  # save / save-as / discard / unlock async workflow.
                                              # Encapsulates isVersionStaleError /
                                              # isVersionLockedError retry handling.
```

### 4.3 Additionally in this PR

- `SAVE_AS_VERSION_KINDS`, `LOCKED_SAVE_AS_KINDS`, `DRAFT_DIFF_TARGET`,
  and the `SaveAsVersionKind` / `PendingSwitch` / `ConfirmationDialog`
  / `DraftRestorePrompt` types move into a new
  `features/project_document/types/versionControls.ts`.
- `draftLooksRecovered` (line 588) moves to `lib.ts`.

### 4.4 Verification (phase-specific)

- All existing project-document tests pass unchanged.
- Playwright MCP smoke: open a project, edit a cell to create a
  draft, save, save-as as Working/Submitted/Closed, switch versions
  with an unsaved draft and confirm each branch (save / save-as /
  discard), discard a draft, unlock a locked version, view the
  diff. All must work identically.
- `wc -l features/project_document/components/VersionControls.tsx` ≤ 300.

### 4.5 Risks

- Moderate. The state machine has six confirmation kinds and
  several async retry paths. Easy to drop a transition.
- **Mitigation:** before extracting, draw the state-transition
  diagram from the current code as a comment in
  `useVersionControlsState.ts`. The extraction is then a transcription
  exercise, not a redesign.

---

## Phase 5 — CSS tokenization + per-feature CSS split *(execute 7th)*

### 5.1 Scope

Two changes bundled because they're synergistic:

- **Token ramps:** introduce `--z-*`, `--space-*`, `--shadow-elev-*`
  custom properties; migrate the 35 raw `z-index` literals and the
  highest-frequency spacing values.
- **Per-feature CSS split:** break `src/App.css` (4,085 lines) into
  per-feature stylesheets co-located with their feature, imported
  from the feature's entry component.

### 5.2 Token Ramps

```css
/* App.css :root additions */
--z-base:        0;
--z-sticky:      10;     /* sticky table headers, summary bar */
--z-dropdown:    100;    /* popovers, menus */
--z-overlay-hud: 500;    /* future 3D-viewer HUD */
--z-modal:       1000;
--z-tooltip:     2000;

--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 24px;
--space-6: 32px;
--space-7: 48px;

--shadow-elev-1: 0 1px 2px rgb(0 0 0 / 6%);
--shadow-elev-2: 0 18px 40px rgb(0 0 0 / 12%);   /* current --phn-shadow */
--shadow-elev-3: 0 24px 60px rgb(0 0 0 / 18%);   /* future modal stack */
```

Migrate `--phn-shadow` to alias `--shadow-elev-2`.
Migrate `--phn-warning`, `--phn-danger`, `--phn-success-bg`,
`--phn-warning-bg`, `--phn-danger-bg` to `color-mix(in oklab, …)`
formulations parallel to `--phn-header-border-locked`. This makes
them dark-mode-ready when that work happens.

### 5.3 Per-Feature CSS Split

Target layout:

```
src/styles/
    tokens.css                # :root, --phn-*, --z-*, --space-*, --shadow-elev-*
    base.css                  # *, html, body, a, form-control resets, page shells
    modals.css                # .modal-panel, .modal-actions, ModalDialog styles
src/shared/ui/data-table/
    DataTable.css             # everything under the "data-table" selectors in App.css
    components/
        GridHeader.css        # header-row, header-context-menu, resize zone styles
        GridBody.css          # body cell, range, fill-handle, chevron styles
        SummaryBar.css        # pinned tfoot styles
        FieldConfigModal.css  # field-editor popover styles
        HideFieldsPanel.css   # hide/show fields panel
        FilterPopover.css     # filter / sort popover surfaces
        GroupPopover.css      # group popover header, group-header rows
src/features/equipment/equipment.css
src/features/windows/windows.css
src/features/project_status/project_status.css
src/features/project_document/version-controls.css
src/features/auth/auth-page.css
```

Each component file imports its own CSS:
`import "./GridHeader.css"`. `src/main.tsx` keeps importing
`./App.css`, which now only re-imports `./styles/*.css` and
the remaining un-claimed selectors (gradually drain to zero).

### 5.4 Additionally in this PR

- Add a code comment at the top of `tokens.css` documenting the
  z-index stacking contract.

### 5.5 Verification (phase-specific)

- Visual diff via Playwright MCP screenshots: take screenshots of
  every route before and after the split (auth, dashboard, project
  list, Equipment/Rooms tab, Windows tab, Status tab, three catalog
  pages, project settings modal, save-as modal, diff modal). The
  diff must be visually identical.
- `grep -c "^[^ ]" App.css` shrinks dramatically (target < 200).
- `grep -c "z-index" src/**/*.css` — every `z-index` rule uses a
  `var(--z-*)` token. No raw integer `z-index` values remain.

### 5.6 Risks

- **Cascade order.** Splitting CSS can change specificity-resolution
  if files are imported in a different order. Keep the same
  textual order: `tokens.css` → `base.css` → component CSS →
  feature CSS.
- **Mitigation:** ship the split in two PRs if needed —
  - 5a: token ramps + `:root` updates, no file split.
  - 5b: file split, no token changes.
  - This makes any visual regression bisectable to one half.

---

## Phase 6 — Feature-shape standardization *(execute 2nd)*

### 6.1 Scope

Bring all `features/<feature>/` directories in line with the
canonical shape established by `features/catalogs/` and
`features/projects/`. Per Ed's preference: consistency over local
convenience, even when a feature is small.

### 6.2 Canonical Shape

```
features/<feature>/
    api.ts                   # endpoint functions
    hooks.ts                 # TanStack Query hooks and mutations
    types.ts                 # feature-local API/domain types
    query-keys.ts            # exported queryKeys constant + types
    lib.ts                   # feature-local pure helpers
    routes/                  # route-level page components
    components/              # presentational and workflow components
    __tests__/               # if tests exist
```

Optional sub-folders (`refresh/`, `stores/`) allowed when a feature
genuinely has them.

### 6.3 Per-Feature Changes

| Feature | Action |
|---|---|
| `auth` | Add `components/SignInForm.tsx`; extract form from `SignInPage.tsx`. |
| `catalogs` | ✓ Reference shape — no change. |
| `equipment` | Add `query-keys.ts` (extract from current inline keys). |
| `mcp` | Add `routes/.gitkeep`, `components/.gitkeep`, `lib.ts` (with `// MCP feature has no UI surface — placeholder for consistency`); add `features/mcp/README.md` documenting the no-UI rationale. |
| `project_document` | Add `query-keys.ts` (extract from current inline keys). `routes/` legitimately absent — document in `features/project_document/README.md`. |
| `project_status` | Add `query-keys.ts`. |
| `projects` | ✓ Reference shape — no change. |
| `table_views` | Rename `useProjectTableViewState.ts` → `hooks.ts` (single hook today; promote to `hooks/useProjectTableViewState.ts` if a second emerges in Phase 2). Add `lib.ts` for the view-state sanitization helpers. Add `query-keys.ts`. |
| `windows` | Add `components/` (populated in Phase 3, not here). Add `query-keys.ts`. |

### 6.4 Backward compatibility

Query-keys extraction is import-only — no key shape changes. Verify
by `git diff` on the literal arrays returned by each `*QueryKeys.*`
function.

### 6.5 Verification (phase-specific)

- `cd frontend && pnpm test` — all pass.
- `git grep "queryKey:.*\["` returns no inline literal arrays in
  `hooks.ts` / `api.ts` (each goes through `*QueryKeys.*`).
- Manual: every feature directory now contains the canonical files
  (or a `README.md` explaining a documented omission).

### 6.6 Risks

- Low. Mechanical moves and renames.
- Watch for circular imports when extracting query-keys (`hooks.ts`
  → `query-keys.ts`, but `query-keys.ts` should never import from
  `hooks.ts`).

---

## Phase 7 — Naming, sentinels, ID-prefix constants *(execute 1st)*

### 7.1 Scope

The cheapest wins from the review's §2.7. All small, all
independent. Bundle into one PR.

### 7.2 Changes

- **ID-prefix constants per feature.** Today: `generatedId("rm")`
  inlined at `EquipmentTab.tsx:613`. Replace with a named export
  per feature:
  ```
  features/equipment/lib.ts:    export const ROOM_ID_PREFIX = "rm";
  features/windows/lib.ts:      export const WINDOW_TYPE_ID_PREFIX = "wt";
  features/catalogs/lib.ts:     export const MATERIAL_ID_PREFIX = "mat";
                                export const FRAME_TYPE_ID_PREFIX = "frm";
                                export const GLAZING_TYPE_ID_PREFIX = "glz";
  ```
  This pre-empts ERV / Pumps / Fans / TB tabs picking colliding or
  inconsistent prefixes.
- **`shared/lib/stableEmpty.ts`** for the memo-sentinel pattern at
  `DataTable.tsx:73–74`:
  ```ts
  export const STABLE_EMPTY_ARRAY: readonly never[] = Object.freeze([]);
  export function stableEmptyArray<T>(): readonly T[] {
    return STABLE_EMPTY_ARRAY as readonly T[];
  }
  ```
  Replace the local `EMPTY_ID_LIST` / `EMPTY_FORMULA_FIELD_REGISTRY`
  uses. Will be needed by every new feature tab.
- **`schemaMutationMutation` → `roomsSchemaMutation`** in
  `EquipmentTab.tsx:159` (and propagate to any callers within the
  same file).
- **`commitRoomsPayload` → `commitRoomsPayloadOrThrow`** in
  `EquipmentTab.tsx:220` to telegraph the throw path.

### 7.3 Backward compatibility

All changes are internal (no exported public-API renames). Tests
exercise the same behavior under the new names.

### 7.4 Verification (phase-specific)

- All existing tests pass unchanged.
- `git grep generatedId\\(\"` returns no string-literal prefixes in
  `features/` (every `generatedId` call uses a `*_ID_PREFIX` constant).

### 7.5 Risks

- Trivial. Pure rename + tiny new module.

---

## Phase 8 — CI guards *(execute 8th — last)*

### 8.1 Scope

Lock in the conventions established by Phases 1–7 with mechanical
guards so the next contributor (human or agent) can't unknowingly
regress them.

### 8.2 Guards

- **File-size guard** (`frontend/scripts/check-file-sizes.mjs`):
  fails CI if any `.ts` / `.tsx` file in `frontend/src/` exceeds
  500 lines unless it carries `// @size-exception: <link-to-doc>`
  on line 1. Whitelist `formula/parser.ts` (parsers are legitimately
  long; document in `docs/code-reviews/2026-05-25/frontend-code-review.md`
  §2.1).
- **Module-shape guard** (`frontend/scripts/check-feature-shape.mjs`):
  fails CI if any `features/<feature>/` is missing `api.ts`,
  `hooks.ts`, `types.ts`, or `query-keys.ts`, OR is missing
  `routes/` / `components/` without a `README.md` explaining why.
- **No-raw-z-index guard** (`frontend/scripts/check-z-index.mjs`):
  fails CI if any CSS file in `frontend/src/` contains a raw
  integer `z-index` (matching `z-index:\s*\d`). Only
  `var(--z-*)` references allowed.
- **No-raw-hex-in-features guard** (extend the existing lint or
  add as a script): fails CI if any `.tsx` / `.css` file under
  `features/` or `shared/ui/` (excluding `tokens.css`) contains a
  raw hex color literal.

### 8.3 Wire-up

Add to `package.json`:

```json
"scripts": {
  "check:sizes": "node scripts/check-file-sizes.mjs",
  "check:shape": "node scripts/check-feature-shape.mjs",
  "check:z-index": "node scripts/check-z-index.mjs",
  "check:hex": "node scripts/check-hex.mjs",
  "check:all": "pnpm run check:sizes && pnpm run check:shape && pnpm run check:z-index && pnpm run check:hex"
}
```

Add a `make check-frontend` recipe that runs `pnpm run check:all`.
Wire `make check-frontend` into the CI pipeline.

### 8.4 Verification (phase-specific)

- `pnpm run check:all` passes on the post-Phase-7 codebase.
- Deliberately introduce a 501-line file in a throwaway branch
  and confirm CI fails.
- Same for a feature directory missing `query-keys.ts` and for a
  CSS file with a raw `z-index: 5`.

### 8.5 Risks

- If guards are too strict at launch, they block in-flight work
  unrelated to this plan. **Mitigation:** land Phase 8 only after
  Phases 1–7 are complete and `main` is clean. Stage with
  `warn-only` (exit 0 with a diagnostic) for one week before
  flipping to `fail` (exit 1).

---

## 4. Out of Scope

Explicitly **not** in this plan:

- **Generalizing the three catalog editor modals** (`Material`,
  `FrameType`, `Glazing`). Per review §3.6: their shapes diverge
  enough that premature abstraction would hurt readability.
  Reassess when the Assemblies builder adds a fourth.
- **Splitting `formula/parser.ts`** (679 lines). Parsers are
  legitimately long; the file is internally well-scoped. Add to
  the size-guard whitelist.
- **Splitting `useGridFill.ts`** (559 lines). Review §2.6 flags
  it as Medium severity; defer to P3 after the new tabs land and
  prove out the fill-behavior surface area.
- **`useProjectTableViewState.ts` deep audit.** Will be exercised
  by the four new tabs; revisit after they land.
- **Behavior changes of any kind.** This plan is structural only.
  New tab features, new viewer features, new builder pages are
  separate plans that consume this one's outputs.
- **Dark mode.** The CSS token cleanup in Phase 5 makes dark mode
  *possible* but does not implement it.

## 5. Tracking

Each phase becomes one PR; reference this plan in the PR description
with the section anchor (e.g. `plan-23-frontend-refactor-phased.md
§Phase 2`). When all phases are complete, update this doc's
`STATUS:` header from `Proposed` to `Complete` and link the merged
PR shas in a `RESULT:` block.

---

*End of plan.*
