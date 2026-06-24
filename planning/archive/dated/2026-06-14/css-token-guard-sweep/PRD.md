---
DATE: 2026-06-14
TIME: 15:50 EDT
STATUS: Complete — implemented and verified.
AUTHOR: Claude Code (Opus 4.8) + Ed May
SCOPE: Work items, evidence, and acceptance criteria
RELATED:
  - ./README.md
  - ../css-structure-discoverability/PRD.md  (§3 + §4 design-pass tail this replaces)
  - ../../code-reviews/2026-06-14/frontend-css-styling-review.md
---

# Token sweep + guard extension + scale design pass — PRD

All line numbers below were captured 2026-06-14; **re-grep before acting.**

## 1. Color-literal tokenization

~24 `rgb()/rgba()/hsl()` literals remain in feature/shared CSS (none in `.ts`
outside the sanctioned modules). They cluster into three intents:

- **Scrims** (modal/overlay backdrops): `rgb(0 0 0 / 45%)` /
  `rgba(0, 0, 0, 0.45)` in `apertures.css` (×2), `DataTable.css` (×2),
  `attachments.css` `rgb(15 23 42 / 0.45)`. → introduce `--scrim` (and maybe a
  slate `--scrim-strong`) tokens; do not silently normalize the slate one to
  black without Ed's eye.
- **Shadows**: `box-shadow` literals in `model_viewer.css` (×4),
  `apertures.css` (×2), `attachments.css` (×2), `DataTable.css` (several).
  Some are close to `--shadow-elev-*` / `--shadow-hud-*` / `--shadow-popover`
  but not identical. Decide per-shadow: snap to an existing token (visual
  change — verify) or add an exact-value token.
- **A data-table tint**: `rgb(233, 238, 249)` in `DataTable.css` (×4, incl.
  inside `color-mix(... var(--accent))`). → a named `--data-table-*` token.

For each: replace the literal with a token, then **browser-verify the surface
is unchanged** (or accept the change deliberately). This is the bulk of the
visual risk; do it before flipping the guard (below) so CI stays green.

## 2. Extend `check:hex`

Today `scripts/check-hex.mjs` flags only `#hex`, only in `.css`/`.tsx` under
`features/` + `shared/ui/`. Extend it to:

- **`rgb()/rgba()/hsl()/hsla()` function-form literals** (after §1 clears the
  CSS ones).
- **`.ts` files.** This is the part the original review under-scoped — adding
  `.ts` lights up legitimate, *non-test* color data that needs a decision:
  - `features/equipment/heat-pumps/lib.ts` `OPTION_COLOR_PALETTE` — a real hex
    palette, analogous to the already-sanctioned
    `data-table/lib/options/create.ts`. → likely **sanctioned-exempt**.
  - `features/equipment/testing/*Fixtures.ts` + `testing/testFixtures.ts` —
    seed/option fixture data with per-option hex. → exempt `testing/` dirs +
    `*Fixtures.ts` (extend the test-fixture skip), or move under `__tests__`.
  - `features/catalogs/materials/fieldDefs.ts` `CATEGORY_COLOR = "#e5e7eb"` —
    a single default. → tokenize or sanction.
- **Named colors** were considered and **deliberately left out**: matching
  `white`/`black`/`red` etc. by regex is a false-positive minefield
  (`white-space`, `currentColor`, `transparent`, `color-mix` keywords). If
  wanted, do it with an allowlist of CSS color keywords, not a broad match.

Keep the sanctioned-module exemption list explicit and commented:
`model_viewer/lib/colors.ts`, `model_viewer/lib/themes.ts`,
`data-table/lib/options/create.ts`, + whatever §2 decides above.

## 3. Scale design pass (needs Ed's eye — shifts sizes)

- **Tighten the spacing scale** (`--space-2 … --space-48`): drop rarely-used
  steps after auditing usage counts.
- **Tighten the type scale** (`--fs-2xs … --fs-3xl`): same.
- **Fold remaining literal radii** (`3px / 7px / 9px / 10px / 12px`) into the
  `--radius-*` scale (or add steps), removing the literals.

Each shifts rendered sizes → do it as an explicit design pass with browser
review, not a mechanical sweep.

## Acceptance criteria

- No `rgb()/rgba()/hsl()` literals remain in feature/shared CSS; replacements
  are tokens; each surface browser-verified.
- `check:hex` covers `rgb/rgba/hsl(a)` + `.ts`, with documented exemptions;
  `pnpm run check:all` and `make ci` green.
- Spacing/type scales tightened, literal radii folded, after Ed's review.

## Implementation notes — 2026-06-14

- Color literals were moved behind exact-value tokens rather than snapped to
  nearby existing shadows/scrims. That keeps this sweep pixel-neutral while
  giving `check:hex` a stricter surface to enforce.
- `.ts` color literals are permitted only in the guard's explicit sanctioned
  data-color list: Model Viewer color/theme modules, DataTable option palette
  generation, Equipment heat-pump option palette generation, and Materials
  category default color. Tests, `__tests__/`, `testing/`, and fixture files
  remain skipped as fixtures.
- Spacing/type scale removal was audited and rejected for this pass. All current
  spacing and type tokens are still referenced; the sparse large/display steps
  remain intentional until a later visual redesign has a reason to change
  pixels.
- Literal radii were folded into tokens with exact active steps, so the pass
  does not shift rendered corner geometry.

## Out of scope

- Anything P3 already shipped (structure, discoverability, the `.css` size
  cap, the doc reconciliation). See `../../archive/css-structure-discoverability/`.
