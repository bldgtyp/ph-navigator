---
DATE: 2026-07-01
TIME: -
STATUS: ✅ DONE (2026-07-02) — implemented on
  feature/model-viewer-construction-detail; see §7 As-built notes.
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff for Phase 4 — the "View Construction"
  button in the Opaque Surface inspector, modal open/close wiring, and
  full feature verification + closeout.
RELATED:
  - ../PRD.md §4.1 (entry point), §7 (acceptance), §8 (verification),
    §13-Q1 (orientation)
  - ../PLAN.md Phase 4
  - frontend/src/features/model_viewer/components/InspectorPanel.tsx
  - frontend/src/features/model_viewer/lib/fieldConfigs.ts
  - frontend/src/features/model_viewer/store.ts
---

# Phase 4 — Frontend: inspector button + wiring + verification

## 1. Goal

Ship the user-facing behavior: a **"View Construction"** button in the
Opaque Surface inspector's Construction section that opens the Phase 3
modal for the selected face's construction, resolved from the Phase 2
`constructions` map. Then verify the whole feature end-to-end and close
out. This is the phase that makes the feature real.

## 2. Required reading (in order)

1. `../PRD.md` §4.1 (button rules — `faceMesh` only, hidden when no layer
   detail), §7 (all 11 acceptance criteria), §8 (verification approach),
   §13-Q1 (confirm honeybee exterior→interior order before trusting the
   drawing's end labels).
2. `frontend/src/features/model_viewer/components/InspectorPanel.tsx` —
   the host: it takes `meta` (l.8-12), reads store actions via
   `useModelViewerStore` (l.13-14), renders header/actions/`FieldRows`
   (l.43-66). The button + modal state live here.
3. `frontend/src/features/model_viewer/lib/fieldConfigs.ts` —
   `constructionFields` (l.263-311) is shared by `faceMesh` AND
   `apertureMeshFace` (l.34-53); the button must be `faceMesh`-only
   (D-1), so gate it on `meta.type`, not on the shared config. The
   `construction()` accessor (l.344-346) gives the face's summary +
   `identifier`.
4. `frontend/src/features/model_viewer/store.ts` — how the built
   `BuildingModel` (now carrying `constructions`, Phase 2) is held and
   selected; add a selector/getter so the inspector can reach
   `model.constructions[identifier]`.

## 3. Work breakdown

### 3.1 Resolve the construction

- Expose the loaded model's `constructions` map through the store (a
  selector like `useModelViewerStore(s => s.model?.constructions)` or a
  dedicated `getConstruction(identifier)` getter — match the store's
  existing access style).
- For a `faceMesh` meta, the detail is
  `constructions[construction(meta)?.identifier]` (may be `undefined` for
  an older artifact or a skipped construction).

### 3.2 The button + modal state (`InspectorPanel.tsx`)

- Render a **"View Construction"** button in/under the Construction
  section, only when: `meta.type === "faceMesh"` **and** the resolved
  detailed construction exists with `materials.length > 0` (D-1, §4.1,
  §4.5). Never render it for `apertureMeshFace` (windows, D-1).
- Local `useState<DetailedOpaqueConstruction | null>` for the open modal;
  the button sets it, `onClose` clears it. When set, render
  `<ConstructionDetailModal construction={...} onClose={...} />`
  (Phase 3).
- Closing returns focus to the button and leaves the 3D `selectionId`
  untouched (do not call `clearSelection`). Escape is handled by
  `ModalDialog`.
- Placement/label are settled (PRD §4.1, Q3 = "View Construction");
  header-inline vs full-width row is a cosmetic choice — pick the one
  that matches the existing `model-inspector-actions` styling.

### 3.3 Confirm orientation (PRD §13-Q1)

Before trusting the "Exterior"/"Interior" end labels, confirm honeybee's
`materials[]` order is exterior-first for wall/roof/floor against a known
model (canonical fixture + one real upload). If it differs by face type,
fix the label direction in the Phase 3 drawing (not the data). Record the
finding in `../STATUS.md`.

## 4. Out of scope

Backend changes (Phase 1). Window constructions (D-1). Any Envelope
cross-reference (D-8). Drawing/table internals (Phase 3) beyond wiring.

## 5. Verification gate

1. **Playwright** (extend the model-viewer specs):
   - select a known **flat** opaque face → "View Construction" appears →
     modal opens with the expected layer count + totals;
   - select a known **framed** face → modal shows segment sub-cells + the
     steel-stud spacing;
   - select a **window** → **no** button (D-1);
   - Escape and Close dismiss the modal and the 3D selection is preserved
     (assert `selectionId` unchanged);
   - IP/SI toggle flips the modal's units.
2. **Acceptance walk**: tick every PRD §7 criterion (1-11) in
   `../STATUS.md`, including criterion 11 (new extractions carry the map;
   a construction lacking layer detail hides the button / shows the empty
   state — graceful degradation, no migration needed, D-9/§10.1).
3. **Closeout**: `$ simplify` on the diff; `$ docs-pass` on the diff;
   `make format`; `make ci` (backend + frontend green); browser
   walkthrough with screenshots of a flat and a detailed assembly saved
   to `assets/`; `graphify update .`. Fold any newly-settled decisions
   (orientation, cosmetic placement) back into the PRD in the same
   docs-pass.

## 6. Exit criteria

Clicking "View Construction" on an opaque face opens a correct, unit-aware
read-only assembly modal for both flat and detailed constructions;
windows have no button; the modal is fully isolated from Envelope/catalog
(D-8); constructions without layer detail degrade to no-button (D-9); all
gates green; screenshots captured; STATUS acceptance checklist complete.

## 7. As-built notes (2026-07-02)

Implemented as specified. Wiring choices and the one non-obvious lesson:

- **Data flow**: the `constructions` map is passed to `InspectorPanel` as
  a prop from the stage-owned `BuildingModel` (`model?.constructions`) —
  NOT via the zustand store, which holds UI state only. The private
  `detailedConstructionForMeta` helper owns all the button-visibility
  rules in one place: `faceMesh` only (D-1), map present, `materials.length
  > 0` (§4.5 degradation). It reuses the `construction()` accessor now
  exported from `lib/fieldConfigs.ts`.
- **Button**: full-width row pinned under the inspector sections (Q3
  cosmetic choice), `Layers` icon, focus returns to it on modal close via
  a ref.
- **Escape lesson (the gotcha)**: React flushes discrete-keydown state
  updates synchronously, so when `ModalDialog`'s document-level Escape
  handler closes the modal, the backdrop is ALREADY unmounted by the time
  the stage's window-level handler runs — a DOM-presence guard alone
  cannot stop the viewer's Escape-deselect. Fix is two documented halves:
  `ModalDialog` consumes its Escape (`stopPropagation`, benefits every
  modal), and the stage's keydown handler returns early while
  `.modal-backdrop` is mounted (covers the other viewer hotkeys —
  m/f/h/digits/⌘C — behind any modal). A deeper consolidation (capture-
  phase modality owned by ModalDialog) was considered and deferred: 16+
  modal consumers is too much blast radius for this feature's tail.
- **Steel-stud note un-gated**: a steel layer often carries a single
  homogenized cell (nothing to expand), so the "Steel studs @ … o.c."
  table note renders whenever spacing exists, not only when expanded —
  caught in the browser walkthrough, covered by a new RTL case.
- **Verification**: e2e spec `tests/e2e/model-viewer-construction-detail
  .spec.ts` (button on opaque face, modal content, Escape/Close preserve
  `selectionId`, IP units, no button on windows) + 12 RTL cases + all
  suites + `make ci` green. Screenshots in `../assets/`: `modal-flat.png`
  (all-fallback-hatch generic construction), `modal-framed.png` (hybrid
  cellulose/wood-stud cells), `modal-steel-stud.png` (spacing note +
  overlay hatch), `modal-flat-context.png` (modal over the viewer).
  Framed/steel visuals were captured from a synthetic honeybee-ph model
  generated by the backend test builder — no licensed HBJSON.
