---
DATE: 2026-07-20
TIME: 17:30 EDT
STATUS: DONE (implemented + verified 2026-07-20)
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 00 — resolve 1A values to tokens; add the few genuinely-new tokens.
RELATED: ../PRD.md §4, ../research.md §4, ../decisions.md D-1/D-6
---

# Phase 00 — Tokens & Foundations

**Goal:** every 1A value has a token to bind to, so no later phase writes a raw
hex. No visible behavior change; no component edits yet.

## Tasks

1. **Map, don't add, where a token exists.** Confirm the `research.md` §4 mapping
   table: teal→`--accent`/`--accent-text`, teal-fill→`--accent-light`,
   text→`--text-primary/secondary/muted`, hairline→`--border-subtle`,
   danger→`--phn-danger`/`--phn-danger-bg`, font→`--font-primary`, sizes→`--fs-*`,
   weights→`--fw-*`, radius→existing `--radius-*`.

2. **Add the genuinely-new tokens** to `frontend/src/styles/tokens.css` (Layer 2 —
   the sanctioned place per DESIGN_SYSTEM §"Where the real thing lives"):
   - `--sidebar-row-hover` — the **neutral** row hover wash (1A `#F3F3F1`). Prefer
     a token that reads neutral in both themes, e.g.
     `color-mix(in oklab, var(--text-primary) 5%, var(--bg-card))` (light-safe,
     dark-safe). Value chosen to sit *below* the teal selection in salience.
   - `--sidebar-grip` (optional) — grip color if `--text-muted` reads too strong;
     1A `#B6B6B1`.
   - `--sidebar-action-scrim` (optional) — if the gradient scrim needs a named
     stop rather than reusing the row bg var inline.
   Keep additions minimal — DESIGN_SYSTEM doctrine: don't invent a fifth grey.

3. **No new font sizes.** Verify the 1A sizes all land on existing `--fs-*` steps
   (title 17px→`--fs-xl`; tab/label 13px→`--fs-sm`; row 14px→`--fs-md`; group
   label 11px→`--fs-2xs`/`--fs-xs`). If a step is missing, STOP and raise — do not
   add a font-size literal (`check:typography` is zero-debt, 29-variant ceiling).

4. **Snapshot refresh.** If any token is added, update the `context/DESIGN_SYSTEM.md`
   Portable-spec snapshot + snapshot date (that doc's own rule).

## Verification
- `pnpm run check:css-vars` and `pnpm run check:hex` green.
- Grep the new tokens resolve (no dangling `var()`).
- `make format`.

## Done when
New tokens exist and resolve; mapping table confirmed; no component/CSS-consumer
changes yet; guards green.
