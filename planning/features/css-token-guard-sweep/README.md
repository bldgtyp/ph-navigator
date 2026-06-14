---
DATE: 2026-06-14
TIME: (local, evening)
STATUS: Deferred — backlog; not started. Carved out of P3 during P3 implementation.
AUTHOR: Claude Code (Opus 4.8) + Ed May
SCOPE: The judgment-heavy CSS-token tail — color-literal tokenization, the
  check:hex guard extension, and the spacing/type/radius design pass.
RELATED:
  - ../../archive/css-structure-discoverability/  (P3 — parent; this was its §3 + design-pass tail)
  - ../../code-reviews/2026-06-14/frontend-css-styling-review.md  (canonical findings)
  - ../../archive/css-rationalization/  (P0–P2; deferred these from P0.3)
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

## Acceptance (high level)

- All `rgb()/rgba()/hsl()` literals in feature/shared CSS replaced by tokens
  (new `--scrim-*` etc. as needed), browser-verified neutral.
- `check:hex` extended to `rgb()/rgba()/hsl(a)()` + `.ts`, with documented
  sanctioned-module exemptions; `make ci` green.
- Spacing/type scales tightened and literal radii folded, after Ed's review.
