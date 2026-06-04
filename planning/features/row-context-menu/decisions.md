---
DATE: 2026-06-04
TIME: 14:30
STATUS: Active
AUTHOR: Ed May / Claude
SCOPE: Row context menu — accepted/rejected decisions
RELATED:
  - planning/features/row-context-menu/PRD.md
  - planning/features/row-context-menu/README.md
---

# Row Context Menu — Decisions

Each entry: the decision, the alternative considered, and the reason
the alternative was rejected. New decisions land here first, then fold
into `PRD.md` on the same docs pass.

## D-1 — Reject "every resource ships its own duplicate endpoint"

**Accepted.** Duplicate routing is per-consumer-write-model, not per-
resource. CRUD consumers (Materials, glazing_types, frame_types) get
a server-side `POST /{resource}/{id}/duplicate`. Slice-replace
consumers (Rooms, ERV / Pumps / Fans under `project_document`) clone
client-side and dispatch their existing slice-replace `PUT`.

**Alternative rejected.** Adding `POST /api/v1/projects/{pid}/rooms/
{rid}/duplicate` (and four more for equipment) as the V1 PRD
proposed. Those resources have no per-row REST endpoints today; their
writes ride the `project_document` draft pipeline. A duplicate-only
per-row endpoint either bypasses the draft / audit / schema-mutation
pipeline or duplicates it for one verb across five resources.

**Why it matters.** The library does not assume CRUD-everywhere. The
WriteOp shape carries enough for both write models (see D-2); each
consumer's `onWrite` decides which path to take.

## D-2 — `WriteOp.rowDuplicate` carries `sourceRow` snapshot

**Accepted.** The forward `rowDuplicate` op carries `{ rowId,
sourceRowId, sourceRow, anchorRowId }` where `sourceRow` is a full
TRow snapshot at op-emit time. The library captures it from
`visibleDataRows[…]` in `DataTable.tsx`.

**Alternative rejected.** Id-only payload (V1 PRD §5). Insufficient
for slice-replace consumers because they need the full row to build
the next slice payload client-side, and re-reading `current.rooms`
inside `onWrite` is brittle (race with concurrent writes).

**Why it matters.** Both write models route the same op through
`onWrite`. CRUD ignores `sourceRow` on the forward path; slice-
replace uses it directly. Inverse `rowDelete` re-uses the snapshot
so ⌘Z is symmetric.

## D-3 — Library ships a `rowActions` extension slot

**Accepted.** `DataTableProps` gains an optional
`rowActions?: (ctx) => RowAction[]` render-prop. Mirrors the existing
`bulkSelectionActions`, `overflowMenuActions`, `footerAction`
patterns.

**Alternative rejected.** Keep the menu fixed at four items and have
consumers fork RowContextMenu for their own actions. Forks drift; the
existing render-prop precedent already proves consumers can extend
the table without forking.

**Why it matters.** Every consumer has product-specific row actions
(Materials "Submit to Phius library", Rooms "Apply assembly preset"
in the future). Solving extensibility once now is cheaper than
rewriting the menu when the first consumer ships a custom action.

## D-4 — User-facing label `Expand record`; internal prop `onOpen?`

**Accepted.** The menu item is labeled `Expand record` (AirTable
parity; matches the gutter's `Expand row N` aria-label). The
RowContextMenu prop is `onOpen?: () => void` to match the existing
`onRowOpen` prop on `DataTableProps`.

**Alternative rejected.** Three-way naming (`onRowOpen` ↔
`onExpandRow` ↔ `Expand record`) preserves the gutter's local name
but adds drift. Renaming the gutter to `onOpenRow` was considered
but is out of scope for this feature.

**Why it matters.** UI label and code identifier serve different
audiences. The asymmetry is documented; the new menu picks the
internal name closest to the public API and the user label closest
to AirTable.

## D-5 — Right-click sets the target

**Accepted.** Whichever row(s) the menu acts on are determined at
right-click time, not by prior selection state. Rules 1–3 in PRD §5
encode the cases.

**Alternative rejected.** "Right-click on a row outside the
selection extends the selection." Predictable failure mode (users
right-click to inspect, not to extend), and contradicts AirTable's
behavior.

### D-5b — Selection clear in rule 2 is irreversible

**Accepted with caveat.** When the user right-clicks a row outside
an existing 2+-row selection, the checkbox selection is cleared
immediately (so the menu's target is unambiguous). `rowSelection`
is **not** in `useGridHistory`; ⌘Z does not restore the cleared
selection.

**Alternative considered.** Defer the clear until the user actually
chooses a menu item, so Esc leaves the selection intact. Rejected
for v1 because the menu's `aria-label` would have to lie about its
target ("Row 7 actions" vs "Selected rows actions") until the user
commits. Worth revisiting if user testing surfaces complaints.

## D-6 — Duplicate is universal (no `canDuplicateRow` flag)

**Accepted.** Every row-bearing DataTable consumer supports
Duplicate. The menu does not consult a per-consumer capability flag.

**Alternative rejected.** A `canDuplicateRow?: boolean` prop or
per-row predicate. Adds API surface for a case the product wants
universally. If a future consumer needs to hide Duplicate for some
rows, its `rowActions` slot can override / suppress, or we add the
flag then.

## D-7 — Hoist `isPointerInActiveEditor` to a shared predicate

**Accepted.** Move the predicate currently inlined inside
`DataTable.tsx` into
`frontend/src/shared/ui/data-table/lib/eventTargets.ts`. Both
`useGridPointerDrag` (existing consumer) and the new contextmenu
hit-test in `GridBody.tsx` call it.

**Alternative rejected.** Inline a duplicate class-list check in the
contextmenu handler. Two lists; the next editor type (e.g. a future
date picker) would silently regress one surface.

## D-8 — Extract `useGridMenuKeyboard` hook

**Accepted.** Pull the focus / Arrow / Home / End / Esc keyboard
manager out of `HeaderContextMenu.tsx` into
`hooks/useGridMenuKeyboard.ts`. Both menus consume it.

**Alternative rejected.** Copy-paste the focus manager into
`RowContextMenu.tsx`. Two ~70-line bodies kept in sync by
convention. Drift inevitable.

## D-9 — Hand-rolled Popover, not `@radix-ui/react-context-menu`

**Accepted.** Continue using `@radix-ui/react-popover` +
`pointAnchorRef` + the new shared keyboard hook.

**Alternative considered.** Adopt `@radix-ui/react-context-menu` for
native `contextmenu` capture, native-menu suppression, Shift+F10 /
ContextMenu-key parity, focus restore, and grouped items.

**Why rejected.** (a) Visual parity with `HeaderContextMenu` is
easier when both menus share the same primitive; the new Radix
package would render differently enough to require visual reconcile
work. (b) The pnpm 24-hour minimum-release-age policy is satisfied
by any released `@radix-ui/react-context-menu` version, but adding
another `@radix-ui/*` package widens the supply-chain surface we
have to watch. (c) The keyboard / focus-restore logic the new
package replaces is ~70 lines that we already have to maintain for
`HeaderContextMenu`; D-8 brings that maintenance to one place.

Worth revisiting if a future cell-context menu lands and the
hand-rolled surface grows past a third callsite.

## D-10 — Phase 3 split into 3a / 3b / 3c

**Accepted.** Phase 3a ships the WriteOp shape + library wiring +
Materials backend + Materials frontend + tests. Phases 3b and 3c
ship Rooms and Pumps respectively against the stable WriteOp
contract, with no further library changes.

**Alternative rejected.** One monolithic Phase 3 that touches all
five resources. The risks-and-open-questions §11 of the V1 PRD
already flagged this; with no users and no deploys, the cost of one
bad merge in a five-resource PR outweighs the small overhead of
three sequential PRs.

## D-11 — `(copy)` suffix helper homes

**Accepted.** Backend helper lives at
`backend/features/catalogs/_shared.py::next_copy_suffix`. Frontend
helper lives at
`frontend/src/features/equipment/lib.ts::nextCopySuffix` (and is
promoted to a shared util when a third consumer needs it).

**Alternative rejected.** A top-level `backend/features/shared/
duplicate.py`. "Duplicate" is too generic for the shared namespace
and the helper is catalog-specific; slice-replace consumers handle
their own suffix logic in TS.

## D-12 — Test scope follows gesture surfaces, not menu items

**Accepted.** Playwright e2e covers one gesture per surface (mouse
right-click, keyboard Shift+F10 / ContextMenu key, viewer-mode
fallthrough, editor-scope suppression) plus one per-consumer
Duplicate happy path (Materials, Rooms). Insert / Expand / Delete
happy paths are already covered by existing `rowInsert` / `rowDelete`
e2e suites — those tests need new assertions about the menu surface,
not new tests.

**Alternative rejected.** One e2e per menu item per consumer. Five
items × N consumers = combinatoric test growth for happy paths the
existing suites already exercise.
