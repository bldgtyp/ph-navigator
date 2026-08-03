---
DATE: 2026-08-03
TIME: 09:16 EDT
STATUS: Deferred — scoped, not started
AUTHOR: Claude with Ed May
SCOPE: Behavior contract for aligning Apertures catalog-drift UX with the
  Envelope materials pattern.
RELATED:
  - ./README.md
  - ./STATUS.md
  - ../../../frontend/src/features/envelope/drift.ts
  - ../../../frontend/src/features/envelope/components/MaterialCatalogStatus.tsx
  - ../../../frontend/src/features/envelope/components/MaterialDrift.tsx
---

# PRD — Aperture catalog-drift UX parity

## Reference implementation

Everything below has a working precedent shipped on the Envelope tab. Read
these before designing anything new:

| Concern | Reference |
|---|---|
| Review-worthy vs. informational states | `frontend/src/features/envelope/drift.ts` |
| Collapsed-row flag + consolidated action | `frontend/src/features/envelope/components/MaterialCatalogStatus.tsx` |
| Compare-card review dialog | `frontend/src/features/envelope/components/MaterialDrift.tsx` |
| Banner scope rule | `frontend/src/features/envelope/routes/EnvelopePage.tsx` |
| Written contract | `context/technical-requirements/envelope-catalog-drift.md` §"Front-end review contract" |

## Current state (audited 2026-08-03)

| # | Where | Today | Problem |
|---|---|---|---|
| A-1 | `ApertureSpecReportPanel.tsx:296` | `ApertureDriftBadge` renders **inside** `spec-expansion__header`, i.e. only after the row is expanded. | Drift is invisible while scanning the table. Worse than materials was — materials at least had the badge in the same place every time. |
| A-2 | `ApertureSpecReportPanel.tsx:366-388` | A separate "Catalog review" `spec-evidence` section in the **left column, below Datasheets**, listing entries each with a `text-button` "Refresh from catalog". | The state (header badge) and the action (bottom-left list) are in different regions. Same split the materials fix collapsed into one button. |
| A-3 | `ApertureSpecReportPanel.tsx:374` | Only `entry.kind === "field_delta"` gets a refresh action. `catalog_row_missing` renders text with no affordance. | A dead end: the user is told something is wrong and given nothing to do. Materials now opens the dialog read-only with an explanation. |
| A-4 | `BuilderDriftBanner.tsx:19-26` | Banner counts entries on the **active aperture only** ("N entries drifted from catalog") but its "Review all" opens a modal listing those same active-aperture entries. | Internally consistent, unlike the materials bug — but it is *not* project-wide, so the Apertures tab has no project-level answer to "how much drift do I have?" |
| A-5 | `BuilderDriftBanner.tsx:41-85` | `ReviewAllModal` hand-rolls `aperture-drift-modal__backdrop` / `__header` / `__list` / `__footer` with a bare `Close` button and click-away dismiss. | Violates the modal contract in `context/DESIGN_SYSTEM.md`. It did **not** inherit the 2026-08-03 shared `.modal-header` / `.modal-actions` / `.modal-form` fix, so it will now look visibly off-system next to every other dialog. |
| A-6 | `RefreshDialog.tsx` | Already uses `ModalDialog` + `DialogActions` (good) and a `Field / Catalog / Yours` three-column layout with per-row radios and bulk actions. | Structurally sound. Needs the visual pass only: compare-card layout, `.modal-lede` summary, the segmented `.drift-choice` control, and a count-bearing submit label. |

## Target behavior

1. **Review-worthy split.** Introduce the aperture equivalent of
   `materialNeedsCatalogReview` vs `materialHasCatalogAction`. Decide
   explicitly whether an aperture entry has a "customized / user intent
   recorded" state (materials does; `in_local_overrides` suggests something
   analogous) and keep it out of alarm counts if so.
2. **Collapsed-row flag.** The aperture/frame/glazing row shows an amber ↻
   (red ⚠ for a removed catalog row) beside its name with the reason in a
   tooltip, before expansion. Reuse `.material-drift-flag` — promote it to a
   shared class rather than copying it.
3. **One consolidated action.** Replace the header badge + bottom-left list
   with a single count-bearing primary at the top of the expansion. Aperture
   drift is per use-site, so the label must aggregate honestly across entries
   — e.g. "Review 3 catalog changes across 2 elements". Getting this phrasing
   right is the main design question in this packet.
4. **Every state gets an action.** `catalog_row_missing` opens the dialog
   read-only with an explanation and a disabled primary, mirroring materials'
   `source_missing` handling.
5. **Banner.** Either state the scope in the text (the materials pattern:
   project-wide headline + active-scope clause) or keep it aperture-scoped and
   say so. What is not acceptable is a bare count whose scope the reader has
   to infer.
6. **`ReviewAllModal` → `ModalDialog` + `DialogActions`.** Delete the
   `aperture-drift-modal__*` CSS. If the consolidated per-row action in (3)
   makes this modal redundant, delete the modal instead — that is the
   preferred outcome.
7. **`RefreshDialog` visual pass.** Compare cards, `.modal-lede`, segmented
   choice control, live count in the submit label.

## Open questions

- **Q1.** Does aperture drift have a `customized` analogue? `in_local_overrides`
  is per field-delta, not per entry, so there may be no entry-level state to
  suppress. Resolve before building the count.
- **Q2.** Is per-use-site drift the right granularity for a *row-level* flag?
  One product row can drift at several use sites with different deltas. The
  flag can say "this product needs review" and let the dialog do the detail —
  confirm that reads correctly with real project data.
- **Q3.** Does the shared segmented control land first (see
  `planning/refactor/shared-segmented-control/`)? If so, sequence that first
  and consume it here rather than copying `.drift-choice`.

## Done means

- Drift is identifiable on every aperture/frame/glazing row without expanding.
- Exactly one action per row, carrying its count.
- No hand-rolled modal chrome anywhere in `features/apertures/`.
- The dialog closes on successful apply and never re-prompts.
- `context/ui/pages/apertures-tab.md` describes what actually renders.
