---
DATE: 2026-06-07
TIME: 17:05 EDT
STATUS: Partial (2026-06-07) — Added `flip_orientation` and `flip_layers`
        frontend command tests. Deferred to a follow-up hardening pass:
        refresh-from-catalog dialog flow, add-layer / add-segment dialog
        flows, hand-enter material modal, Airtightness + Site Photos
        sub-tab routing, catalog-picker submit assertion, and the 6-way
        EnvelopePage.test.tsx split.
AUTHOR: Ed May (with Claude)
SCOPE: Close the frontend test gaps identified in the 2026-06-07 review,
       and split EnvelopePage.test.tsx (1,149 lines) along its natural
       feature seams so future edits stay scoped.
RELATED:
  - planning/code-reviews/2026-06-07/assembly-builder-review.md §4.2, §4.3
  - frontend/src/features/envelope/__tests__/EnvelopePage.test.tsx
  - frontend/src/features/envelope/__tests__/phase16-fixtures.ts
  - context/user-stories/20-envelope.md US-ENV-1, US-ENV-8, US-ENV-9, US-ENV-11
  - context/UI_UX.md §2.7
---

# Phase 3 — Frontend Test Coverage + Test Split

## P0. Why this slice

`EnvelopePage.test.tsx` at 1,149 lines is hostile to incremental edits.
It is also missing tests for the single highest-leverage V2-vs-V1
behavior (refresh-from-catalog), the two non-segment sub-tabs, two of
three flip behaviors, and the Add Layer / Add Segment / Hand-Enter
Material dialog flows.

This phase does two things:

1. **Add missing test coverage** for the documented behaviors that
   currently rely on backend tests or are uncovered end-to-end.
2. **Split the test file** along six natural feature seams so future
   regression work doesn't touch a 1,200-line wall of tests.

Phase 3 runs after Phase 1 (so the catalog-picker effect fix is in
place before tests pin behavior around it) but is independent of
Phase 2 and can run in parallel.

## P1. Acceptance — Phase 3 done when

### Test coverage

- [ ] **Refresh-from-catalog dialog flow** (US-ENV-11): a test drives
      the drift badge → opens the refresh dialog → exercises each of
      the three actions (`take_catalog`, `use_value`, `keep_mine`) →
      asserts the correct command body is POSTed.
- [ ] **Airtightness sub-tab routing** test: navigating to the
      Airtightness sub-tab renders without redirect-loop; if the panel
      is a placeholder today, assert the placeholder render. If it is
      shipped UI, assert the basic landing chrome.
- [ ] **Site Photos sub-tab routing** test: same shape as Airtightness.
- [ ] **Flip orientation** test: covers the same seam as the existing
      `flip_segments` test.
- [ ] **Flip layers** test: same seam.
- [ ] **Add Layer dialog flow**: open dialog → submit → assert
      `add_layer` command body for both "above" and "below" affordances.
- [ ] **Add Segment dialog flow**: same for both "left" and "right"
      affordances of `add_segment`.
- [ ] **Hand-Enter Material modal**: open from the segment dialog →
      fill the required fields → submit → assert `hand_enter_material`
      command body including the default color (`#e6e6e6`) and default
      category ("Other") when the user does not change them.
- [ ] **Catalog material picker submit**: distinct from the gating test
      that already exists; this one asserts the `pick_catalog_material`
      command body when the user selects a material in the picker.
- [ ] **`LayerThicknessEditor` regression assertions** are present in
      the new canvas test file (or in the existing
      `useLengthDraft.test.tsx`) so Phase 4's migration to
      `useLengthDraft` is covered by a behavior net, not just a
      hook-internal net.

### Test split

- [ ] `EnvelopePage.test.tsx` is split into six files in
      `frontend/src/features/envelope/__tests__/`:
  - `EnvelopePage.routing.test.tsx` — bare-URL redirect, invalid id,
    empty state, locked viewer (~120 lines).
  - `EnvelopePage.toolbar.test.tsx` — flip segments / pick-mode
    interplay, unit toggle, sidebar collapse.
  - `EnvelopeCanvas.interaction.test.tsx` — paint, eyedropper, undo,
    dedup, delete confirms, layer thickness inline editor (~400
    lines).
  - `EnvelopeHeader.rename.test.tsx` — rename + dimension-label inline
    edits.
  - `Specifications.test.tsx` — use-site notes, evidence, NA hide,
    sort order, drift badges, refresh-from-catalog dialog (new).
  - `EnvelopeMaterialPicker.test.tsx` + `EnvelopeExport.test.tsx`
    (two small files; can be one combined file if either ends up
    under ~80 lines).
- [ ] No test is duplicated across files; shared setup is imported
      from `phase16-fixtures.ts` (which stays as-is unless a fixture
      needs to grow to support the new tests).
- [ ] No test relies on test-execution order across files.
- [ ] `make ci` is green.

## P2. Implementation steps

### P2.1 New tests first (before the split)

Add the new tests **into the existing `EnvelopePage.test.tsx`** in
clearly-marked `describe` blocks. This keeps the diff reviewable and
avoids interleaving "new behavior coverage" with "moved code" in the
same commit.

For each new test, follow the conventions already in the file:

- Fixture: extend `phase16-fixtures.ts` only if needed; prefer adding
  small inline fixtures for one-off scenarios.
- Mock: use the existing `fetch` boundary mock; do not introduce React
  mocks.
- Assertion style: assert the POST body for command tests; assert
  rendered DOM (via `@testing-library/react` selectors that match the
  existing style) for UI tests.

Recommended order:

1. **Refresh-from-catalog** — highest-value V2 differentiator, biggest
   gap.
2. **Flip orientation** + **flip layers** — easy ports of the existing
   `flip_segments` test.
3. **Add Layer** + **Add Segment** — exercise both directional
   affordances.
4. **Hand-Enter Material** — straightforward modal-form test.
5. **Catalog material picker submit**.
6. **Airtightness sub-tab** + **Site Photos sub-tab**.

### P2.2 Split into six files

Once the new tests are in and `make ci` is green, perform the split:

1. Create the six new test files listed in Acceptance.
2. Move `describe` blocks (with their setup) verbatim from
   `EnvelopePage.test.tsx`. Do not rewrite tests during the move.
3. Each new file imports the same shared helpers from
   `phase16-fixtures.ts` (or wherever the current file imports from).
4. Delete the old `EnvelopePage.test.tsx` only after all tests are
   passing in their new homes.
5. Verify by running each file individually first, then `make ci`.

### P2.3 Suggested split (concrete)

Use these `describe` block targets:

- **`EnvelopePage.routing.test.tsx`**:
  - "redirects bare envelope route to assemblies and selects an active
    assembly"
  - "redirects invalid assembly id to first sorted assembly"
  - "renders empty state when no assemblies exist, no redirect loop"
  - "locked viewer suppresses edit affordances"
- **`EnvelopePage.toolbar.test.tsx`**:
  - "unit toggle relabels dims without changing canvas geometry"
  - "sidebar collapse preserves active assembly and zoom"
  - "Flip Segments dispatches semantic command"
  - "Flip Orientation" (new)
  - "Flip Layers" (new)
  - "Flip ops disabled in pick mode"
  - "in-flight dedup prevents double-flip"
- **`EnvelopeCanvas.interaction.test.tsx`**:
  - "canvas renders single SVG, no clamps"
  - "active-material legend follows unit pref"
  - "eyedropper + paint bucket paste_assignment"
  - "rapid-click paint dedup"
  - "undo last paint"
  - "delete layer + delete segment confirm dialogs"
  - "layer thickness inline editor: Enter commits, Escape cancels,
    blur commits, parse error blocks, unit-switch mid-edit does not
    reformat"
  - "Add Layer above / below" (new)
  - "Add Segment left / right" (new)
- **`EnvelopeHeader.rename.test.tsx`**:
  - "inline header rename"
  - "dimension label edit (layer thickness, unit parsing)"
- **`Specifications.test.tsx`**:
  - "catalog drift badges (assemblies + specifications)"
  - "use-site notes, evidence, NA hide, sort order"
  - "Hand-Enter Material modal" (new — opens from segment dialog but
    its assertions live with specifications-style material tests; can
    move if better fit elsewhere)
  - "refresh-from-catalog dialog flow" (new)
- **`EnvelopeMaterialPicker.test.tsx`**:
  - "segment material picker (gating + project-material commands)"
  - "catalog material picker submit" (new)
- **`EnvelopeExport.test.tsx`**:
  - "HBJSON download dirty-draft warning + saved-version call"

If `EnvelopeMaterialPicker` and `EnvelopeExport` each end up under
~80 lines, combine into a single `EnvelopeMisc.test.tsx`. Resist
keeping a one-test file if the rationale is purely organizational.

### P2.4 Mocking and fetch boundary

Continue using the existing fetch-boundary mock pattern. The new
refresh-from-catalog test will need to:

1. Mock the initial envelope read with a project material that has
   `catalog_origin` set.
2. Mock the drift report response with a `drifted` row for that
   material.
3. Mock the `refresh_project_material_from_catalog` POST response.

If the existing mock setup helper does not already support per-test
overrides for the drift response, add the override capability rather
than duplicating mock setup.

## P3. Verification

- Per-file targeted runs:
  - `cd frontend && pnpm exec vitest run src/features/envelope/__tests__/EnvelopePage.test.tsx`
    (during the new-tests-first pass)
  - After split: each new file run individually first to confirm
    isolation.
- `cd frontend && pnpm run typecheck` to confirm no broken imports
  after the split.
- `make ci` from the repo root, green.

## P4. Risks

- **Hidden test ordering dependency**: tests in a single file
  sometimes share top-level setup state (modules, mocks). After the
  split, run each file in isolation first to surface any cross-test
  coupling. If discovered, fix at the file level, do not paper over
  with shared state.
- **`phase16-fixtures.ts` bloat**: the temptation to add 100 lines of
  fixture for one test is real. If a fixture is only used by one new
  test, keep it inline in that test file's `describe` block.
- **Test-driven UI rewrite**: writing the refresh-from-catalog test
  may surface that the dialog's current behavior is subtly broken. If
  so, fix the bug in a separate commit within the phase, not as part
  of the test commit.

## P5. Out of scope

- New product behavior.
- Refactoring production code (covered in Phase 4).
- Changing `phase16-fixtures.ts`'s overall shape (only extend if
  needed for new tests).
- Splitting `useLengthDraft.test.tsx` — it is small and focused; leave
  it.
- Adding E2E (Playwright) tests for any new behavior — those live in
  `frontend/tests/e2e/` and are outside this phase's scope.
