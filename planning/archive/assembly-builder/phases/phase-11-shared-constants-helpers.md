---
DATE: 2026-05-27
TIME: 22:30 EDT
STATUS: Proposed. Foundation polish — name the values, share the helpers.
AUTHOR: Claude (Opus 4.7)
SCOPE: Replace magic numbers, hand-rolled duplicates, and inline string
       literals with named constants and shared helpers, so a polish-phase
       author has one place to read or change each calibrated value.
RELATED:
  - planning/code-reviews/2026-05-27/assembly-builder-foundation-review.md §M1, §M2, §M4, §L2, §L3, §L7, §L8
  - planning/archive/assembly-builder/PRD.md §6.1, §6.6
  - context/CODING_STANDARDS.md §Documentation Standard
---

# Phase 11 - Shared Constants And Helpers

## Goal

Every unnamed numeric, every hand-rolled string parser, and every
duplicated "find next free name" loop in the envelope feature gets one
named home. After this phase, a reader who wants to know "why is the
canvas 0.18 px/mm at zoom=1?" or "what does an `argb_color` actually
parse from?" lands on a named module with a one-line answer, not on a
literal embedded in JSX.

Behavior does not change. This is a rename / extract / colocate phase,
not a logic change.

## Why Now

- The polish UI phase will care about the canvas scale calibration
  (`BASE_PX_PER_MM = 0.18`, `MIN_LAYER_HEIGHT`, `MIN_SEGMENT_WIDTH`,
  the unlabelled `360` / `12` / `2` / `0.6` / `0.1` zoom values). If
  these stay as inline literals, the polish PR will accidentally
  double or halve one of them and break every reference screenshot.
- `argb_color` parsing is duplicated between envelope (`materialColor`
  with a regex) and catalogs (three editor modals with raw string
  inputs). The current regex is whitespace-intolerant; a future
  hand-edited value could silently fall back to `var(--bg-page)`
  without an obvious failure.
- Two near-identical "find next free name with suffix" loops exist
  (`_next_copy_name`, `_next_custom_material_name`). Adding a third
  use-case (e.g. duplicate a layer with `(Copy)` suffix) would copy
  the loop a third time.
- The HBJSON download path builds and tears down a temporary `<a>`
  element inline. The `try / finally` around `URL.revokeObjectURL` is
  exactly the kind of correctness contract that wants one shared
  implementation.

## In Scope

### Backend

- Add `backend/features/envelope/identifiers.py` (or similar) with
  named ID prefix constants (`ID_PREFIX_ASSEMBLY = "asm"`,
  `ID_PREFIX_LAYER = "lyr"`, `ID_PREFIX_SEGMENT = "seg"`,
  `ID_PREFIX_PROJECT_MATERIAL = "pmat"`) plus the `_new_id` helper
  with a one-line docstring explaining the keyspace choice
  (`36^12 ≈ 4.7×10^18`, intentional vs. UUIDs to keep IDs short in
  JSON-Patch paths).
- Extract `_next_copy_name` and `_next_custom_material_name` into one
  helper (`next_unique_name(existing, base, separator, fallback_id)`
  or similar). The `range(2, 1000)` cap stays — picking up an
  ID-suffix fallback at copy #1000 is correct — but the cap gets a
  one-line comment.
- Add a `DEFAULT_HAND_ENTERED_MATERIAL_COLOR` constant (currently the
  inline `"(255,230,230,230)"` in `_hand_enter_material`) with a
  reference to the ARGB convention used across the project.
- Replace the bare `raise api_error(422, ...)` in
  `hbjson_export.export_hbjson_constructions` with
  `status.HTTP_422_UNPROCESSABLE_ENTITY` so the import style matches
  the rest of the feature.

### Frontend

- Add `frontend/src/features/envelope/canvas-constants.ts` with
  named values:
  - `BASE_PX_PER_MM` (canvas-to-physical calibration)
  - `MIN_LAYER_HEIGHT_PX` (readable minimum layer band)
  - `MIN_SEGMENT_WIDTH_PX` (clickable minimum segment)
  - `MIN_CANVAS_WIDTH_PX` (the existing `360`)
  - `MIN_LAYER_WIDTH_PERCENT` (the existing `12`)
  - `ZOOM_MIN`, `ZOOM_MAX`, `ZOOM_STEP`
  Each constant gets a one-line block comment explaining the
  calibration intent (so a polish-phase author knows why `0.18` and
  not `0.2`).
- Add a small `pxFromMm(mm, zoom, minPx)` helper next to the
  constants and use it in the three places `AssemblyCanvas.tsx`
  currently does the multiplication inline.
- Add `frontend/src/shared/lib/argbColor.ts` exporting `parseArgb`
  (string → `{ a, r, g, b } | null`) and `argbToCssRgb` (string →
  `rgb(r g b)` with a CSS-variable fallback). Be whitespace-tolerant
  (`(255, 230, 230, 230)` parses the same as `(255,230,230,230)`).
  Ship a `argbColor.test.ts` covering: canonical form, whitespace
  form, missing/empty input, malformed input. Update
  `features/envelope/lib.ts:materialColor` to use the helper.
  Catalog material/frame/glazing editors are noted as future
  callers but not migrated in this phase — see "Out Of Scope".
- Add `frontend/src/shared/lib/downloadBlob.ts` exporting a
  `downloadBlob(blob, filename)` helper that owns the temporary
  `<a>` element lifecycle and `URL.revokeObjectURL` cleanup. Update
  `useEnvelopeHbjsonExportMutation` to use it.

## Out Of Scope

- Migrating catalog editors (`MaterialEditorModal`,
  `FrameTypeEditorModal`, `GlazingTypeEditorModal`) to the new
  `argbColor` helper. The helper lands and is wired into envelope this
  phase; catalog migration happens opportunistically the next time
  those files are touched, to keep this phase reviewable.
- Color picker UI for `argb_color`. The current text input is
  intentional for now — a real color picker is a polish-phase
  decision.
- New canvas calibration values. The named constants get the values
  the code uses today, not improved ones.
- Renaming `argb_color` itself, or changing its persistence shape.

## Why This Split, Not Another

Each item above passes the same test: it is **a value or behavior the
polish phase will want to read, reuse, or tune**, and it currently
lives at the literal-string or copy/paste level. Naming and sharing it
now means polish-phase PRs touch one named module instead of three
JSX files.

The phase deliberately does *not* try to migrate every consumer of the
new shared helpers (`argbColor` is the obvious case). The cost of
"one phase introduces helpers, the next phases adopt them" is much
lower than the cost of a 7-file PR that touches catalogs, envelope,
and shared in a single review.

## Verification Gates

Backend:

```bash
cd backend
uv run ruff check features/envelope
uv run ty check features/envelope tests/test_envelope_phase0*.py
uv run pytest tests/test_envelope_phase0*.py
```

Frontend:

```bash
cd frontend
pnpm run format
pnpm exec eslint src/features/envelope src/shared/lib
pnpm exec vitest run src/shared/lib/argbColor.test.ts src/features/envelope/__tests__/EnvelopePage.test.tsx
pnpm exec tsc --noEmit --pretty false 2>&1 | rg "src/features/envelope|src/shared" || true
pnpm run build
```

Browser:

- open a seeded envelope project — canvas renders with identical
  dimensions to a pre-refactor screenshot;
- zoom in and out — same min/max behavior;
- download HBJSON — file saves with the same name and content.

## Success Criteria

1. No literal `0.18`, `30`, `72`, `360`, `12`, `2`, `0.6`, or `0.1`
   appears in `AssemblyCanvas.tsx` or `EnvelopePage.tsx`.
2. `argbColor.test.ts` passes with the canonical form, whitespace
   form, and explicit-null cases.
3. `_next_copy_name` and `_next_custom_material_name` are gone,
   replaced by one named helper.
4. `_hand_enter_material` and any other "(255,230,230,230)" literal
   in `service.py` references the named constant.
5. `useEnvelopeHbjsonExportMutation` no longer owns DOM-element
   lifecycle; it calls `downloadBlob` and is one line shorter.
6. Visual diff on the canvas screenshot is zero pixels.

## Risks

- **Helper extraction changes behavior accidentally.** Mitigation:
  every helper extracted in this phase has a one-shot test (existing
  test for `_next_copy_name` semantics, new `argbColor.test.ts`,
  visual baseline for the canvas). If a test fails, the extraction
  is wrong, not the test.
- **`downloadBlob` collides with an existing helper that this review
  missed.** Mitigation: grep the repo for `URL.createObjectURL`
  before writing the new helper; if one exists, adopt it instead.
- **Polish phase wants to change one of the canvas constants
  immediately.** Mitigation: that is fine. The point of this phase is
  to make that change a one-line edit in one file, not a scavenger
  hunt across JSX.

## Sequencing

This phase is independent of Phase 9 and Phase 10. It can land before,
after, or alongside either of them. Preference: land Phase 9 and Phase
10 first so this phase touches only the post-refactor file layout.

It must land before serious UI polish begins; otherwise the canvas
constants will get tuned (and re-tuned, and forgotten) inline as part
of the polish PR.
