---
DATE: 2026-07-01
TIME: 18:05 (completed 23:10)
STATUS: Complete
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

- `SunStudyBar.tsx` mounted from `ModelViewerStage` (site-sun lens ∧
  sun-path present ∧ model ready ∧ not measuring). Collapsed pill →
  full bar per PRD §4.2: header (label · live "Jul 1 · 12:00" readout ·
  ✕), date scrubber with month-initial rail, four preset chips
  composing the canonical `chip chip--md chip--outline
  chip--interactive` pattern (amber `aria-pressed` state), time
  scrubber whose track is the daylight band (CSS gradient from the
  backend sunrise/sunset with ±45 min dawn/dusk ramps), details row
  (Alt · Az · ↑ · ↓ · "LST (no DST)").
- Amber single-source: the TS token `VIEWER_SUN_MARKER_COLOR` is
  injected as `--sun-study-amber` inline; CSS never restates the hex.
- First engage defaults to today @ 12:00 (verified: Jul 1 · 12:00,
  altitude 70.7°); chips set date only (Dec 21 kept 12:00); ArrowRight
  on the focused time slider steps 10 min live.
- **Bug found & fixed**: the Stage's `isTextEntryTarget` treated every
  `input` as text entry, so Esc (and all viewer shortcuts) died while
  a scrubber held focus — non-text input types (range/checkbox/radio/
  button) are now excluded. Esc collapses the bar after
  selection/filter in the Stage's Esc priority.
- Verified in browser (screenshots in `../assets/`): pill state, full
  bar at Jul-1 noon, Dec-21 chip state with visibly shorter daylight
  band + low-sun scene, narrow 720 px viewport (bar fits, focus ring
  visible).
- Gates: model_viewer vitest 101 green, eslint clean, format applied.
