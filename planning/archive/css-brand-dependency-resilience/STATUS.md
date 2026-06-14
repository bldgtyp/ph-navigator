---
DATE: 2026-06-14
TIME: (local, evening)
STATUS: Complete — merged to main 2026-06-14. Archived.
AUTHOR: Claude Code (Opus 4.8) + Ed May
SCOPE: P4 final outcome
RELATED:
  - ./README.md
  - ./PRD.md
  - ../../features/css-structure-discoverability/  (inherited the TECH_STACK doc tail)
---

# STATUS — CSS Brand-Dependency Resilience (P4)

**State:** Complete. Both items built, verified (offline render + `make ci`
green), and merged to `main` 2026-06-14. Feature folder archived.

## Item 1 — Vendor + self-host the brand assets ✅

- Added `frontend/scripts/sync-brand-assets.mjs` (pnpm `sync:brand`): it
  vendors the brand `tokens.css` into
  `frontend/src/styles/brand/tokens.css` and downloads the Geist +
  Geist Mono `woff2` (latin + latin-ext, the weights `index.html`
  requested) into `frontend/src/styles/brand/fonts/`, generating
  `frontend/src/styles/brand/fonts.css`.
- `App.css` now imports `brand/tokens.css` + `brand/fonts.css` **first**
  (Layer 1, before `styles/tokens.css` so the app's `--font-primary`
  override still wins). `index.html` no longer links
  `bldgtyp.github.io` or Google Fonts — both render-blocking remote
  fetches are gone.
- `check-css-vars.mjs` now sources its brand-token allowlist by parsing
  the vendored `brand/tokens.css` (no more hand-mirrored Set), so it
  stays in sync with `sync:brand`.
- `frontend/.prettierignore` excludes `src/styles/brand/` so the
  vendored copy stays byte-stable against upstream.
- **Verified offline:** production preview served with computed
  `--accent` = `#3E93AE`, body font resolving to Geist, all 16 woff2
  served from `localhost/assets/`, and **zero** requests to
  googleapis / gstatic / bldgtyp.github.io.

## Item 2 — Reconcile docs with bespoke-CSS reality ✅

- Rewrote `context/UI_UX.md` §"BLDGTYP design system" to describe the
  hand-written plain-CSS + 3-tier token model, the vendored/self-hosted
  brand assets, the guard suite, and the sanctioned-hex rule. Dropped
  the Tailwind/shadcn prescription; corrected the stale "Outfit body
  text" guidance (the app pins `--font-primary` to Geist).
- Updated PRD §12 to drop Tailwind/shadcn and name the real stack
  (plain CSS + 3-tier tokens + Radix primitives), with a "Styling
  authority" note pointing at UI_UX.

**Refresh cadence:** on demand — run `pnpm run sync:brand`, review the
diff (esp. renamed/removed `--tokens`, which `check:css-vars` catches),
commit.

**Follow-up (out of scope here):** `context/TECH_STACK.md` still has
shadcn/Tailwind UI-kit + table-primitive rows; flagged as superseded in
PRD §12, but its own reconciliation pass (it carries detailed
table-view tradeoff text) is deferred. The P3
`css-structure-discoverability` `styles/README.md`, once it lands,
should be cross-linked from UI_UX §design-system.
