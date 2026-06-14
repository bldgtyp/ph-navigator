---
DATE: 2026-06-14
TIME: (local, afternoon)
STATUS: Active
AUTHOR: Claude Code (Opus 4.8) + Ed May
SCOPE: Frontend CSS/styling consolidation following the 2026-06-14 review
RELATED:
  - ../../code-reviews/2026-06-14/frontend-css-styling-review.md  (canonical findings + P0–P4 backlog)
  - ../../code-reviews/2026-06-14/scopes/  (six per-module detail reports)
  - phases/phase-07-canvas-extraction.md  (next pickup — handoff)
---

# CSS Rationalization

Execution surface for the styling cleanup that came out of the
**2026-06-14 frontend CSS/styling review**. The review doc is the
canonical findings + the full P0–P4 remediation backlog; this folder
tracks what's been done and what's next.

## Why this exists

The review found the foundation was sound (3-tier token system, enforced
z-index contract, exemplary axis-tint subsystem, disciplined inline
styles) but real "drift" had accumulated: undefined-variable bugs,
guard gaps, token scales defined but unused, ~12 reinvented chips, and a
remote brand-token dependency. We are working it phase by phase.

## Status at a glance

| Phase | What | State |
|-------|------|-------|
| **P0 — Correctness** | Fix 7 (→8) undefined `var()`s, define unstyled classNames, add `check-css-vars` guard | ✅ **Merged to main** (`177f67bb`) |
| **P1 — Token scales** | Tokenize shadows/radius/spacing (neutral); 2px-base spacing scale; 8-step type scale; radius xs/md | ✅ **Merged to main** (`21a89165`, `ab8a01ff`) |
| **P2.6 — Chip primitive** | `.chip` + variants; migrate 6 chips | ✅ **Merged to main** (`f274585b`, `32839dc0`) |
| **P2.8 — SVG/3D color** | SVG strokes → `--svg-line-heavy`; 3D palette assessed | ✅ **Merged to main** (`32839dc0`, `fd10e996`) |
| **P2.7 — Canvas extraction** | Extract shared apertures/envelope drawing widgets | ⏸ **Active / next** → [phase-07](phases/phase-07-canvas-extraction.md) |
| **P3 — Structure & discoverability** | styles README, `shared/ui` barrel, import strategy, split god-stylesheets | 🔜 Planned (see below) |
| **P4 — Strategic** | Vendor brand tokens/fonts; reconcile Tailwind/shadcn docs | 🔜 Decided, not built (see below) |

`origin/main` is at **`fd10e996`** with all merged phases above. CI is
green (`make ci`).

## Recurring lesson from P0–P2

**The review over-flagged some "duplication."** P0/P1's correctness +
tokenization work absorbed much of what looked like P2 duplication, and
two items were *intentional*, not drift:
- The model-viewer 3D color-by palettes are **domain-standard
  Honeybee/Ladybug colors** — left independent on purpose.
- Most chips were already tokenized after P1 and are **semantically
  distinct** — the `.chip` primitive is a reusable base, not a
  one-look collapse.

➡️ **For every remaining phase: diff/measure before consolidating.** Do
not assume the review's duplication estimate; confirm it, and prefer
visually-neutral changes (verify any non-neutral change in the browser).

## Next: Phase 7 — canvas widget extraction

The remaining P2 item and the next pickup. It is a **larger, higher-risk
refactor of the two core drawing UIs** (apertures + envelope), so it gets
its own branch + interaction-level verification. Full handoff:
[phases/phase-07-canvas-extraction.md](phases/phase-07-canvas-extraction.md).

## P3 — Structure & discoverability (owner's goal #3)

Not yet started. From the review backlog:
1. `src/styles/README.md` — token catalog (L1/L2/L3, the scales) + the
   shared-class catalog (what lives in `base.css`) + "how to style a new
   feature." Add a `src/shared/ui/index.ts` barrel. Propagate the
   `shared/ui/report-table/` co-located pattern (the gold standard).
2. Pick one CSS import strategy (today: `App.css` `@import` for some,
   component TS-import for others, **6 sheets double-imported**). Promote
   genuinely-shared CSS out of feature files (`.sr-only` in
   `equipment.css`; the panel recipe in `auth-page.css`; invert the
   `InlineHeaderNameEditor.css` shared→feature selectors). Begin splitting
   the `base.css` god-stylesheet (~2,000 lines) and `DataTable.css`
   (2,830 lines).

## P4 — Strategic (decided 2026-06-14, not yet built)

1. **Vendor + self-host** a pinned copy of the brand `tokens.css` and the
   Geist fonts (currently render-blocking runtime fetches from
   `bldgtyp.github.io` + Google Fonts with no fallback). Add a sync
   script. Then `check-css-vars.mjs`'s `BRAND_TOKENS` allowlist can import
   the vendored list instead of mirroring it by hand.
2. **Reconcile the docs:** update `context/UI_UX.md` §design-system and
   PRD §12 to describe the bespoke-CSS reality (drop the Tailwind/shadcn
   prescription — not migrating).

## Deferred guard/scale follow-ups (small, do when convenient)

- Extend `check:hex` to `rgb()/rgba()/hsl()`/named colors and to `.ts`
  files (exempt the sanctioned colour modules: `model_viewer/lib/colors.ts`,
  `themes.ts`, `data-table/lib/options/create.ts`). Add a `.css` line-size
  cap. These were deferred from P0.3 because they'd turn pre-existing
  literals red — do them *with* the sweep/split that cleans those up.
- Tighten the spacing + type scales (drop rarely-used steps) — a design
  pass with Ed's eye, since it shifts sizes.
- Fold the remaining literal radii (`3/7/9/10/12px`) into tokens.

## Verification environment (shared by all phases)

See phase-07 for the full browser-verification setup; the short version:
seed a **codex-owned** project so the agent account can see project pages
(`make seed-agent-user` then `seed_dev_db --reset --email codex@example.com`),
sign in as `codex@example.com` / `password`, and use Playwright MCP. Gate
every change with `make format` + `make ci` from the repo root.
