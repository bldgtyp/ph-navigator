# Typography consolidation — PRD

- DATE: 2026-07-17
- TIME: 12:38
- STATUS: Active
- AUTHOR: Claude (Fable 5) with Ed May
- SCOPE: Target type system + role map + exit criteria
- RELATED: `planning/code-reviews/2026-07-17/font-audit/REPORT.md` (baseline)

## Goal

Reduce the app's rendered typography to the **minimum number of states**,
centralize font CSS on tokens, and make every page, modal, header, button,
dropdown, table, and label feel like one system. Baseline: 55 variants.

## Principles

1. **No new scale.** The existing 8-step `--fs-*` scale in `tokens.css` is
   the system; consolidation means moving strays *onto* it, not inventing
   sizes. All font-size/weight/letter-spacing values in component CSS must
   reference tokens.
2. **Roles, not places.** A button in a modal renders identically to the
   same-tier button on a page. Modals get no private typography.
3. **Two families only.** Geist (content) and Geist Mono (chrome, labels,
   data, actions). No raw `monospace`/system fallbacks reaching the screen.
4. **Enforced, not aspirational.** A CI lint blocks literal font values in
   component CSS (DataTable-uniformity iron-law pattern: parent-owned +
   enforced, never per-component opt-in).

## New tokens (Phase 1)

```css
/* tokens.css additions */
--fw-regular: 400;
--fw-medium: 500;
--fw-semibold: 600;
--fw-bold: 700;
--tracking-caps: 0.05em; /* the ONLY letter-spacing used with uppercase */
```

Weights 550 and 650 are abolished (→ 500/600). Tracking values 0.04/0.06/
0.08em collapse to `--tracking-caps`. `--data-table-font-size: 13px` stays
(deliberate table-density choice, already tokenized).

## Target role map

Chrome/action text is Geist Mono; content text is Geist. "caps" =
`text-transform: uppercase; letter-spacing: var(--tracking-caps)`.

| Role | Family | Size | Weight | Case |
| --- | --- | --- | --- | --- |
| Page/section title (h2, DataTable toolbar title, modal title) | Geist | --fs-lg | 600 | — |
| Display/empty-state heading (h3 hero, "No model uploaded yet") | Geist | --fs-xl | 600 | — |
| Body / modal body / form label / input / select | Geist | --fs-md | 400 | — |
| Secondary text, table-adjacent prose, text buttons | Geist | --fs-sm | 400 | — |
| Dense metric/label text (cards, sidebars) | Geist | --fs-xs | 400 | — |
| Emphasized row/item name | Geist | --fs-md | 600 | — |
| Action button (primary/secondary/modal actions) | Geist Mono | --fs-sm | 400 | caps |
| Compact chrome button (subtabs, IP/SI, toolbar toggles) | Geist Mono | --fs-xs | 500 | caps |
| Nav/tab link (active: weight 700) | Geist Mono | --fs-xs | 400/700 | caps |
| Status chip / save-state / badge | Geist Mono | --fs-2xs | 400 | caps |
| Table header | Geist Mono | --fs-xs | 600 | caps |
| Table header units | Geist Mono | --fs-2xs | 600 | — |
| Table cell | Geist | --data-table-font-size | 400 | — |
| Table footer/count/status, row numbers | Geist Mono | --fs-2xs | 400–600 | caps where current |
| Code/file literals (`code`, `kbd`, `pre`) | Geist Mono | inherit | 400 | — |

Target: **≤ ~22 variants site-wide** (the map above ± active/bold pairs).

## Known off-scale sources to fix (from baseline REPORT)

1. `8.64px` — `.data-table-footer-record-count-label`, `.data-table-footer-status`
   (DataTable.css; em-of-em compounding) → --fs-2xs.
2. `16px/650` — `h2.data-table-toolbar-title` → --fs-lg / --fw-semibold.
3. `14.4px` / `14.72px` — `.catalog-count`, catalog toolbar toggle labels
   (em-of-em) → --fs-md.
4. `18.72px` — empty-state `h3` (base.css) → --fs-xl.
5. `12.48px/550` — `.aperture-uvalue-chip__label` → --fw-medium.
6. Raw `monospace` — `code` never assigned a family in reset.css →
   `code, kbd, samp, pre { font-family: var(--font-mono); }`.
7. `17.6px` mono "+" glyphs (`.data-table-add-row-button`,
   `.data-table-add-field-glyph`) — keep size (glyph, not text) but express
   via token; verify vertical alignment unchanged.

## Open decisions (proposed defaults — implementation agent proceeds with
these unless Ed overrides)

- **D1 Modal titles**: currently 20px/600 vs page titles 16px/600. Default:
  modal titles drop to `--fs-lg/600` to match pages (kills the "modals feel
  foreign" effect). Alternative: promote page titles to --fs-2xl.
- **D2 Sign-in h1** (49.6px clamp): default: keep as intentional display
  type but expressed as a documented exception in the lint allowlist.
- **D3 Canvas dimension labels** (10px, aperture builder drawing chrome):
  default: keep 10px as a documented canvas-annotation exception (they
  annotate a drawing, not UI text). Alternative: --fs-2xs.
- **D4 Aperture-card h2 20px/700** ("Unnamed Aperture Type" editor title):
  default: → --fs-2xl/--fw-semibold (drop the 700), it is the one
  editor-hero heading. Alternative: --fs-lg/600 like other titles.
- **D5 DataTable gutter chevron 10px** → --fs-2xs (default) or keep.

## Enforcement (Phase 1 warn → Phase 5 error)

Add `frontend/scripts/check-font-tokens.mjs` (pattern: existing
`check-css-vars.mjs`): fail when `src/**/*.css` outside `tokens.css`
contains literal `font-size`/`font-weight`/`letter-spacing` values
(px/rem/em/number) rather than `var(--…)`. Allowlist file for documented
exceptions (D2/D3). Wire into the frontend check used by `make ci`.

## Non-goals

- Color consolidation (data already captured per-variant in the audit JSONs;
  separate follow-up pass).
- Line-height systemization (recorded in JSONs; revisit after sizes settle).
- Responsive-breakpoint typography, new fonts, or scale redesign.
- Any behavior/layout change beyond what the type changes imply.

## Exit criteria (measured, not vibes)

Run the sweep (README §Verification) and require:

1. **≤ 25 unique variants** site-wide (baseline 55).
2. **Zero OFF-SCALE sizes** except the documented allowlist (D2/D3).
3. Weights ⊆ {400, 500, 600, 700}.
4. Exactly **one** letter-spacing value (0.05em) across all caps text.
5. `button` role ≤ 5 variants (baseline 25); `heading:*` ≤ 3 (baseline 8);
   `modal/*` roles use only variants that also appear outside modals.
6. No `monospace` raw family.
7. `make ci` green, including the new font-token lint.
8. Visual spot-check screenshots (dashboard, a catalog, apertures, one
   modal, equipment table) attached to `STATUS.md` — no layout breakage.
