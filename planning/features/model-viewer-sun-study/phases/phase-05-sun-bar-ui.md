---
DATE: 2026-07-01
TIME: 18:05
STATUS: Pending (blocked by phase 04)
AUTHOR: Claude (for Ed)
SCOPE: Phase 05 — the sun bar UI: collapsed pill, expanded control bar
  (date scrubber + preset chips, time scrubber with daylight band,
  header readout, details row), exits, polish (PRD §4, §8).
RELATED:
  - ../PRD.md §4, §8, D-6/D-7/D-8/D-9
  - frontend/src/features/model_viewer/components/ModelViewerStage.tsx
  - frontend/src/features/model_viewer/model_viewer.css
  - context/UI_UX.md §0/§1
---

# Phase 05 — Sun Bar UI

## Steps

1. **`SunStudyBar.tsx`** (new component, mounted from
   `ModelViewerStage` when lens = site-sun ∧ sunPath present ∧ model
   ready): collapsed pill (`☀ Sun study`) bottom-center; expands in
   place to the full bar (PRD §4.2 layout). First engage defaults to
   today @ 12:00 (D-8).
2. **Date scrubber**: native range 1..365 step 1, month-initial tick
   rail (`<datalist>` or CSS rail), live "Jun 21" label; four preset
   chips (Dec 21 · Mar 20 · Jun 21 · Sep 22, season tooltips) reusing
   the report-status-chip pattern; chips set date only.
3. **Time scrubber**: native range 0..1439 step 10, track painted as
   the daylight band (night dark / day amber-lit / short dawn-dusk
   ramps) from the backend sunrise/sunset — CSS gradient computed from
   the day's pair; amber thumb.
4. **Header row**: label, live `Jun 21 · 14:30` readout, ✕ collapse.
   **Details row**: `Alt · Az · ↑ sunrise · ↓ sunset · LST (no DST)`.
5. **Exits**: ✕ and `Esc` collapse (Esc wired into the Stage's existing
   keydown handler, only in site-sun with the bar engaged and ahead of
   other Esc consumers); lens switch hides the bar but keeps state.
6. **CSS**: floating-chrome surface recipe (`--bg-card` color-mix,
   `--border-card`, `--radius-md`, `--shadow-hud-2`,
   `--z-base-elevated`); `width: min(560px, calc(100% - 28px))`
   bottom-center; rows wrap on narrow viewports; visible focus on both
   ranges; move the site-sun location hint if it collides.
7. **Polish pass** (explicit): spacing/alignment on the 4px grid,
   tabular numerals for readouts, hover/active/focus states on pill +
   chips + ✕, no layout shift between collapsed/engaged, screenshot
   review at 1440/1024/720 widths.

## Exit criteria

PRD §4 behaviors verified in the browser (Playwright screenshots at
summer noon, winter morning, night, narrow viewport); keyboard-only
operation works; `make frontend-dev-check` green.

## Ledger

- (fill on completion)
