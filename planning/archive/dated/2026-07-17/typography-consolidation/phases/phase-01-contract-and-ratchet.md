---
DATE: 2026-07-17
TIME: afternoon ET
STATUS: ✅ Done 2026-07-17 (D1–D5 defaults adopted; guard blocking in check:all; baseline 436 decls / 435 fingerprints; make ci green)
AUTHOR: Codex
SCOPE: Typography tokens, canonical authoring rules, static inventory, and
  blocking no-new-debt CI ratchet
DEPENDS_ON: none
RELATED:
  - `../PRD.md`
  - `../TYPOGRAPHY-CONTRACT.md`
  - `../../../code-reviews/2026-07-17/font-audit/REPORT.md`
---

# Phase 1 — Contract and anti-drift ratchet

## Goal

Make the desired system explicit and prevent any new typography debt before
the visual migration starts. This phase intentionally does not attempt a broad
selector rewrite.

## Build

1. Resolve PRD decisions D1–D5 and record them in `STATUS.md`.
2. Add the approved token groups to `frontend/src/styles/tokens.css`:
   weights, normal/caps tracking, and line-height roles. If the auth display or
   canvas annotation sizes remain off-scale, create named semantic tokens.
3. Fix the family reset gap for `code`, `kbd`, `samp`, and `pre`.
4. Implement `frontend/scripts/check-typography.mjs` as a thin CLI over a
   testable scanner module. Use a declared CSS-parser dependency rather than
   regex-only declaration parsing.
5. Cover CSS and TS/TSX typography entry points. Reject raw sizes, weights,
   tracking, line heights, families, non-inherit `font` shorthands, and
   undocumented inline/library typography props.
6. Generate a checked-in normalized debt baseline. Fingerprints use relative
   file, selector/owner, property, and normalized value—not line number.
7. Add focused scanner tests for multiline declarations, comments, nested
   functions, `font: inherit`, illegal shorthand, stale baseline entries,
   duplicate exceptions, TSX inline styles, and chart/canvas exceptions.
8. Wire `check:typography` into `check:all`; it is blocking immediately.
9. Fold the active rules from `TYPOGRAPHY-CONTRACT.md` into
   `frontend/src/styles/README.md`, `context/UI_UX.md`, and the frontend-control
   list in `context/CODING_STANDARDS.md`. Describe the ratchet honestly as a
   migration baseline, not zero-debt enforcement yet.

## Initial inventory evidence

Record parser-derived counts in `STATUS.md`, grouped by property and file.
The current line-oriented preflight found 398 `font-size` declarations (340
already `var()` based), 180 weights, 93 tracking declarations, 111 family
declarations, and 94 line heights outside vendored brand CSS. Parser output is
the authoritative Phase 1 baseline.

## Verification

- Scanner fixture tests pass.
- `pnpm run check:typography` passes with the checked-in baseline.
- Injecting one temporary literal causes the command to fail; removing one
  baseline violation causes stale-baseline failure.
- `pnpm run check:all` includes the new guard.
- Focused browser check confirms the code-family reset and semantic exception
  tokens render as intended.
- `make format` and `make ci` pass before phase closeout.

## Done when

CI blocks new typography debt, the debt baseline is reproducible, canonical
docs state the rules, and no broad migration has been mixed into this phase.
