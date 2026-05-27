---
DATE: 2026-05-27
TIME: 22:30 EDT
STATUS: Proposed. Foundation refactor before serious UI/UX work begins.
AUTHOR: Claude (Opus 4.7)
SCOPE: Bring the three largest envelope frontend files back under the
       project's component-size discipline, isolate the editor state
       primitives that the polish UI will build on, and stop reaching
       through the page component for cross-cutting workflows.
RELATED:
  - planning/code-reviews/2026-05-27/assembly-builder-foundation-review.md §H3, §H4, §M5
  - planning/features/assembly-builder/PRD.md §§6, 9
  - context/CODING_STANDARDS.md §Component Size And Splitting, §App And Routing Boundaries
---

# Phase 10 - Frontend Page And Dialog Decomposition

## Goal

Land the frontend half of the foundation cleanup. Today,
`EnvelopePage.tsx`, `EnvelopeEditorDialogs.tsx`, and
`SpecificationsPanel.tsx` are all past the documented soft limits, with
the dialogs file past the 500-line hard ceiling. Polish-phase changes
(layout, keyboard, drag-reorder candidates, drift overlay polish) will
all want to add to those files. Splitting them once now is cheaper than
splitting them under deadline.

Behavior does not change. Every dialog still opens from the same
trigger, every command still dispatches through
`useEnvelopeCommandMutation`, every attachment still mounts through the
generic asset backbone.

## Why Now

- `EnvelopeEditorDialogs.tsx` (665 lines) is past the 500-line hard
  ceiling. It holds 9 distinct dialog families plus a shared length-draft
  hook plus a `DialogActions` building block. A reader looking for one
  dialog has to scroll past eight others.
- `EnvelopePage.tsx` (509 lines) mixes route guarding, redirect logic,
  feature data wiring, local UI state, and the JSX tree. The standard
  asks page components to be "page layout + feature hooks + smaller
  components" only.
- `SpecificationsPanel.tsx` (389 lines) is past the 300-line review
  threshold and is the most likely surface to grow during UI polish
  (card layout, evidence reviewers, drift visuals).
- `useLengthDraft` is the key editor primitive — its design (sticky
  unit system per modal open, parse-on-submit, dirty error clearing)
  is something the polish UI will reuse for new editors. It belongs in
  its own file so polish-phase authors can find it.

## In Scope

- Split `EnvelopeEditorDialogs.tsx` into one file per dialog family
  (`AssemblyNameDialog`, `LengthDialog`, `SegmentDialog`,
  `ConfirmDialog`) with a thin `EnvelopeEditorDialogs.tsx` doing the
  `dialog.kind` routing. The `SegmentDialog` material-picker fieldset
  becomes its own component (`SegmentMaterialPicker` or similar) since
  it is the densest knot inside the densest dialog.
- Promote `useLengthDraft` to `features/envelope/hooks/useLengthDraft.ts`
  with its own test. Keep its sticky-unit-system behavior — that is
  intentional per Phase 3 lessons and §15 PRD defaults.
- Promote `DialogActions` to `shared/ui/` (or alongside `ModalDialog`).
  It is domain-neutral.
- Extract attachment workflow from `EnvelopePage.tsx` into a
  `useEnvelopeAttachmentMutation` hook in `features/envelope/hooks.ts`.
  The page should not own 50+ lines of asset attach/detach
  orchestration; that belongs next to the other envelope mutations.
- Move the envelope subpath / redirect cascade out of `EnvelopePage.tsx`
  into `paths.ts` (already the home of `isEnvelopeSubroute`). The page
  imports a helper instead of regex-parsing inline.
- Move the Escape-to-clear copy-keyboard `useEffect` into the canvas
  component that owns the `copiedAssignment` UX, or into a small
  `useClearOnEscape(value, setValue)` hook colocated with the page's
  other interaction logic.
- Reuse the named `EnvelopeReadSource` type in `query-keys.ts` instead
  of inlining `"draft" | "version"` three times.

## Out Of Scope

- Visual / layout changes. This is a refactor, not a polish PR. The
  same DOM should render the same way after each commit. UI polish
  begins in a follow-up phase informed by this clean foundation.
- New dialogs, new commands, new keyboard shortcuts.
- Drift visuals, accessibility audit, or perf work. Those have their
  own phases (existing Phase 8, plus the polish phase that follows).
- Backend changes. Phase 9 owns those.
- Catalogs-side `argb_color` editor changes. That is in Phase 11.

## Why This Split, Not Another

`context/CODING_STANDARDS.md` §Component Size And Splitting lists the
preferred split directions in order: route pages from presentational
components; forms with submission helpers from page bodies; query/mutation
hooks from route files; feature constants and registries into typed
modules; expensive derived data into memoized helpers. This phase is
deliberately each of those in turn — the file shapes follow the
documented preference, not a fresh invention.

Splitting dialogs per family (`AssemblyNameDialog`, `LengthDialog`,
`SegmentDialog`, `ConfirmDialog`) matches the actual decision a reader
makes when adding a new dialog: "is this a name dialog? a length
dialog? a confirm dialog? or a domain-specific dialog?" The current
file forces that decision to happen after reading the whole file.

## Verification Gates

Frontend:

```bash
cd frontend
pnpm run format
pnpm exec eslint src/features/envelope
pnpm exec vitest run src/features/envelope/__tests__/EnvelopePage.test.tsx
pnpm exec tsc --noEmit --pretty false 2>&1 | rg "src/features/envelope|src/shared/ui" || true
pnpm run build
```

Repo:

- `make test`
- `make typecheck`
- `make lint`

Browser (Playwright MCP or manual):

- open a seeded envelope project;
- open and close each dialog family at least once
  (rename, type, duplicate, delete; add-layer, layer-thickness,
  delete-layer; add-segment, segment-properties, delete-segment;
  refresh-material);
- toggle IP/SI inside a dialog and confirm the draft text stays stable;
- copy/paste a segment assignment with the keyboard Escape shortcut
  clearing the clipboard banner;
- upload one datasheet and one site photo to confirm the new
  `useEnvelopeAttachmentMutation` wiring still updates draft state.

## Success Criteria

1. No envelope frontend file exceeds the 300-line soft limit except
   where the file is mostly declarative (and that exception is
   documented in the file header).
2. `useLengthDraft` lives in its own file with its own unit test
   covering: initial format respects the modal-open unit system; mid-edit
   unit toggle does not clobber the draft string; parsePositive rejects
   zero and negative input; parseOptional returns `null` for empty and
   `undefined` for invalid.
3. `EnvelopePage.tsx` is under 400 lines and contains no inline regex
   parsing, no inline attachment orchestration, and no `dialog.kind`
   logic.
4. `EnvelopePage.test.tsx` (the existing integration-style component
   test) passes unchanged.
5. Catalog drift dialog still opens via the same trigger and applies
   refresh through the same mutation. No user-visible regression.

## Risks

- **`EnvelopePage.test.tsx` is the only frontend test and is broad.**
  It will catch wiring regressions but not subtle render-order
  changes. Mitigation: take a baseline browser screenshot of the
  envelope shell before the refactor; compare after.
- **`useLengthDraft` callers depend on the sticky-unit-system
  behavior.** Mitigation: that behavior is the entire point of the
  hook; preserve it explicitly in the new test.
- **Attachment hook needs the current `EnvelopeReadResponse` for
  ETags.** Mitigation: the existing `useEnvelopeCommandMutation`
  already takes `{ current, command }` as its mutation input — follow
  the same pattern so the page passes `current` once and the hook
  manages the per-step ETag chaining.
- **`DialogActions` lives in `shared/ui/` but is only used by
  envelope today.** Mitigation: that is fine. The standard says
  promote to `shared/` when at least one feature uses it — envelope
  qualifies. Other modal-heavy features (custom fields, catalogs)
  will pick it up as they refactor.

## Sequencing

This phase has no blockers and is independent of Phase 9. It can land
on a fresh branch off `main`. If both Phase 9 and Phase 10 land in
parallel, they will not conflict — they touch disjoint files.

It should land before any UI polish work begins, because every polish
PR will otherwise add to one of the three files this phase is
splitting.
