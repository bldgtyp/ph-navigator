# Phase 05 — Installs modal (key view + paint assignment)

```
DATE:    2026-08-03
TIME:    11:55
STATUS:  ✅ Done 2026-08-04; Ed's UI review closed 2026-08-15 (five rounds of
         polish — see Review follow-ups)
AUTHOR:  Ed + Claude
SCOPE:   Frontend. The core interaction: per-aperture modal with read-only
         key-view SVG, pick-type-then-paint-edges, bulk apply, copy-to,
         inline type creation. No builder-canvas changes.
RELATED: ../decisions.md (D-6c/d), ../PRD.md §5.1 layer 3 (wireframe), phases 02–04
```

Read first: `context/DESIGN_SYSTEM.md` (blessed components; modal chrome is
`shared/ui/ModalDialog.tsx` + `DialogActions.tsx`), `context/ui/pages/apertures-tab.md`.
Known gotcha (memory): modal-Escape vs viewer/builder hotkeys — the builder
already handles Esc at `ApertureCanvasContainer.tsx:317-347`; the modal must
stop propagation so Esc closes the modal without clearing builder selection.

## 1. Entry point

One small button per aperture in the builder header region (next to the
existing per-aperture actions — find the aperture header actions cluster in
`AperturesHeader`/`ApertureCanvasContainer` and match its button style).
Label: `Installs` (icon + text, title "Window install psi-values"). No new
canvas events (D-6d).

## 2. Modal layout (PRD §5.1 wireframe)

`components/InstallsModal.tsx` (+ CSS module in `apertures.css` token
families):

- **Left: key view.** `ApertureSvgCanvas` rendered read-only at fit zoom
  (compute like the builder's fit action) with a new overlay layer:
  - Per perimeter element-side, a tint rect from
    `elementRegionsMm` (`aperture-geometry.ts:111-147`) filled by the
    assigned type's color; inherited-default edges get a
    neutral/low-emphasis tint.
  - Interior (mulled) sides: hatched pattern + not clickable; small
    `0` glyph or legend note (PRD: the rule should be *visible*).
  - Hit handling: reuse the `ApertureHitTarget` pattern (per-side DOM
    targets) scoped inside the modal — do NOT touch
    `ApertureCanvasOverlay`.
- **Right: legend.** List of `aperture_install_types` rows: color swatch,
  name, formatted Ψ value, PDF chip when `pdf_report_asset_ids` non-empty,
  live usage count across the project ("14 edges"). Selecting a row arms
  paint mode. `+ New type…` opens the phase-03 create-row flow inline
  (reuse the table's row-insert machinery or a small form writing through
  the same payload builders — do not fork validation).
- Colors: deterministic assignment from a small design-token palette (order
  of rows), not user-chosen. Default row is always the neutral swatch.
- **Footer actions:** `Apply <selected type> to all edges` (this aperture);
  `Copy assignments to…` — popover multi-select listing only apertures with
  an **identical grid signature** (phase-02 `CopyElementInstalls` contract;
  filter client-side with the mirrored signature helper); `Done`.

## 3. Interaction rules

- Click a perimeter edge with a type armed → `setElementInstall(type)`;
  click an edge already carrying that type → clear to None (inherit).
- No armed type → clicking an edge shows its current assignment (tooltip /
  transient popover), does not mutate.
- All writes go through the existing apertures command mutation (drafts,
  undo journal, conflict handling come for free) — batch paint clicks with
  the same coalescing the builder uses if available.
- Esc closes (stop propagation); background click does not close if a paint
  is armed (prevent accidental loss — match `SetElementKindDialog`
  conventions).

## 4. Tests & exit gate

- Vitest: overlay renders correct rects per fixture (mull hatching,
  tints), paint toggle logic, copy-to filter by grid signature, legend
  usage counts.
- e2e: arm type → paint two edges → reopen modal → assignments persisted
  (use `--settle` for draft debounce); apply-to-all; copy-to a matching
  aperture; FrameRow cells (phase 04) reflect the change.
- Agent-browser screenshots: modal open with mixed assignments; PHI-style
  flow (several calculated types).
- This is the "see how the UI feels" phase — after the exit gate, capture a
  short screenshot sequence for Ed's review and pause for feedback before
  phase 06 polish decisions.
- Closeout gate; STATUS.md ledger.

## As-built notes (2026-08-04)

- **Entry point:** one `Installs` button (title "Window install psi-values")
  in the builder header actions for the active aperture — not per-aperture
  row buttons; the modal always targets the active aperture.
- **View-model:** `install-overlay.ts` composes on
  `resolveInstallPsiForAperture` (the phase-04 resolver stays the single
  owner of edge resolution); each overlay cell carries the full
  `ResolvedInstallPsi` plus the raw slot for the paint transition. The
  copy-to filter mirrors the backend `_grid_signature`
  (`apertureGridSignature`).
- **Legend:** reads `useInstallTypeSummaries()` from the phase-04
  `InstallTypesProvider` (no forked slice query in the modal). Inline
  create *and* per-row edit go through `installs/useInstallTypeWrites.ts`,
  which reuses the phase-03 payload builders + replace mutation and
  invalidates the apertures slice so summaries refresh. Ψ entry is unit-aware
  (`parseLinearPsiToWmK` + `psiUnitLabel`) so IP-mode input converts to SI.
  PDF marker is the blessed `chip chip--sm chip--outline`.
- **Fit zoom:** fits by width to exactly 360 px — equal to the SVG
  `MIN_CANVAS_WIDTH_PX` floor, so the floor can never re-scale the canvas
  out from under the absolutely-positioned overlay; tall apertures scroll
  vertically. The builder's `position: absolute` rule on
  `.aperture-svg-canvas` is overridden to `static` inside the modal (it
  collapsed the key view to 0 height otherwise).
- **Footer:** `Apply selected to all edges`; `Copy assignments to…` popover
  (extracted control, `useOutsidePointerDown` + `aria-expanded`); secondary
  `Close` (ManufacturerFiltersModal precedent) instead of a primary `Done`.
  Legend rows are plain toggle buttons with `aria-pressed` (not
  listbox/option).
- **No armed type → inspect:** via `title`/`aria-label` tooltips only; no
  transient popover was needed.
- **Write batching:** dispatches serialize through a `busy` flag; no
  coalescing layer (each paint is one `setElementInstall` command).
- **Test deltas from plan:** e2e paints one edge + clears it + apply-to-all
  + reload persistence on the 1×1 fixture (FrameRow phase-04 cells
  asserted); copy-to and mull hatching are covered by vitest
  (`install-overlay.test.ts` — signature filter, mull cells) rather than
  e2e, since the seeded fixture has a single aperture. Screenshots:
  `working/agent-browser/installs-modal-phase05.png` (default state) and
  `installs-modal-phase05-painted.png` (armed + painted top edge).
- **Deferred follow-ups:** backend-emitted grid signature on the apertures
  slice (so the copy-to predicate has one owner); a shared swatch primitive
  if a third feature needs color chips.
- **⏸ Pause:** per plan, Ed reviews the modal UI from the screenshots /
  live app before phase-06 polish decisions; phase 06 proceeds on the
  docs-integration work meanwhile.

## Review follow-ups (Ed's manual pass, 2026-08-04)

- **Second create in one modal session 409'd.** An aperture command (edge
  paint) is a document write and bumps the draft-wide etag, but
  `useApplyApertureCommandMutation` never invalidated the sibling table
  slices, so the cached install-types slice `If-Match`ed a superseded etag.
  Fixed on both sides of the protocol: the command mutation now calls
  `invalidateProjectDocumentEditorTableSlices` (`refetchType: "none"`), and
  the install-type writes resolve through `resolveCachedSliceForWrite`.
  Covered by `installs/__tests__/useInstallTypeWrites.test.tsx`.
- **Edit-in-place added.** Each legend row has a muted pencil
  (`installs-modal__type-action`) that swaps the row into the shared
  `InlineTypeForm` (name + Ψ, Save/Cancel). Escape backs out of the form
  instead of closing the modal. An untouched Ψ field is omitted from the
  patch so display rounding can't quantize the stored value.
- **Tint bands now trace the drawn frame.** `bandRect` returns the frame strip
  verbatim and only thickens a side with no picked frame (caller passes the mm
  equivalent of `MIN_BAND_PX` at the key view's zoom). `.installs-modal__edge`
  also had to opt out of the global 38px control floor and pill radius, which
  was what made the bands read as oversized rounded bubbles.
- **Layout/tool placement pass.** The footer is a single right-anchored `Done`
  (nothing to cancel — every write is immediate); `Apply to all edges` moved
  into the legend's paint bar and only exists while a type is armed;
  `Copy to other apertures…` moved to `headerAccessory` and its popover states
  what it overwrites. Legend rows became one card (arm button + pencil inside
  one border, full-height divider), and the installs CSS block was re-spaced —
  it was written against the old index-named scale, so `var(--space-2)` meant
  2px, not 8px. `CopyInstallsControl` / `InstallTypeForm` split out of
  `InstallsModal.tsx` to stay under the 500-line guard.
- **Staged edits + real Cancel (supersedes the "Done"-only footer above).**
  Immediate writes meant Cancel/Escape could not undo a paint or a type edit.
  The session now accumulates in `installs-draft.ts` and is written on `Save`:
  type creates/edits through `useInstallTypeWrites.commit`, then the edge
  commands. Two things fell out of it: `AperturesTab.dispatchSequence` threads
  each accepted slice into the next `If-Match` (the old `dispatch` closed over
  its render's slice, so a second command in one action 409'd), and a session
  that leaves every perimeter edge on one type collapses to a single
  `applyInstallToApertures` write. Cover: `__tests__/installs-draft.test.ts`
  plus a cancel-discards leg in the e2e spec.
- **Second UI pass.** Mulled-edge caption dropped; the paint hint + `Apply to
  all edges` moved under the key view; `+ New type…` is the last row of the
  type list; the inline editor is one line (name · Ψ · ✓ · ✗) with the unit
  captioned above the Ψ field; a paint-bucket cursor (the lucide `PaintBucket`
  glyph, inline data-URI with a white halo) marks armed painting.
- **Third UI pass.** Edge hover is a neutral 2px ring (accent disappeared
  against the blue chart tints) plus a 72% fill; `Apply to all edges` is always
  rendered and merely disabled, so the key view no longer shifts under the
  cursor; the pencil arms its row as well as opening the editor; the legend
  name dropped to `--fs-md` (buttons inherit the 16px body size, which read as
  a heading next to the Ψ text); and inheritance is stated explicitly — a
  legend note and each unassigned edge's tooltip name the Default row and its
  Ψ, since a grey "cleared" band communicated nothing.
- **The hover ring was invented, and that was the real bug (Ed, 2026-08-15).**
  The app already had a state language (magenta ring + tint on drawn surfaces,
  teal for selection, rings drawn as *inset* transparent outlines) — it was
  simply undocumented, so this modal grew its own outset `--text-primary`
  outline that clipped at the canvas edge. Fixed the rule *and* the gap:
  `--state-*` tokens in `styles/tokens.css`, a new `DESIGN_SYSTEM.md`
  § Interaction states, a visual pre-flight in `frontend/.instructions.md`, a
  `CLAUDE.md` dispatch row for any visible change, a `PreToolUse` hook
  (`.claude/hooks/ui-design-system-hook.py`) that injects the rules on every
  frontend css/tsx edit, and `check:interaction-states` (101 baselined
  fingerprints, ratchet-only) wired into `check:all`.
- **Default is an ordinary row (Ed, 2026-08-15).** Dropped the
  `[data-kind="default"]` band special-case (12% grey vs the 34% every other
  type used, which is why the drawing's grey did not match the legend swatch),
  removed the inheritance note and every "clear" phrasing — the vocabulary is
  just "Default" — and made `installUsageCounts` count what each perimeter edge
  *uses*, so inherited edges count toward Default (and mulled edges with a
  stale slot no longer count at all). Open question left for Ed: he described
  Default as un-renameable, but the backend contract says the row "can be
  edited but never deleted" and the Installs table page allows renaming, so the
  modal still allows it — locking the name is a backend + table + modal change.
- **Footer no longer scrolls away.** New shared `scrollBody` on `ModalDialog`
  (`.modal-panel--scroll-body`): header and `.modal-actions` pin, the body is
  the flexible middle. The Installs modal sets `overflow: hidden` on its body
  and scrolls the type list alone, so the key view and paint bar stay put. The
  list is a flex column — as a grid the rows' `overflow: hidden` zeroed their
  automatic minimum size and they compressed into each other instead of
  scrolling.
- **Element card clipped its own last column on a narrow screen.** The
  phase-04 Ψ-inst column pushed `.aperture-element-table`'s min-width columns
  past the workspace width, and the card box stopped at the viewport while the
  grid kept going — the far-right column drew outside the card border.
  `.aperture-element-card-stack` now has `min-width: max-content`, so the stack
  (and every card stretched to it) is as wide as the widest row and the border
  travels with the columns. Verified at 1010 px (card grows, last cell 9 px
  inside the border) and 1600 px (card still fills the workspace, no
  shrink-to-content regression).

