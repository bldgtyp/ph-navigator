---
DATE: 2026-07-09
TIME: 11:20 EDT
STATUS: Active
AUTHOR: Ed May + Claude
SCOPE: Behavior contract for the five attachment-cell UX items
RELATED: README.md, STATUS.md,
         context/technical-requirements/attachments.md §A4
---

# PRD — Attachment Cell UX

All line references are as of 2026-07-09.

Key files:
- `frontend/src/features/assets/components/AttachmentCell.tsx` — the shared
  cell + preview modal.
- `frontend/src/shared/ui/attachments/attachments.css` — all styling.
- `frontend/src/features/assets/hooks.ts` — `uploadAsset` (sha256 →
  upload-intent → PUT signed URL → complete-upload).
- `backend/features/assets/registry.py` — locked field caps (datasheet
  `max_count=5`).

---

## Item 1 — Drop zone must highlight on file-drag

**Symptom.** The empty-state "📎 Drop files here" button lightens on
mouse *hover* but gives no feedback when a file is dragged over it, so the
user can't tell the drop target is live/valid.

**Root cause.** The cell's `onDragOver` only calls `event.preventDefault()`
(`AttachmentCell.tsx:106-108`); no drag state is tracked and there is no
`:hover`-equivalent for an active drag. CSS only styles
`.attachment-cell-inline .attachment-drop-button:hover`
(`attachments.css:62-65`).

**Fix.**
- Track a `dragActive` boolean via `onDragEnter` / `onDragLeave` /
  `onDrop` on the `.attachment-cell` div (guard against child-element
  dragleave flicker with a counter or `relatedTarget` check).
- While `dragActive && !readOnly`, apply a `.drag-active` class that shows
  a strong drop overlay: accent-colored dashed border + tinted fill on the
  empty button, and (item 4) on the populated strip's drop target too.
- Respects §A4.3 ("strong drop overlay on that cell only").

**Blast radius.** All attachment cells. Pure additive; no behavior change
when not dragging.

**Acceptance.** Dragging a valid file over an empty or populated cell
produces an obvious accent overlay; leaving/ dropping clears it.

---

## Item 2 — Single-click opens full-screen preview

**Symptom.** Opening the preview requires a double-click; Ed wants a
single click.

**Root cause.** By design today: `onClick` selects the thumbnail
(`AttachmentCell.tsx:138`), `onDoubleClick` opens the modal (`:139`). This
matches the current contract §A4.2 (single = select, double = open —
AirTable parity).

**⚠ OPEN DECISION (resolve before implementing).** Single-click-to-open
removes the in-strip *selection* affordance, which currently drives:
- arrow-key navigation along the strip (`onKeyDown`, `:87-89`),
- `Delete`/`Backspace` to detach the selected thumbnail (`:91`).

The preview modal already offers Prev/Next + Detach, so losing in-strip
select is tolerable. Options:

- **(A) Recommended — single-click opens, everywhere.** Drop the
  select-then-double-click model; detach/navigate happen in the modal.
  Simplest, matches Ed's ask, consistent across all attachment surfaces.
  Requires updating §A4.2 in `attachments.md`.
- **(B) Single-click opens for datasheets only**, via a prop
  (`openOnSingleClick`), keeping select-model for site photos. More code,
  divergent behavior across cells.
- **(C) Single-click opens; keep keyboard select for detach** (click =
  open, focus/arrows still select for `Delete`). Hybrid; slightly subtle.

**RESOLVED (Ed, 2026-07-09): (A) global.** Single click opens the preview on
every attachment surface; the in-strip select model is removed; `Enter` /
`Space` still open a focused tile (native `<button>`); detach is modal-only.
Contract §A4.2/§A4.6 updated to match.

**Blast radius.** Click semantics on every attachment cell (A) or scoped
(B). Contract doc §A4.2 update required for (A)/(C).

**Acceptance.** A single click on a thumbnail opens the full-screen
preview; detach remains reachable; keyboard open still works.

---

## Item 3 — Redesign the thumbnail tile

**Symptom.** The preview icon is very small, has a "weird right-side
border" and odd corner radii; looks unpolished.

**Root cause.**
- Image thumbnails render in a 30×30 px tile with `border-radius:
  var(--radius-xs)` and `object-fit: cover` (`attachments.css:84-111`) —
  tiny and cover-cropped, so a PDF first page reads as a scrap.
- The non-image glyph is a hand-built mini "document": `.attachment-doc-thumb`
  (20×25 px) with a `::after` folded dog-ear on the **top-right** (the
  "weird right-side border": `right:-1px; top:-1px` triangle, `:129-143`)
  and a `::before` colored underline bar (`:145-158`). At this size it
  reads as noise.

**Fix (invoke the `frontend-design` skill at implementation).** Direction
to validate then spec:
- Larger tile (target ~48–56 px, card-shaped) with consistent 1px border,
  single radius token, subtle shadow; image `object-fit: cover` but large
  enough to be legible; consider a filename caption under the tile in the
  card context (Materials expansion has room — the DataTable cell context
  does not, so keep the caption context-gated).
- Replace the hand-drawn doc glyph with a clean file-type badge (PDF / IMG
  / JSON) — drop the `::after` dog-ear and `::before` bar, or refine into a
  single deliberate motif. Keep PDF/danger accent legible.
- Preserve the fixed-height / horizontal-scroll cell contract (§A4.1) —
  the tile must still fit a DataTable row where used.

**Blast radius.** Visual only, all attachment cells. Must be verified in
both the roomy card context (Materials/Apertures expansions) and the tight
DataTable-cell context (Equipment).

**Acceptance.** Thumbnails read as intentional cards; no stray borders;
legible at a glance in both card and table contexts; light + dark themes.

---

## Item 4 — Persistent "+ Add" affordance on populated cells

**Symptom.** After the first datasheet uploads, "Drop files here"
disappears; user assumes only one attachment is allowed.

**Root cause.** Not a limit — datasheets allow `max_count=5`
(`registry.py:39`); site photos allow 10. The empty-state button only
renders while the cell is empty (`shouldRenderEmptyDropButton = isEmpty &&
!readOnly`, `AttachmentCell.tsx:99,119`). A populated cell shows only the
thumbnail strip. Dropping more files onto the strip *does* append (the
whole `.attachment-cell` is a drop target), but there is no visible add
control and no click-to-pick.

**Fix.**
- Append a persistent **"+ Add"** tile at the tail of `.attachment-strip`
  when `!readOnly && value.length + pending.length < config.maxCount`.
  Click opens the native file picker (reuse `inputRef`); it is also inside
  the drop target.
- When at `maxCount`, hide the tile (optionally a muted "5/5" hint).
- Keep the empty-state button for the zero-attachment case.

**Blast radius.** All attachment cells gain a "+ Add" tile. Matches the
`envelope-tab.md` §2.7.3 mockup ("+ Add" in the datasheet zone).

**Acceptance.** A populated cell shows a clear "+ Add"; adding a 2nd–5th
datasheet works via both click and drop; the tile disappears at the cap.

---

## Item 5 — Real upload spinner + completion verification

**Symptom.** No clear in-progress indicator; want a spinner until the file
is confirmed uploaded (possibly needing a Cloudflare/R2 confirmation
signal).

**Root cause.** In-flight files render as a plain
`<span class="attachment-pending">uploading...</span>` text pill
(`AttachmentCell.tsx:154-158`, `attachments.css:169-181`) — no spinner.

**What "verification" already exists (no new Cloudflare wiring needed).**
`uploadAsset` awaits the full chain before resolving the `asset_id`:
sha256 → `createUploadIntent` → `putToSignedUrl` (a 200 from R2 confirms
the bytes landed) → `completeUpload` (server GETs the first 4–8 KB back
from R2 and MIME-sniffs to verify — `attachments.md §A9`). So resolution of
`uploadAsset` **is** the verified-in-R2 signal. The gap is purely visual +
the thumbnail lag.

**Fix.**
- Replace the text pill with a real spinner tile matching the item-3
  thumbnail size (indeterminate). Optional determinate bar deferred (§A0
  batched coordinator is Phase-5).
- Handle the **thumbnail-lag** gap: `completeUpload` kicks server-side
  thumbnail generation as a background task, so `thumbnail_url` may be null
  for a moment after the asset resolves. The tile should show the file-type
  glyph (not a broken image) until `thumbnail_status = ready`; optionally
  re-fetch the asset URL once so the thumbnail swaps in without a manual
  refresh (today `useAssetUrls` has a 10-min staleTime — a targeted
  invalidation on upload-complete is the clean hook).
- Error path: on upload/verify failure surface a red tile + Sonner toast
  with the filename (§A4.3, envelope-tab.md §2.7.3), retry/dismiss.
  **As-built:** shipped the dismissible red tile (filename in tooltip); the
  Sonner toast is **deferred** — no global `<Toaster>` is mounted app-wide
  yet, so wiring one is separate infra work, not part of this item.

**Blast radius.** All attachment cells; upload plumbing in
`assets/hooks.ts` unchanged except an optional post-complete cache
invalidation.

**Acceptance.** Dropping a file shows a spinner until the asset is
confirmed in R2; the thumbnail then appears without a manual refresh;
failures show a clear error with the filename.

---

## Item 6 — Primary-color border around the expanded row

**Symptom.** When a material row is expanded, the expanded block reads as
loose/unbounded. Ed wants a primary-color border around the **entire**
expanded element (row header + expansion panel together) — see mockup
`assets/` image, 2026-07-09.

**Root cause.** The expanded state is two **sibling** divs inside a
`<Fragment>` with no shared wrapper: `.report-table__row--expanded`
(`ReportTable.tsx:94-147`) followed by `.report-table__expansion`
(`:148-152`). On expand they only get a faint accent-tint background
(`ReportTable.css:80-83`) and the expansion has plain subtle top/bottom
borders (`:143-148`). No enclosing outline.

**Fix (two viable approaches — prefer CSS-only).**
- **(A) CSS-only, recommended.** Draw a continuous box across the two
  siblings: `.report-table__row--expanded` gets border top+left+right +
  top corner radii; `.report-table__expansion` (when following an expanded
  row) gets border left+right+bottom + bottom radii. Use an accent border
  token (e.g. `color-mix(in oklab, var(--accent) …)`). No DOM change; keeps
  the shared component's structure intact. Watch the grid box-sizing so the
  border doesn't shift column alignment (compensate with an inset
  box-shadow ring instead of `border` if alignment drifts).
- **(B) Structural wrap.** Wrap the row+expansion in a container div when
  expanded and border that. Cleaner border, but changes shared-component
  DOM and grid/`role` semantics — heavier. Only if (A) can't align.

**Blast radius.** `ReportTable` is shared with the **Apertures** spec
report. The expanded-row border will appear there too (desirable).

**Acceptance.** Expanding a material draws a single accent-colored outline
around the header row + expansion as one unit; column alignment unchanged;
light + dark themes; verified on Apertures too.

---

## Item 7 — Collapsed-row chip: count tooltip + lighter "missing" icon

**Symptom.** On a collapsed row the datasheet/photo presence is only faintly
indicated. Ed wants (a) a tooltip showing how many attachments there are,
and (b) the "no attachment" paperclip rendered a lighter grey so the
have-vs-missing contrast is stronger.

**Root cause.** `AttachmentChipCell` (`AttachmentChipCell.tsx:9-20`) renders
a binary presence chip with an `aria-label` ("Attached" / "Missing") but
**no `title`**, so no hover tooltip. The "missing" state
(`.report-attachment-chip`, `ReportTable.css:314-326`) uses
`--text-muted`/`--text-secondary` on a dashed subtle border — not faint
enough to contrast strongly with the accent-tinted has-files state
(`:328-333`).

**Fix.**
- **(a) Tooltip.** Add a `title` to the chip: has-files →
  `"{count} datasheet(s)"` / `"{count} photo(s)"`; empty → `"No datasheets"`
  / `"No photos"`. The chip is generic (used for both datasheets and
  photos), so pass an optional `noun`/`label` prop from `MaterialsPanel`
  (`:198` datasheets, `:204` photos) rather than hard-coding "attachment".
  Keep the `aria-label` in sync.
- **(b) Contrast.** Drop the "missing" chip to a lighter token (e.g.
  `--text-faint` if it exists, else reduce glyph opacity / lighten the
  dashed border) so empty reads clearly weaker than the solid accent
  has-files chip. Do not touch the has-files styling.

**Blast radius.** `AttachmentChipCell` + its CSS are shared with the
**Apertures** spec report (`ApertureSpecReportPanel.tsx`). Tooltip noun
must be parameterized so it stays correct there. Contrast change is global
(desirable).

**Acceptance.** Hovering a collapsed-row chip shows an accurate count
tooltip with the right noun; empty chips are visibly lighter than
populated ones; Apertures chips still read correctly.

---

## Item 8 — IP mode shows Resistivity [R/inch], not conductivity

**Symptom.** In the Materials table, SI mode correctly shows Lambda
[W/(m-K)]. IP mode currently shows conductivity in IP units, but the PH
convention (and the rest of the app) is to show **Resistivity R/inch**
— (hr·ft²·°F)/(Btu·in) — in IP, since designers reason in R-per-inch.

**Root cause.** The `lambda` column is hard-wired to conductivity in both
systems: `header: "Lambda"`, `unit: conductivityUnitLabel(unitSystem)`,
render `formatConductivityFromWmK(...)` (`MaterialsPanel.tsx:161-171`).

**Precedent — reuse, don't invent.** `MaterialLegend.tsx:23-26,57-70`
already branches on `unitSystem`: IP → label "Resistivity", unit "R/inch",
value via **`formatRPerInFromConductivityWmK`** (exported from
`lib/units`); SI → "Conductivity" / "W/(m-K)" via
`formatConductivityFromWmK`. The stored field is unchanged
(`conductivity_w_mk`); resistivity is derived (1/λ, unit-converted) at
display only.

**Fix.** In the `lambda` column definition, branch on `unitSystem`:
- **IP:** `header: "Resistivity"`, `unit: "R/inch"`, render
  `formatRPerInFromConductivityWmK(m.conductivity_w_mk, { unitSystem, showUnit: false })`.
- **SI:** unchanged — `header: "Lambda"`, `unit: conductivityUnitLabel(unitSystem)`,
  render `formatConductivityFromWmK(...)`.
- Keep `numeric: true`. The column already rebuilds on `unitSystem`
  change (built inside the component), so the toggle is live.

**Blast radius.** `MaterialsPanel` only — the lambda column is defined
inline there, not shared. (The card sub-line / segment facts / legend
already follow this convention.)

**Acceptance.** Toggle IP → the column header reads "Resistivity [R/inch]"
and each value is R-per-inch (= 1/λ, IP-converted); toggle SI → back to
"Lambda [W/(m-K)]"; missing values still render "—".

---

## Cross-item notes

- **Contract sync.** Item 2 (if A/C) and item 4 update
  `attachments.md §A4.1/§A4.2`. Fold changes back in the same docs pass
  (`planning/.instructions.md` rule 4).
- **No backend changes expected** for any item (registry caps already
  support multi-file; verification already exists). Item 5's optional
  cache invalidation is frontend-only.
- **Verification:** each item verified in the running app (Envelope →
  Materials, signed in as Ed) plus at least one other surface for the
  shared-component items. `make frontend-dev-check` fast gate; `make ci`
  before merge.
</content>
