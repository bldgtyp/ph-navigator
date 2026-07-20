---
DATE: 2026-07-20
TIME: 17:50 EDT
STATUS: Active
AUTHOR: Claude with Ed May
SCOPE: Full per-modal static-audit catalog backing the modal-consistency refactor.
RELATED:
  - ./README.md
  - ./PRD.md
  - ../../../frontend/src/shared/ui/ModalDialog.tsx
  - ../../../frontend/src/shared/ui/DialogActions.tsx
  - ../../../frontend/src/styles/modals.css
---

# Modal / Dialog Consistency Catalog

Static code audit of every modal/dialog in the PHN frontend, scored against the
shared `ModalDialog` + `DialogActions` contract. 58 modal instances across ~50
files. Generated 2026-07-20 by a 9-agent fan-out; eval only, no code changed.

See `PRD.md` for the ratified contract and defect analysis; this file is the
raw per-modal evidence.

## Totals

- **Tiers:** gold 10 · partial 40 · rogue 8
- **Severity:** high 9 · medium 23 · low 26

| Recurring defect | Count / 58 |
|---|---|
| Both top-right Close AND footer Cancel (double dismiss) | 34 |
| Hand-rolled footer despite using shared ModalDialog | 32 |
| Backdrop-click dismiss (inconsistent presence) | 25 |
| Primary/submit button missing `.primary-button` (renders unstyled) | 20 |
| No top-right header Close button | 11 |
| Custom panel width (not shared 560px) | 5 |

## HIGH severity

### DocumentConfirmationDialog (kind='switch') — `partial`
`src/features/project_document/components/DocumentConfirmationDialog.tsx`  
*Uncommitted draft / switch-version confirmation*

- **dismiss:** footer-cancel, header-close
- **footer:** `Save then open` [other] · `Save As... then open` [secondary] · `Discard changes` [danger] · `Cancel` [secondary]
- **width / padding / overflow:** shared 560px (via ModalDialog) — shared --space-24 — shared overflow:auto
- **issues:**
  - Uses a bespoke 'modal-actions modal-actions-stack' variant (4 buttons stacked vertically) that departs from the standard two-button space-between row used everywhere else — a genuinely different footer layout, not just a hand-rolled row.
  - Cancel is placed LAST in a 4-button stack instead of the conventional 'Cancel on the left' pattern from DialogActions — inconsistent affordance ordering versus every other modal in this set.
  - 'Save then open' primary action has no className (plain button) while a sibling secondary action does — inconsistent button styling within the same footer.
  - Two secondary-button-styled actions ('Save As... then open' and 'Cancel') sit adjacent with no strong visual hierarchy distinguishing which is the recommended path.

### ProjectMaterialEditorModal — `partial`
`src/features/envelope/components/ProjectMaterialEditorModal.tsx`  
*Edit project material — modal shell wrapping ProjectMaterialEditor*

- **dismiss:** header-close, backdrop-click, esc-only
- **footer:** `Update material` [other]
- **width / padding / overflow:** shared 560px — shared --space-24 — shared overflow:auto
- **bespoke CSS namespace:** `project-material-editor__* (defined in the child ProjectMaterialEditor.tsx, not this file)`
- **issues:**
  - This file itself is a pure host/wrapper: it renders no chrome of its own beyond <ModalDialog><ProjectMaterialEditor/></ModalDialog> — all footer/body markup lives in the sibling ProjectMaterialEditor.tsx, so the tier judgment below is really about that child component's footer, which this modal has no control over from this file alone.
  - There is no Cancel button at all in this modal — the footer (<footer className="project-material-editor__footer"> in ProjectMaterialEditor.tsx) has only a single <button type="submit">Update material</button> with NO className (so it does not get .primary-button styling, unlike every primary action elsewhere in this feature area) and no secondary/cancel action; the only way to dismiss is the header 'Close' text-button or backdrop/Esc.
  - Error display also diverges: instead of DialogActions' .form-error row, the footer conditionally renders <p className="form-error" role="alert">{parseError ?? error}</p> or an empty <span/> spacer to hold the flex layout — functionally similar but hand-built rather than reusing DialogActions.

### ManufacturerFiltersModal — `rogue`
`src/features/apertures/components/ManufacturerFiltersModal.tsx`  
*Configure manufacturer filters (frame/glazing checkbox columns)*

- **dismiss:** backdrop-click, footer-cancel
- **footer:** `Cancel` [secondary] · `Save` [primary]
- **width / padding / overflow:** custom — min-width: min(640px, 92vw); max-width: 92vw (not the shared 560px) — custom — padding: 1rem 1.25rem (not --space-24) — custom but equivalent — overflow: auto on .manufacturer-modal, max-height: 88vh
- **bespoke CSS namespace:** `manufacturer-modal__`
- **issues:**
  - Hand-rolls its own backdrop (.manufacturer-modal__backdrop, position:fixed/flex-center) and panel (.manufacturer-modal) instead of ModalDialog — entirely bespoke chrome with its own CSS block in apertures.css.
  - Header has no top-right 'Close' text-button at all (only an <h2>); the only way to dismiss is the Cancel button in the footer or clicking the backdrop — no equivalent of ModalDialog's showHeaderClose.
  - Cancel button (<button type="button" onClick={onClose}>Cancel</button>) has no className at all — does not use .secondary-button, so it will pick up default browser/global button styling rather than the shared secondary style.
  - Save button uses a bespoke .manufacturer-modal__save class (font-weight only) rather than .primary-button, so its visual weight/color will diverge from every gold-tier modal's primary action.
  - Footer button order is Cancel (left) then Save (right) via justify-content:flex-end + gap, which happens to match the DialogActions visual order, but is not laid out via .modal-actions/space-between and isn't reusable button styling.
  - Loading state ('Loading catalog rosters…') and the in-use note banner are also fully custom-styled, adding to the divergent surface area.

### RefreshDialog — `rogue`
`src/features/apertures/components/RefreshDialog.tsx`  
*Refresh element from catalog (three-column field diff dialog)*

- **dismiss:** backdrop-click, footer-cancel
- **footer:** `Cancel` [secondary] · `Save` [primary]
- **width / padding / overflow:** custom — min-width: min(680px, 92vw); max-width: 92vw (not the shared 560px) — custom — padding: 1rem 1.25rem (shared .aperture-drift-modal/.refresh-dialog/.project-refs CSS block, not --space-24) — custom but equivalent — overflow: auto, max-height: 88vh
- **bespoke CSS namespace:** `refresh-dialog__`
- **issues:**
  - Hand-rolls its own backdrop (.refresh-dialog__backdrop) and panel (.refresh-dialog) instead of ModalDialog; the CSS block is explicitly shared/copy-pasted across three different rogue modals (.aperture-drift-modal, .refresh-dialog, .project-refs all share the same rules), which is itself a sign of an un-consolidated pattern that should be ModalDialog.
  - No top-right header 'Close' button — header is just <h2> + subtitle text; only dismiss paths are the footer Cancel button or backdrop click.
  - Cancel button has no className at all (plain <button>), so it doesn't match .secondary-button styling used elsewhere in gold-tier modals.
  - Save button uses a bespoke .refresh-dialog__save class (font-weight only) instead of .primary-button — visually it will not match other primary actions app-wide.
  - Footer 'Cancel' is conditionally the only button when entry.kind === 'catalog_row_missing' (Save button is omitted entirely rather than disabled) — an unusual footer-composition pattern versus DialogActions' consistent two-button row.
  - Additional bespoke UI inside the panel — bulk-action buttons ('Take all from catalog' / 'Keep all mine') and a full data table with radio-button rows — is all custom-styled via refresh-dialog__* classes rather than reusing any shared table/control primitives.

### CreateFieldConfigModal — `rogue`
`src/shared/ui/data-table/components/CreateFieldConfigModal.tsx`  
*Add field*

- **dismiss:** esc-only, backdrop-click (onPointerDownOutside/onInteractOutside, suppressed while pending)
- **footer:** `Cancel` [secondary] · `Add field / Adding...` [primary]
- **width / padding / overflow:** custom: min-width 360px, max-width 480px, width calc(100vw - 48px); formula variant widens to min(720px, calc(100vw-48px)) via .data-table-field-config-modal-formula — custom var(--space-16) on .data-table-field-config-modal (vs shared --space-24) — custom: overflow-y:auto, max-height calc(100vh - 48px)
- **bespoke CSS namespace:** `data-table-field-config-modal*`
- **issues:**
  - Built directly on raw Radix Dialog.Root/Content, not the shared ModalDialog shell — completely bespoke backdrop, panel, and footer.
  - No visible header at all: <Dialog.Title> is sr-only ('Add field'), so there is no on-screen H2 and no top-right Close button, unlike every ModalDialog-based modal.
  - Submit button ("Add field"/"Adding...") has no className — it falls back to the browser/base button default rather than .primary-button, so it looks visually different from Save/Add buttons in gold-tier modals.
  - Footer is right-aligned (justify-content: flex-end) rather than the shared .modal-actions space-between layout, so Cancel/Add field sit flush right instead of Cancel-left/Primary-right.
  - Panel width (360-480px) and padding (--space-16) are both narrower/tighter than the shared 560px / --space-24 contract, so this modal reads visually smaller and denser than gold-tier modals.

### FieldConfigModal — `rogue`
`src/shared/ui/data-table/components/FieldConfigModal.tsx`  
*Edit field*

- **dismiss:** esc-only (suppressed while pending/confirming), backdrop-click (onPointerDownOutside/onInteractOutside, suppressed while pending/confirming)
- **footer:** `Cancel` [secondary] · `Save / Saving…` [primary]
- **width / padding / overflow:** same as CreateFieldConfigModal: 360-480px, width calc(100vw-48px), formula variant min(720px, calc(100vw-48px)) — custom var(--space-16) (vs shared --space-24) — custom overflow-y:auto, max-height calc(100vh - 48px)
- **bespoke CSS namespace:** `data-table-field-config-modal*, data-table-field-config-confirmation-*, data-table-alert-* (nested AlertDialog)`
- **issues:**
  - Same rogue Radix Dialog.Root/Content build as CreateFieldConfigModal — no ModalDialog shell, no visible header, sr-only title, no header Close button.
  - Submit button ("Save"/"Saving…") has no className — no .primary-button styling, inconsistent with gold-tier Save buttons.
  - Nests a second, fully independent bespoke dialog (Radix AlertDialog for the type-change confirmation) with its own overlay/content classes (.data-table-field-config-confirmation-*), stacked z-indexes, and its own Cancel/Action buttons — a third distinct visual system layered inside an already-rogue modal.
  - Also renders a third ad-hoc inline chrome for the R-S2 external-conflict banner (.data-table-field-config-modal-conflict) with its own unstyled-class 'Keep my changes' button (no className at all) next to a secondary-button 'Discard my changes' — inconsistent button styling within the same row.
  - Footer right-aligned (flex-end) rather than shared space-between; width/padding both diverge from the 560px/--space-24 contract.
  - At 963 lines this file carries an enormous amount of modal-adjacent bespoke chrome (main dialog + confirmation alert + conflict banner) that duplicates concerns the shared ModalDialog/DialogActions/AlertDialog wrappers already solve elsewhere in the app.

### ConfirmDestructiveDialog — `rogue`
`src/shared/ui/data-table/components/ConfirmDestructiveDialog.tsx`  
*Generic destructive-action confirm (e.g. delete field/row)*

- **dismiss:** esc-only (Radix AlertDialog default), backdrop-click (onOpenChange(false) → onCancel)
- **footer:** `Cancel` [secondary] · `{confirmLabel}` [danger]
- **width / padding / overflow:** custom: min-width 320px, max-width 480px (position:fixed, translate(-50%,-50%)) — custom var(--space-20) — none (can overflow) — no overflow rule set on .data-table-alert-content
- **bespoke CSS namespace:** `data-table-alert-*`
- **issues:**
  - Built on raw Radix AlertDialog with its own .data-table-alert-overlay/.data-table-alert-content classes — no ModalDialog shell, no <h2>-style header, no Close affordance at all (title is just an AlertDialog.Title styled as a heading, no dismiss X).
  - Footer is right-aligned (justify-content:flex-end) rather than the shared space-between layout DialogActions provides.
  - Width (320-480px) and padding (--space-20) both diverge from the shared 560px/--space-24 modal-panel contract, and there is no explicit overflow handling if description/children content grows tall.
  - This bespoke .data-table-alert-* pattern is shared verbatim by ConfirmDeleteOptionDialog and reused inline inside FieldConfigModal's nested AlertDialog.Content, meaning three separate call sites all hand-roll the same non-canonical confirm-dialog look instead of a single shared component.

### ConfirmDeleteOptionDialog — `rogue`
`src/shared/ui/data-table/components/ConfirmDeleteOptionDialog.tsx`  
*Delete single-select option (with clear/replace cascade)*

- **dismiss:** esc-only (Radix AlertDialog default), backdrop-click (onOpenChange(false) → onCancel)
- **footer:** `Cancel` [secondary] · `Delete` [danger]
- **width / padding / overflow:** custom: min-width 320px, max-width 480px (same .data-table-alert-content as ConfirmDestructiveDialog) — custom var(--space-20) — none (can overflow) — no overflow rule; content grows with the radio-group cascade UI + inline AutocompleteSelect, which can push the fixed-position dialog off-screen on short viewports
- **bespoke CSS namespace:** `data-table-alert-* (shared with ConfirmDestructiveDialog) plus data-table-field-editor-cascade-*`
- **issues:**
  - Same rogue Radix AlertDialog build as ConfirmDestructiveDialog — no ModalDialog shell, no header Close, right-aligned footer, 320-480px width, --space-20 padding all diverging from the shared contract.
  - Adds a non-trivial embedded form (radio buttons + AutocompleteSelect for the replacement option, plus a form-error line) inside a dialog whose fixed top:50%/left:50%/translate(-50%,-50%) positioning has no overflow/scroll handling — a long option list or narrow viewport can clip or overflow the dialog edges unlike ModalDialog's overflow:auto panel.
  - Radio inputs and the 'Delete' danger button are unstyled by any shared control-density system (no visible token-driven spacing beyond ad-hoc .data-table-field-editor-cascade-* classes), adding yet another bespoke micro-layout on top of the already non-canonical alert shell.

### CascadePreviewDialog — `rogue`
`src/features/equipment/heat-pumps/components/CascadePreviewDialog.tsx`  
*Cascade delete preview / confirm (e.g. deleting equipment referenced elsewhere)*

- **dismiss:** footer-cancel, backdrop-click via AlertDialog.Root onOpenChange->onCancel, esc (Radix AlertDialog default)
- **footer:** `Cancel` [secondary] · `{confirmLabel} (caller-supplied)` [danger]
- **width / padding / overflow:** custom — Radix AlertDialog.Content with own `data-table-alert-content` class, no ModalDialog panel width used — custom — `data-table-alert-content`/`data-table-alert-actions` CSS classes, not `.modal-panel` — none observed in this file (depends on external `data-table-alert-content` CSS, not the shared overflow:auto contract)
- **bespoke CSS namespace:** `data-table-alert- (Radix AlertDialog wrapper, shared across data-table but distinct from ModalDialog/.modal-panel entirely)`
- **issues:**
  - Uses Radix `AlertDialog` primitives (Overlay/Content/Title/Description/Cancel/Action) instead of ModalDialog — no header, no top-right Close button at all, and no `.modal-panel`/`.modal-backdrop` classes; this is a structurally different modal system living alongside ModalDialog.
  - No visible title-bar Close affordance; only way to dismiss is Cancel button, backdrop click, or Escape — inconsistent with ModalDialog's always-present header Close text-button.
  - This file also exports a second modal, BlockedDeleteDialog (see separate entry), which DOES use ModalDialog — so the same file mixes a rogue-tier and a partial-tier modal implementation.


## MEDIUM severity

### SegmentDialog — `gold`
`src/features/envelope/components/dialogs/SegmentDialog.tsx`  
*Edit assembly-layer segment (material picker + width + steel-stud params)*

- **dismiss:** backdrop-click, esc-only, footer-cancel
- **footer:** `Cancel` [secondary] · `Apply` [primary]
- **width / padding / overflow:** shared 560px — shared --space-24 — shared overflow:auto
- **bespoke CSS namespace:** `segment-properties-form / segment-dialog-section / segment-geometry-grid / segment-steel-stud-* / segment-actions*`
- **issues:**
  - Longest/most complex modal in the set: material picker + facts panel + width input + collapsible 'Steel stud parameters' section (rendered as an open <section> or a closed <details> disclosure depending on state) — all inside the single shared scroll container, so a fully-expanded form can push well past typical viewport height before the shared max-height/scroll kicks in.
  - showHeaderClose={false} plus a custom headerAccessory holding BOTH a unit toggle and a bespoke kebab-style 'more actions' menu (SegmentActionsMenu, its own outside-click hook, role=menu/menuitem, 'Delete segment' danger item) crammed into the header-right slot — this is the most header-chrome-heavy deviation from the gold default in this feature area and is worth a UX pass on whether a destructive delete action belongs in a hidden overflow menu in the header rather than the footer.

### OneTimeLinkModal — `partial`
`src/features/admin/components/OneTimeLinkModal.tsx`  
*One-time invite/reset link display (copy-to-clipboard, shown once)*

- **dismiss:** header-close, footer-done-button
- **footer:** `Copy / Copied (inline with the link input, not in the footer action row)` [other] · `Done` [primary]
- **width / padding / overflow:** shared 560px (via ModalDialog .modal-panel) — shared --space-24 — shared overflow:auto
- **bespoke CSS namespace:** `admin-link-`
- **issues:**
  - Hand-rolls its own footer instead of DialogActions: a bare `<div className="modal-actions">` with a single `<button className="primary-button">Done</button>` — no Cancel/secondary button, so the space-between two-button layout that DialogActions guarantees is not present (only one button, left-aligned by flex default rather than the shared row's balanced justify-content).
  - Introduces a second, unrelated action button ("Copy"/"Copied") inside the body via `.admin-link-row`, styled with `secondary-button` but placed next to the link input rather than in the footer row — a plausible design choice (copy is tied to the input) but it means there are two differently-purposed `.secondary-button` usages in this modal family, one in-body and one (elsewhere) in-footer, which could read as inconsistent placement across the admin modal set.
  - No error/busy state plumbing (no `.form-error`, no disabled/pending button) since there's no mutation here — fine functionally, but it means this modal's footer contract diverges from all four DialogActions-based siblings with no equivalent visual fallback for a future error case.

### CatalogOptionCascadeProgressModal — `partial`
`src/features/catalogs/components/CatalogOptionCascadeModal.tsx`  
*Catalog option update / cascade progress modal*

- **dismiss:** header-close (conditional, hidden while working via showHeaderClose={!working}), footer-cancel/close/done buttons
- **footer:** `Close` [secondary] · `Try again` [other] · `Retry project update / Retrying…` [other] · `Done` [other]
- **width / padding / overflow:** shared 560px (via ModalDialog's .modal-panel) — shared --space-24 (via .modal-panel) — shared overflow:auto (via .modal-panel)
- **bespoke CSS namespace:** `catalog-option-cascade-`
- **issues:**
  - Hand-rolls its own footer markup (custom .catalog-option-cascade-actions div) instead of DialogActions, so it never gets the shared .modal-actions space-between row layout.
  - Button styling is inconsistent within the same component: 'Close' gets className="secondary-button" but 'Try again', 'Retry project update', and 'Done' have no className at all — they render as unstyled default <button> elements, not matching primary-button or secondary-button.
  - The 'Done' state shows only a single unstyled button with no Cancel/secondary counterpart, an asymmetric footer shape versus every other modal in the app.
  - onClose is swapped for a no-op while working (onClose={working ? () => undefined : onClose}), which also disables the header Close — a legitimate modal-blocking pattern, but it's implemented ad hoc rather than via any shared 'busy' contract.

### FrameTypeCreateModal — `partial`
`src/features/catalogs/components/FrameTypeCreateModal.tsx`  
*New frame-type create form modal*

- **dismiss:** header-close, footer-cancel
- **footer:** `Cancel` [secondary] · `Create frame type / Creating…` [primary]
- **width / padding / overflow:** shared 560px (via ModalDialog's .modal-panel) — shared --space-24 (via .modal-panel) — shared overflow:auto (via .modal-panel)
- **issues:**
  - Hand-rolls the footer with a raw <div className="modal-actions"> instead of the DialogActions component — reuses the shared layout class but bypasses the shared component and its built-in error-line handling.
  - The submit button (<button type="submit" disabled={!canSubmit}>) has NO className at all — it is missing primary-button, so it renders as a plain unstyled button next to the properly-styled secondary-button Cancel, a visible mismatch versus the DialogActions-driven gold-tier pattern.
  - Error text is rendered manually as a <p className="form-error" role="alert"> above the actions div rather than via DialogActions' built-in error slot — functionally equivalent but duplicated boilerplate that would be centralized under gold tier.

### MaterialEditorModal — `partial`
`src/features/catalogs/components/MaterialEditorModal.tsx`  
*New/Edit material form modal*

- **dismiss:** header-close, footer-cancel
- **footer:** `Cancel` [secondary] · `Create material / Save changes / Saving…` [primary]
- **width / padding / overflow:** shared 560px (via ModalDialog's .modal-panel) — shared --space-24 (via .modal-panel) — shared overflow:auto (via .modal-panel)
- **issues:**
  - Identical pattern to FrameTypeCreateModal: hand-rolled <div className="modal-actions"> footer instead of DialogActions.
  - Submit button has no className — missing primary-button — so it's visually a plain default button beside the correctly-styled secondary-button Cancel.
  - Manual <p className="form-error" role="alert"> duplicate of what DialogActions already provides as a built-in error slot.

### ClimateDatasetPickerModal — `partial`
`src/features/climate/components/ClimateDatasetPickerModal.tsx`  
*Set Phius/PHI Climate Data (dataset picker)*

- **dismiss:** header-close, footer-cancel
- **footer:** `Cancel` [secondary] · `Attach / Replace current dataset / Attaching…` [primary]
- **width / padding / overflow:** shared 560px (via ModalDialog's .modal-panel) — shared --space-24 (via .modal-panel) — shared overflow:auto (via .modal-panel)
- **bespoke CSS namespace:** `climate-picker-`
- **issues:**
  - Hand-rolls its own footer (`<div className="modal-actions">` + raw buttons) instead of using DialogActions; two distinct footers exist in this file — one inside the 'location not set' guard branch (lines 148-161) and one in the main content branch (lines 210-217) — duplicating markup instead of sharing a component.
  - The primary action button (`Attach` / `Replace current dataset`) has NO className at all — it is a bare `<button type="button">`, not `.primary-button`, so it likely renders as an unstyled/browser-default button instead of matching the shared primary style used elsewhere (e.g. SetLocationModal's Save button does use `.primary-button`).
  - In the guard branch, the second button ('Set the project location') also lacks `.primary-button`/any class, same styling gap.
  - Footer button order is Cancel (left) then primary action (right) matching DialogActions convention, which is good, but achieved by hand-coding rather than reuse.
  - No `id`/title accessory beyond default ModalDialog header; content area mixes ad hoc `.form-note`/`.form-error` classes consistent with shared conventions, which is fine.

### ClimateUploadModal — `partial`
`src/features/climate/components/ClimateUploadModal.tsx`  
*Upload Climate Data (EPW/STAT/DDY upload)*

- **dismiss:** header-close, footer-cancel
- **footer:** `Cancel` [secondary] · `Upload & attach / Uploading…` [primary]
- **width / padding / overflow:** shared 560px (via ModalDialog's .modal-panel) — shared --space-24 (via .modal-panel) — shared overflow:auto (via .modal-panel)
- **bespoke CSS namespace:** `climate-upload-`
- **issues:**
  - Hand-rolls its own `.modal-actions` footer with raw `<button>` elements instead of DialogActions.
  - The primary action button ('Upload & attach') has no className — same missing `.primary-button` gap as the dataset picker modal, so it won't visually match other modals' primary CTAs.
  - Error text is rendered manually as `<p className="form-error" role="alert">` inside the body rather than via DialogActions' built-in error slot — functionally similar but hand-implemented, duplicating a pattern the shared footer already provides.
  - Otherwise simple/compact: single content block, no extra secondary/tertiary buttons, low visual clutter.

### WeatherStationPickerModal — `partial`
`src/features/climate/components/WeatherStationPickerModal.tsx`  
*Set Hourly Climate Data (EPW station picker)*

- **dismiss:** header-close, footer-cancel
- **footer:** `Cancel` [secondary] · `Upload Climate Data` [secondary] · `Attach weather file / Attaching…` [primary]
- **width / padding / overflow:** shared 560px (via ModalDialog's .modal-panel) — shared --space-24 (via .modal-panel) — shared overflow:auto (via .modal-panel)
- **bespoke CSS namespace:** `climate-picker-actions-secondary / climate-picker-actions-primary`
- **issues:**
  - Introduces a THREE-button footer layout unique among the four files: Cancel + 'Upload Climate Data' grouped left via `.climate-picker-actions-secondary`, and the primary action isolated right via `.climate-picker-actions-primary` (with `margin-left:auto` and a custom `min-width:180px` on its button) — a bespoke two-group flex wrapper layered on top of `.modal-actions` instead of DialogActions' plain two-button row.
  - This custom `.climate-picker-actions` variant is duplicated twice in the same file (guard branch lines 89-111 and main branch lines 141-157) instead of extracted to one shared subcomponent.
  - The primary action button ('Attach weather file') again has no className — missing `.primary-button`, same gap as the other two 'partial' picker modals in this set.
  - `.climate-picker-actions` in CSS adds its own `border-top` + `padding-top` divider above the footer row, a treatment not present in ModalDialog/DialogActions or the other three modals here — inconsistent footer chrome across the feature.
  - Functionally reasonable (Upload Climate Data as an escape hatch when no location is set), but the extra button and custom grouping increase visual complexity relative to the plain 2-button convention used elsewhere.

### RecordDetailModal — `partial`
`src/shared/ui/data-table/components/RecordDetailModal.tsx`  
*Record details (row expand)*

- **dismiss:** header-close, esc-only (via ModalDialog's document Escape listener)
- **footer:** `Cancel/Close (readOnly ? "Close" : "Cancel")` [secondary] · `Save` [primary]
- **width / padding / overflow:** shared 560px (inherits ModalDialog's .modal-panel; no override found) — shared --space-24 (via .modal-panel) — shared overflow:auto (via .modal-panel)
- **bespoke CSS namespace:** `table-row-modal-* (form/section/grid), data-table-record-detail-readonly (content only, not chrome)`
- **issues:**
  - This component itself renders no modal chrome directly — it delegates entirely to the shared RowEditModal (src/shared/ui/data-table/row-edit.tsx), which wraps ModalDialog but hand-rolls its own .modal-actions footer instead of using DialogActions, making it partial tier rather than gold.
  - RowEditModal's Save button has no className (falls back to default button styling) while Cancel uses .secondary-button and an optional Delete uses .danger-button — three different visual weights in one footer row where DialogActions would give Cancel/primary a consistent two-button contract.
  - RowEditModal's footer omits DialogActions' justify-content:space-between guarantee implicitly (it reuses .modal-actions class so layout matches), but the missing primary-button class on Save is a real visual inconsistency vs. gold-tier modals using DialogActions.

### DocumentConfirmationDialog (kind='discard') — `partial`
`src/features/project_document/components/DocumentConfirmationDialog.tsx`  
*Discard draft? confirmation*

- **dismiss:** header-close, footer-cancel
- **footer:** `Cancel` [secondary] · `Discard draft` [danger]
- **width / padding / overflow:** shared 560px (via ModalDialog) — shared --space-24 — shared overflow:auto
- **issues:**
  - Footer is a hand-rolled <div className="modal-actions"> with raw buttons instead of <DialogActions>, so it duplicates rather than reuses the shared footer contract.
  - Body wrapper is 'confirmation-panel' (bespoke to this file/sibling dialogs), not the DialogActions form-error/actions structure.

### DocumentConfirmationDialog (kind='unlock') — `partial`
`src/features/project_document/components/DocumentConfirmationDialog.tsx`  
*Unlock version? confirmation*

- **dismiss:** header-close, footer-cancel
- **footer:** `Cancel` [secondary] · `Unlock version` [other]
- **width / padding / overflow:** shared 560px (via ModalDialog) — shared --space-24 — shared overflow:auto
- **issues:**
  - Primary action button ('Unlock version') has no className at all — not primary-button, not any other convention — unlike DialogActions which always applies primary-button to the submit action. Visually it will look unstyled/default relative to sibling dialogs.
  - Hand-rolled modal-actions div instead of DialogActions.

### DocumentConfirmationDialog (kind='stale-save') — `partial`
`src/features/project_document/components/DocumentConfirmationDialog.tsx`  
*Saved version changed confirmation*

- **dismiss:** footer-cancel(labeled 'Keep draft'), header-close
- **footer:** `Keep draft` [secondary] · `Discard draft` [secondary] · `Save As` [other]
- **width / padding / overflow:** shared 560px (via ModalDialog) — shared --space-24 — shared overflow:auto
- **issues:**
  - Three-button row where the cancel-equivalent is relabeled 'Keep draft' rather than 'Cancel' — reasonable semantically but breaks the DialogActions label convention other dialogs follow.
  - Two buttons both styled secondary-button ('Keep draft' and 'Discard draft') with no visual distinction, while the actual primary/submit action ('Save As') carries no className at all — inverted hierarchy versus the shared primary-button/secondary-button contract.

### DocumentConfirmationDialog (default/'locked-save') — `partial`
`src/features/project_document/components/DocumentConfirmationDialog.tsx`  
*Version locked confirmation*

- **dismiss:** footer 'Keep draft', header-close
- **footer:** `Keep draft` [secondary] · `Discard draft` [secondary] · `Save As` [other]
- **width / padding / overflow:** shared 560px (via ModalDialog) — shared --space-24 — shared overflow:auto
- **issues:**
  - Identical footer pattern/issues to the 'stale-save' dialog above (duplicate markup rather than shared component) — same inverted primary/secondary styling problem.

### DraftRestoreDialog — `partial`
`src/features/project_document/components/VersionControlsDialogs.tsx`  
*Recovered draft found dialog*

- **dismiss:** header-close (onClose=onKeep, not a neutral cancel)
- **footer:** `Discard draft` [secondary] · `Restore draft` [other]
- **width / padding / overflow:** shared 560px (via ModalDialog) — shared --space-24 — shared overflow:auto
- **issues:**
  - Destructive-leaning action ('Discard draft') is on the LEFT styled secondary-button, while the safe/default action ('Restore draft') is on the right with no className — reversed from the Cancel(left)/primary(right) convention and the primary action has no primary-button styling.
  - ModalDialog's onClose is wired to onKeep (restore) rather than a neutral dismiss, so the header 'Close' X performs a decision-equivalent action rather than a true cancel — worth flagging as a UX inconsistency versus other modals where header-close is neutral.

### StatusItemModal — `partial`
`src/features/project_status/components/StatusItemModal.tsx`  
*Add/Edit status item form modal*

- **dismiss:** header-close, footer-cancel
- **footer:** `Cancel` [secondary] · `Save item / Saving...` [other]
- **width / padding / overflow:** shared 560px (via ModalDialog) — shared --space-24 — shared overflow:auto
- **issues:**
  - Submit button 'Save item' has no primary-button className, same pattern as SaveAsDialog and the unlock/save-as confirmation dialogs — this is a recurring, not one-off, gap across the whole feature area: hand-rolled footers consistently forget to apply primary-button to the submit action.
  - Internal 'segmented-control' (Edit/Preview toggle) buttons use their own active-state classing unrelated to modal chrome — not a chrome issue, just noting bespoke control inside the form body.
  - Form is otherwise reasonably consistent (form-error placement, field-group patterns) but the footer duplicates DialogActions' visual contract via hand-written JSX instead of using the component.

### SegmentDetailDialog — `partial`
`src/features/envelope/components/dialogs/SegmentDetailDialog.tsx`  
*Read-only segment detail inspector (viewer / locked-version mode)*

- **dismiss:** header-close, footer-close, backdrop-click, esc-only
- **footer:** `Close` [secondary]
- **width / padding / overflow:** shared 560px — shared --space-24 — shared overflow:auto
- **bespoke CSS namespace:** `modal-form / metadata-grid (shared generic classes, not bespoke)`
- **issues:**
  - Hand-rolls its own footer instead of DialogActions: a bare <div className="modal-actions"><button className="secondary-button">Close</button></div> with no primary-button counterpart — since there's nothing to submit this is defensible, but it means the footer row is asymmetric (single left-aligned-by-flex button) compared to every other modal in this set, and it duplicates DialogActions' row markup by hand rather than reusing a no-submit variant.
  - No error/busy state plumbing at all (reasonable for a pure read-only view, but worth flagging since every sibling dialog carries busy/error props through DialogActions).

### RoomModal (wraps shared RowEditModal from data-table) — `partial`
`src/features/equipment/components/RoomModal.tsx`  
*Add/Edit Room*

- **dismiss:** header-close, footer-cancel (via RowEditModal), backdrop-click (via ModalDialog onClose)
- **footer:** `Delete room (conditional, appears only when onDelete provided and not readOnly)` [danger] · `Cancel` [secondary] · `Save room (submitLabel prop; bare <button type=submit> with no explicit className)` [primary]
- **width / padding / overflow:** shared 560px (via ModalDialog/.modal-panel, through RowEditModal) — shared --space-24 (via .modal-panel) — shared overflow:auto (via .modal-panel)
- **bespoke CSS namespace:** `table-row-modal-* / room-notes-expander (bespoke form/grid classes layered inside the shared panel)`
- **issues:**
  - RoomModal doesn't render chrome directly — it composes the shared `RowEditModal` (src/shared/ui/data-table/row-edit.tsx), which is ModalDialog + a hand-rolled `.modal-actions` footer, NOT DialogActions. This is the same off-contract footer pattern used by every other RowEditModal-based file in this batch (VentilatorRowModal, IndoorEquipRowModal, IndoorUnitRowModal, OutdoorEquipRowModal, OutdoorUnitRowModal) — a systemic partial-tier pattern, not a one-off.
  - Submit button in RowEditModal has no explicit className, so it does not visually match `.primary-button` styling used elsewhere via DialogActions — it falls back to bare `<button type=submit>` browser/base styling.
  - Delete button is danger-button and placed leftmost before Cancel/Submit, a 3-button row layout DialogActions has no equivalent for.
  - Adds a `<details>` Notes expander with its own `room-notes-expander` class and a visually-hidden label pattern (`sr-only`) not used elsewhere in this batch.

### BlockedDeleteDialog — `partial`
`src/features/equipment/heat-pumps/components/CascadePreviewDialog.tsx`  
*Blocked delete notice (cascade references prevent deletion)*

- **dismiss:** header-close, footer OK button, backdrop-click
- **footer:** `OK` [other]
- **width / padding / overflow:** shared 560px (via ModalDialog/.modal-panel) — shared --space-24 (via .modal-panel) — shared overflow:auto (via .modal-panel)
- **bespoke CSS namespace:** `hp-cascade-list / hp-cascade-meta (list rendering only, not chrome)`
- **issues:**
  - Single-button footer ("OK") is completely unstyled — no `secondary-button`/`primary-button` class at all, unlike every other file in this batch which at minimum applies `secondary-button` to its lower-priority action.
  - Footer is a single button rather than the two-button `justify-content:space-between` row DialogActions expects, so `.modal-actions` here renders with only one child — visually distinct from every 2-button modal elsewhere in the batch.
  - Reuses the same `CascadeReferenceList` body content as the sibling `CascadePreviewDialog` export in this file, but that sibling is rogue-tier (Radix AlertDialog) while this one is partial-tier (ModalDialog) — two different chrome systems for closely related dialogs in one file.

### PhiusExportDialog — `partial`
`src/features/equipment/heat-pumps/components/PhiusExportDialog.tsx`  
*Export to Phius HP Estimator (CSV export with warnings)*

- **dismiss:** header-close, footer-cancel/close, backdrop-click
- **footer:** `Cancel (ready state) / Close (loading/error state)` [secondary] · `Continue with gaps / Download CSV (conditional on ready state + warnings)` [primary]
- **width / padding / overflow:** shared 560px (via ModalDialog/.modal-panel) — shared --space-24 (via .modal-panel) — shared overflow:auto (via .modal-panel)
- **bespoke CSS namespace:** `hp-phius-warning-list (list content only, not chrome)`
- **issues:**
  - Hand-rolls its own `.modal-actions` footer directly (does not go through RowEditModal or DialogActions) — a third distinct hand-rolled-footer implementation pattern in this batch (RowEditModal's is shared/reused; this one is bespoke per-file).
  - Primary action button has no `primary-button` class, same unstyled-bare-button issue seen across the batch, and its label conditionally changes between three states ("Cancel"/"Close", "Continue with gaps"/"Download CSV") entirely via string logic embedded in JSX rather than any shared labeling convention.
  - Uses a bare `<p>Computing export…</p>` as the loading indicator with no shared spinner/skeleton component.

### NewProjectModal — `partial`
`src/features/projects/components/NewProjectModal.tsx`  
*Create new project form*

- **dismiss:** header-close, footer-cancel
- **footer:** `Cancel` [secondary] · `{createProjectMutation.isPending ? "Creating..." : "Create project"}` [primary]
- **width / padding / overflow:** shared 560px (via ModalDialog's .modal-panel) — shared --space-24 (via .modal-panel) — shared overflow:auto (via .modal-panel)
- **issues:**
  - Hand-rolled '.modal-actions' footer instead of DialogActions.
  - The primary submit button `<button type="submit" disabled={!canSubmit}>` has NO className at all — not `.primary-button`, nothing — so it falls back to bare browser button styling next to a properly-styled `.secondary-button` Cancel. This is a visible inconsistency versus every other modal in this set, which do give their destructive/primary action an explicit class.
  - Uses '.project-form' as its own body wrapper class (shared with ProjectSettingsModal via 'settings-form' combo, but distinct convention from the confirm-dialog modals).

### ProjectSettingsModal — `partial`
`src/features/projects/components/ProjectSettingsModal.tsx`  
*Project settings editor (metadata, location, MCP tokens)*

- **dismiss:** header-close, footer-cancel/close, inline discard-confirmation banner (Cancel/Discard text-buttons)
- **footer:** `{isViewer ? "Close" : "Cancel"}` [secondary] · `{isSaving ? "Saving..." : "Save"} (rendered only when !isViewer)` [primary]
- **width / padding / overflow:** shared 560px (via ModalDialog's .modal-panel) — but this is by far the tallest/densest modal content (metadata + location + MCP tokens sections) squeezed into the same 560px/760px-max-height shell as a two-field create form — shared --space-24 (via .modal-panel) — shared overflow:auto (via .modal-panel)
- **bespoke CSS namespace:** `settings- (settings-form, settings-section, settings-section-heading, settings-readonly-grid, settings-readonly-list, settings-discard-warning)`
- **issues:**
  - Same bare/unstyled submit-button bug as NewProjectModal: `<button type="submit" disabled={!canSave}>` has no className, so 'Save' renders unstyled next to a properly-classed '.secondary-button' Cancel/Close — the two most similar modals in the set (create vs. edit project) share this exact same footer-styling gap.
  - Adds a second, ad hoc confirmation affordance — an inline '.draft-banner settings-discard-warning' with its own Cancel/Discard pair styled as '.text-button' — layered above the standard modal-actions footer. This is a bespoke nested-confirmation pattern not used by any other modal in the set and not modeled by ModalDialog/DialogActions at all.
  - By far the most content-heavy modal (3 sections: Metadata, Location, MCP tokens) but still uses the same fixed max-height/560px shell as trivial modals — heavy internal scrolling likely, unlike the lightweight siblings.
  - Hand-rolled footer instead of DialogActions, consistent with the rest of this set.

### ConstructionDetailModal — `partial`
`src/features/model_viewer/components/ConstructionDetailModal.tsx`  
*Read-only HBJSON construction/assembly detail viewer*

- **dismiss:** header-close (custom icon-button, not the shared header Close text-button)
- **footer:** _none_
- **width / padding / overflow:** shared 560px (via ModalDialog's .modal-panel) — likely cramped for the side-by-side stack-drawing + layer table body content — shared --space-24 (via .modal-panel) — shared overflow:auto (via .modal-panel)
- **bespoke CSS namespace:** `construction-detail- (construction-detail-stats, construction-detail-stat, construction-detail-body, construction-detail-empty)`
- **issues:**
  - Explicitly disables the shared header Close text-button (showHeaderClose={false}) and replaces it with a custom `.icon-button` X (lucide-react) passed via headerAccessory — the only modal in this set that overrides the standard header dismiss affordance with a different visual (icon vs. text 'Close').
  - Has no footer / no modal-actions row at all — no DialogActions, no Cancel button, nothing; the only way to close is the custom header icon button. Intentional for a read-only viewer, but means this modal has zero footer consistency with any other modal in the set.
  - Fixed 560px/760px-max ModalDialog shell is a poor fit for what's described as a to-scale section drawing + expandable data table side-by-side ('.construction-detail-body') — likely to feel cramped or force internal scroll/wrap compared to modals with simple form content.

### DeleteDimensionDialog — `rogue`
`src/features/apertures/components/DeleteDimensionDialog.tsx`  
*Delete row/column confirmation (customized elements)*

- **dismiss:** footer-cancel, backdrop-click (Radix AlertDialog onOpenChange)
- **footer:** `Cancel` [secondary] · `{confirmLabel} ("Delete")` [danger]
- **width / padding / overflow:** unspecified in this file — inherited from shared ConfirmDestructiveDialog's .data-table-alert-content CSS (not ModalDialog's 560px) — custom — via .data-table-alert-content (not .modal-panel's --space-24) — none (can overflow) — no overflow:auto observed on .data-table-alert-content in this component
- **bespoke CSS namespace:** `data-table-alert- (from the shared ConfirmDestructiveDialog it wraps, not from this file itself)`
- **issues:**
  - This file is a thin wrapper with no chrome of its own — it delegates entirely to shared/ui/data-table/components/ConfirmDestructiveDialog.tsx, which is built on @radix-ui/react-alert-dialog (AlertDialog.Root/Portal/Overlay/Content), not ModalDialog/DialogActions.
  - Per the strict rubric (uses neither ModalDialog nor DialogActions = rogue) this scores rogue, but it is a second, consistently-reused shared pattern (ConfirmDestructiveDialog) rather than a bespoke one-off — it reuses .secondary-button for Cancel like DialogActions does, but uses .danger-button (not .primary-button) for the destructive action, and has no header 'Close' affordance at all (title/description only, no close X).
  - No header close button and no visible backdrop-click-to-dismiss in this specific component beyond Radix's built-in Escape/overlay handling — dismiss affordances are narrower than the ModalDialog gold pattern.


## LOW severity

### ConfirmActionModal — `gold`
`src/features/admin/components/ConfirmActionModal.tsx`  
*Generic sensitive-action confirmation (deactivate/reactivate/grant/revoke)*

- **dismiss:** header-close, footer-cancel
- **footer:** `Cancel` [secondary] · `{confirmLabel} ("Working…" when busy)` [primary]
- **width / padding / overflow:** shared 560px (via ModalDialog .modal-panel) — shared --space-24 — shared overflow:auto
- **issues:**
  - Fully conforms to the gold pattern — only wraps body content in .modal-body admin-form, no custom chrome.

### EditUserFieldModal — `gold`
`src/features/admin/components/EditUserFieldModal.tsx`  
*Edit a single user field (name or email)*

- **dismiss:** header-close, footer-cancel
- **footer:** `Cancel` [secondary] · `OK ("Saving..." when pending)` [primary]
- **width / padding / overflow:** shared 560px (via ModalDialog .modal-panel) — shared --space-24 — shared overflow:auto
- **issues:**
  - Form-based submit (native <form onSubmit>, DialogActions renders type="submit" primary button since no onConfirm prop is passed) — correct usage of the shared contract, but note the submit label "OK" is generic/less descriptive than other modals' action-specific verbs (e.g. "Create invite"); minor copy inconsistency, not a structural one.

### InviteUserModal — `gold`
`src/features/admin/components/InviteUserModal.tsx`  
*Invite a new user (email, display name, role)*

- **dismiss:** header-close, footer-cancel
- **footer:** `Cancel` [secondary] · `Create invite ("Inviting…" when pending)` [primary]
- **width / padding / overflow:** shared 560px (via ModalDialog .modal-panel) — shared --space-24 — shared overflow:auto
- **issues:**
  - Fully conforms to the gold pattern; three-field form (email, display name, role select) inside .modal-body admin-form with no bespoke layout.

### DeleteApertureDialog — `gold`
`src/features/apertures/components/DeleteApertureDialog.tsx`  
*Delete aperture type? confirmation*

- **dismiss:** header-close, footer-cancel
- **footer:** `Cancel` [secondary] · `Delete` [primary]
- **width / padding / overflow:** shared 560px (via ModalDialog .modal-panel) — shared --space-24 (via .modal-panel) — shared overflow:auto (via .modal-panel)
- **issues:**
  - Fully conforms to the shared ModalDialog + DialogActions contract; no deviations observed.

### AssemblyNameDialog — `gold`
`src/features/envelope/components/dialogs/AssemblyNameDialog.tsx`  
*Create/rename assembly (name + type picker)*

- **dismiss:** header-close, backdrop-click, esc-only
- **footer:** `Cancel` [secondary] · `Create assembly / Apply (dynamic on hideName||hideType)` [primary]
- **width / padding / overflow:** shared 560px — shared --space-24 — shared overflow:auto
- **bespoke CSS namespace:** `envelope-assembly-dialog / envelope-assembly-type-*`
- **issues:**
  - Fully canonical: default ModalDialog header-close plus DialogActions footer, no custom chrome.

### ConfirmDialog — `gold`
`src/features/envelope/components/dialogs/ConfirmDialog.tsx`  
*Generic confirm/cancel prompt*

- **dismiss:** header-close, backdrop-click, esc-only
- **footer:** `Cancel` [secondary] · `Confirm` [primary]
- **width / padding / overflow:** shared 560px — shared --space-24 — shared overflow:auto
- **issues:**
  - Smallest/most canonical modal in the set; wraps body in generic .modal-form div, nothing bespoke.

### ImportConstructionsDialog — `gold`
`src/features/envelope/components/dialogs/ImportConstructionsDialog.tsx`  
*Import constructions from HBJSON — preview/resolve plan*

- **dismiss:** header-close, backdrop-click, esc-only
- **footer:** `Cancel` [secondary] · `"Nothing to import" (disabled) or "Import N construction(s)" (dynamic)` [primary]
- **width / padding / overflow:** shared 560px — shared --space-24 — shared overflow:auto (body content is two long <ul> lists of rows plus chips, all inside the single scrolling .modal-panel — no independent scroll region for the lists)
- **bespoke CSS namespace:** `envelope-import__* (chips, rows, warnings, section, list, count, material-override)`
- **issues:**
  - By far the densest content of the set (chips row + warnings list + two itemized sections with per-row <select> and checkbox controls) but still relies on the single shared .modal-panel scroll container rather than a scoped inner scroll area — on a long import this makes the whole panel (including header/footer) scroll together, which is consistent with the shared contract but can feel heavy compared to the other, much shorter modals in this area.
  - Uses 'chip chip--sm chip--outline' components inline in rows — worth checking these chip primitives are the same ones used elsewhere (e.g. report-status-chip pattern) rather than a bespoke duplicate.

### LengthDialog — `gold`
`src/features/envelope/components/dialogs/LengthDialog.tsx`  
*Edit a single length/thickness value (with unit toggle)*

- **dismiss:** backdrop-click, esc-only, footer-cancel
- **footer:** `Cancel` [secondary] · `Apply` [primary]
- **width / padding / overflow:** shared 560px — shared --space-24 — shared overflow:auto
- **bespoke CSS namespace:** `layer-thickness-form / length-dialog-input-row`
- **issues:**
  - Sets showHeaderClose={false} and instead puts a ModalUnitToggle in headerAccessory — so the header's top-right slot holds a unit-system toggle, not the usual 'Close' text-button. This is an intentional, supported ModalDialog prop, but it means this modal's dismiss affordances differ from the gold-standard default (only Cancel/backdrop/Esc, no header close), and a user scanning by muscle memory for header-close won't find it here.
  - Same header-close-suppression + unit-toggle pattern is repeated in SegmentDialog.tsx — worth confirming this is a deliberate, documented convention for 'value editing' dialogs rather than incidental drift.

### PhppExportWarningDialog — `gold`
`src/features/envelope/components/PhppExportWarningDialog.tsx`  
*PHPP export preflight warning (blocked assemblies)*

- **dismiss:** header-close, backdrop-click, esc-only
- **footer:** `Cancel` [secondary] · `Download anyway` [primary]
- **width / padding / overflow:** shared 560px — shared --space-24 — shared overflow:auto
- **bespoke CSS namespace:** `phpp-export-warning-list`
- **issues:**
  - Clean canonical usage; only bespoke bit is a plain <ul class="phpp-export-warning-list"> of blocked-assembly names, no structural deviation.

### UserAuditModal — `partial`
`src/features/admin/components/UserAuditModal.tsx`  
*Recent account-activity audit log viewer for a user*

- **dismiss:** header-close
- **footer:** _none_
- **width / padding / overflow:** shared 560px (via ModalDialog .modal-panel) — shared --space-24 — shared overflow:auto
- **bespoke CSS namespace:** `admin-audit-`
- **issues:**
  - Read-only viewer with no footer/action row at all — no DialogActions, no Cancel/Close/Done button in the .modal-actions row, so the only dismissal affordance is the header's top-right Close text-button.
  - This is a defensible read-only-viewer pattern (nothing to confirm/cancel), but it diverges from the other four files in this set, none of which omit a footer entirely; worth confirming intentional vs. an omitted "Close" footer button for consistency with the rest of the admin modal family.
  - Reuses the shared `.form-error` class correctly for the audit-load error state, which is good — the only inconsistency is the missing footer, not the error styling.

### ImportDialog (frame-types) — `partial`
`src/features/catalogs/frame-types/import_export/ImportDialog.tsx`  
*Import frame-types JSON — multi-stage (pick file / analyzing / preview report / committing / done) modal*

- **dismiss:** header-close, footer-cancel (pick stage), footer-close (done stage)
- **footer:** `Cancel (pick stage)` [secondary] · `Cancel (report stage)` [secondary] · `Import {n} row(s) (report stage)` [primary] · `Close (done stage, sole button)` [primary]
- **width / padding / overflow:** shared 560px (via ModalDialog's .modal-panel) — shared --space-24 (via .modal-panel) — shared overflow:auto (via .modal-panel); adds its own internal scrollable <details>/<table> row-preview inside the panel
- **bespoke CSS namespace:** `import-dialog-`
- **issues:**
  - Hand-rolls footer via raw <div className="modal-actions"> at three different call sites (pick / report / done) instead of using DialogActions once — correct classNames are used (secondary-button/primary-button) so it visually matches, but the button set/labels change per stage without a single shared contract, and the 'pick' stage's Cancel-only footer is asymmetric (no primary action) versus the 2-button gold pattern.
  - The 'done' stage footer has only a single primary-button 'Close' with no secondary/cancel counterpart, an inconsistent shape versus DialogActions' fixed Cancel+Submit layout used elsewhere in the app.
  - Error banner (<p className="form-error" role="alert">) is manually placed at the top of the modal body rather than via DialogActions' built-in error slot near the footer.

### ImportDialog (glazing-types) — `partial`
`src/features/catalogs/glazing-types/import_export/ImportDialog.tsx`  
*Import glazing-types JSON — multi-stage (pick file / analyzing / preview report / committing / done) modal*

- **dismiss:** header-close, footer-cancel (pick stage), footer-close (done stage)
- **footer:** `Cancel (pick stage)` [secondary] · `Cancel (report stage)` [secondary] · `Import {n} row(s) (report stage)` [primary] · `Close (done stage, sole button)` [primary]
- **width / padding / overflow:** shared 560px (via ModalDialog's .modal-panel) — shared --space-24 (via .modal-panel) — shared overflow:auto (via .modal-panel); adds its own internal scrollable <details>/<table> row-preview inside the panel
- **bespoke CSS namespace:** `import-dialog-`
- **issues:**
  - Byte-for-byte structural duplicate of the frame-types ImportDialog (only copy strings and one preview-table column header differ: 'Manufacturer' vs materials' 'Category') — three copies of the same hand-rolled modal exist instead of one shared component.
  - Hand-rolls footer via raw <div className="modal-actions"> at three call sites instead of DialogActions; classNames happen to match the shared button styles but the component contract is bypassed.
  - 'Done' stage footer is a single primary-button with no secondary counterpart, asymmetric versus the 2-button gold pattern; 'pick' stage footer is Cancel-only with no primary action visible until a file is chosen.

### ImportDialog (materials) — `partial`
`src/features/catalogs/materials/import_export/ImportDialog.tsx`  
*Import materials JSON — multi-stage (pick file / analyzing / preview report / committing / done) modal*

- **dismiss:** header-close, footer-cancel (pick stage), footer-close (done stage)
- **footer:** `Cancel (pick stage)` [secondary] · `Cancel (report stage)` [secondary] · `Import {n} row(s) (report stage)` [primary] · `Close (done stage, sole button)` [primary]
- **width / padding / overflow:** shared 560px (via ModalDialog's .modal-panel) — shared --space-24 (via .modal-panel) — shared overflow:auto (via .modal-panel); adds its own internal scrollable <details>/<table> row-preview inside the panel
- **bespoke CSS namespace:** `import-dialog-`
- **issues:**
  - Third byte-for-byte structural duplicate of the same ImportDialog pattern (frame-types/glazing-types/materials) — a prime consolidation target into one shared, parameterized component instead of three hand-maintained copies.
  - Hand-rolls footer via raw <div className="modal-actions"> instead of DialogActions at three call sites; classNames match shared styles by convention only, not by using the shared component.
  - 'Done' stage single primary-button footer and Cancel-only 'pick' stage footer are asymmetric versus the DialogActions Cancel+Submit contract used by gold-tier modals elsewhere.

### SetLocationModal — `partial`
`src/features/climate/components/SetLocationModal.tsx`  
*Set Project Location*

- **dismiss:** header-close, footer-cancel
- **footer:** `Cancel` [secondary] · `Save Location / Saving…` [primary]
- **width / padding / overflow:** shared 560px (via ModalDialog's .modal-panel) — shared --space-24 (via .modal-panel) — shared overflow:auto (via .modal-panel)
- **bespoke CSS namespace:** `set-location-`
- **issues:**
  - Hand-rolls its own `.modal-actions` footer (Cancel + Save Location) instead of using DialogActions, but is the only one of the four files whose primary button correctly uses `.primary-button` — closest to gold-tier styling despite not using the shared footer component.
  - Multiple inline `.form-error` blocks (loadError, geocodeError, validationError, actionError) are scattered through the body rather than funneled through DialogActions' single error slot — more error-surface variety than the other modals, which could read as visually inconsistent/cluttered within this one modal.
  - Contains a nested `<details>` disclosure ('Advanced — elevation, time zone, orientation') and an inline search/candidates sub-UI, both bespoke to this modal — not shared chrome, but noted as added structural complexity beyond the base ModalDialog contract.
  - Body content is wrapped in a `<form>` (`project-form set-location-modal`) rather than a plain div like the other three modals — a structural inconsistency in the content-wrapper pattern across this file set.

### DirectionsModal — `partial`
`src/features/documentation/components/DocumentationModals.tsx`  
*How to photograph - {section} directions modal*

- **dismiss:** header-close
- **footer:** _none_
- **width / padding / overflow:** shared 560px (via ModalDialog/.modal-panel) — shared --space-24 — shared overflow:auto
- **issues:**
  - Purely informational modal with no footer/action row at all — only the shared header 'Close' text-button dismisses it, so DialogActions is never invoked. Not a hand-rolled-footer violation, but worth flagging since every other modal in this area has some kind of footer.
  - Body content uses feature-specific classes (documentation-modal-body, documentation-direction-card, documentation-direction-placeholder) which is fine/expected, not bespoke chrome.

### SaveAsDialog — `partial`
`src/features/project_document/components/VersionControlsDialogs.tsx`  
*Save As (create version) dialog*

- **dismiss:** header-close, footer-cancel
- **footer:** `Cancel` [secondary] · `Create version` [other]
- **width / padding / overflow:** shared 560px (via ModalDialog) — shared --space-24 — shared overflow:auto
- **issues:**
  - Submit button 'Create version' has no primary-button className — relies on default button styling instead of the shared primary-button look DialogActions would give it.
  - Form body uses 'project-form' class (shared across the app) which is fine, but footer is still hand-rolled 'modal-actions' rather than <DialogActions submitLabel=... />.

### DiffDialog — `partial`
`src/features/project_document/components/VersionControlsDialogs.tsx`  
*Diff viewer dialog*

- **dismiss:** header-close
- **footer:** _none_
- **width / padding / overflow:** shared 560px (via ModalDialog) — shared --space-24 — shared overflow:auto (plus internal 'diff-panel'/'diff-table' content that could get long — no independent scroll region, relies on outer modal-panel scroll)
- **issues:**
  - No footer/action row at all (view-only dialog) — consistent with DirectionsModal's pattern of skipping DialogActions entirely when there's nothing to confirm, but means dismiss is header-close only.
  - Potentially long content (diff tables, changed-paths lists truncated at 12) relies entirely on the shared modal-panel max-height/overflow rather than any internal scroll container — fine given the shared contract, just noting no bespoke handling.

### StatusDeleteDialog — `partial`
`src/features/project_status/components/StatusDeleteDialog.tsx`  
*Delete status item confirmation*

- **dismiss:** header-close, footer-cancel
- **footer:** `Cancel` [secondary] · `Delete item / Deleting...` [danger]
- **width / padding / overflow:** shared 560px (via ModalDialog) — shared --space-24 — shared overflow:auto
- **issues:**
  - This is the cleanest of the audited modals: Cancel left / danger action right, form-error rendered inline before the actions row, matching DialogActions' contract almost exactly — but it's still hand-rolled markup rather than the actual <DialogActions> component, so any future shared-footer change (spacing, error placement) won't propagate here automatically.
  - Body wrapper class 'confirm-dialog-body' is yet another one-off name (vs. 'confirmation-panel' used elsewhere) for what is functionally the same pattern — naming drift across the codebase for identical structure.

### ConfirmDeleteRoomDialog — `partial`
`src/features/equipment/components/ConfirmDeleteRoomDialog.tsx`  
*Delete room confirmation*

- **dismiss:** header-close, footer-cancel, backdrop-click (via ModalDialog onClose)
- **footer:** `Cancel` [secondary] · `Delete room` [danger]
- **width / padding / overflow:** shared 560px (via ModalDialog/.modal-panel) — shared --space-24 (via .modal-panel) — shared overflow:auto (via .modal-panel)
- **issues:**
  - Hand-rolls its own `.modal-actions` footer div with inline buttons instead of using DialogActions; Cancel/Delete order matches the shared convention (Cancel left) but the danger button uses `danger-button` not `primary-button`, which DialogActions has no notion of, so this can't be a drop-in DialogActions usage without a variant prop.

### VentilatorRowModal (wraps shared RowEditModal) — `partial`
`src/features/equipment/components/VentilatorRowModal.tsx`  
*Add/Edit Ventilator (ERV)*

- **dismiss:** header-close, footer-cancel/close (via RowEditModal; cancelLabel becomes "Close" when readOnly), backdrop-click
- **footer:** `Cancel / Close (readOnly)` [secondary] · `Save ventilator (submit button hidden entirely when readOnly)` [primary]
- **width / padding / overflow:** shared 560px (via ModalDialog through RowEditModal) — shared --space-24 (via .modal-panel) — shared overflow:auto (via .modal-panel)
- **bespoke CSS namespace:** `table-row-modal-* (RowEditSection/RowEditGrid shared subcomponents, not bespoke to this file)`
- **issues:**
  - Same RowEditModal partial-tier footer pattern as RoomModal — hand-rolled `.modal-actions`, unstyled submit button.
  - Bare `<label>Notes<textarea/></label>` at the bottom instead of using the shared `TextAreaField` helper that other files in this batch (IndoorEquipRowModal, OutdoorEquipRowModal, OutdoorUnitRowModal) do use for their Notes field — inconsistent within the same batch.

### IndoorEquipRowModal (wraps shared RowEditModal) — `partial`
`src/features/equipment/heat-pumps/components/IndoorEquipRowModal.tsx`  
*Add/Edit Indoor Equipment (heat pump)*

- **dismiss:** header-close, footer-cancel, backdrop-click
- **footer:** `Delete indoor equipment (conditional)` [danger] · `Cancel` [secondary] · `Create indoor equipment / Save indoor equipment (mode-dependent submitLabel)` [primary]
- **width / padding / overflow:** shared 560px (via ModalDialog through RowEditModal) — shared --space-24 (via .modal-panel) — shared overflow:auto (via .modal-panel)
- **bespoke CSS namespace:** `table-row-modal-* (shared RowEditSection/RowEditGrid, not bespoke)`
- **issues:**
  - Same systemic RowEditModal partial-tier footer as RoomModal/VentilatorRowModal — hand-rolled `.modal-actions`, unstyled submit button, danger-button leftmost.
  - Long form (Identity + Performance sections, 8+ numeric fields) with no visible internal scroll handling beyond the shared `.modal-panel` overflow:auto — fine, but worth noting this is one of the taller bodies in the batch relying entirely on the shared max-height/overflow contract.

### IndoorUnitRowModal (wraps shared RowEditModal) — `partial`
`src/features/equipment/heat-pumps/components/IndoorUnitRowModal.tsx`  
*Add/Edit Indoor Unit (heat pump)*

- **dismiss:** header-close, footer-cancel, backdrop-click
- **footer:** `Delete indoor unit (conditional)` [danger] · `Cancel` [secondary] · `Create indoor unit / Save indoor unit (mode-dependent)` [primary]
- **width / padding / overflow:** shared 560px (via ModalDialog through RowEditModal) — shared --space-24 (via .modal-panel) — shared overflow:auto (via .modal-panel)
- **bespoke CSS namespace:** `table-row-modal-grid__wide / hp-inline-action / hp-helper-text (bespoke layout/helper classes inside the shared form)`
- **issues:**
  - Same systemic RowEditModal partial-tier footer pattern.
  - Adds an extra in-body action button ("Create new indoor equipment", secondary-button + `hp-inline-action`) inline within the form grid, outside the standard footer — a third interactive affordance not present in most other modals in this batch, increasing visual clutter versus the plainer forms.
  - Two conditional `<small className="hp-helper-text">` hint lines appear inline in the grid when no outdoor units / no ventilators exist yet — a bespoke helper-text pattern not used by sibling modals.

### OutdoorEquipRowModal (wraps shared RowEditModal) — `partial`
`src/features/equipment/heat-pumps/components/OutdoorEquipRowModal.tsx`  
*Add/Edit Outdoor Equipment (heat pump)*

- **dismiss:** header-close, footer-cancel, backdrop-click
- **footer:** `Delete outdoor equipment (conditional)` [danger] · `Cancel` [secondary] · `Save outdoor equipment` [primary]
- **width / padding / overflow:** shared 560px (via ModalDialog through RowEditModal) — shared --space-24 (via .modal-panel) — shared overflow:auto (via .modal-panel)
- **bespoke CSS namespace:** `table-row-modal-* (shared subcomponents only)`
- **issues:**
  - Same systemic RowEditModal partial-tier footer pattern.
  - Largest body in the batch: 3 RowEditSections (Identity, Heating performance, Cooling performance) with ~15 fields total, all relying on the shared `.modal-panel` max-height (min(760px, 100vh-40px)) + overflow:auto — likely to scroll on smaller viewports; worth flagging as the tallest content of the batch even though the mechanism itself is shared/consistent.

### OutdoorUnitRowModal (wraps shared RowEditModal) — `partial`
`src/features/equipment/heat-pumps/components/OutdoorUnitRowModal.tsx`  
*Add/Edit Outdoor Unit (heat pump)*

- **dismiss:** header-close, footer-cancel, backdrop-click
- **footer:** `Delete outdoor unit (conditional)` [danger] · `Cancel` [secondary] · `Create outdoor unit / Save outdoor unit (mode-dependent)` [primary]
- **width / padding / overflow:** shared 560px (via ModalDialog through RowEditModal) — shared --space-24 (via .modal-panel) — shared overflow:auto (via .modal-panel)
- **bespoke CSS namespace:** `table-row-modal-grid__wide / hp-inline-action (shared layout helper classes)`
- **issues:**
  - Same systemic RowEditModal partial-tier footer pattern.
  - Same in-body extra action button pattern as IndoorUnitRowModal ("Create new outdoor equipment", secondary-button + hp-inline-action) placed inline in the grid rather than in the footer.

### DeleteProjectsModal — `partial`
`src/features/projects/components/DeleteProjectsModal.tsx`  
*Delete project(s) confirmation*

- **dismiss:** header-close, footer-cancel
- **footer:** `Cancel` [secondary] · `{isPending ? "Deleting..." : actionLabel} ("Delete project" or "Delete projects")` [danger]
- **width / padding / overflow:** shared 560px (via ModalDialog's .modal-panel) — shared --space-24 (via .modal-panel) — shared overflow:auto (via .modal-panel)
- **issues:**
  - Hand-rolls its own .modal-actions footer instead of using the shared DialogActions component (Cancel/Confirm order and spacing happen to match by convention, not by shared code).
  - .danger-button is a legitimate shared class from base.css (not invented), but DialogActions itself only knows primary/secondary — a destructive-confirm variant of the shared footer doesn't exist, so this pattern is duplicated ad hoc across every delete modal.
  - Wraps content in an extra '.confirmation-panel project-delete-confirmation' div not used by sibling delete dialogs (DeleteFileDialog uses '.confirm-dialog-body' instead) — two different wrapper-class conventions for the same 'confirm delete' shape.

### DeleteFileDialog — `partial`
`src/features/model_viewer/components/DeleteFileDialog.tsx`  
*Delete HBJSON file confirmation*

- **dismiss:** header-close, footer-cancel
- **footer:** `Cancel` [secondary] · `{isDeleting ? "Deleting..." : "Delete"}` [danger]
- **width / padding / overflow:** shared 560px (via ModalDialog's .modal-panel) — shared --space-24 (via .modal-panel) — shared overflow:auto (via .modal-panel)
- **issues:**
  - Hand-rolled '.modal-actions' footer (Cancel secondary-button / Delete danger-button) instead of DialogActions — functionally near-identical to DeleteProjectsModal's footer but implemented independently rather than through the shared component, so any future change to delete-confirmation styling has to be made in both places.
  - Uses its own '.confirm-dialog-body' wrapper class where DeleteProjectsModal uses '.confirmation-panel project-delete-confirmation' for the same 'confirm delete' shape — two divergent wrapper-class names for what is otherwise the same modal pattern.
  - Plain-text error (`{error}` as a string prop) rather than routing through the shared errorMessage() helper used by every other modal in this set — minor but means error formatting isn't guaranteed consistent.
