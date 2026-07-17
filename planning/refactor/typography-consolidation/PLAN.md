# Typography consolidation — implementation plan

- DATE: 2026-07-17
- TIME: 12:38
- STATUS: Active
- AUTHOR: Claude (Fable 5) with Ed May
- SCOPE: Phase sequence for PRD.md; each phase independently shippable
- RELATED: `PRD.md`, `planning/code-reviews/2026-07-17/font-audit/REPORT.md`

Work on a feature branch; keep `main` deployable. After each phase: run the
font-audit sweep, record the variant count in `STATUS.md`, run the repo
closeout gate (`simplify`, `docs-pass`, `make format`, `make ci`).

## Phase 1 — Foundations (low risk, no visual change intended)

1. `tokens.css`: add `--fw-*` and `--tracking-caps` tokens (PRD §New tokens).
2. `reset.css`: `code, kbd, samp, pre { font-family: var(--font-mono); }`.
3. New `frontend/scripts/check-font-tokens.mjs` lint (PRD §Enforcement),
   **warn-only**; print the offending file:line list. This list is the
   worklist for Phases 2–5.
4. Verify: sweep shows the same 55 variants except raw `monospace` gone.

## Phase 2 — Shared chrome (biggest reach per edit)

1. DataTable.css: footer 8.64px → `--fs-2xs`; toolbar title 650 →
   `--fw-semibold`; gutter chevron (D5); "+" glyph via token; all
   font-size/weight/letter-spacing literals → tokens.
2. App shell (topbar, subtabs, save-state, nav tabs): collapse the four
   tracking values to `--tracking-caps`; weights → tokens.
3. Catalog toolbar: `.catalog-count` + toggle labels (em-of-em 14.4/14.72px)
   → `--fs-md`.
4. Verify: sweep; expect ~10 variants gone; screenshot DataTable pages
   (catalog-materials, equipment) against baseline for density regressions.

## Phase 3 — Buttons (25 variants → 4 tiers)

1. Define the four tiers from PRD §Role map as shared button classes (extend
   the existing `.secondary-button` / `.text-button` family in base.css) —
   typography only; colors/borders out of scope.
2. Migrate one-off buttons found in REPORT.md (`top selectors` column is the
   worklist) to a tier class; delete their per-component font declarations.
3. Verify: sweep role-consistency table shows `button` ≤ 5 variants.

## Phase 4 — Modals + headings

1. `modals.css`: title → `--fs-lg`/`--fw-semibold` (D1); body/labels/inputs
   → `--fs-md`; actions use the Phase 3 action-button tier. Kill all
   modal-private typography.
2. Headings: element defaults for h1–h4 in base.css per role map; fix
   empty-state h3 (18.72px) and aperture editor h2 (D4); sign-in h1 per D2.
3. Verify: sweep — `modal/*` roles use only variants that also appear
   outside modals; `heading:*` ≤ 3 variants. Screenshot every modal state in
   the sweep manifest.

## Phase 5 — Long tail + enforcement + closeout

1. Remaining lint findings: `.aperture-uvalue-chip__label` 550, dimension
   labels (D3), any stragglers the Phase 1 lint list still shows.
2. Flip `check-font-tokens.mjs` to **error** in CI with the final allowlist.
3. Final sweep → regenerate REPORT into
   `planning/code-reviews/2026-07-17/font-audit/` as `REPORT-after.md`;
   verify every PRD exit criterion; record pass/fail table in `STATUS.md`.
4. Docs: fold accepted decisions (D1–D5 outcomes) back into
   `context/UI_UX.md` / `context/CODING_STANDARDS.md` per planning rule 4;
   archive this packet when merged.
