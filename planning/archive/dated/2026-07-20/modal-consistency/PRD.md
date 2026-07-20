---
DATE: 2026-07-20
TIME: 17:50 EDT
STATUS: Active
AUTHOR: Claude with Ed May
SCOPE: Problem statement, ratified modal contract, and defect analysis for the
  cross-cutting modal/dialog consistency refactor.
RELATED:
  - ./README.md
  - ./CATALOG.md
  - ./PLAN.md
  - ../../../frontend/src/shared/ui/ModalDialog.tsx
  - ../../../frontend/src/shared/ui/DialogActions.tsx
  - ../../../frontend/src/styles/modals.css
  - ../../../context/DESIGN_SYSTEM.md
---

# Modal Consistency Refactor — PRD

## Problem

The app has ~50 modal/dialog components (58 distinct modal instances). Padding,
margins, spacing, layout, overflow, and button placement/labels/styling are
inconsistent across them. The user's ask: **polish each modal — reduce visual
clutter, consistent spacing/layout/margins/padding, and above all a single
consistent answer to "where is Cancel, where is the primary action, what do
they look like?"**

Shared infrastructure already exists but is under-adopted:

- **`ModalDialog`** (`frontend/src/shared/ui/ModalDialog.tsx`) — the shell:
  `.modal-backdrop` → centered `.modal-panel` (`min(100%, 560px)`,
  padding `--space-24`, `max-height` + `overflow:auto`) → `.modal-header`
  (`<h2>` + top-right **"Close"** text-button, `showHeaderClose` default `true`)
  → children. Owns the document-level `Escape` handler.
- **`DialogActions`** (`frontend/src/shared/ui/DialogActions.tsx`) — the footer:
  optional `.form-error` line + `.modal-actions` row with **"Cancel"**
  (`secondary-button`, left) and one **primary** (`primary-button`, right).

Only **10 of 58** modals use both. The rest drift.

## Audit findings (see `CATALOG.md` for per-modal evidence)

Tiers by conformance:

| Tier | Meaning | Count |
|---|---|---|
| **gold** | uses `ModalDialog` + `DialogActions` | 10 |
| **partial** | uses `ModalDialog`, hand-rolls its own footer | 34 (files) |
| **rogue** | uses neither — bespoke backdrop/panel/footer | 8 (files) |

Recurring defects (of 58 modal instances):

| Defect | Count |
|---|---|
| Shows **both** top-right Close **and** footer Cancel (double dismiss) | 34 |
| Hand-rolls footer despite using the shared shell | 32 |
| Backdrop-click dismiss present in some, absent in others | 25 |
| **Primary/submit button missing `.primary-button`** → renders as a plain gray browser button next to a correctly-styled Cancel | 20 |
| No top-right header Close button | 11 |
| Custom panel width / padding (not the shared 560px / `--space-24`) | 5–8 |

The rogue tier is **not** random — it is two deliberate parallel systems:

1. **data-table Radix family** — `FieldConfigModal`, `CreateFieldConfigModal`,
   `ConfirmDestructiveDialog`, `ConfirmDeleteOptionDialog` (and the wrappers
   `DeleteDimensionDialog`, `CascadePreviewDialog` that reuse them). Built on
   `@radix-ui` dialog/alert primitives with `data-table-*` / `data-table-alert-*`
   classes, 320–480px, right-aligned footers, sr-only titles, no header Close.
2. **apertures copy-paste family** — `ManufacturerFiltersModal`, `RefreshDialog`
   with hand-rolled `*-modal__` / `*-dialog__` backdrops and copy-pasted CSS.

The partial tier also clusters usefully:

- **`RowEditModal` cluster (7 modals, 1 fix):** `RoomModal`, `VentilatorRowModal`,
  the four heat-pump row modals, and `RecordDetailModal` all delegate to the
  shared `RowEditModal` (`frontend/src/shared/ui/data-table/row-edit.tsx`).
  Its Save button carries no `.primary-button`. Fixing `RowEditModal` once fixes
  all seven.
- **"own-footer, missing primary" cluster:** `FrameTypeCreateModal`,
  `MaterialEditorModal`, the three catalog `ImportDialog`s, all four climate
  modals, `NewProjectModal`, `StatusItemModal`, etc. — mechanical: replace the
  hand-rolled footer with `DialogActions`.
- **multi-action footers (need a real decision):** `DocumentConfirmationDialog`
  (up to 4 buttons), `WeatherStationPickerModal` (3), the stale-save/discard
  variants, `CatalogOptionCascadeProgressModal`. `DialogActions` currently only
  models Cancel + one primary.
- **read-only viewers (the contract exception):** `UserAuditModal`,
  `ConstructionDetailModal`, `RecordDetailModal` in read-only mode — no footer,
  header Close is their only dismiss and that is correct.

## The Modal Contract (ratified by Ed, 2026-07-20)

Every modal MUST follow this. It is the acceptance spec for the refactor.

### 1. Dismiss — one canonical path

- **Footer `Cancel` is canonical** (left of the footer row).
- **Drop the top-right header "Close"** on any modal that has a footer.
- Header "Close" survives **only** on read-only viewers with no footer
  (`UserAuditModal`, `ConstructionDetailModal`, read-only `RecordDetailModal`).
- Implementation: flip `ModalDialog`'s `showHeaderClose` default to `false`;
  viewers opt in with `showHeaderClose`.

### 2. Footer — always `DialogActions`

- Cancel (`secondary-button`, left) + one primary (`primary-button`, right).
- Destructive primary uses `danger-button` (add a `variant`/`danger` prop to
  `DialogActions`).
- **No bare/unstyled submit buttons** — every action button carries a system
  class (`primary-button` / `secondary-button` / `danger-button` / `text-button`).
- Error uses `DialogActions`' built-in `.form-error` slot, not a hand-rolled `<p>`.
- Multi-action footers (>2 buttons) use an explicit `DialogActions` variant
  (see Open Questions) rather than an ad-hoc `<div className="modal-actions">`.

### 3. Labels

- Cancel is always literally **"Cancel"** (not "Close", not "Keep draft" as the
  cancel slot). Read-only viewers' single dismiss may read "Close".
- Primary is a specific action verb: `Create material`, `Delete room`, `Save`,
  `Apply`. Kill generic `OK` / `Done` and conditional
  `{isViewer ? "Close" : "Cancel"}` drift.
- Busy state swaps the label in place (`Saving…`, `Creating…`) — already common;
  standardize the ellipsis form.

### 4. Box — shared shell, resizable when oversized

- Always the shared `.modal-panel`: `min(100%, 560px)`, padding `--space-24`,
  `max-height` cap, `overflow:auto`. No bespoke widths/paddings.
- **Oversized modals (content that scrolls vertically or horizontally) get a
  user resize affordance — a lower-right corner handle.** Implement with native
  `resize: both` (or `vertical`) on the scrolling panel plus sensible
  `min-width`/`min-height`, so the browser draws the corner grip whenever the
  panel is the scroll container. Applies to the large/data-dense modals
  (`SegmentDialog`, `RefreshDialog`, `FieldConfigModal`, the RowEdit forms,
  `ConstructionDetailModal`), not the small confirmations.

### 5. Backdrop-click

- **Forms / anything with unsaved input: NO backdrop-dismiss** (prevents data
  loss — must use Cancel or Escape).
- **Read-only viewers: YES backdrop-dismiss** (click-away is expected).

## Non-goals

- No behavior/logic changes to what the modals *do* — this is visual +
  dismiss-affordance consistency only.
- Not adding a focus-trap/a11y overhaul beyond what adopting the shared shell
  already gives (the Radix family already has focus-trapping; note that as a
  factor when deciding its migration in Phase 05).
- Not redesigning the design-system tokens; this consumes them.

## Resolved decisions (see `decisions.md`)

Both former open questions are decided (2026-07-20):

1. **`DialogActions` multi-action shape → D-2:** extend `DialogActions` with an
   optional `extraActions` slot between Cancel and primary (built in Phase 00,
   consumed in Phase 04).
2. **data-table Radix family → D-3:** keep Radix, conform its shell to the
   contract (Phase 06); do not migrate onto `ModalDialog`.
