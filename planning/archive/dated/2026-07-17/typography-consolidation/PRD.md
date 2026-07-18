# Typography consolidation — PRD

- DATE: 2026-07-17
- TIME: 12:38
- STATUS: ✅ Complete 2026-07-17 — exit criteria measured in STATUS.md (29 variants vs ≤25 aspiration recorded as deviation)
- AUTHOR: Claude (Fable 5) with Ed May
- REVISED: 2026-07-17 afternoon ET by Codex
- SCOPE: Target type system + role map + exit criteria
- RELATED: `planning/code-reviews/2026-07-17/font-audit/REPORT.md` (baseline)

## Goal

Reduce the app's rendered typography to the **minimum number of states**,
centralize font CSS on tokens, and make every page, modal, header, button,
dropdown, table, and label feel like one system. Baseline: 55 variants.

## Principles

1. **No new size scale.** The existing 8-step `--fs-*` scale in `tokens.css` is
   the system; consolidation means moving strays *onto* it, not inventing
   sizes. Named semantic tokens are allowed only for an approved role that
   cannot use a scale step (for example auth display or canvas annotation).
   All family/size/weight/tracking/line-height values in component CSS must
   reference tokens or deliberately inherit a complete parent-owned role.
2. **Roles, not places.** A button in a modal renders identically to the
   same-tier button on a page. Modals get no private typography.
3. **Two families only.** Geist (content) and Geist Mono (chrome, labels,
   data, actions). No raw `monospace`/system fallbacks reaching the screen.
4. **Enforced, not aspirational.** A blocking source guard prevents new debt
   from Phase 1 onward; a computed-style evaluator checks semantic role and
   cascade output. Parent/shared owners define roles; features do not opt in
   selector by selector.
5. **Migrate by owner.** Each stylesheet is assigned to one phase. This avoids
   repeatedly reopening `base.css` / `DataTable.css` for buttons, headings,
   modals, and long-tail declarations.

## New tokens (Phase 1)

```css
/* tokens.css additions */
--fw-regular: 400;
--fw-medium: 500;
--fw-semibold: 600;
--fw-bold: 700;
--tracking-normal: 0;
--tracking-caps: 0.05em;
/* Final line-height values approved from the Phase 1 rendered inventory. */
--lh-solid: 1;
--lh-tight: 1.15;
--lh-heading: 1.2;
--lh-ui: 1.25;
--lh-body: 1.5;
```

Weights 550 and 650 are abolished (→ 500/600). The nine current non-zero
tracking values collapse to `--tracking-caps`. `--data-table-font-size: 13px`
stays (deliberate table-density choice, already tokenized). Phase 1 confirms
line-height token values against computed output before selector migration.

## Target role map

Chrome/action text is Geist Mono; content text is Geist. "caps" =
`text-transform: uppercase; letter-spacing: var(--tracking-caps)`.

| Role | Family | Size | Weight | Line height | Case |
| --- | --- | --- | --- | --- | --- |
| Page/section title (DataTable toolbar, modal title) | Geist | --fs-lg | 600 | --lh-heading | — |
| Display/empty-state heading | Geist | --fs-xl | 600 | --lh-heading | — |
| Editor-hero heading | Geist | --fs-2xl | 600 | --lh-heading | — |
| Body / modal body | Geist | --fs-md | 400 | --lh-body | — |
| Form label / input / select | Geist | --fs-md | 400 | --lh-ui | — |
| Secondary text, table-adjacent prose, text buttons | Geist | --fs-sm | 400 | --lh-body | — |
| Dense metric/label text (cards, sidebars) | Geist | --fs-xs | 400 | --lh-ui | — |
| Emphasized row/item name | Geist | --fs-md | 600 | --lh-ui | — |
| Action button (primary/secondary/modal actions) | Geist Mono | --fs-sm | 400 | --lh-ui | caps |
| Compact chrome button (subtabs, IP/SI, toolbar toggles) | Geist Mono | --fs-xs | 500 | --lh-ui | caps |
| Nav/tab link (active: weight 700) | Geist Mono | --fs-xs | 400/700 | --lh-ui | caps |
| Status chip / save-state / badge | Geist Mono | --fs-2xs | 400 | --lh-tight | caps |
| Table header | Geist Mono | --fs-xs | 600 | --lh-tight | caps |
| Table header units | Geist Mono | --fs-2xs | 600 | --lh-tight | — |
| Table cell | Geist | --data-table-font-size | 400 | --lh-ui | — |
| Table footer/count/status, row numbers | Geist Mono | --fs-2xs | 400–600 | --lh-tight | caps where current |
| Code/file literals (`code`, `kbd`, `samp`, `pre`) | Geist Mono | inherit | 400 | inherit | — |

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
  type through a named semantic token; do not allowlist a raw component value.
- **D3 Canvas dimension labels** (10px, aperture builder drawing chrome):
  default: keep 10px through a named canvas-annotation token (they annotate a
  drawing, not UI text). Alternative: --fs-2xs.
- **D4 Aperture-card h2 20px/700** ("Unnamed Aperture Type" editor title):
  default: → --fs-2xl/--fw-semibold (drop the 700), it is the one
  editor-hero heading. Alternative: --fs-lg/600 like other titles.
- **D5 DataTable gutter chevron 10px** → --fs-2xs (default) or keep through a
  named semantic token.

## Enforcement

Phase 1 adds blocking `check:typography` to `check:all`. It accepts existing
debt only through a checked-in normalized fingerprint baseline and fails on
new, changed, or stale entries. It covers CSS family/size/weight/tracking/
line-height/shorthand declarations and TS/TSX inline/library typography entry
points. D2/D3 use tokens, not literal allowlist entries. See
`TYPOGRAPHY-CONTRACT.md` for the exception structure and two-layer static +
rendered control model.

## Non-goals

- Color consolidation (data already captured per-variant in the audit JSONs;
  separate follow-up pass).
- Large-scale line-height visual redesign. This work tokenizes and reduces the
  line-height vocabulary, but preserves the nearest approved current role
  unless visual review explicitly accepts a change.
- Responsive-breakpoint typography, new fonts, or scale redesign.
- Any behavior/layout change beyond what the type changes imply.

## Exit criteria (measured, not vibes)

Run the sweep (README §Verification) and require:

1. **≤ 25 unique variants** site-wide (baseline 55).
2. **Zero accidental OFF-SCALE sizes**; any accepted D2/D3 semantic tokens are
   recognized explicitly by the evaluator.
3. Weights ⊆ {400, 500, 600, 700}.
4. Exactly **one non-zero** letter-spacing value (0.05em) across all caps text;
   normal text uses zero/normal tracking.
5. `button` role ≤ 5 variants (baseline 25); `heading:*` ≤ 3 (baseline 8);
   `modal/*` roles use only variants that also appear outside modals.
6. No `monospace` raw family.
7. Static debt baseline empty; `make ci` green, including
   `check:typography`.
8. Rendered evaluator covers every declared state and passes from a clean,
   hermetically seeded environment.
9. Visual spot-check screenshots (dashboard, a catalog, apertures, one
   modal, equipment table) attached to `STATUS.md` — no layout breakage.
