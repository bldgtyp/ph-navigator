---
DATE: 2026-06-12
TIME: -
STATUS: Done — implemented and verified 2026-06-13.
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff for Model Viewer Phase 5 — color themes
  per lens, theme menu, legend card with counts, mini-keys, scene-info
  popover, &theme= deep link.
RELATED:
  - planning/features/model-viewer/PRD.md (§4.1 lens/theme table —
    D-03; §4.3 derived materials — D-09)
  - planning/features/model-viewer/UI_SPEC.md (§3 theme menu, §4
    legend card, §8 scene-info popover)
  - context/user-stories/40-model-viewer.md (US-VIEW-5 — color
    sources, hash, weighting buckets)
  - research/v1-3d-model-viewer-reference.md (§11 color-by + cyrb53)
---

# Phase 5 — Color themes + legend

## 1. Goal

Each lens that has themes gets the `Color: ▾` menu; switching themes
recolors in place and updates the bottom-left legend card with
per-bucket counts. All six US-VIEW-5 color attributes survive 1:1
under the D-03 recomposition. Ventilation / Hot Water get their
always-on 2-row mini-keys. The `load_summary` gets its permanent
home in the scene-info popover. `&theme=` deep-links work.

## 2. Required reading (in order)

1. `planning/features/model-viewer/PRD.md` §4.1 — the lens→themes
   table is the authoritative mapping (defaults: Building→Shaded,
   Spaces→Shaded, **Floor Areas→Weighting Factor**).
2. `context/user-stories/40-model-viewer.md` — US-VIEW-5: color
   sources, static maps, cyrb53 + golden-ratio hash (crit. 6 —
   preserve verbatim), weighting buckets (crit. 2 — the fixed 0.3
   boundary), unlit colors (crit. 7).
3. `planning/features/model-viewer/UI_SPEC.md` §3 (theme menu), §4
   (legend card — counts, collapse, inert-button rows), §8
   (scene-info popover).
4. `decisions.md` D-09 (derived materials), D-11 (legend counts).
5. V1 source (read-only):
   `../ph-navigator/frontend/src/features/project_view/model_viewer/`
   — `_constants/colorByColors.ts` (static maps + hash),
   `_handlers/modeColorBy.tsx`, `_components/ColorByLegend/`.

## 3. Work breakdown

### 3.1 Theme model

- Store: `theme` slice keyed per lens; switching lens resets theme
  to that lens's default (PRD §4.1). Selection **survives** theme
  switches (UI_SPEC §6).
- Theme menu attaches to the right end of the lens bar only when
  the active lens has >1 theme (Building, Spaces, Floor Areas).
  Dropdown lists that lens's themes with a check; switching
  recolors in place — no lens change, no camera move.

### 3.2 Color application (D-09)

Extend Phase 3's derived-material function with the theme slot:
`color = f(lensDefault, themeColor(meta), hovered, selected)`.
Theme colors are unlit/flat (US-VIEW-5 crit. 7 — the rendered color
must match the legend swatch exactly; with the Phase 3 lighting rig
this means switching themed meshes to an unlit material path or
emissive-only — verify swatch fidelity by screenshot). One shared
material/color instance per bucket (PRD §7). Behavior contract
(PRD §4.3): deselect during a theme lands on the theme color; theme
switches never leave stale colors; hover never leaks.

Color sources per attribute (US-VIEW-5 crit. 1 table):
- **Surface Type** / **Boundary** — static maps ported from V1
  `colorByColors.ts` (drop the `default` entry from legends).
- **Construction** / **Window Construction** — deterministic
  cyrb53 + golden-ratio HSL hash on the construction identifier,
  ported **verbatim** (crit. 6); dynamic legend map built at
  application time, sorted alphabetically.
- **Ventilation Airflow** (Spaces lens) — static map keyed by
  `(v_sup > 0, v_eta > 0)` → SupplyOnly / ExtractOnly /
  SupplyAndExtract / NoVentilation.
- **Weighting Factor** (Floor Areas lens, default) — five buckets
  per US-VIEW-5 crit. 2 with the fixed 0.3 boundary:
  `>=0.6` FullyTreated · `0.5–0.6` Semi · `0.3–0.5` Partial ·
  `0–0.3` Minimal (open at 0) · `==0.0` NonTreated.

### 3.3 Legend card (UI_SPEC §4, D-11)

- Bottom-left floating card; visible for any non-Shaded theme;
  always visible as a 2-row mini-key on Ventilation (supply/exhaust)
  and Hot Water (distribution/recirc).
- Rows: swatch + label + **count** (computed client-side at theme
  application — one pass over the meta records).
- Dynamic legends scroll internally past ~10 rows.
- Collapsible to title bar; collapsed state remembered per session
  (sessionStorage or the store — not persisted server-side).
- Build each row as a real `<button>` rendered inert (no handler,
  `aria-disabled`) — NEW-VIEW-2 legend-as-filter (near-priority
  post-MVP) must be a behavior change, not a rebuild.

### 3.4 Scene-info popover (UI_SPEC §8)

`ⓘ` trigger on the legend-card title bar (and reachable when no
legend shows — e.g. keep a slim standalone trigger bottom-left on
Shaded themes): file name, upload date, counts from `load_summary`,
schema version if available, extraction warnings list. The Phase 3
loading-chip flash now also collapses into this popover.

### 3.5 URL param

`&theme={...}` (D-10) — kebab-case tokens recorded in STATUS.md;
invalid/inapplicable-to-lens values fall back to the lens default
silently.

## 4. Fixture limits — test accordingly

The canonical fixture has all weighting factors = 1.0 and only
generic constructions (PLAN.md gap list). Therefore: bucket logic,
dynamic-legend construction, and hash distribution are **unit-tested
with synthetic DTOs** (cover every weighting bucket boundary:
0.0, 0.15, 0.3, 0.45, 0.5, 0.55, 0.6, 1.0; cover adjacent
construction names hashing to distinct hues). E2E asserts the wiring
(theme switch recolors + legend appears with counts), not the full
bucket spread. Re-verify visually when the multifamily fixture
arrives.

## 5. Out of scope

Legend-as-filter (NEW-VIEW-2, post-MVP), Measure, Site & Sun,
keyboard map, a11y pass (Phase 6).

## 6. Verification gate

1. **Vitest**: cyrb53 hash golden values (pin a few
   identifier→color outputs so future refactors can't silently
   shift colors), weighting buckets incl. boundaries, ventilation
   categorization truth table, legend count computation, theme
   reset on lens switch, selection survival on theme switch,
   URL param fallback.
2. **Playwright e2e** (`model-viewer-themes.spec.ts`): Building →
   Boundary theme → legend shows Outdoors 12 / Surface 6 / Ground 7
   (golden counts from the fixture); select a face, switch theme,
   selection persists; deselect → face shows theme color (assert
   via the Phase 3 `window.__phnModelViewer` hook — this phase adds
   its `theme` + `legend` fields per phase-03 §4.8); Floor Areas
   defaults to Weighting Factor with one bucket (fixture reality);
   Ventilation mini-key always visible; deep link `&theme=boundary`
   works; legend collapse persists across a lens round-trip within
   the session.
3. **Playwright MCP walkthrough**: swatch-vs-mesh color fidelity
   screenshot; legend legibility over the canvas.
4. **Closeout**: `make format` + `make ci`. `graphify update .`.

## 7. Exit criteria

US-VIEW-5 criteria pass under the D-03/D-09 recomposition; legend
counts match client tallies and the fixture's golden counts;
PRD §4.3 observable-behavior contract holds. STATUS.md ledger
updated (incl. theme URL tokens).

## 8. Implementation status — 2026-06-13

Implemented frontend-only:

- Theme state: `themesByLens` in the model-viewer Zustand store,
  with default tokens:
  - Building: `shaded`
  - Spaces: `shaded`
  - Floor Areas: `weighting-factor`
  - Site & Sun / Ventilation / Hot Water: `shaded` fixed
- Theme URL tokens:
  `shaded`, `surface-type`, `boundary`, `construction`,
  `window-construction`, `ventilation-airflow`, `weighting-factor`.
  Invalid or inapplicable `&theme=` values silently fall back to the
  active lens default.
- Theme menu: attached to the lens bar for Building, Spaces, and
  Floor Areas only. Theme switches recolor in place and preserve
  selection.
- Color application: static V1 maps and cyrb53 + golden-ratio
  construction hash ported into a pure theme helper. Themed meshes use
  shared unlit `MeshBasicMaterial` bucket colors; hover/selection
  still override through the D-14 highlight treatment.
- Legend: bottom-left card with inert button rows, per-bucket counts,
  dynamic construction sorting, internal scroll, session collapse, and
  Ventilation / Hot Water mini-keys.
- Scene info: bottom-left `Info` trigger available with or without a
  legend; popover shows file name, upload timestamp, load-summary
  counts, and extraction warnings.
- Debug/e2e hook: `window.__phnModelViewer` now exposes `theme`,
  `legend`, `setTheme`, and `themeColorForObject`.

Focused verification completed before closeout:

- `cd frontend && pnpm exec tsc -b --pretty false` — green.
- `cd frontend && pnpm run lint` — green with the known pre-existing
  aperture fast-refresh warnings.
- `cd frontend && pnpm run check:all` — green.
- `cd frontend && pnpm exec vitest run
  src/features/model_viewer/__tests__/viewerCore.test.ts
  src/features/model_viewer/__tests__/viewerThemes.test.ts
  src/lib/units/units.test.ts` — green.
- `cd frontend && pnpm exec playwright test
  tests/e2e/model-viewer-files.spec.ts
  tests/e2e/model-viewer-lenses.spec.ts
  tests/e2e/model-viewer-themes.spec.ts --project=chromium` —
  green.
- `$ simplify` completed after focused verification. Applied fixes:
  atomic URL lens/theme hydration to avoid same-lens theme churn and
  accidental selection clearing; production gating for debug-hook
  derived data; `metaById` lookup for debug theme colors; shared
  line-style label/color registry for scene lines and mini-key
  legends; early return for shaded/fixed theme material creation;
  shared outside-pointer close handling for the theme menu; explicit
  legend-title CSS class.
- `$ docs-pass` completed: planning docs were already current; stable
  `context/user-stories/40-model-viewer.md` was updated to replace
  the stale "no duct legend in V2 v1" note with the implemented
  Ventilation mini-key behavior.
- In-app browser walkthrough on `localhost:5173` as
  `codex@example.com`: deep-linked
  `?file=…&lens=building&theme=boundary`, verified the Color:
  Boundary trigger, disabled Site & Sun segment, legend counts
  Outdoors 12 / Ground 7 / Surface 6, scene-info popover counts
  25 surfaces / 4 spaces / 5 shade groups / 0 air boundaries skipped,
  and swatch-vs-mesh color fidelity in screenshot.
