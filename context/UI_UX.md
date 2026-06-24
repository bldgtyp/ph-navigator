---
DATE: 2026-05-10
TIME: -
STATUS: DRAFT — narrative UI/UX descriptions, populated incrementally
        alongside the user-stories doc. Companion to
        context/PRD.md (architecture PRD) and
        context/USER_STORIES.md (user stories).
        Designed to be handed off to Claude Design (or another visual
        designer) for actual screen design once content is stable.
AUTHOR: Ed May (with Claude)
SCOPE: Narrative descriptions of every UI page and flow in PH-Navigator
       V2. Describes layout, content, behavior, and interaction patterns
       in plain language — no pixel-level decisions. Reference, not
       prescription.
RELATED: context/PRD.md (architecture PRD),
         context/USER_STORIES.md (user stories),
         https://github.com/bldgtyp/bt-branding,
         https://bldgtyp.github.io/bt-branding/
---

# PH-Navigator V2 — UI / UX Narrative

## 0. Design intent

PH-Navigator V2 is an **internal tool** for a two-person consulting
firm. The audience is technical (architects, certified passive house
consultants, energy modelers) and data-dense screens are welcome.

Design hypothesis: PH-Navigator V2 should feel like a **technical
workbench for Passive House project data**: quiet, precise, data-rich,
and built for repeated use by expert users. It should preserve V1's
domain spine without inheriting V1's generic admin-app styling.

Design should optimize for:

- **Clarity over polish.** Information hierarchy and discoverability
  matter more than visual flourish.
- **Speed of action.** Frequent users; minimize click counts on the
  workflows they hit daily (open project → edit → save).
- **Stable mental model.** App-like Save / Save As, lock states,
  versions, catalogs — concepts the user keeps in their head; the UI
  must reinforce them, not contradict them.
- **Low ceremony.** No onboarding tours, no "we noticed you..." nags,
  no dark-pattern confirmations except where genuinely needed
  (project delete, lifecycle transitions).
- **Honest density.** Tables show the data; don't hide columns behind
  hover-reveal or progressive disclosure unless the screen really
  forces it.
- **Domain-native surfaces.** The best screens should support the
  building object directly: assembly section, aperture diagram,
  evidence checklist, model selection, or row-level equipment record.
  Avoid generic dashboard/card composition when a workbench layout is
  clearer.

### V1 precedent, not prescription

V1 screenshots are useful precedent for workflow shape, not final visual
direction. Treat V1 findings with this taxonomy:

- **Invariant:** product/workflow facts that carry forward unless a
  later PRD decision supersedes them.
- **Requirement:** behavior V2 must implement.
- **Design hypothesis:** direction to prototype and test.
- **Open question:** choice to keep unresolved until more V1 examples,
  user priority, or prototype feedback clarifies it.

Current V1-derived invariants:

- Project workspace tabs stay: Status, Climate, Apertures, Envelope,
  Spaces, Equipment, Thermal Bridges, Model.
- Status remains the default project landing surface.
- Windows and assemblies need visual builders, not only tables.
- Dense table views remain central for equipment, materials, and
  catalog-like records.
- Evidence state for datasheets, specs, and site photos is a
  cross-cutting UX system, not a set of isolated icon cells.
- The Model tab is a real HBJSON viewer with color-by, legends,
  selection, inspection, model-file switching, and enough canvas area to
  feel primary.

### BLDGTYP design system

> **Implementation reality (2026-06-14).** The styling is **hand-written
> plain CSS** on a 3-tier custom-property token system cribbed from the
> BLDGTYP brand. **There is no Tailwind and no shadcn/ui.** Earlier
> drafts of this section and PRD §12 prescribed Tailwind + shadcn; that
> prescription was the source of the "ghost token" vocabulary
> (`--surface`, `--border`, `--danger`, `--font-sans`,
> `--text-on-accent`) the CSS-rationalization pass had to hunt down, and
> it was **dropped** (decision: reconcile docs to reality, no migration —
> see the 2026-06-14 CSS review, Theme 10). Build new UI as plain CSS
> against the tokens below.

PH-Navigator V2 cribs from the BLDGTYP brand design system so the app
feels like part of the same technical tool family:

- Canonical reference: <https://bldgtyp.github.io/bt-branding/>
- Source repo: <https://github.com/bldgtyp/bt-branding>

The brand assets are **vendored and self-hosted**, not fetched from
`bldgtyp.github.io` / Google Fonts at runtime, so the app renders fully
offline and in CI and a brand-side token rename surfaces as a reviewable
diff. Refresh the vendored copies with `pnpm run sync:brand`. See
`planning/archive/dated/2026-06-14/css-brand-dependency-resilience/`.

**3-tier token system** (cascade order matters — each layer can override
the previous):

- **Layer 1 — brand** (`frontend/src/styles/brand/tokens.css`, vendored).
  The brand palette and theme surfaces: `--accent` / `--highlight`
  families, `--bg-*`, `--text-*`, `--border-*`, `--font-primary` /
  `--font-table` / `--font-mono`, `--radius-sm`, `--transition-base`,
  `--ease`, `--svg-*`. Self-hosted Geist + Geist Mono `@font-face` rules
  live alongside in `brand/fonts.css`.
- **Layer 2 — app tokens** (`frontend/src/styles/tokens.css`). App-wide
  scales built on Layer 1: the px-named spacing scale (`--space-2 …
  --space-48`), the rem type scale (`--fs-2xs … --fs-3xl`), radius,
  shadow, z-index, the chart/report-status palettes, and the semantic
  `--phn-*` tokens (`--phn-danger`, `--phn-focus`, …). This layer also
  pins `--font-primary` / `--font-table` to **Geist** (overriding the
  brand default).
- **Layer 3 — feature/component CSS** (`features/**/*.css`,
  `shared/ui/**/*.css`). Consumes Layer 1 + Layer 2 tokens via `var()`;
  defines no raw colors of its own.

Initial application guidance:

- Body text and headings use **Geist** (the `--font-primary` /
  `--font-table` tokens), not Outfit — Layer 2 pins both to Geist.
- Use Geist Mono (`--font-mono`) for labels, numeric annotations, nav
  triggers, compact metadata, units, and technical chips.
- Use `--accent` / `--accent-text` as the primary action/accent channel.
- Use `--highlight` / `--highlight-text` sparingly for emphasis,
  warnings, missing evidence, or selected technical objects. Do not let
  magenta mean every action state.
- Use theme-aware surfaces (`--bg-page`, `--bg-card`, `--bg-elev`,
  `--border-subtle`, `--text-*`). The app currently runs light-only
  (`color-scheme: light`); the dark surface family exists in the brand
  layer but is not yet enabled.
- Consider graph-paper treatments only where they reinforce technical
  drafting/data context: dashboard bands, data views, model/building
  workbench panels, or empty technical states. Keep them subtle.

**Guard suite** (`frontend/scripts/`, wired into `pnpm run check:all` →
CI) keeps the token system honest:

- `check:css-vars` — every fallback-less `var(--x)` must resolve to a
  real token; the brand allowlist is sourced from the vendored
  `brand/tokens.css` so it stays in sync.
- `check:hex` — **sanctioned-hex rule:** raw hex literals are allowed
  only in the token-definition files; feature/shared-ui CSS must go
  through `var()` tokens.
- `check:z-index`, `check:sizes`, `check:shape` — z-index must use the
  `--z-*` tokens, `.ts`/`.tsx`/`.css` files stay under the size cap
  (`@size-exception` escape hatch on line 1), and feature folders keep
  their canonical shape.

The token + shared-class catalog, the import strategy, the "how to style a
new feature" recipe, and the god-stylesheet split plan live in
**`frontend/src/styles/README.md`** — the canonical styling guide. Start
there for any styling work.

### Tech-stack constraints (from PRD §12)

The frontend stack is **Vite + React + TypeScript + plain CSS +
TanStack Query + TanStack Table + Zustand**. Interactive primitives
(dialog, alert-dialog, popover) are built on **Radix UI** and styled
with plain CSS. The 3D viewer adds **React Three Fiber + drei +
postprocessing**. These should not be visible to the user as specific
tools — the user sees clean, consistent UI — but they constrain visual
idioms:

- Compose from hand-written, plain-CSS components (the existing
  `shared/ui/*` widgets are the building blocks); reach for a Radix
  primitive when a behavior needs robust a11y/focus management
  (modals, popovers).
- All component styling flows through the 3-tier token system above —
  do not introduce a parallel palette or shadcn-style vocabulary.
- Real screen composition and component design are deferred to a Claude
  Design pass that follows this doc and the BLDGTYP design system.

### Out of scope for this doc

Pixel-perfect mockups, final component variants, illustration,
empty-state art, and animation specifics. Those land in the design pass.
The brand-asset dependency (vendoring + self-hosting) is resolved — see
`planning/archive/dated/2026-06-14/css-brand-dependency-resilience/`.

---

## 1. Common elements

### 1.1 Top header

Present on signed-in app pages and Viewer project reads. Viewers
use the same project workspace routes in read-only mode
(§2.11).

```
┌────────────────────────────────────────────────────────────────────┐
│ [PH-Nav]  Project Foo › Status                 Catalogs ▾   Ed ▾  │
└────────────────────────────────────────────────────────────────────┘
```

- **Far left:** PH-Nav logo (wordmark + minimal graphic mark).
  Clicking returns to `/dashboard`.
- **Adjacent right of logo:** breadcrumb context. Examples:
  - On `/dashboard` → just shows the logo (no breadcrumb).
  - On `/projects/{id}` → "Project Foo › Status" (or the active tab).
  - On `/catalog/materials` → "Catalogs › Materials".
  - Each breadcrumb segment is a link to the corresponding page.
- **Center-right:** "Catalogs ▾" dropdown. Opens a small menu listing
  the available catalogs. **v1 (live):** Materials, Window-Frame
  Elements, Window-Glazing. **Future (deferred — see PRD §7.0
  for the full roster):** ERV units, Pumps, Fans, Appliances,
  Hot-Water Heaters, Heat-Pumps,
  Direct-Elec Heaters, Boilers, and others TBD.
  - **v1 menu treatment:** show only the 3 live catalogs; do not
    list future catalogs as "coming soon" entries (premature
    promises). Future catalogs appear in the menu the moment they
    ship.
  - **Menu-redesign trigger:** when the catalog count exceeds ~5,
    the flat dropdown becomes unwieldy. At that point, regroup
    (Envelope / Mechanical / Appliances / ...) or move to a
    Command-K-style search palette. Defer the redesign until the
    fourth catalog actually lands.
- **Far right:** user identity. "Ed ▾" or avatar + name. Click opens
  a small menu: Sign out, (later: account settings).
- **Sticky on vertical scroll.** Stays visible.
- **Responsive note (low priority for v1):** at narrow widths,
  breadcrumb collapses; logo stays. Phone is non-goal.

### 1.2 Footer (signed-in app)

Minimal: small text bottom-right with build/version (e.g. "PHN-V2
build 2026-05-10.42") and a link to the changelog. No marketing.

### 1.3 Modals

Used for:
- Confirmation of high-stakes actions (Delete project, Discard
  changes).
- Forms that don't justify a full page (New project, Save As).
- Conflict-resolution dialogs (409 on Save).

Radix UI `Dialog` / `AlertDialog` primitives, styled with the shared
plain-CSS `ModalDialog`. Always dismissible by Esc and clicking
outside, **unless** the dialog is mid-confirmation of a destructive
action (e.g. project delete final-confirm) — then only an explicit
Cancel closes.

### 1.4 Toasts

Used for:
- "Saved." after successful Save.
- "Saved as Round 1 Submit." after Save As.
- Error notifications (network failure on draft sync, 409 on Save).

Intended behavior: auto-dismiss after 4 seconds; errors sticky until the
user dismisses or clicks "View details." **Not yet built as a global
system** — per decision D-06 there is currently no global toast; features
use inline notice surfaces (e.g. `UploadNoticeLine`). No shadcn/Sonner
dependency.

### 1.5 Session-expiry modal

When a request returns 401 because the user's session expired (60-min
idle) or was invalidated by sign-in on another device, the frontend
opens a **session-expiry modal in place** rather than navigating
away — so the in-memory document and current tab context are not
lost.

Modal contents:
- Title: "Your session has expired"
- Subtitle (varies by reason):
  - Idle timeout: "You've been inactive for 60 minutes. Sign in to
    continue."
  - Superseded by new login: "Your account signed in on another
    device. Sign in here to take over editing."
- Email + password inputs (email pre-filled from the prior session if
  remembered).
- "Sign in" primary button.
- No Cancel / Dismiss; modal is non-dismissible. The user must sign
  in or close the tab. (Closing the tab is a final-fallback for
  signing out without re-authenticating.)

On successful re-auth:
- Modal closes.
- The most recent failed request (or queue of failed requests) is
  retried automatically.
- A subtle toast: "Welcome back, Ed."

If the user has unsaved in-memory changes that were never synced to
the server-side draft (the queue had items pending when the 401
occurred), those are queued and retried after re-auth as well.

### 1.6 Empty states

For empty tables, lists, and pages, show a quiet illustration or icon
+ short description + primary action. Never a blank screen.

Examples:
- Empty dashboard (new user): "No projects yet. [+ New project]"
- Empty assemblies list: "No assemblies yet. Add your first wall,
  floor, or roof. [+ New assembly]"
- Empty HBJSON list: "No HBJSON files uploaded yet. Upload a model
  exported from Rhino + honeybee_ph. [+ Upload]"

### 1.7 DataTable — shared grid interaction model

The same React component (`<DataTable>`) renders every grid-style
surface: the catalog manager pages (`/catalog/{slug}`), the
project-scoped Materials sub-tab, the bookshelf material
picker, and any future tabular surface. Per-table column
declarations live in TS at the call site (PRD §11.1: "schema
flexibility lives in code, not runtime").

The interaction model below is the user-facing contract — what the
table feels like to use. The full component contract, library
choices, write pipeline, and lessons-learned live in
`context/technical-requirements/data-table.md`. This subsection is
the UI/UX-level summary that other pages reference.

**Density and chrome.** 32 px row height, 1 px dividers, hover
highlight on rows. Sticky-left first column for any table whose
first column is the row identifier. Sticky 32 px left gutter outside
the column model carries row numbers and the row-select target.
Every column has a user-resizable, persisted width (drag the right
edge of any header; double-click fits to content; defaults per field
type).

**Active cell + keyboard nav.** A single click focuses a cell (no
double-click required). Arrow keys, Tab/Shift+Tab (with row
wrapping), Home/End move the active cell. Enter or double-click
opens the cell editor; Esc cancels; Enter/blur commits. Auto-scroll
keeps the focused cell in view.

**Range selection.** Click-drag or Shift+arrow extends a rectangle.
Shift+click sets the head, anchor unchanged. Auto-scroll near
viewport edges while dragging. Click in the left gutter selects the
full row; Shift+click extends a contiguous block of rows. Click the
header strip selects the full column; Shift+click extends a
contiguous block of columns. ⌘A selects the visible (filtered) data
set. Non-contiguous ⌘+click selection is **not** supported in v1
(deferred per parity gate).

**Copy / paste.** ⌘C writes the active cell or selected rectangle to
the clipboard as **both** TSV and HTML, so external paste into
Excel, Numbers, Google Sheets, and AirTable preserves the row ×
column shape. ⌘V parses an incoming TSV and lays it onto the
selection:

- Single clipboard cell into a multi-cell selection → fills the
  selection.
- Multi-cell clipboard with a single anchor → places a block.
- Same-shape selection and clipboard → cell-by-cell.
- More clipboard rows than fit → modal: *"Clipboard has N more
  rows. Add N empty records and paste?"* Confirm appends; Cancel
  drops overflow.
- More clipboard columns than fit → silent drop with a toast note.

Paste is **disabled while the table is grouped** — banner reads
*"Ungroup to paste"*. Per-column type coercion runs on every
incoming string (numeric strings parsed; single-select strings
matched-or-created; etc.).

**Fill handle.** When a range is active and not editing, a 6×6 px
square at the bottom-right corner extends the selection by drag
(axis-locked to the dominant direction); a dashed target rectangle
previews the result. Source values map cyclically when shapes
mismatch. ⌘D fills down, ⌘R fills right. Pattern detection (1, 2, 3
→ 4, 5…) is **not** supported in v1.

**Undo / redo.** ⌘Z and ⌘⇧Z revert / replay user actions. Undo
operates per **gesture** — one ⌘Z reverts an entire paste, fill, or
row-insert, not one cell at a time. POC bound: 8 entries, in-memory.
Production undo is local-only; version switches, refetches, ETag
mismatches, Save / Save As / Discard, and MCP/other-tab draft changes
clear the undo stack (see `context/technical-requirements/data-table.md`).

**Sort, filter, group, hide — toolbar-owned.** A toolbar above the
table holds five buttons:

```
┌──────────────────────────────────────────────────────────────────┐
│  Hide fields    Filter (2)    Group by    Sort by    Color    ⋯  │
│                  green tint    purple       peach                │
└──────────────────────────────────────────────────────────────────┘
```

Each button opens a popover:

- **Hide fields.** Show/hide columns.
- **Filter.** Stacked rows: column + operator + value, drag-reorder,
  AND-only in v1 (OR is a deferred follow-up). Operators per type:
  text (contains/is/is empty/…); number (=, !=, >, <, between, is
  empty); single_select (is any of, is none of, is empty). Empty/
  dormant rows pass everything (don't match the empty string).
- **Group by.** Up to 3 levels; stacked rows with asc/desc.
- **Sort by.** Stacked rows; first row primary, rest are tiebreakers.
  Shift+click on a column header adds to the sort stack.
- **Color.** Configurable row-coloring rules — placeholder in v1.

When a button is active, it tints pale (filter-green, group-purple,
sort-peach) and reads as a sentence fragment: *"Filtered by
MANUFACTURER"*, *"Grouped by 1 field"*, *"Sorted by 1 field"*.

**Per-column tinting.** When a column participates in a filter,
sort, or group, its body cells tint the corresponding color. When it
participates in two or three roles, the tints layer through a
pre-mixed palette (no live HSL math). Tint sits underneath
selection; focus uses a separate `outline` channel so the focus ring
stays visible inside a tinted, selected cell.

**Group accordion.** Grouped rows render as a nested accordion with
a chevron, the group key (rendered as the column's own pill / value
type), a row count `(N)`, and per-column aggregated values
(count/sum/mean/min/max/none — pickable per column from a small
caret in the column header). Toolbar quick actions: Collapse all /
Expand all.

**Single-select cells.** A typed field type, used in v1 for
`materials.category`. Cells render as a colored pill; the inline
editor is a popover with search, click-to-pick, and an inline
`+ Add new option` form. Pasting a TSV column of category strings
runs match-or-create case-insensitively, auto-assigns palette colors
to new options, and reports the new options in a single toast:
*"5 cells written. 3 new options created in 'category'."* Undo of
the paste rolls back the cell writes **and** the new options
together.

**Per-column field config.** Right-click on a column header (or
double-click the header label — separate from the resize handle's
fit-to-content double-click) opens the field-config modal. The modal
is the unified entry point for renaming a column, editing its
description, editing options on single-select columns, and editing
formula source on formula columns. Built-in (feature-author-declared)
fields and user-created custom fields both open the same modal;
per-attribute locks (declared in feature code) disable individual
sections with a uniform `"Field Locked"` tooltip rather than hiding
the modal. Locked-attribute presence shows as a small lock glyph in
the header.

Formula fields use the same modal, with a larger multiline expression
editor, syntax highlighting for field refs / strings / numbers, and a
dedicated preview/error card. Field and function suggestions appear from
the current caret token, insert valid formula syntax, and support mouse,
ArrowUp/ArrowDown, Enter, Tab, and Escape without closing the modal first.
The formula editor is shared DataTable UI; feature tables do not provide
local formula authoring chrome.

**Locked / read-only mode.** When the open version is locked, the
visitor is a Viewer, or another permission boundary applies, the table
renders in read-only mode: no toolbar mutations except sort/filter/group
on the user's local view, no inline edits, no paste/fill/undo, no
row-add. Edit affordances are hidden, not disabled-with-tooltip.

**A11y baseline.** `tabIndex={0}` container with bubbled key
handling so internal inputs still receive their own keys. `role=
"grid"` with `aria-rowindex`/`aria-colindex` reflecting the visual
(post-sort/filter) position. Tab from the last visible cell
**leaves** the table rather than wrapping. Polite live-region
announces filter/sort/group changes. Roving-tabindex hardening is a
post-extraction lane.

**Out of scope for v1.** Linked-record / relation cells; per-user
non-contiguous selection; OR mode in filter; fill-handle pattern
detection; comments / @mentions / presence cursors; mobile / phone
optimization; dark-mode tint palette. See
`context/technical-requirements/data-table.md`.

---

### 1.8 Evidence / documentation status grammar

Evidence state appears across project materials, equipment rows,
aperture/window records, site-photo pages, and certification/status
workflows. It should read as one coherent documentation layer.

Core states:

| State | Meaning | Typical use |
|---|---|---|
| Missing | Required evidence is absent. | Datasheet/site photo/spec missing. |
| Required | Evidence is expected but not yet evaluated. | New row or imported V1 data. |
| Attached | One or more files are linked. | Datasheets, photos, HBJSON files. |
| Complete | QA status accepted for this record. | Spec status, milestone done. |
| N/A accepted | Requirement intentionally does not apply. | Spec/photo requirement waived. |
| Linked source | Row came from a catalog or imported source. | Catalog badge, V1 import. |
| Drifted | Copied value differs from current catalog/source. | Refresh-from-catalog flows. |

Design rules:

- Missing evidence must be filterable at the page/table level.
- A missing state should link directly to the surface that resolves it:
  upload drop zone, row detail, assembly segment, equipment record, or
  status item.
- Evidence badges/icons need text labels or hover/detail affordances;
  tiny icon-only cells are not sufficient for certification QA.
- Separate missing/required from warning/error colors. Missing evidence
  is a work item, not necessarily an application error.
- For Viewer/read-only mode, retain evidence visibility but hide upload,
  delete, and status-edit affordances.


## 2. Pages — narrative

Per-page narratives live as individual files under [`ui/pages/`](ui/pages/),
so UI work loads only the surface in hand. Read the page for the surface you
are building **plus §1 (common elements) above**. See
[`ui/pages/.instructions.md`](ui/pages/.instructions.md) for the routing rule.

| Page | File |
| --- | --- |
| 2.1 Sign-in (`/sign-in`) | [`ui/pages/sign-in.md`](ui/pages/sign-in.md) |
| 2.2 Dashboard (`/dashboard`) | [`ui/pages/dashboard.md`](ui/pages/dashboard.md) |
| 2.3 Catalog landing (`/catalog/{table_slug}`) | [`ui/pages/catalog.md`](ui/pages/catalog.md) |
| 2.4 Project workspace — header, tab bar, version picker | [`ui/pages/project-workspace.md`](ui/pages/project-workspace.md) |
| 2.5 Status tab (default landing) | [`ui/pages/status-tab.md`](ui/pages/status-tab.md) |
| 2.6 Apertures tab | [`ui/pages/apertures-tab.md`](ui/pages/apertures-tab.md) |
| 2.7 Envelope tab — assemblies, materials, airtightness, site photos | [`ui/pages/envelope-tab.md`](ui/pages/envelope-tab.md) |
| 2.8 Spaces & Equipment tabs | [`ui/pages/spaces-equipment-tab.md`](ui/pages/spaces-equipment-tab.md) |
| 2.9 Model tab (HBJSON viewer) | [`ui/pages/model-tab.md`](ui/pages/model-tab.md) |
| 2.10 Project settings (overflow menu) | [`ui/pages/project-settings.md`](ui/pages/project-settings.md) |
| 2.11 Viewer public read | [`ui/pages/viewer-public.md`](ui/pages/viewer-public.md) |
## 3. Flows (multi-page)

### 3.1 Sign-in → dashboard (US-0 → US-1)

1. User visits any signed-in URL while unauthenticated.
2. Server redirects to `/sign-in?next=<original-url>`.
3. User enters credentials, submits.
4. Server validates, sets session cookie, returns 200 with redirect
   target (the `next` URL or `/dashboard`).
5. Frontend navigates to the redirect target.

### 3.2 Create new project (US-1.3)

1. From dashboard, user clicks "+ New project".
2. Modal opens; user fills name, bt_number, optional client.
3. User clicks "Create project".
4. Backend INSERTs project row + initial "Working" version + sets
   active_version_id.
5. Frontend redirects to `/projects/{new_id}` (Status tab default).

### 3.3 Pin / reorder projects (US-1.1)

- Click the pin icon on any row → row immediately moves to the
  Pinned section, persists via `user_project_preferences`.
- Drag a pinned row by its handle → other pinned rows reflow;
  on drop, new order persists.
- Unpinning sends the row back to the All-projects section in its
  natural sort position.

### 3.4 Delete project (US-1.4 — deferred from MVP)

1. User clicks `⋯` on a row → Delete.
2. Modal #1: warning + summary of consequences. Cancel / Continue.
3. Modal #2: "Type the project name `Project Foo` to confirm."
   Confirm button disabled until exact match.
4. On confirm: project soft-deleted, row removed from dashboard,
   toast: "Project Foo deleted. Recovery is admin-only."

### 3.5 Open project → switch tab (US-3)

- Click a project row → land on `/projects/{id}/status`.
- Click "Model" in the tab bar → URL becomes
  `/projects/{id}/model`; back/forward buttons work.

---

## 4. State indicators (cheatsheet)

Consistent visual language for state across the app:

| State | Visual | Used where |
|---|---|---|
| Clean (committed) | Subtle green dot | Project header version indicator |
| Dirty (uncommitted draft) | Amber dot + "Uncommitted changes" tooltip explaining edits are auto-saved as a draft on the server and Save Version writes them into the active version | Project header |
| Sync error | Red dot + tooltip | Project header |
| Locked version | Padlock icon next to version name | Project header, Versions list |
| Submitted | Document-with-checkmark icon | Versions list |
| Closed | Folded-document icon | Versions list |
| Read-only (Viewer public read) | "Read-only" pill in header | Project workspace header |
| Evidence missing | Badge/icon + filterable status | Tables, Materials, Site Photos |
| Evidence attached | Badge/icon + file count/preview | Datasheets, photos, HBJSON files |
| N/A accepted | Muted badge/state | Spec/photo requirements |
| Catalog/source drift | Refresh/drift badge | Materials, frames, glazings, catalog-linked rows |

---

## 5. Open UX questions (collected)

These are the cross-cutting UX questions surfaced so far. Each maps
back to a user-story open question.

| ID | Topic | Lean |
|---|---|---|
| UX-Q1 | Pinned vs. all visual treatment — distinct section or just sort-to-top? | distinct section |
| UX-Q2 | Last-modified column format — relative ("2 hours ago") or absolute? | relative + tooltip absolute |
| ~~UX-Q3~~ | ~~Project landing default tab?~~ | **Resolved 2026-05-10:** Status |
| UX-Q4 | Save status indicator — dot, text, or both? | dot + tooltip text |
| UX-Q5 | Catalogs nav — header dropdown (lean) or top-level page route? | header dropdown |
| UX-Q6 | Empty-state primary action — single button or guided onboarding? | single button |
| ~~UX-Q7~~ | ~~Viewer header — "Read-only" pill or banner?~~ | **Resolved 2026-05-11:** pill in normal project header |
| UX-Q8 | Builder details placement — below canvas, right inspector, or adaptive? | adaptive by surface |
| ~~UX-Q9~~ | ~~Model toolbar placement — bottom V1 rail or left/right modeling-app rail?~~ | **Resolved 2026-06-12:** neither — top-center lens bar + bottom-right camera/measure cluster (D-05; `planning/archive/dated/2026-06-13/model-viewer/UI_SPEC.md` §1) |
| UX-Q10 | Evidence interaction model — checklist, table filters, or both? | both, via §1.8 |

---

## 6. Out-of-scope for this doc

- Final component variants.
- Final iconography choices.
- Animation specifics.
- Mobile / phone optimization.
- Onboarding tours.
- Marketing / public-facing pages.

These are deferred to the Claude Design pass that follows this
content review.

---

## 7. Index of pages by status

| Page | Status | Priority |
|---|---|---|
| Sign-in (`/sign-in`) | Drafted | MVP |
| Dashboard (`/dashboard`) | Drafted | MVP |
| Catalog landing (`/catalog/{slug}`) | Placeholder | MVP |
| Project workspace shell (header + tab bar) | Drafted | MVP |
| Version dropdown picker (header) | Drafted | MVP |
| Locked-version edit lockout banner | Drafted | MVP |
| Status tab (`/projects/{id}/status`) | Placeholder | MVP |
| Apertures tab (`/projects/{id}/apertures`) | Shipped | MVP |
| Envelope tab (`/projects/{id}/envelope`) — sub-tab structure + Assemblies + Materials | Drafted | MVP |
| Envelope · Airtightness sub-tab | Placeholder | MVP |
| Envelope · Site Photos sub-tab | Placeholder | MVP |
| Equipment tab (`/projects/{id}/equipment`) | Placeholder | MVP |
| Model tab (`/projects/{id}/model`) | Placeholder | MVP |
| Project settings (overflow menu) | Placeholder | MVP (minus delete) |
| Viewer public read (`/projects/{id}/{tab}`) | Drafted (high-level) | MVP |
