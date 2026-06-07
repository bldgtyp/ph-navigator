---
DATE: 2026-06-07
TIME: (review compiled this date)
STATUS: Review only — no code changed
AUTHOR: Claude (Opus 4.7) via four parallel `feature-dev:code-reviewer` agents
SCOPE: Post-13-phase quality review of the Aperture-Builder feature
       (frontend `features/apertures/` + backend `aperture_commands`,
       `aperture_drift`, `aperture_u_value`, `aperture_hbjson_export`,
       `apertures_mcp`, `project_document/apertures`)
RELATED:
  - planning/archive/apertures-cleanup/PRD.md (existing backlog —
    findings below are deliberately *not* duplicates of A.1–F items)
  - planning/archive/apertures/STATUS.md (final state of the 13-phase build)
---

# Aperture-Builder — Code Quality Review

A focused review run after the 13 build-out phases shipped, before
moving on to the next feature area. Goal: surface refactor candidates
that the existing `apertures-cleanup/PRD.md` backlog does NOT already
cover, and call out the things that are healthy enough to leave alone.

Four parallel `feature-dev:code-reviewer` agents covered:

1. Frontend canvas + SVG + dimension chrome
2. Frontend builder state + sidebar + pickers + drift surfaces
3. Backend `aperture_commands` + `project_document/apertures` doc layer
4. Backend cross-cutting (`aperture_drift`, `aperture_u_value`,
   `aperture_hbjson_export`, `apertures_mcp`)

Each agent read the planning PRD first and excluded items already there.

---

## TL;DR — the priority list

In rough ship order (highest correctness/maintenance value first):

1. **Extract shared handler helpers** — `_find_entry`, `_find_element`,
   `_replace_aperture`, `_replace_element`, `_audit` are duplicated
   across 5–6 backend handler files; one has a divergent signature
   (`refresh.py`). **(Backend §1, 2, 3)**
2. **Unify `_refresh_origin` semantics** — three identical-looking
   copies, with `merge_split.py` deliberately diverging on
   `local_overrides`. This is a real maintenance trap.
   **(Backend §4)**
3. **Fix the undo-stack pop in the builder store** — `popUndoEntry`
   reads a `let popped` variable from outside `set()`. Currently
   works because Zustand is synchronous, but breaks the contract.
   Tests don't catch it because the undo paths are untested.
   **(Frontend §5 + §13)**
4. **Drift-report cross-cutting fixes** — N+1 catalog queries
   (300+ DB round-trips for a 20-type doc), duplicate `_LiveCatalogReader`
   across REST + MCP, and the missing invalidation of the drift query
   after `refreshRefFromCatalog`. **(Backend §8, 9; Frontend §12)**
5. **Consolidate catalog-document loading** — same 4-line
   `if source == "draft" / else` block appears in 4 places.
   **(Backend §10)**
6. **Memoize the canvas mirror + share pixel dims** — `mirrorApertureForInterior`
   recomputes in three siblings; `pxW`/`pxH` is computed twice.
   **(Frontend §1, 2)**
7. **Extract test fixture builders** — five test files redefine the
   same `frame()` / `glazing()` / `element()` / `entry()` helpers.
   **(Frontend §3)**
8. **Naming and WHY-comment hygiene** — handful of small,
   high-leverage edits called out below.
9. **Test coverage holes** — listed at the bottom; modest scope.

The two big-file candidates (`AperturesTab.tsx` 431, `ApertureCanvasContainer.tsx`
432, `dimensions.py` 420, `models.py` 292) were each reviewed for a
split. **Only `ApertureCanvasContainer.tsx` warrants extraction**
(two small hooks). The others are appropriately sized for what they do.

---

## Frontend findings

### Canvas + SVG + dimension chrome

#### §1. `mirrorApertureForInterior` runs in three siblings, none of them shared (High)

**Files:** `components/ApertureCanvasContainer.tsx:185`,
`components/ApertureCanvasOverlay.tsx:70-73`,
`components/ApertureSvgCanvas.tsx:23`

Container computes `rendered` via a bare assignment (no `useMemo`).
Overlay re-mirrors inside a `useMemo`. Canvas re-mirrors inline. All
three are driven by the same `(aperture, viewDirection)` pair, so on
every render each independently walks every element and reverses the
column array. More importantly, the container passes the *original*
`aperture` to canvas/overlay (which mirror themselves) but the
*already-mirrored* `rendered` to `HorizontalDimensionStrip`. The
asymmetry is load-bearing and a future fourth consumer will get it
wrong.

**Fix:** Compute `rendered` once in the container with `useMemo`,
pass it to all three consumers under an explicit `displayedAperture`
prop. Both leaf components drop their internal mirror call. Medium
refactor; touches three components plus tests.

#### §2. Container and overlay re-derive identical `pxW`/`pxH` (High)

**Files:** `components/ApertureCanvasOverlay.tsx:75-78`,
`components/ApertureCanvasContainer.tsx:186-189`

Overlay must align pixel-perfect with the stage `<div>` the container
sized. Two independent computations of the same value are a silent
drift hazard.

**Fix:** Pass `pxW`/`pxH` as props, or extract
`useCanvasPixelDimensions(widthMm, heightMm, zoom)`. Tiny.

#### §3. Five test files redefine the same fixture builders (High)

**Files:** `__tests__/aperture-geometry.test.ts:15-75`,
`__tests__/ApertureCanvasOverlay.test.tsx:7-67`,
`__tests__/ApertureSvgCanvas.test.tsx:6-71`,
`__tests__/operation-frame-match.test.ts:5-47`,
`__tests__/ApertureCanvasContainer.test.tsx:13-35`

Each declares its own `frame()`, `glazing()`, `element()`, `entry()`
helpers. `FrameRef` is 17 fields. `ApertureSvgCanvas`'s copy already
diverges with a `color` param. A schema change requires five parallel
edits.

**Fix:** Extract `__tests__/test-fixtures.ts` with `Partial<FrameRef>`
override params. Medium pure-extraction.

#### §4. `ViewDirection` declared in two modules; `ApertureViewDirection` is a third alias (Medium)

**Files:** `operation-symbols.ts:12`, `frame-label-map.ts:12`,
`components/ApertureSvgCanvas.tsx`

Same `"exterior" | "interior"` union, three names. Move to `types.ts`,
re-export. Small.

#### §5. `ApertureCanvasContainer` conflates three concerns (Medium)

**File:** `components/ApertureCanvasContainer.tsx` (432 lines)

Three orthogonal concerns share the render body:

- zoom + view-direction state (lines 117, 166-183)
- delete-confirmation orchestration (lines 119, 214-243)
- pick-paste delegation (lines 133-144)

Two small hooks would land it under 350 LOC of clean prop-wiring:
`useDeleteDimensionOrchestrator(aperture, onDeleteRow, onDeleteColumn)`
and `useCanvasViewState(aperture, scrollRef)`. Medium, no behavior
change.

#### §6. Other canvas-area items (Medium / Low)

- `LAST_ROW_REASON` / `LAST_COLUMN_REASON` duplicated string constants
  in both dimension strips; move to `canvas-constants.ts`.
- `ApertureCanvasContainer.tsx:104` uses an inline `import("../types")`
  type expression — fold into the top-of-file named import.
- `noDeleteTooltipShown` module-level flag at
  `ApertureCanvasContainer.tsx:55` leaks across Vitest tests in the
  same worker; either reset in `beforeEach` or move into component state.
- `OperationRow.tsx:51-59` renders three blank `"-"` cells purely for
  table alignment — add a one-line WHY comment.
- `elementRegionsMm` returns canvas-absolute coordinates;
  `ApertureHitTarget.tsx:30-31` is the only place that subtracts
  `parentRect`. Add a one-sentence note at the consumer site to
  prevent silent positioning bugs in future consumers.
- `VerticalDimensionStrip` has no dedicated unit test (the horizontal
  sibling has four).
- `TotalDimensionsCaption` has no test — `ft-in` / `in-frac` format
  paths are untested.
- `EdgeAddButtons.tsx` appears unreferenced — confirm dead code from
  Phase 05's superseded edge-insert design and delete if so.
- `hooks/useApertureDimFormat.ts` has no test; the `SI_VALUES.has`
  fallback guard is untested.

### Builder state + sidebar + pickers + drift

#### §7. `popUndoEntry` reads a closure variable mutated by `set()` (High)

**File:** `store/builder-store.ts:179-191`

```ts
let popped: PasteUndoEntry | null = null;
set((state) => { /* popped = stack.at(-1); ... */ });
return popped;
```

Works today because Zustand `set()` is synchronous. Breaks the
contract — under React 18 concurrent batching this becomes a silent
`null` return while the state has already mutated. Lost undo, no
error.

**Fix:** Read with `getState()`, then `set()` — or use the `get`
parameter in the `create` callback. ~15 LOC.

#### §8. `useFrameCatalog` fires the "all" query unconditionally — multiplies catalog traffic (High)

**Files:** `hooks/useFrameCatalog.ts:48-53`,
`hooks/useGlazingCatalog.ts:31-36`,
`components/FramePicker.tsx:36-44`

Both hooks always run a second `useQuery` for the unfiltered universe
to provide the "Showing N of M" count. `FramePicker` then calls the
hook *again* internally for `selectedRow` lookup, producing three
queries per picker mount. An aperture with 4 elements × 4 sides
registers 48 subscribers on first render (network deduplicates, but
TanStack still tracks staleness per subscriber).

**Fix:** Lift the "totals" query to a single shared hook or context
above the card stack; pass `totalRows` down as a prop. Medium.

#### §9. `RefreshDialog` reseed effect can silently desync from drift query (High)

**File:** `components/RefreshDialog.tsx:47-53`

The seed `useEffect` lists only `seedKey` and reads `entry.deltas`
outside the deps with an `eslint-disable`. The drift query has
`staleTime: 0` and can refetch while the dialog is open — same
`element_id:target` but different delta set leaves the dialog
showing stale rows.

**Fix:** Include `entry` in deps and accept the harmless re-seed
(`setRows` is idempotent), or hash the delta set into `seedKey`.

#### §10. `FramePicker` / `GlazingPicker` apply the manufacturer filter to the "all rows" lookup (Medium)

**Files:** `components/FramePicker.tsx:40-44`,
`components/GlazingPicker.tsx:30`

The variable is named `allRows` but the call still passes
`effectiveManufacturers`. If the currently-assigned frame's
manufacturer is filtered out, `selectedRow` becomes undefined and
the picker silently drops the current-value chip. Pass no
`manufacturers` for the "all" call.

#### §11. `SIDES` constant duplicated three ways (High)

**Files:** `lib/inUseManufacturers.ts:16`, `lib/refsAggregation.ts:35`,
`components/ApertureElementCard.tsx:35` (`ALL_SIDES`)

Same `["top", "right", "bottom", "left"]` array, three places. Order
matters in both aggregators. Move to `types.ts` (or a
`lib/aperture-constants.ts`); import everywhere.

#### §12. Drift report not invalidated after `refreshRefFromCatalog` (Medium)

**Files:** `hooks/useApertureDriftReport.ts:15`, `hooks.ts`

`useApertureUValues` has an exported `apertureUValuesQueryKey()`
factory and is invalidated after relevant mutations.
`useApertureDriftReport` uses a plain inline array, has no factory,
and is not invalidated after `refreshRefFromCatalog` succeeds. The
banner stays stale until the user navigates away and back.

**Fix:** Export `apertureDriftReportQueryKey()`. Add the
invalidation hook in `hooks.ts`.

#### §13. Builder-store test coverage is thin (Medium)

**File:** `__tests__/builder-store.test.ts`

Covers selection/hover setters; zero coverage for `pushUndoEntry`,
`popUndoEntry`, `clearUndoStack`, `clearAllUndoStacks`,
`pickPasteAction`, `dismissOperationWarning`. The undo-stack pop bug
(§7) would not be caught by the current suite.

#### §14. `ProjectRefsView` aggregations rerun on every modal tab click (Medium)

**File:** `components/ProjectRefsView.tsx:29-30`

Both `aggregateFrameRefs` and `aggregateGlazingRefs` walk every
element × side on every render. Tab switching triggers the walk
even though `apertures` is stable. Wrap in `useMemo([apertures])`.

#### §15. Other state/picker items (Medium / Low)

- `pick-paste-machine.ts:28` has a dead ternary
  (`current === "idle" ? "idle" : "idle"`) — collapse to
  `return "idle"`. Looks like a copy-paste lapse; not a bug, but
  a future reader will look for an intended branch difference.
- `ManufacturerFiltersModal.arraysEqual` is correct, but the
  `null → explicit-all → null` round-trip story is non-obvious;
  add a brief comment on `arraysEqual` documenting the
  set-semantics invariant.
- `UValueChip.tsx:35-36` strips `"Window U-Value: "` / `"U-Value: "`
  prefixes via `String.replace()` from `formatWindowUValue` output —
  a leaky abstraction. Add a `formatUValueNumeric()` helper that
  returns just the number+unit.
- `usePickPasteHandlers.undoLastPaste` calls `onPasteAssignment` with
  `target === source` to revert; the `pasteOnto` guard exists to
  prevent self-paste — add a one-line WHY comment that undo
  deliberately uses self-paste as the revert path.
- `pick-paste-machine.ts` exports `PickPasteMode`; `builder-store.ts`
  re-declares the same union as `AperturePickPasteMode`. Re-export
  the single source.
- `AperturesTab.tsx:147-165` constructs `exportContext` /
  `filtersContext` / `refsContext` only to destructure them at the
  call site. Pass props directly; removes 18 lines of indirection.
- `usePickPasteHandlers` has no test — the self-paste guard and
  undo-revert payload are untested.
- `RefreshDialog.stringify:212-216` has a dead `typeof "number"`
  branch identical to the fallthrough.

### Healthy as-is

- `AperturesTab.tsx` at 431 lines is appropriate page composition.
  The long prop chain to the container is one prop per distinct
  command — not coupling.
- `builder-store.ts` is correctly scoped to ephemeral UI state only.
  No extraction needed.
- `pick-paste-machine` is well-separated as a pure state machine
  with full test coverage; the gap is at the React-integration
  layer (§13, §15).

---

## Backend findings

### `aperture_commands` + document-layer `apertures/`

#### §1. Five helper functions duplicated across every handler file (Critical)

**Files (each contains its own copy):** `handlers/dimensions.py`,
`handlers/merge_split.py`, `handlers/picks.py`, `handlers/refresh.py`,
`handlers/element.py`, `handlers/paste.py`

| Helper                  | Copies |
|-------------------------|--------|
| `_find_entry`           | 5      |
| `_replace_aperture`     | 4      |
| `_find_element`         | 3      |
| `_replace_element`      | 4      |
| `_audit`                | 6      |

Byte-for-byte identical (except §3 below). Every invariant change —
e.g., adding structured logging to lookup failures, tightening the
audit payload — must be applied 6×.

**Fix:** Create `aperture_commands/handlers/_shared.py` exporting
`find_entry`, `find_element`, `replace_aperture`,
`replace_element`, `build_audit`. Mechanical grep-replace across 6
files; ~60 LOC of new module.

#### §2. Document layer also has duplicated helpers (Important)

**Files:** `apertures/factories.py` and `handlers/dimensions.py`

`_bookshelf_copy_frame` and `_bookshelf_copy_glazing` are duplicated
with identical bodies. Same `_shared.py` candidate as §1.

#### §3. `refresh.py:_audit` has a divergent signature (Important)

**File:** `handlers/refresh.py:178`

`def _audit(actor_user_id: str, **payload)` — no `kind` parameter.
Every other handler is `def _audit(kind: str, actor_user_id: str,
**payload)`. Works today because `refresh.py` is single-command and
hardcodes the lookup. Breaks the "one pattern across all handlers"
assumption stated in the architecture docs and will trip a future
sibling command added to that module. Align before merging into the
shared helper (§1).

#### §4. `_refresh_origin` triplicated with one silent semantic divergence (Critical)

**Files:**
- `apertures/factories.py:126` — resets `local_overrides: []`
- `handlers/dimensions.py:407` — resets `local_overrides: []`
- `handlers/merge_split.py:222` — **preserves** `local_overrides`

The merge-split variant's behavior is correct (split copies must
preserve overrides on the source side). But the function has the
same name and signature as the resetting copies, with no WHY-doc
explaining why split is different. A future developer will either
unify (breaking split) or copy the wrong variant into a new handler.

**Fix:** Two named functions in `apertures/_ref_helpers.py`:
- `reset_origin(...)` — resets `local_overrides` (create / add-row /
  pick path)
- `advance_origin(...)` — preserves `local_overrides` (split /
  duplicate path)

Each gets a docstring naming the invariant.

#### §5. `_add_along_axis` shallow-copies seeded frames (Important)

**File:** `handlers/dimensions.py:245-259, 384-392`

`frame_copy = ...model_copy()` is created once before the loop and
each new element calls `model_copy()` again per side. Today
`FrameRef` is all primitives + a Pydantic-model `CatalogOrigin`, so
shallow-copy is safe. The split handler defensively uses `deep=True`.
Inconsistent and creates a latent aliasing bug if `FrameRef` ever
grows a mutable field.

**Fix:** Pass `deep=True` to the `model_copy()` calls in
`_build_seeded_element`. One-line change.

#### §6. `MergeElements.element_ids` has no upper bound (Minor)

**File:** `aperture_commands/models.py:127`

`min_length=2` is set; no `max_length`. `_validate_rectangle`
enumerates O(N²) cells. Not a practical DOS vector at current grid
limits, but tighten with `max_length=400` matching the grid ceiling.

#### §7. `sidebar.py` uses raw integer HTTP status codes (Minor)

**File:** `handlers/sidebar.py:64, 138`

`api_error(404, ...)` / `api_error(422, ...)` while every other
handler uses `status.HTTP_404_NOT_FOUND` etc. Match house style.

#### §8. Dead import in `service.py` (Trivial)

**File:** `aperture_commands/service.py:102`

`_ = document_etag` with an aspirational comment. Will trip stricter
lint configs. Either use it or remove it.

### Cross-cutting (`aperture_drift`, `u_value`, `hbjson_export`, `apertures_mcp`)

#### §9. Drift detection is N+1 with one DB connection per catalog lookup (Critical)

**Files:** `aperture_drift/routes.py:35-49`,
`aperture_drift/detector.py:51-53`,
`apertures_mcp/tools.py:266-279`

`_LiveCatalogReader.get_frame_type` / `.get_glazing_type` open a fresh
`connection()` per call. The detector loops over every element × every
side (up to 5 catalog reads per element). A 20-aperture-type doc with
3 elements each = up to **300 DB round-trips per drift-report request**.

**Fix:** Bulk-fetch all referenced catalog record IDs into a
`dict[str, row]` map before the walk, or thread a single `conn` from
the route through the reader. Combine with §10.

#### §10. `_LiveCatalogReader` is duplicated in REST + MCP modules (Critical)

**Files:** `aperture_drift/routes.py:35-49`,
`apertures_mcp/tools.py:266-279`

Identical class, identical body. Adding a tenant filter or rate
limit means two edits.

**Fix:** Move the concrete reader to `aperture_drift/reader.py`;
`tools.py` imports it. Trivial.

#### §11. `_read_body` in MCP can implicitly return `None` (Critical)

**File:** `apertures_mcp/tools.py:205-225`

`except: raise_http_exception_as_mcp_error(...)` — that helper raises
`ToolError`, so control doesn't return. But the helper is not
annotated `-> NoReturn`, so the type checker treats the except branch
as falling off the end. The function's declared return is
`ProjectDocumentV1`. If the helper's behavior ever changes to return
normally (a refactor regression), every caller will receive `None`
and crash deep inside document walks. FastAPI middleware catches this
in REST routes; MCP tools have no equivalent safety net.

**Fix:** Add `-> NoReturn` to `raise_http_exception_as_mcp_error`, or
`raise` unconditionally after the helper call. One-line.

#### §12. Document-loading pattern triplicated across REST routes + MCP (Important)

**Files:** `aperture_drift/routes.py:60-64`,
`aperture_u_value/routes.py:46-49`,
`aperture_hbjson_export/routes.py:46-50`,
`apertures_mcp/tools.py:_read_body`

The same `if source == "draft": ... else: ...` block, four times,
each calling `get_current_document_view` vs `get_saved_document`.
Adding a `"published"` source means four edits.

**Fix:** `load_document_body(version_id, access, source)` helper in
`project_document/store.py`. Each route becomes one line.

#### §13. `_validate_command` rebuilds a Pydantic model class on every MCP write (Important)

**File:** `apertures_mcp/tools.py:241-263`

`class _Wrap(BaseModel)` is declared inside the function body. Pydantic
v2 builds the JSON schema and validator on class creation. For
high-frequency MCP calls this is real per-call overhead and produces
a new class object per call.

**Fix:** Hoist `_Wrap` to module scope as a private class.

#### §14. `aperture_u_value/cache.py` docstring claims FIFO; behavior is LRU (Important)

**Files:** `aperture_u_value/cache.py:8-10, 45-46`

Docstring says "FIFO (insertion order)." `get()` calls `move_to_end`,
making it LRU. Not a bug, but the documented rationale for the 256
capacity assumes FIFO. Either remove `move_to_end` from `get` (which
is what the docstring promises) or fix the docstring.

#### §15. `Collision.model_dump` is a hand-rolled dict method on a `@dataclass` (Important)

**File:** `aperture_hbjson_export/identifiers.py:55-57`

`Collision` is `@dataclass(frozen=True)` but defines a method named
`model_dump()` that returns a hand-built dict. Caller in `service.py:86`
expects Pydantic semantics. Adding a field requires hand-updating the
method (no enforcement). Either make `Collision` a `BaseModel` (the
house convention for wire shapes) or use `dataclasses.asdict`.

### Healthy as-is

- The dispatcher is a thin lookup table plus `validate_document`;
  no business logic has leaked in.
- `aperture_commands/models.py` at 292 lines is appropriately
  scoped to wire shapes + the audit-kind map.
- `dimensions.py` at 420 lines does not need to split — five public
  handlers + two axis-generic core functions + helpers, all on a
  single coherent boundary.
- `merge_split.py` at 281 lines is similarly coherent.
- Pydantic v2 usage is consistently clean — `ConfigDict(extra="forbid")`
  on every command model, no v1 idioms found.
- Coupling is appropriate: `aperture_commands` imports from
  `project_document.document` (shared types) and `apertures.factories`
  (protocol). It does not reach into `repository` or `routes`.
- Cohesion is good across the four cross-cutting features —
  detection / comparison / formatting / caching are correctly split.
- Naming consistency across drift / u-value / hbjson-export /
  apertures-mcp is good — `catalog_origin`, `local_overrides`,
  `field_delta`, `catalog_row_missing`, `refresh` are used
  identically across modules.

---

## Documentation

The `planning/archive/apertures-cleanup/PRD.md` backlog accurately
reflects what was deferred during the 13-phase build and is the
authoritative starting point for any cleanup phase. Nothing in this
review contradicts it.

The archived per-phase docs at `planning/archive/apertures/phases/`
remain accurate as historical context.

WHY-doc gaps worth adding inline (small, high-leverage):

- `aperture-geometry.ts` header note that all `rect` values are
  canvas-absolute coordinates.
- `ApertureHitTarget.tsx` note that consumer must subtract
  `parentRect.x/y` to convert to element-local CSS.
- `merge_split._refresh_origin` invariant — why `local_overrides`
  is preserved on split (will become moot once unified per §4).
- `OperationRow` three-blank-cells alignment comment.
- `usePickPasteHandlers.undoLastPaste` self-paste-is-revert comment.
- `ManufacturerFiltersModal.arraysEqual` set-semantics + null
  semantics comment.

No standalone WHY docstring drift was found — the existing module
docstrings on `dimensions.py`, `merge_split.py`, `aperture-geometry.ts`,
and `pick-paste-machine.ts` are accurate to current behavior.

---

## Test coverage gaps (consolidated)

Frontend:

- `__tests__/builder-store.test.ts` — undo stack push/pop/trim/clear;
  `pickPasteAction` transitions; `dismissOperationWarning`.
- `__tests__/usePickPasteHandlers.test.ts` (new file) — self-paste
  guard, undo revert payload, flash side effect.
- `__tests__/VerticalDimensionStrip.test.tsx` (new file) — mirror the
  four horizontal-strip tests on the row axis.
- `__tests__/TotalDimensionsCaption.test.tsx` (new file) — `mm`,
  `ft-in`, `in-frac` format paths.
- `__tests__/useApertureDimFormat.test.ts` (new file) — localStorage
  default / valid / invalid-fallback round-trip.

Backend:

- `test_aperture_commands_picks.py` — hand-entered glazing rejection
  path (analogue of the frame test exists; glazing version doesn't).
- `test_aperture_commands_refresh.py` — `target == "glazing"` branch
  (every existing test hits `frame.top`).
- `test_aperture_commands_dimensions.py` — `addRow`/`addColumn` with
  `at_index > len(dims)` out-of-bounds error path.
- `test_aperture_commands_sidebar.py` — `duplicateApertureType`
  preservation of `catalog_origin` / `synced_at` on cloned elements.
- `test_aperture_commands_paste.py` — paste from a source with
  `glazing=None` onto a target that previously had glazing.

Pre-existing backlog items (E.1 Playwright E2E, E.2 V1 fixture parity,
E.3 BuilderDriftBanner / ProjectRefsView smoke tests) are NOT
re-listed here.

---

## Suggested phase grouping

If the next pass becomes a real cleanup phase, the findings naturally
group into three coordinated PRs:

**Phase C-02 — Backend helper consolidation** (largest payoff)

- §1 `aperture_commands/handlers/_shared.py` extraction (6 files)
- §2 document-layer `_bookshelf_copy_*` consolidation
- §3 align `refresh.py:_audit` signature
- §4 split `_refresh_origin` into `reset_origin` / `advance_origin`
- §5 `model_copy(deep=True)` consistency
- §7, §8 (sidebar status codes, dead import)

**Phase C-03 — Drift correctness + cross-cutting** (high user impact)

- §9 N+1 bulk-fetch
- §10 deduplicate `_LiveCatalogReader`
- §12 shared `load_document_body` helper
- §13 hoist `_Wrap` class
- §14 cache LRU/FIFO docstring
- §15 `Collision` Pydantic-or-asdict
- §11 `_read_body` NoReturn annotation
- Frontend §12 drift query invalidation + key factory

**Phase C-04 — Frontend hygiene** (UI-only, low blast radius)

- Frontend §1, §2 mirror + pixel-dim consolidation
- Frontend §3 shared fixture builders
- Frontend §5 canvas-container hook extraction
- Frontend §7 popUndoEntry contract fix
- Frontend §8 catalog-totals hoist
- Frontend §9 RefreshDialog seed-effect deps
- Frontend §10 picker manufacturer-filter bug
- Frontend §11 unified `ALL_SIDES`
- Frontend §14 `ProjectRefsView` memoization
- The §15 polish bundle
- Coverage holes listed above

A.1–A.6 from the existing backlog (the `Window*` → `Aperture*`
rename) should still come **before** any of the above — the rename
will touch many of the same files and is the biggest source of
churn-cost if done separately.

---

## Bottom line

The Aperture-Builder is structurally sound. The 13 phases left a
codebase with clean dispatcher-handler separation, well-isolated
features, consistent Pydantic v2 usage, and clean coupling. The
issues found are real but local — three categories dominate:

1. **Mechanical duplication** (handler helpers, `_LiveCatalogReader`,
   document loading, test fixtures, `ViewDirection`, `SIDES`) —
   straightforward to consolidate, no design questions.
2. **A handful of latent contract violations** (Zustand pop,
   `_read_body` implicit `None`, FIFO/LRU docstring, `Collision`
   `model_dump`) — small fixes, real correctness value.
3. **One genuine performance issue** (drift detection N+1) — the
   only finding with user-visible impact today.

The big files (`AperturesTab.tsx`, `ApertureCanvasContainer.tsx`,
`dimensions.py`, `merge_split.py`, `models.py`) are mostly
appropriately sized for what they do. Only `ApertureCanvasContainer`
warrants a small two-hook extraction.

No "rip it up and rewrite" recommendations.
