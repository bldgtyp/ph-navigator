---
DATE: 2026-06-14
TIME: 15:50 EDT
STATUS: Complete — implemented and verified.
AUTHOR: Claude Code (Opus 4.8) + Ed May
SCOPE: The judgment-heavy CSS-token tail — color-literal tokenization, the
  check:hex guard extension, and the spacing/type/radius design pass.
RELATED:
  - ../css-structure-discoverability/  (P3 — parent; this was its §3 + design-pass tail)
  - ../../code-reviews/2026-06-14/frontend-css-styling-review.md  (canonical findings)
  - ../css-rationalization/  (P0–P2; deferred these from P0.3)
---

# CSS — Token sweep + guard extension + scale design pass

Carved out of **P3 (`css-structure-discoverability`)** while P3 was being
implemented. P3 landed its structure + discoverability work (styles README,
`shared/ui` barrel, one import strategy / zero double-imports, leaked-CSS
promotion, first god-stylesheet split, a `.css` size cap, and the
`TECH_STACK.md` / `UI_UX.md` doc reconciliation). What's left is the part P3
flagged as **needing Ed's eye and per-literal visual verification** — it was
not safe to fold into the otherwise visually-neutral P3 change.

## Why this is separate

Three reasons this couldn't ride along with P3's neutral structural sweep:

1. **Color tokenization is not visually neutral by construction.** The ~24
   remaining `rgb()/rgba()/hsl()` literals are scrims and shadows that mostly
   do **not** map to an existing token (there is no `--scrim-*`; shadow values
   differ from `--shadow-*`). Tokenizing them means *inventing* tokens and
   choosing values — a design decision, verified literal-by-literal.
2. **The `check:hex` → `.ts` extension surfaces undecided cases.** Turning the
   guard on for `.ts` lights up legitimate palettes/fixtures the original
   review never listed (see PRD §2). Each needs a sanctioned-vs-tokenize call.
3. **The scale tightening shifts sizes.** Dropping spacing/type steps and
   folding literal radii changes pixels; it wants Ed's design review.

## Read order

1. This README.
2. [`PRD.md`](PRD.md) — the exact literals, the `.ts` cases, and the scale work.
3. [`STATUS.md`](STATUS.md) — state + suggested first step.

## Execution summary

Implemented and verified 2026-06-14 in the main worktree:

- Feature/shared `rgb()/rgba()/hsl()` CSS literals were replaced with
  app-level tokens in `frontend/src/styles/tokens.css`.
- `frontend/scripts/check-hex.mjs` now scans `.css`, `.ts`, and `.tsx` for
  hex and `rgb()/rgba()/hsl()/hsla()` literals.
- Sanctioned TypeScript color-data modules are explicit in the guard:
  Model Viewer color/theme data, DataTable option palette generation,
  Equipment heat-pump option palette generation, and the Materials category
  default color.
- Literal `border-radius` values called out by the PRD were folded into radius
  tokens without pixel shifts.
- Spacing/type scale deletion was audited and not performed: every type token
  and every spacing token remains in active use (`--space-32`/`--space-48` and
  `--fs-2xl`/`--fs-3xl` are sparse but live).

No follow-up phase is required for this packet.

## Acceptance (high level)

- All `rgb()/rgba()/hsl()` literals in feature/shared CSS replaced by tokens
  (new `--scrim-*` etc. as needed), browser-verified neutral.
- `check:hex` extended to `rgb()/rgba()/hsl(a)()` + `.ts`, with documented
  sanctioned-module exemptions; `make ci` green.
- Spacing/type scales tightened and literal radii folded, after Ed's review.
