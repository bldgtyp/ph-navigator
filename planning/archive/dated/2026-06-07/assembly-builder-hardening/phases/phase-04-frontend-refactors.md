---
DATE: 2026-06-07
TIME: 17:15 EDT
STATUS: Partial (2026-06-07) — Shipped: `usePaintMode` and
        `useEnvelopeDialogs` hook extractions. EnvelopePage.tsx dropped
        from 525 to 403 lines; @size-exception annotation rewritten to
        cite this phase. Deferred to a follow-up: material-form dedupe
        (`useFrozenUnitOptions`, `parseMaterialNumbers`),
        LayerThicknessEditor → useLengthDraft migration, and
        `AssemblyCanvasToolbarActions` bundle.
AUTHOR: Ed May (with Claude)
SCOPE: Targeted frontend refactors identified by the 2026-06-07 review.
       All preserve user-facing behavior; all run after Phases 1 and 3
       so the regression net is in place before the changes land.
RELATED:
  - planning/code-reviews/2026-06-07/assembly-builder-review.md §2.2, §3.1, §3.3
  - frontend/src/features/envelope/routes/EnvelopePage.tsx
  - frontend/src/features/envelope/components/AssemblyCanvasOverlay.tsx
  - frontend/src/features/envelope/components/AssemblyCanvas.tsx
  - frontend/src/features/envelope/components/AssemblyWorkspace.tsx
  - frontend/src/features/envelope/components/ProjectMaterialEditor.tsx
  - frontend/src/features/envelope/components/MaterialDrift.tsx
  - frontend/src/features/envelope/hooks/useLengthDraft.ts
---

# Phase 4 — Frontend Refactors

## P0. Why this slice

Five focused refactors, all judged worth doing **before more state lands
on the affected files**. Each is internal-only — no user-facing behavior
changes. They run after Phase 1 (effect fix) and Phase 3 (test net) so
each refactor lands under regression coverage.

The five:

1. **Extract `usePaintMode` from `EnvelopePage.tsx`**. The paint-mode
   state machine (~80 lines: four state variables, an in-flight ref,
   six functions, two effects, and the `paintController` builder) has
   zero coupling to dialogs, routing, or zoom. It is the largest
   extractable block in the file and the primary driver of the current
   `@size-exception` annotation reading as weaker than its citation.
2. **Extract `useEnvelopeDialogs` from `EnvelopePage.tsx`**. `dialog`,
   `catalogPickerOpen`, `refreshMaterialId`, and `commandError` are
   reset together in every close handler. Bundling them into a single
   hook makes the pairing explicit and removes three state
   declarations from the page.
3. **Dedupe material-form internals**. `ProjectMaterialEditor` and
   `MaterialDriftDialog` share the same `editorUnitSystem` frozen-on-
   mount pattern and the same `parseOptionalUnitNumber` calls for the
   same three fields. Extract `useFrozenUnitOptions()` and a
   `parseMaterialNumbers()` helper. High value as more material edit
   surfaces appear.
4. **Migrate `LayerThicknessEditor` to `useLengthDraft`**.
   `AssemblyCanvasOverlay.tsx:140-252` reimplements draft/error/
   committedRef state that `useLengthDraft` was built to solve. ~40
   lines of duplicated logic; eliminates the silent divergent-
   validation-path risk.
5. **Bundle `AssemblyCanvasToolbarActions`**. `AssemblyCanvas` carries
   14 props; five (zoom in/out, three flips) are toolbar-only and pass
   straight through to the internal `AssemblyCanvasToolbar`. Bundle
   them into a typed `AssemblyCanvasToolbarActions` mirroring the
   existing `AssemblyCanvasOverlayActions` pattern. Reduces fan-out
   into `AssemblyWorkspace` as well.

## P1. Acceptance — Phase 4 done when

- [ ] `usePaintMode` hook exists in
      `frontend/src/features/envelope/hooks/usePaintMode.ts` and is
      consumed by `EnvelopePage.tsx`. The page no longer declares
      `paintMode`, `pickedAssignment`, `lastPaint`, `pastePulseKey`,
      `paintCommandInFlightRef`, or the paint-related functions
      directly.
- [ ] `useEnvelopeDialogs` hook exists and is consumed by
      `EnvelopePage.tsx`. The page no longer declares `dialog`,
      `catalogPickerOpen`, `refreshMaterialId`, or `commandError`
      directly.
- [ ] `EnvelopePage.tsx` lands at ≤ 425 lines.
- [ ] The existing `// @size-exception:` annotation on
      `EnvelopePage.tsx` is rewritten to reflect the new state, or
      removed if the file is at or below the project's size guideline.
- [ ] `useFrozenUnitOptions` hook and `parseMaterialNumbers` helper
      exist (in `frontend/src/features/envelope/hooks/` and either
      `lib.ts` or a new `material-form.ts`, follow existing structure)
      and are consumed by both `ProjectMaterialEditor` and
      `MaterialDriftDialog`. No duplicated unit-freeze or parse logic
      remains between the two files.
- [ ] `LayerThicknessEditor` uses `useLengthDraft`. The local `draft`,
      `error`, and `committedRef` state are gone.
- [ ] `AssemblyCanvasToolbarActions` type exists in `canvas-paint.ts`
      (or wherever `AssemblyCanvasOverlayActions` lives — same module).
      `AssemblyCanvas`, `AssemblyWorkspace`, and the toolbar consume
      it.
- [ ] **All existing frontend tests pass with zero modifications to
      their assertions.** Test setup wiring may be updated (e.g.,
      passing a `paintController` constructed by the hook into
      AssemblyCanvas), but the user-facing assertions stay
      bit-for-bit identical.
- [ ] No new `eslint-disable` or `@ts-ignore` comments introduced.
- [ ] `make ci` is green.

## P2. Implementation steps

Land each refactor as a separate commit (or PR slice) in this order.
Each step is independent of the next so a failure in step 3 does not
block steps 1, 2, 4, 5.

### P2.1 Extract `usePaintMode`

File: new `frontend/src/features/envelope/hooks/usePaintMode.ts`.

Signature (sketch — refine as you read the existing code):

```ts
function usePaintMode(args: {
  canEdit: boolean;
  activeAssembly: Assembly | null;
  applyCommand: (command: EnvelopeCommand) => Promise<boolean>;
  commandPending: boolean;
}): AssemblyCanvasPaintController;
```

Move into the hook:

- `paintMode`, `pickedAssignment`, `lastPaint`, `pastePulseKey` state.
- `paintCommandInFlightRef`.
- `clearCanvasPaintMode`, `startPicking`, `startPasting`,
  `pickSegment`, `paintSegment`, `undoLastPaint` functions.
- The Escape-key effect (`EnvelopePage.tsx:156-165`).
- The pulse-timeout effect (`EnvelopePage.tsx:167-171`).
- The `clearCanvasPaintMode` effect when `activeAssembly?.id` changes
  (`EnvelopePage.tsx:151-154`).
- The `clearCanvasPaintMode` effect when `canEdit` flips
  (`EnvelopePage.tsx:147-149`).
- The `paintController` builder.

`EnvelopePage` then becomes:

```ts
const paintController = usePaintMode({
  canEdit,
  activeAssembly,
  applyCommand,
  commandPending: commandMutation.isPending,
});
```

While you are there, **add the missing WHY comment on
`paintCommandInFlightRef`** explaining that it coexists with the outer
`commandInFlightRef` because `applyCommand` itself can be called from
non-paint paths, and the two guards are scoped to different command
sources. The review specifically flagged this as opaque; a one-line
hook-level comment closes it.

### P2.2 Extract `useEnvelopeDialogs`

File: new `frontend/src/features/envelope/hooks/useEnvelopeDialogs.ts`.

Signature (sketch):

```ts
function useEnvelopeDialogs(): {
  dialog: EnvelopeEditorDialogState | null;
  setDialog: (next: EnvelopeEditorDialogState | null) => void;
  catalogPickerOpen: boolean;
  setCatalogPickerOpen: (open: boolean) => void;
  refreshMaterialId: string | null;
  setRefreshMaterialId: (id: string | null) => void;
  commandError: string | null;
  setCommandError: (msg: string | null) => void;
  closeDialog: () => void;       // resets dialog + picker + error
  closeRefresh: () => void;      // resets refresh id + error
};
```

The `closeDialog` and `closeRefresh` helpers replace the repeated
inline close handlers in `EnvelopePage.tsx` (lines 502-507 and 517-521).

Include the catalog-picker sync effect inside the hook (the fix from
Phase 1, so deps are `[dialog]` only).

### P2.3 Dedupe material-form internals

Files:

- `frontend/src/features/envelope/components/ProjectMaterialEditor.tsx`
- `frontend/src/features/envelope/components/MaterialDrift.tsx`

Extract:

- `useFrozenUnitOptions()` — captures the on-mount unit system and
  returns the matching unit-options object. New hook in
  `frontend/src/features/envelope/hooks/useFrozenUnitOptions.ts`.
- `parseMaterialNumbers(form, unitOptions)` — returns
  `{ conductivity_w_mk, density_kg_m3, specific_heat_j_kg_k }` (or
  whatever the existing parse helpers return), with consistent error
  handling for all three fields. Place in `lib.ts` (or `material-form.ts`
  if `lib.ts` is already saturated; current `lib.ts` is small enough
  that adding here is appropriate).

Consume in both components. The diff against the previous editor
implementations should be a near-trivial substitution — if it isn't,
stop and revisit the helper's signature.

While you are in `ProjectMaterialEditor`, wrap `initialForm` in
`useMemo` keyed to `[material, unitOptions]` (review §3.4 finding).
Cosmetic perf cleanup but adjacent to the change.

### P2.4 Migrate `LayerThicknessEditor` to `useLengthDraft`

File: `frontend/src/features/envelope/components/AssemblyCanvasOverlay.tsx`,
lines 140-252.

Replace local `draft`, `error`, `committedRef` state with a call to
`useLengthDraft`. The hook's existing options (`followUnitPreference`,
`unitLabelStyle`) cover the editor's needs.

**Verify** that the editor's existing behavior is preserved:

- Enter commits, Escape cancels.
- Blur commits.
- Parse error displays inline.
- Unit-system mid-edit changes do not reformat the in-progress draft.

These behaviors are now covered by tests in Phase 3's
`EnvelopeCanvas.interaction.test.tsx`. If any test fails after the
migration, the hook's contract is wrong, not the editor's intent —
fix at the hook, not the editor.

Add the WHY comment from review §2.6 — the `committedRef`/blur-after-
Enter rationale survives into the hook as a docstring on
`useLengthDraft`, not on the editor.

### P2.5 Bundle `AssemblyCanvasToolbarActions`

File: `frontend/src/features/envelope/canvas-paint.ts` (or wherever
`AssemblyCanvasOverlayActions` is defined).

Add:

```ts
export type AssemblyCanvasToolbarActions = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFlipOrientation: () => void;
  onFlipLayers: () => void;
  onFlipSegments: () => void;
};
```

Update:

- `AssemblyCanvas` accepts `toolbarActions: AssemblyCanvasToolbarActions`
  instead of five separate props.
- The internal `AssemblyCanvasToolbar` consumes the bundle.
- `AssemblyWorkspace` constructs the bundle from its own props and
  passes it down.

`AssemblyCanvas`'s top-level prop count drops from 14 to ~10. The
`AssemblyWorkspace` prop signature also flattens.

While you are in `AssemblyWorkspace`, note (do not fix — out of scope)
whether the **layer/segment action callbacks** would benefit from a
similar bundle (`onAddLayer`, `onEditSegment`, `onAddSegment`,
`onDeleteLayer`, `onUpdateLayerThickness`). The existing
`AssemblyCanvasOverlayActions` already partially addresses this. If
your judgment is that bundling here would be a clear win, do it.
Otherwise leave for a later pass.

### P2.6 Address `@size-exception` annotation

After steps P2.1 and P2.2 land, `EnvelopePage.tsx` should be at or
around 420 lines. Either:

- Remove the `// @size-exception:` annotation if the file now meets
  the project's size guidance, or
- Rewrite the annotation to reflect the new state, citing this phase
  plan as the most recent review.

Do not leave the stale annotation in place.

## P3. Verification

- After each step, run the focused test for the affected area:
  - usePaintMode → `EnvelopeCanvas.interaction.test.tsx`
  - useEnvelopeDialogs → `EnvelopePage.routing.test.tsx`,
    `Specifications.test.tsx`
  - Material-form dedupe → `Specifications.test.tsx`
  - LayerThicknessEditor → `EnvelopeCanvas.interaction.test.tsx`
  - Toolbar bundle → `EnvelopePage.toolbar.test.tsx`
- After all steps: `make frontend-dev-check` for fast feedback, then
  `make ci` from the repo root.

## P4. Risks

- **Hook extraction subtly changes effect timing.** Effects that lived
  in `EnvelopePage` ran in the order they were declared. Inside a
  custom hook, effect order is preserved but the hook itself runs in
  the order it is called. If `usePaintMode` is called before
  `useEnvelopeDialogs` but the original effects ran the other way
  around, behavior could subtly shift. Audit: list every effect that
  reads from or writes to state owned by the **other** hook, and
  preserve their declared order in the page body.
- **`useLengthDraft` API gap.** If the editor needs an affordance the
  hook does not currently expose (e.g., explicit `commit()` from a
  parent), do not work around it in the editor. Extend the hook's
  surface in a small commit before the migration.
- **Material-form helper signature drift.** If `parseMaterialNumbers`
  ends up with a six-argument signature, the abstraction is wrong.
  Stop, simplify.

## P5. Out of scope

- The `EnvelopeEditorDialogs` kind→render lookup map (deferred per PRD
  §4).
- The `useAssemblyRouting` hook extraction (the third "HIGH" finding
  in the review). It is medium effort but lower payoff than the two
  hooks in this phase; revisit after the size annotation is reviewed.
- Any change to the `AssemblyCanvasOverlay` sub-components beyond the
  `LayerThicknessEditor` migration.
- CSS work.
