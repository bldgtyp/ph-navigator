---
DATE: 2026-06-14
TIME: (local, evening)
STATUS: Deferred — decided; execution backlog. Not built.
AUTHOR: Claude Code (Opus 4.8) + Ed May
SCOPE: P4 work items, evidence, and acceptance criteria
RELATED:
  - ./README.md
  - ../../code-reviews/2026-06-14/frontend-css-styling-review.md
---

# P4 — Brand-Dependency Resilience & Doc Reconciliation — PRD

Source: 2026-06-14 CSS review, Theme 8 (remote-dependency resilience,
MED/strategic) and Theme 10 (plan vs reality). **Both decisions were taken
2026-06-14; this is an execution spec, not an open question.**

## Item 1 — Vendor + self-host the brand assets (Theme 8)

### Problem (evidence)

- `frontend/index.html:7` loads
  `https://bldgtyp.github.io/bt-branding/tokens/tokens.css` at runtime —
  the BLDGTYP brand palette (`--accent`, `--highlight`), the light/dark
  surface/text/border families, radius, motion, and the `--svg-*` tokens.
- The Geist fonts load from Google Fonts.
- Both are **render-blocking runtime fetches** with **no local fallback and
  no `var()` fallbacks anywhere**. Offline / in CI / brand-site-down /
  upstream token *rename* → `--accent` (101 uses), `--ease` (48 uses) and
  all text/border/bg tokens silently collapse to initial values. No build
  error; no guard can see it. A brand-side rename is an **undetectable**
  breakage for this app.

### Decision

**Vendor a pinned copy + self-host the fonts.**

### Work

- Vendor a pinned copy of the brand `tokens.css` into the repo (e.g.
  `frontend/src/styles/brand/tokens.css` or `public/`), load it locally
  instead of the remote URL in `index.html`.
- Self-host the Geist fonts (woff2 in the repo; local `@font-face`).
- Add a **sync script** to refresh the vendored copy from upstream, and
  document the refresh cadence / how to run it.
- Point `scripts/check-css-vars.mjs`'s `BRAND_TOKENS` allowlist at the
  **vendored token list** instead of hand-mirroring it (so the guard stays
  in sync automatically).
- *Optional:* add `var(--accent, #3E93AE)`-style fallbacks on the most
  critical tokens as belt-and-suspenders.

### Acceptance

- `index.html` no longer render-blocks on `bldgtyp.github.io` or Google
  Fonts; the app renders fully **offline** and in CI with correct brand
  colors + fonts.
- A documented sync script exists; `check-css-vars` sources its brand
  allowlist from the vendored file.
- `make ci` green; a brand-asset snapshot/visual check confirms parity.

## Item 2 — Reconcile the docs with bespoke-CSS reality (Theme 10)

### Problem

`context/UI_UX.md` §"BLDGTYP design system" and PRD §12 prescribe
**Tailwind + shadcn/ui** with theme tokens wired to the brand vars. The app
is actually **hand-written plain CSS, no Tailwind, no shadcn**, on a 3-tier
custom-property token system. The stale prescription (a) misleads new
contributors and (b) is the source of the shadcn-vocabulary "ghost tokens"
(`--surface`, `--border`, `--danger`, `--font-sans`, `--text-on-accent`)
that the P0 correctness pass had to chase down.

### Decision

**Update the docs to describe the bespoke-CSS reality. No migration to
Tailwind/shadcn.**

### Work

- Rewrite `context/UI_UX.md` §design-system to describe the actual
  hand-written plain-CSS + 3-tier token model (L1 brand / L2
  `styles/tokens.css` / L3 feature), the guard suite, and the
  sanctioned-hex rule.
- Update PRD §12 to drop the Tailwind/shadcn prescription.
- Cross-reference the P3 `styles/README.md` once it exists (the token +
  shared-class catalog).

### Acceptance

- `UI_UX.md` §design-system and PRD §12 match the bespoke-CSS reality; no
  remaining Tailwind/shadcn prescription.
- No new ghost-token vocabulary introduced.

## Sequencing

Item 2 (doc reconciliation) is small and can ship first / independently.
Item 1 (vendoring) is the substantive change; do the fonts + tokens
together so `index.html` drops both remote fetches at once.
