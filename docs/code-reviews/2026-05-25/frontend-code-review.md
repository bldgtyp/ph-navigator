DATE: 2026-05-25
TIME: 21:05

# Frontend Code Review — PH-Navigator V2

## 0. Scope & Method

In-scope: everything under `frontend/src/`. Out-of-scope: backend, `research/`, `../ph-navigator/` (V1).

This review was written against `context/CODING_STANDARDS.md` (the canonical engineering bar) and is calibrated for the upcoming work Ed flagged:

- New DataTable-based feature pages: **ERV, Pumps, Fan, Thermal-Bridge** (will follow the Equipment/Rooms template).
- New "builder" pages for **Windows** and **Assemblies** (more complex than current pages).
- A complete **3D-Model-Viewer** feature.

The guiding principle for the recommendations below: **consistency and predictability across feature modules win over local conciseness.** Even when merging models/services/routes feels easier today, every feature should keep the same shape so the next four DataTable tabs are a copy-rename exercise.

---

## 1. Executive Summary

The frontend is in genuinely good shape for its current scope. TanStack Query usage is consistent, there are zero raw `fetch` calls in feature code, `App.tsx`/`router.tsx`/`providers.tsx` are kept tiny per the standard, and there are essentially no hard-coded color literals in component CSS — the design tokens defined in `App.css :root` are doing their job.

The real issues cluster in three places:

1. **Three feature files breach the 500-line hard limit** in `CODING_STANDARDS.md` and need to be split *before* they get copy-pasted into ERV / Pumps / Fan / Thermal-Bridge:
   - `features/equipment/routes/EquipmentTab.tsx` (785 LOC)
   - `features/windows/routes/WindowsTab.tsx` (557 LOC, packs 7 components into one file)
   - `features/project_document/components/VersionControls.tsx` (727 LOC, 16 hook calls, holds its own dialog component)
2. **Two shared infra modules are oversized** and the upcoming tables will worsen them:
   - `shared/ui/data-table/DataTable.tsx` (1219 LOC) — the orchestration component
   - `shared/ui/data-table/lib.ts` (1189 LOC, 63 exports) — a kitchen-sink helpers bucket the standards explicitly warn against (“Do not split by arbitrary helper buckets such as `utils.py`” — same principle on the FE)
3. **Module-shape inconsistency across features.** `features/mcp/` and `features/table_views/` lack `routes/`, `components/`, and `lib.ts`; `features/auth/` has no `components/`; `features/projects/` has no top-level `lib.test.ts` companion despite owning settings/modal logic; query-keys live in `query-keys.ts` for two features (`catalogs`, `projects`) and inlined elsewhere. None of these are bugs — but Ed values predictability, and the four upcoming tabs should not have to discover whether their feature is a "full shape" or a "thin shape" feature.

`App.css` is 4085 LOC but is *not* the highest-priority refactor — it is mostly declarative, well-tokenized, and sectioned by phase comments. It does deserve a split before the 3D viewer ships, but the file/function refactors above unblock more day-to-day pain.

**One-line takeaway:** before adding ERV/Pumps/Fan/Thermal-Bridge, extract a `DataTableFeatureTab<TSlice, TRow>` wrapper from `EquipmentTab.tsx` and split `data-table/lib.ts` by concern. Both pay for themselves on the first new tab.

---

## 2. Findings by Theme

### 2.1 SRP / file-length violations

| File | LOC | Verdict | Why it matters |
|---|---|---|---|
| `src/App.css` | 4085 | Split (Medium) | Tokenized; mostly declarative. Mainly a navigability/git-diff concern. |
| `shared/ui/data-table/DataTable.tsx` | 1219 | Split (High) | Orchestration component. Will keep growing as each new feature tab introduces new write kinds / formula registries. |
| `shared/ui/data-table/lib.ts` | 1189 | Split (High) | 63 exports across filtering, sorting, ranges, paste/fill, options, body-plan, aggregates. Pure "utils bucket" anti-pattern. |
| `features/equipment/routes/EquipmentTab.tsx` | 785 | Split (Critical) | Breaches hard limit. Will be copy-pasted as the template for 4 new tabs. |
| `features/project_document/components/VersionControls.tsx` | 727 | Split (High) | Breaches hard limit. 16 hook calls in one component; contains `DocumentConfirmationDialog` inline. |
| `shared/ui/data-table/lib/formula/parser.ts` | 679 | Acceptable | Parsers legitimately need to be long; well-scoped to one file. Low priority. |
| `shared/ui/data-table/components/FieldConfigModal.tsx` | 664 | Split (High) | Modal that already delegates to `FieldConfigSection*` siblings — the remainder is still doing too much (orchestration + state + footer + validation). |
| `shared/ui/data-table/hooks/useGridFill.ts` | 559 | Split (Medium) | Fill is one feature but the hook holds pointer, keyboard, range, axis, and option-pruning logic. |
| `features/windows/routes/WindowsTab.tsx` | 557 | Split (Critical) | Holds **7 components** in one file: `WindowsTab`, `WindowTypeSidebar`, `WindowTypeDetail`, `WindowElementCard`, `CatalogPickerSlot`, `UValueOverrideInput`, `formatNumber`. This is the *first* builder page and the template for Assemblies. |
| `features/equipment/lib.ts` | 542 | Split (Medium) | Mixes payload builders, validators, error matchers, schema constants, and broadcast helpers. |

**Recommendation:** add a CI guard now — `pnpm` script that fails on any `frontend/src/**/*.{ts,tsx}` over 500 lines without a documented exception. The standards already specify these limits; nothing enforces them.

### 2.2 Cross-feature duplication that the upcoming tabs will multiply

The single highest-leverage refactor in this review.

`EquipmentTab.tsx` contains a pattern that every future DataTable feature tab (ERV / Pumps / Fan / Thermal-Bridge) will need verbatim:

- `useTableSchema({ tableKey, coreFieldDefs, fingerprintCoreFieldKeys, customFields, singleSelectOptions })`
- `useProjectTableViewState({ projectId, tableKey, defaults, enabled, columns, fieldDefs, schemaFingerprint })`
- `useRoomsDraftBroadcast` → generic `useSliceDraftBroadcast`
- The whole `commit<X>Payload` / `withDraftConflictHandling` / `handleStaleDraftConflict` / `handleVersionLockedConflict` orchestration (lines 169–194, 220–235, 512–534)
- `handleTableWrite(op: WriteOp)` dispatch (cell/paste/fill/rowInsert/rowDelete/schemaMutation) — lines 289–356
- `handleDeleteCustomField` / `handleAddCustomField` / `handleDuplicateCustomField` / `handleEditCustomFieldBundle` — lines 365–510, **almost completely tabular** in nature
- `buildEmptyRowDefaults` adapter, `insertAfterColumnOrder`, formula-registry builder

Copy-pasting this into four new tabs would mean ~3,000 LOC of near-duplicate orchestration in `features/`, and any fix to the broadcast/conflict/schema flow would need to be applied in 5 places.

**Recommended abstraction** — introduce a generic hook in `shared/ui/data-table/`:

```ts
// shared/ui/data-table/feature/useSliceTableController.ts
function useSliceTableController<TSlice, TRow extends { id: string }>(args: {
  projectId: string;
  activeVersionId: string | null;
  canEdit: boolean;
  tableKey: string;
  slice: TSlice;
  fingerprintCoreFieldKeys: readonly string[];
  coreFieldDefs: FieldDef[];
  customFields: CustomFieldDef[];
  singleSelectOptions: SingleSelectOptions | null;
  payloadBuilders: SlicePayloadBuilders<TSlice, TRow>;   // see below
  conflictMessages: { active: string; delete: string; locked: string };
  publishSlice: (slice: TSlice) => void;
  refetch: () => Promise<unknown>;
  replaceMutation: UseMutationResult<...>;
  schemaMutation: UseMutationResult<...>;
}): SliceTableController<TRow>;
```

…where each new tab provides a single `SlicePayloadBuilders` shape:

```ts
interface SlicePayloadBuilders<TSlice, TRow> {
  fromCellWrites(slice: TSlice, writes: CellWrite[], newOptions, removedOptions): Payload;
  fromRowInsert(slice: TSlice, rows: TRow[], build: BuildEmptyRow<TRow>): Payload;
  fromRowDelete(slice: TSlice, rows: TRow[]): Payload;
  validate(payload: Payload): string | null;
  replaceOptions?(slice: TSlice, optionKey, opts, replacements): Payload; // optional per slice
}
```

The new ERV tab then collapses to ~150 LOC: payload-builder module + schema-field-defs + a thin route component composing `useSliceTableController` and `<DataTable>`. The four new tabs cost ~600 LOC instead of ~3,000, and the conflict-handling story has exactly one implementation.

### 2.3 Hard-coded CSS / token discipline

Good news: **outside `App.css`, there are essentially no hard-coded color literals** in feature TSX or component CSS. Tokens are wired and used.

Minor concerns inside `App.css`:

- `--phn-warning: #8a5a00` (line 8), `--phn-warning-bg: #fff6d9` (9), `--phn-danger: #9b2f24` (10), `--phn-danger-bg: #fff0ee` (11), `--phn-success-bg: #e9f5ef` (7) — these are *token definitions* (good) but bypass the BLDGTYP design-token system (`--accent`, `--accent-dark`, …) and use raw hex. If the design tokens later get a dark mode pass these will not follow. **Recommendation:** define them via `color-mix(in oklab, var(--accent-*) X%, var(--bg-page))` like `--phn-header-border-locked` already does.
- `rgb(0 0 0 / 12%)` in `--phn-shadow` (line 4) — fine, but consider a `--shadow-elev-2` token so the planned 3D viewer / modal stack uses the same shadow ramp.
- 571 lines with raw `px` literals in `App.css`. Many are legitimate (border widths, icon sizing). But spacing values (`padding: 24px`, `gap: 16px`, `padding: 8px 12px`) are scattered. Recommend a spacing scale — `--space-1`..`--space-6` (4/8/12/16/24/32) — and convert one section at a time. Not urgent, but should land before the 3D viewer brings a new layout vocabulary.
- 35 `z-index` literals across the file with no documented stacking order. Before the 3D viewer (which will add overlay/HUD/tooltip layers competing with modals, popovers, and the field-config dialog stack) introduce `--z-modal`, `--z-popover`, `--z-overlay-hud`, `--z-tooltip` tokens and migrate the existing values. This is cheap insurance against a stacking-order bug discovered only at viewer-launch time.

### 2.4 Feature-module structure inconsistency

The standard prescribes a per-feature shape: `api.ts`, `hooks.ts`, `types.ts`, `routes/`, `components/`, optionally `lib.ts`, `stores/`. Actual state:

| Feature | api | hooks | types | lib | routes | components | query-keys | notes |
|---|---|---|---|---|---|---|---|---|
| `auth` | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | inline | No `components/` despite SignInPage having form pieces. |
| `catalogs` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `query-keys.ts` | ✓ Reference shape. |
| `equipment` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | inline | Missing `query-keys.ts` (uses inline). |
| `mcp` | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | inline | **Most divergent.** No routes, no components — feature behavior lives where? |
| `project_document` | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | inline | No `routes/` because it owns no top-level page; OK. |
| `project_status` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | inline | ✓ Good shape. |
| `projects` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `query-keys.ts` | ✓ Reference shape. |
| `table_views` | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | inline | Hook is `useProjectTableViewState.ts` at the feature root instead of in `hooks.ts`. |
| `windows` | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | inline | **No `components/`** despite 5 sub-components living inline in `WindowsTab.tsx`. Has bespoke `refresh/` sub-feature. |

**Recommendation:** pick `features/catalogs/` or `features/projects/` as the canonical shape and bring the others in line. Specifically:

- `features/mcp/`: add `routes/`, `components/`, `lib.ts` (even if mostly empty stubs) per the "predictable boundaries" rule from `CODING_STANDARDS.md`.
- `features/table_views/`: rename `useProjectTableViewState.ts` to live inside `hooks.ts` (or `hooks/` if multiple emerge) — currently it's the only feature with a top-level hook file.
- `features/windows/`: add `components/` and move `WindowTypeSidebar`, `WindowTypeDetail`, `WindowElementCard`, `CatalogPickerSlot`, `UValueOverrideInput` into sibling files. This is also the SRP fix (§2.1) for WindowsTab.
- `features/auth/`: add `components/SignInForm.tsx` extraction (small, but consistency).
- Standardize on `query-keys.ts` everywhere or move all keys inline; do not mix. Recommend `query-keys.ts` since `catalogs` and `projects` already do this and the tests live in `query-keys.test.ts`.

### 2.5 React / TanStack-Query / hooks discipline

Largely strong:

- ✓ No raw `fetch` in feature code (only TanStack Query helpers).
- ✓ Only 16 `useEffect` calls across all of `features/`, and the ones spot-checked (e.g. `EquipmentTab.tsx:165–167` — reset blocker on version change) are legitimate side effects.
- ✓ `App.tsx`/`providers.tsx`/`router.tsx` total 72 LOC.

Concerns:

- **`VersionControls.tsx` packs 16 hook calls and 9 `useState`s** (lines 67–77 alone are 9 `useState` declarations). Extract a `useVersionControlsState()` hook owning the modal/dialog state machine, and pull `DocumentConfirmationDialog` into a sibling file. The component should compose, not own, all of this.
- **Inline component definitions in `WindowsTab.tsx`** — `WindowTypeSidebar`, `WindowTypeDetail`, `WindowElementCard`, `CatalogPickerSlot`, `UValueOverrideInput`. The standard says explicitly: "Avoid defining nested components inline. Extract them to sibling files when they have their own state, markup branch, or test surface." All five of these qualify.
- `useProjectTableViewState.ts` (197 LOC) is a single complex hook coupling persistence, sanitization, debouncing, and view-state shape. When ERV/Pumps/etc. come online it will fan out to N tableKeys per project. Worth a follow-up audit but not blocking.

### 2.6 Complexity / convoluted abstractions

- `shared/ui/data-table/lib.ts` is the worst offender — 63 exports across unrelated concerns. The body of the file works, but a reader trying to find "where does filter coercion live?" has no signpost. Splitting (§3.1) fixes this.
- `EquipmentTab.tsx` `handleEditCustomFieldBundle` (lines 412–460) does six conditional config-shape mutations based on field-type transitions. This logic is **not** equipment-specific — it should move into `shared/ui/data-table/lib/customFieldMutations.ts` (where similar logic already lives) as `buildNextConfigForFieldTypeChange(source, request)`. Otherwise every new DataTable tab re-implements the same `delete nextConfig.precision` / `delete nextConfig.source` ceremony.
- `data-table/hooks/useGridFill.ts` at 559 LOC mixes the *axis decision* (which way is the user dragging?), the *target computation* (which cells get filled?), the *write generation* (what values per cell?), and the *option-pruning* (what happens to single-select values?). The three concerns should split into `lib/fillAxis.ts`, `lib/fillTarget.ts`, and `lib/fillPlan.ts`, leaving the hook as a pointer-event orchestrator.

### 2.7 Naming

Generally good. Specific calls:

- `replaceRoomsMutation` / `schemaMutationMutation` (`EquipmentTab.tsx:159`) — `schemaMutationMutation` is a double-noun typo-by-convention. Either `schemaMutation` (collides with payload type) or `roomsSchemaMutation`.
- `commitRoomsPayload` returns either the mutation result *or* throws — the name doesn't telegraph the throw path. Either `commitRoomsPayloadOrThrow` or wrap into a Result type.
- `EMPTY_ID_LIST` / `EMPTY_FORMULA_FIELD_REGISTRY` (`DataTable.tsx:73–74`) — these are stable-identity sentinels for memo deps; the comment is good but the names don't say "sentinel". Consider `STABLE_EMPTY_*` prefix or move into a `shared/lib/stableEmpty.ts` since other features will need the same trick.
- `generatedId("rm")` (`EquipmentTab.tsx:613`) — opaque two-letter prefix. Per-feature ID prefixes should live as named constants in `features/<feature>/lib.ts` (`const ROOM_ID_PREFIX = "rm"`) so future ERV/Pump/Fan/TB tabs don't reinvent or collide.

### 2.8 Data flow

The data-table → feature-tab → mutation flow is healthy: write ops are a typed sum (`WriteOp`), each variant routes through `commitRoomsPayload` which composes validate → mutate → conflict-handle. No spaghetti.

The one tangled spot: **schema mutations have two entry points** (`op.variant === "typed"` calls `commitSchemaMutation` directly, while the legacy option-editor branch builds a `replaceRoomOptionsPayload` and rides the regular replace path — `EquipmentTab.tsx:321–355`). The comment on line 326 acknowledges this is transitional ("plan-16 splits it into its own kind"). Worth tracking; ideally finish that split before duplicating EquipmentTab into ERV/etc.

---

## 3. Per-Module Notes

### 3.1 `shared/ui/data-table/`

The most consequential module in the codebase — every upcoming feature tab depends on it. Suggested layout after refactor:

```
shared/ui/data-table/
  DataTable.tsx                    # ≤ 400 LOC orchestrator
  feature/                         # NEW
    useSliceTableController.ts     # the abstraction in §2.2
    SliceTableShell.tsx            # banners, blockers, downloads — extracted from EquipmentTab
    types.ts                       # SlicePayloadBuilders<TSlice, TRow>
  lib/
    filter/                        # split from lib.ts
      apply.ts, defaultOperator.ts
    sort/
      sortRows.ts, compareSingleSelectValues.ts
    range/
      normalize.ts, edgeBits.ts, clamp.ts
    paste/
      tsv.ts, planPaste.ts, coerce.ts
    fill/                          # currently 5 fill helpers in lib.ts + 559-LOC hook
      axis.ts, direction.ts, target.ts, plan.ts
    body/
      buildBodyPlan.ts, aggregates.ts
    options/
      createFieldOption.ts, references.ts, normalize.ts
    customFieldMutations.ts        # already exists — add buildNextConfigForFieldTypeChange
  hooks/                            # existing; useGridFill split per §2.6
  components/
  fields/
  tokens/
```

Migrate `lib.ts` exports gradually: add the new modules, re-export from `lib.ts` as a deprecation shim for one PR cycle, then delete.

### 3.2 `features/equipment/`

- **`routes/EquipmentTab.tsx` (785)** → split as:
  - `routes/EquipmentTab.tsx`: ~120 LOC — composes `useSliceTableController`, renders subtabbar + banners + `<RoomsTable>` + modals.
  - `lib/roomsController.ts`: payload builders → `SlicePayloadBuilders<RoomsSlice, RoomRow>`.
  - `lib/roomsFormulaRegistry.ts`: move `buildRoomsFormulaRegistry`, `readRoomsFormulaValue`, `buildRoomFormulaRowValues`, `ROOMS_FORMULA_FIELD_ID_BY_COLUMN_KEY`, `mapToFormulaType`. (`mapToFormulaType` likely belongs in `shared/ui/data-table/lib/formula/` since every new feature will need it.)
  - `lib/columnOrder.ts`: move `insertAfterColumnOrder` — also generic, candidate for `shared/ui/data-table/lib/`.
- `lib.ts` (542) → split into `lib/payloads.ts`, `lib/validation.ts`, `lib/errors.ts`, `lib/schema.ts`. The `is*Error` family belongs with the other error matchers in `project_document/lib.ts` (`isInvalidProjectDocumentError`) — consider promoting to `shared/api/draftErrors.ts`.

### 3.3 `features/windows/`

- **`routes/WindowsTab.tsx` (557, 7 components)** → split immediately:
  - `components/WindowTypeSidebar.tsx`
  - `components/WindowTypeDetail.tsx`
  - `components/WindowElementCard.tsx`
  - `components/CatalogPickerSlot.tsx` (this one is interesting — it's generic over `<TRow, TRef>`; consider whether it belongs in `shared/ui/` for re-use by the upcoming Assemblies builder)
  - `components/UValueOverrideInput.tsx`
  - `lib/formatters.ts`: move `formatNumber`
- The `refresh/` sub-feature is well-structured (separate `hooks`, `lib`, `types`, dialog + modal). Keep it as a template for the eventual Windows-builder's "review pending changes" UX.

### 3.4 `features/project_document/`

- **`components/VersionControls.tsx` (727)** → split:
  - `components/DocumentConfirmationDialog.tsx` (lives at line 595–726 inline today)
  - `hooks/useVersionControlsState.ts`: owns the 9 `useState` declarations + `confirmation` / `draftRestorePrompt` state machine
  - `hooks/useDraftLifecycle.ts`: save / save-as / discard / unlock async workflow (encapsulates the `isVersionStaleError` / `isVersionLockedError` retries)
  - `components/VersionControls.tsx`: shrinks to render + event-binding (~250 LOC)
- `lib.ts`: fine.

### 3.5 `features/projects/`

- Reference shape. Keep.
- `components/ProjectSettingsModal.tsx` (463) is below the 500 hard limit but contains tabbed settings UI; split when adding the next tab (likely cert-related when Phius workflows land). Track but don't act now.

### 3.6 `features/catalogs/`

- Reference shape. Keep.
- `components/MaterialEditorModal.tsx` (264), `FrameTypeEditorModal.tsx` (260), `GlazingTypeEditorModal.tsx` (227) are *near-identical-shape* modals. As the Assemblies builder lands, watch for a fourth and consider an `EditorModal<TForm>` abstraction. **Not now** — three is the rule-of-three trigger but the shapes differ enough that premature abstraction would hurt readability. Document the pattern as a code comment so the fourth one doesn't slip in unnoticed.

### 3.7 `features/project_status/`

- Good shape. No issues found.

### 3.8 `features/auth/`

- Missing `components/`. `SignInPage.tsx` should extract its form into `components/SignInForm.tsx`. Low priority but consistency matters.

### 3.9 `features/mcp/`

- **Most divergent module.** No `routes/`, no `components/`, no `lib.ts`. If MCP truly has no UI surface, document that in a `features/mcp/README.md` and add empty `routes/.gitkeep` / `components/.gitkeep` per the standards' "Small features still get this shape" rule. Otherwise, surface the missing layers now while the feature is small.

### 3.10 `features/table_views/`

- Top-level `useProjectTableViewState.ts` is the only feature with a hook at the feature root. Move to `hooks.ts` (or `hooks/useProjectTableViewState.ts` if it's the start of a family — likely is, given upcoming tabs).
- Add `lib.ts` for the view-state sanitization helpers that currently live inline.
- This feature will be heavily exercised by ERV/Pumps/Fan/Thermal-Bridge — clean it up before they land.

### 3.11 `shared/`

- `shared/api/` and `shared/lib/` are appropriately small.
- `shared/ui/` is mostly the data-table package; the only other top-level files are `ModalDialog`, `useOutsidePointerDown`, etc. — fine. As the 3D viewer ships, consider `shared/ui/viewer/` or a top-level `features/viewer/` (likely the latter, since it'll have its own state + hooks + types). Keep `shared/ui/` for truly cross-feature primitives.

### 3.12 `App.css`

- Splittable along the phase-comment boundaries already in the file. Suggested:
  - `styles/tokens.css` (`:root` + the `--phn-*` definitions)
  - `styles/base.css` (`*`, `html`, `body`, `a`, form-control resets, page shells)
  - `styles/modals.css`
  - `styles/data-table/` (one file per logical section: header, body, popovers, summary, hide-fields, etc.)
  - `styles/version-controls.css`
  - `styles/equipment.css`, `styles/windows.css`, …
- Each can be imported by the consuming component file (`import "./WindowsTab.css"`) so styles ship with their feature. This dramatically improves grep-ability ("where does `.window-element-card` live?").
- Not blocking, but **do this before the 3D viewer adds its own ~800 LOC of viewer chrome to App.css.**

---

## 4. Prioritized Refactor Plan

Ordered by leverage on the upcoming work.

### P0 — Do before ERV / Pumps / Fan / Thermal-Bridge tabs

1. **Extract `useSliceTableController` + `SliceTableShell`** (§2.2). One PR. After this, each new tab is ~150 LOC.
2. **Split `EquipmentTab.tsx`** to live on top of the new controller (§3.2). Validates the abstraction. Sets the template.
3. **Promote schema-mutation helpers** (`buildNextConfigForFieldTypeChange`, `insertAfterColumnOrder`, `mapToFormulaType`) into `shared/ui/data-table/lib/` (§2.6, §3.2).
4. **Finish the "schema-mutation as its own WriteOp kind" migration** referenced at `EquipmentTab.tsx:326` so the new tabs don't inherit two code paths.

### P1 — Do before the Windows / Assemblies builders

5. **Split `WindowsTab.tsx`** into sibling components under `features/windows/components/` (§3.3). The Assemblies builder will mirror this structure — give it a clean template.
6. **Decide whether `CatalogPickerSlot` is shared or windows-local.** If Assemblies will pick from catalogs too (likely), promote to `shared/ui/`.
7. **Split `data-table/lib.ts`** by concern (§3.1). Reduces "where does X live?" friction the builder pages will create.
8. **Standardize feature module shape** — fill in the missing `components/`, `lib.ts`, `query-keys.ts` per §2.4. Mostly mechanical; do as part of (5).

### P2 — Do before the 3D-Model-Viewer

9. **Split `App.css`** into per-feature stylesheets (§3.12).
10. **Introduce `--z-*` tokens** and migrate the 35 raw `z-index` values (§2.3).
11. **Introduce `--space-*` and `--shadow-elev-*` token ramps** (§2.3).
12. **Split `VersionControls.tsx`** (§3.4) — independent of the viewer, but the viewer will be adding new modals to the same screen.

### P3 — Quality / hygiene, anytime

13. **CI guard for file size** — fail on `.ts`/`.tsx` over 500 LOC without `// @size-exception: <doc>` opt-out (§2.1).
14. **CI guard for module shape** — every `features/<feature>/` must contain `api.ts`, `hooks.ts`, `types.ts`, and either `routes/` or a documented reason in `features/<feature>/README.md`.
15. **Split `useGridFill.ts`** into `lib/fill/*` modules (§2.6).
16. **Rename `schemaMutationMutation`**, introduce per-feature ID-prefix constants (§2.7).
17. **Add `shared/lib/stableEmpty.ts`** for the sentinel-array pattern at `DataTable.tsx:73–74`.

---

## 5. Appendix

### 5.1 Top-30 files by line count (non-test)

| LOC | Path |
|---:|---|
| 4085 | `src/App.css` |
| 1219 | `shared/ui/data-table/DataTable.tsx` |
| 1189 | `shared/ui/data-table/lib.ts` |
| 785 | `features/equipment/routes/EquipmentTab.tsx` |
| 727 | `features/project_document/components/VersionControls.tsx` |
| 679 | `shared/ui/data-table/lib/formula/parser.ts` |
| 664 | `shared/ui/data-table/components/FieldConfigModal.tsx` |
| 559 | `shared/ui/data-table/hooks/useGridFill.ts` |
| 557 | `features/windows/routes/WindowsTab.tsx` |
| 542 | `features/equipment/lib.ts` |
| 463 | `features/projects/components/ProjectSettingsModal.tsx` |
| 427 | `shared/ui/data-table/lib/customFieldMutations.ts` |
| 415 | `shared/ui/data-table/types.ts` |
| 412 | `shared/ui/data-table/components/FieldConfigSectionOptions.tsx` |
| 374 | `shared/ui/data-table/lib/formula/evaluator.ts` |
| 339 | `shared/ui/data-table/components/GridBody.tsx` |
| 335 | `shared/ui/data-table/components/GridHeader.tsx` |
| 334 | `shared/ui/data-table/components/CreateFieldConfigModal.tsx` |
| 322 | `shared/ui/data-table/hooks/useGridEdit.ts` |
| 302 | `shared/ui/data-table/components/FieldConfigSectionFormula.tsx` |
| 301 | `shared/ui/data-table/components/FilterPopover.tsx` |
| 270 | `shared/ui/data-table/hooks/useGridColumnResize.ts` |
| 264 | `features/catalogs/components/MaterialEditorModal.tsx` |
| 260 | `features/catalogs/components/FrameTypeEditorModal.tsx` |
| 259 | `shared/ui/data-table/hooks/useGridPointerDrag.ts` |
| 258 | `shared/ui/data-table/components/HideFieldsPanel.tsx` |
| 248 | `shared/ui/data-table/hooks/useGridKeyboard.ts` |
| 245 | `features/projects/routes/ProjectShell.tsx` |
| 241 | `features/equipment/components/RoomsTable.tsx` |
| 227 | `features/catalogs/components/GlazingTypeEditorModal.tsx` |

Total non-test frontend: ~27,929 LOC.

### 5.2 CSS hotspots

- 36 hex literals in `App.css`; 18 unique; 31 outside `:root` (mostly in `--phn-*` token definitions — acceptable but worth migrating to `color-mix` per §2.3).
- 571 raw `px` literals — primarily spacing. Token-ramp opportunity.
- 35 `z-index` literals — top priority for tokenization before 3D viewer.
- **Zero** raw hex literals in non-test component TSX/CSS under `features/` and `shared/` (excellent — keep this property).

### 5.3 Feature-shape conformance summary

| Conforms to standard | Diverges |
|---|---|
| `catalogs`, `projects`, `project_status` | `mcp` (missing routes/components/lib), `table_views` (top-level hook, no lib), `windows` (no components/), `auth` (no components/), `project_document` (no routes/, intentional), `equipment` (no query-keys.ts) |

### 5.4 Notes on what is intentionally NOT recommended

- **Do not** generalize the three catalog editor modals (`Material`, `FrameType`, `GlazingType`) into one component yet. Their field shapes differ enough that the abstraction would hide more than it saved. Reassess when the Assemblies builder adds a fourth.
- **Do not** split `formula/parser.ts` — parsers are legitimately long and the file is internally well-scoped.
- **Do not** convert `useEffect` calls to TanStack Query without per-case review; the existing ones are true side effects.
- **Do not** rename existing TanStack Query keys mid-flight; bundle that with the `query-keys.ts` standardization in P1.

---

*End of review.*
