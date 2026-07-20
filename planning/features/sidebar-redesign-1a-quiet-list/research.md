---
DATE: 2026-07-20
TIME: 17:10 EDT
STATUS: Active
AUTHOR: Claude (Opus 4.8)
SCOPE: Code-verification of the current element sidebar against the 1A "Quiet
  List" handoff, before any implementation.
RELATED:
  - assets/1A-Quiet-List-Handoff.md
  - PRD.md
  - context/DESIGN_SYSTEM.md
  - frontend/src/shared/ui/element-sidebar/
  - frontend/src/features/sidebar_views/
---

# Research — Current Sidebar vs. 1A "Quiet List"

The single most important finding, up front:

> **1A is a restyle of ONE already-shared component. It is not a new feature and
> needs NO domain-document schema migration and NO new backend commands.**
> Sort mode (A–Z / Manual), dnd-kit drag-to-reorder, and groups already ship,
> already persist, and are already shared by both the Envelope and Aperture
> sidebars. The "loud" before-state in the handoff is the *real running app*, not
> a mock. What changes is appearance, density, and a few interaction details.

## 1. The component is already shared

Both sidebars are thin adapters over `frontend/src/shared/ui/element-sidebar/`:

| File | Lines | Owns |
| --- | --- | --- |
| `element-sidebar/ElementSidebar.tsx` | 207 | Shell: header (`<h2>` + add `+` + collapse toggle), the `SortModeToggle` "Order" control (L165-206), list dispatch (static / grouped tree / flat sortable, L133-159), the "New group" button (L147-157). |
| `element-sidebar/rows.tsx` | 301 | `SortableRows` (dnd-kit ctx), `StaticRow`, `SortableRow` (`GripVertical` handle, L109-118), `ElementSidebarRowBody` (hover actions, L124-185), `MoveToGroupSelect` native `<select>` (L192-219), `ElementSidebarRowLink` (NavLink/button + leading icon, L221-265), `SidebarActionButton` (L267-300). |
| `element-sidebar/GroupedList.tsx` | 159 | Manual-mode group tree: collapsible `GroupSection` w/ up/down + rename + delete (L55-158), "Ungrouped" remainder (L38-50). |
| `element-sidebar/types.ts` | 106 | Full prop contract (`ElementSidebarItem`, `…Organization`, `RowContext`, …). |
| `element-sidebar/element-sidebar.css` | 395 | All appearance. Plain BEM-ish `.element-sidebar__*`, tokens only. |

Feature adapters (data + behavior only, no styling):

- `frontend/src/features/envelope/components/EnvelopeSidebar.tsx` (123) — rendered
  by `EnvelopePage.tsx` (~L406-426). Routing nav (`mode:"link"`), leading
  assembly-type icon (`assemblyTypeIcon`, L111-122: wall→`BrickWall`,
  roof→`House`, floor→`Layers`, other→`CircleHelp`), **four** row actions:
  `change-type` (`Shapes`), `duplicate` (`Copy`), `delete` (`Trash2`) + the
  built-in rename (`Pencil`).
- `frontend/src/features/apertures/components/ApertureSidebar.tsx` (88) — rendered
  by `AperturesTab.tsx` (L421-439). Selection nav (`mode:"select"`), **no leading
  icon**, **two** row actions (`duplicate`, `delete`) + built-in rename, add
  button hidden for viewers.

Because the component is shared, **the restyle reaches both pages at once.** The
only per-page work is resolving the two adapter deltas above (aperture type
icons; the envelope `change-type` action) — see `decisions.md`.

## 2. Ordering + groups already persist (as user view-state, NOT the document)

State lives in `frontend/src/features/sidebar_views/`:

- `useSidebarOrganization.ts` (176) — composes ordering/grouping + persistence;
  exposes `sortMode`, `orderedItems`, `groups`, `ungrouped`, `hasGroups`, and the
  `on*` callbacks. Switching to manual with no saved order **freezes the current
  display order** (L104-109) — exactly the 1A §9 requirement, already done.
- `hooks.ts` `useProjectSidebarViewState` (153) — loads + **debounced 500 ms**
  saves; editors only (viewers get in-memory defaults, no I/O).
- `types.ts` — `SidebarViewState = { sort_mode, order: string[], groups:
  SidebarGroup[], collapsed_group_ids: string[] }`; `SidebarGroup = { id, label,
  member_ids: string[] }`; `SIDEBAR_VIEW_SCHEMA_VERSION = 1`; default
  `"alphabetical"`.
- `groups.ts` (139), `lib.ts`, `api.ts` — pure immutable group ops + REST client.
- `toElementSidebarOrganization.ts` (28) — bridges the hook to the component's
  `organization` prop; used identically by both adapters.

Backend: `backend/features/sidebar_views/` — `routes.py`
(`GET/PUT/DELETE /api/v1/projects/{project_id}/sidebar-views/{view_key}`, gated
by `require_project_edit_access`), `repository.py` (raw-SQL upsert into
**`user_sidebar_views`**, PK `(user_id, project_id, view_key)`, `view_state`
JSONB, `MAX_VIEW_STATE_BYTES=65536`). Tests: `backend/tests/test_sidebar_views.py`.

**Persistence is per-user, per-project, per-sidebar view-state — opaque JSONB.**
It is NOT localStorage and NOT the shared project document.

## 3. The domain document has NO ordering/group fields (and doesn't need any)

- `backend/features/project_document/document.py` L360 `assemblies: list[Assembly]`,
  L364 `apertures: list[ApertureTypeEntry]` — plain lists; list position is array
  order only.
- `Assembly` (`backend/features/project_document/envelope_models.py` L196-230):
  `id, name, type, orientation, layers` — **no `order`, no `group`**.
- `ApertureTypeEntry` (same file, ~L490): `id, name, row_heights_mm,
  column_widths_mm, elements` — **no `order`, no `group`**.
- The 29 envelope semantic commands (`context/technical-requirements/envelope-commands.md`)
  include `create/rename/duplicate/delete/update_type/flip_*` — **no reorder, no
  group command**. Correct, because ordering/grouping is view-state, not shared
  domain data.
- `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION = 8` (`document.py` L220). **1A touches
  none of this.** The only schema that could evolve is the frontend-owned
  `sidebar_views` view-state (currently v1) — and 1A needs no change there either
  (it removes chrome, not data).
- NB: the `order: int` fields on layers/segments in `envelope_models.py` are
  *within-assembly cross-section* ordering, unrelated to the sidebar list.

## 4. Styling + guardrails (what the restyle must obey)

- Plain hand-written CSS on the 3-tier token system; no Tailwind/CSS-modules.
  Icons are **`lucide-react`** everywhere. DnD is **`@dnd-kit`**
  (`core`/`sortable`/`utilities`), `PointerSensor` 4px activation + `KeyboardSensor`.
- **Guards in `pnpm run check:all` → CI** (DESIGN_SYSTEM §Guards):
  `check:hex` (no raw hex — every color a `var()`), `check:css-vars` (every
  `var()` resolves), `check:typography` (font size/weight/tracking/line-height
  from the `--fs-*`/`--fw-*`/`--tracking-*`/`--lh-*` vocabulary only, **zero-debt,
  29-variant ceiling**), `check:z-index`, `check:sizes` (≤500 lines),
  `check:shape`. **Every 1A pixel value must land as a token, not a literal.**
- App reality vs. 1A's sampled hexes (handoff §2 anticipates this — "map to
  existing tokens"):

  | 1A value | 1A role | App token to use |
  | --- | --- | --- |
  | `#2C7A8C` teal | active tab underline, selected icon | `--accent` (`#3E93AE`) |
  | `#1D5F6E` teal-ink | selected row text, ghost-action hover | `--accent-text` (= `--accent-dark` `#2d6b80`) |
  | `#E7F1F4` teal-fill | selected row bg | `--accent-light` (`#d6ebf1`) or `color-mix(--accent …)` |
  | `#F3F3F1` neutral wash | row hover bg | **new token** (neutral; see below) |
  | `#161616` / `#242424` | title / row text | `--text-primary` (`#111111`) |
  | `#9C9C97` / `#5F5F5B` | muted / secondary | `--text-muted` / `--text-secondary` |
  | `#B6B6B1` grip | drag-handle | `--text-muted` (or a new `--sidebar-grip`) |
  | `#C0492F` danger | delete-on-hover | `--phn-danger` / `--phn-danger-bg` (already wired, css L372-376) |
  | `#EAEAE6` / `#EFEFEB` | hairline / group rule | `--border-subtle` (`#e5e7eb`) |
  | `Inter` | UI font | `--font-primary` (**Geist** renders — app overrides brand's Outfit) |
  | panel radius `16px` | outer card | N/A — sidebar is **docked** (css L11 `--radius-md` left corners), not a floating card; keep existing width `260px` (css L19) & no shadow. |

  Genuinely-new tokens 1A implies (add to `styles/tokens.css`): a **neutral row
  hover wash** (today hover is accent-tinted, `color-mix(--accent 10%)`, css
  L127-128 — 1A wants a *neutral* wash so only selection carries teal), and
  optionally a **grip rest color/opacity** and the **action-cluster scrim** stop.
- Dark theme: 1A is light-only hexes; the app is light-today-but-token-safe.
  Using semantic tokens keeps dark-mode viable for free — a hard-coded 1A hex
  would break it *and* fail `check:hex`.

## 5. Per-section delta table (1A handoff → current code)

| 1A § | Change | Current code | Effort |
| --- | --- | --- | --- |
| §4 | Header icon buttons → borderless **ghost** (30px) | `.icon-button` (base.css L1366) is bordered-ish; header uses it (ElementSidebar L88-125) | S — ghost variant or restyle within sidebar scope |
| §5 | Segmented "Order A–Z/Manual" → **two-tab underline** "Alphabetical/Manual", drop "Order" label | `SortModeToggle` (ElementSidebar L165-206) + `.element-sidebar__sortbar*` (css L61-103) | M — markup + CSS + ARIA tablist |
| §6 | Row height **40px**, softer **neutral** hover, teal **only** on selected, no leading grip in A–Z | `.element-sidebar__row` min-height 38px (css L114-133); hover==selected bg (css L126-129) | M — split hover/selected bg; add new token |
| §7 | Row actions → ghost cluster w/ **gradient scrim**, **remove dark tooltip** (native title/aria), keep Rename/Dup/Delete | `ElementSidebarRowBody` (rows L124-185) uses `<Tooltip>` (dark) on actions + row-link (rows L244, L283); actions live in a grid `auto` col, no scrim | M — drop `<Tooltip>`, add `title`, absolute cluster + scrim; decide `change-type` |
| §8 grip | Drag handle **hover-reveal**, reserved 13px, faint→full | `SortableRow` always-visible `GripVertical` (rows L109-118); handle col always in grid (css L241-243) | S — rest opacity + hover reveal |
| §8 groups | Group = **label + hairline rule**, no box, **no collapse** (1A drops collapsible) | `GroupSection` boxed/indented + `ChevronDown/Right` collapse (GroupedList L84-95; css L136-207) | M — divider styling, hide collapse chrome (keep `collapsed_group_ids` field) |
| §8 new group | Dashed box → **quiet ghost text button** | `.element-sidebar__new-group` dashed border (css L209-229) | S — restyle |
| §9-10 | Persist mode (done), `:focus-within` reveal (done, css L338-347), **`prefers-reduced-motion`**, ARIA tablist, native labels | reduced-motion not handled; ARIA is `aria-pressed` today | S — add media query + ARIA roles |

Legend: S ≈ ≤½ day, M ≈ ~1 day of focused work incl. tests.

## 6. Interaction facts already satisfied by the code (do NOT rebuild)

- Alphabetical = read-only natural sort; Manual = drag reorder — already the model.
- Switching A–Z→Manual keeps current order (freeze) — `useSidebarOrganization`
  L104-109.
- Selection independent of hover, survives mode switch — `activeId`-driven
  (`StaticRow`/`SortableRow`), not NavLink active state (types.ts L38-40 note).
- Actions stop propagation — `SidebarActionButton` (rows L290-294).
- `:focus-within` reveal of the action cluster — css L338-347. **Keep this.**
- Keyboard drag — `KeyboardSensor` + `sortableKeyboardCoordinates` (rows L43).
- Keyboard group assignment — `MoveToGroupSelect` native `<select>` (rows L192-219).
  1A's drag-only reassignment is not keyboard-accessible, so **keep this select**
  (restyled/quiet) to satisfy §10.

## 7. Docs that are now stale (fold in during docs-pass)

- `context/ui/pages/envelope-tab.md` §2.7.2 and `context/ui/pages/apertures-tab.md`
  §2.6.1 both describe a *simple naturally-sorted list with hover
  Edit/Duplicate/Delete* and **no** sort toggle / manual mode / groups. That
  predates the shipped `ElementSidebar`. Update both to match shipped behavior +
  the 1A look when this lands.
- `context/DESIGN_SYSTEM.md` component inventory has no "element sidebar" row —
  add one, and refresh the token snapshot if new tokens are introduced.

## 8. Existing tests (safety net for the restyle)

- `frontend/src/shared/ui/element-sidebar/__tests__/ElementSidebar.test.tsx`
- `frontend/src/features/sidebar_views/__tests__/*`
- `frontend/src/features/apertures/__tests__/*` (per-adapter)
- `backend/tests/test_sidebar_views.py` (view-state persistence — untouched by 1A)

Restyle work that changes DOM (tab markup, removed `<Tooltip>`, group divider
structure, id/aria changes) will require updating the first three.
