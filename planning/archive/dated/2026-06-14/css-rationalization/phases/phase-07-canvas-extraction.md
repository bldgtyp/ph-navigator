---
DATE: 2026-06-14
TIME: (local, afternoon)
STATUS: Complete — squash-merged to main 2026-06-14; feature archived
AUTHOR: Claude Code (Opus 4.8) + Ed May
SCOPE: P2 item 7 — extract shared apertures/envelope drawing widgets
RELATED:
  - ../README.md  (see "Phase 7 outcome" for what shipped)
  - ../../../code-reviews/2026-06-14/scopes/scope-D-apertures-envelope.md  (original duplication analysis)
  - ../../../code-reviews/2026-06-14/frontend-css-styling-review.md  (Theme 6)
---

# Phase 7 — Canvas widget extraction (HANDOFF)

> **DONE 2026-06-14 on branch `css-p2-canvas` (off `main` `61aba28b`).**
> Four genuinely-shared widgets extracted (InfoTooltip, canvas hover-hint
> tooltip, canvas toolbar, dimension delete button); sidebar roster +
> dimension input/hooks left feature-specific by design. All four commits
> `make ci`-green + Playwright-verified on both canvases. See the **Phase 7
> outcome** section in `../README.md` for the commit list and decisions.
> The handoff text below is preserved as the original plan/method.

## Goal

The apertures and envelope features each render a technical SVG drawing
UI, and the review (Theme 6 / scope-D) found they are **~70% structurally
parallel** — built twice, split only by class prefix. Extract the
**genuinely-shared** pieces into `frontend/src/shared/ui/canvas/` (or
extend `shared/ui/dimensions/`, which already exists), so both features
consume one implementation.

## ⚠️ Read this first — method

This session repeatedly found the review **over-flagged** duplication
(the 3D palette was domain-standard; most chips were already tokenized
and semantically distinct). **Do not assume 70%.** For each candidate:

1. **Diff the two implementations** before extracting. Some pairs may be
   parallel-but-meaningfully-different (different interaction models,
   data shapes, edit affordances) — those should NOT be force-merged.
2. Extract only the **genuinely-identical** structure/markup/CSS. Keep
   feature-specific differences as props or composition.
3. Prefer **visually + behaviourally neutral** extraction (same DOM,
   same classes, same handlers — just relocated/shared). Verify any
   non-neutral change in the browser.
4. Work **incrementally**: one widget per commit, each `make ci`-green
   and interaction-verified, so a regression is easy to bisect.
5. **Branch:** `git checkout -b css-p2-canvas` off `main` (`fd10e996`).
   This is the core drawing UI — higher risk than the rest of the
   cleanup; do not do it directly on `main`.

## Candidate shared widgets (verify each — lines have shifted post-P1/P2)

Parallel component pairs (confirmed to exist as separate files):

| Apertures | Envelope | Notes |
|-----------|----------|-------|
| `ApertureSidebar.tsx` | `EnvelopeSidebar.tsx` | roster list + collapse |
| `ApertureCanvasOverlay.tsx` | `AssemblyCanvasOverlay.tsx` | overlay layer |
| `ApertureSvgCanvas.tsx` | `AssemblySvgCanvas.tsx` | the SVG drawing |
| `ApertureCanvasToolbar.tsx` / `ZoomCluster.tsx` | toolbar in `AssemblyCanvas.tsx` | zoom/pan/view controls |
| `HorizontalDimensionStrip.tsx` / `VerticalDimensionStrip.tsx` / `DimensionLabel.tsx` | envelope dimension UI | check overlap with existing `shared/ui/dimensions/DimensionChrome.css` |

CSS duplication (scope-D cited these; **re-grep — P1/P2 shifted all line
numbers**):
- The pseudo-element info tooltip is duplicated in `apertures.css` and
  `envelope.css`, **including a byte-identical `rgb(87 87 87 / 94%)`
  literal** — a clear dedup + tokenization win (consider a `--tooltip-bg`
  token or `--svg-text`-style token; it currently bypasses the shadow/
  color tokens).
- Canvas toolbar, sidebar roster, and dimension input/label/delete blocks
  are near-identical between the two stylesheets.

`shared/ui/dimensions/` already exists (only `DimensionChrome.css` today,
no `.tsx`) — the dimension strips may be the easiest first extraction and
the most-already-shared. Start there or with the tooltip (smallest, with
the identical literal).

## Verification environment

Project pages need data, and the agent account can't see ed-owned
projects, so seed a **codex-owned** project:

```bash
docker compose up -d db
make seed-agent-user                 # (re)create codex@example.com
cd backend && uv run python -m scripts.seed_dev_db --reset \
  --email codex@example.com --display-name "Codex Agent" --password password
```

Gotchas learned this session:
- `seed_dev_db --reset` **wipes app tables and logs out all sessions** —
  re-sign-in after running it.
- `make seed-hbjson` is **hardcoded to ed@example.com** and will fail for
  codex; the model viewer isn't needed for Phase 7, but if you want a
  model, upload `backend/seeds/*.hbjson` via the Model tab dropzone
  (Playwright `browser_file_upload`).
- Frontend on `http://localhost:5173`, backend on `:8000`. Sign in as
  `codex@example.com` / `password`. Use Playwright MCP with an isolated
  session (don't sign in as ed — single-active-session rule).

Routes (get the real project id from the dashboard "All projects" link):
- Apertures: `/projects/<id>/apertures`
- Envelope: `/projects/<id>/envelope/assemblies` and `/envelope/materials`

**Interactions to verify on BOTH canvases** (this is the real risk — not
just static rendering): zoom in/out + fit, pan, select an element, hover
highlight, inline name edit (`aperture-name-pill` becomes an input),
dimension-strip read/edit, delete dialog, add element, view-direction
toggle, sidebar collapse/expand. Take before/after screenshots per widget
and confirm identical rendering + working interactions.

## Gate (every commit)

From the repo root: `make format` then `make ci` (must be EXIT 0 —
backend + 1621 frontend tests + build + all guards incl. `check:css-vars`
and `check:hex`). The SVG strokes already use `var(--svg-line-heavy)`;
keep any new shared CSS token-driven (no raw hex — `check:hex` will catch
it in feature/shared CSS).

## Definition of done

- The genuinely-shared canvas widgets live once under `shared/ui/canvas/`
  (or `shared/ui/dimensions/`), consumed by both apertures and envelope.
- The duplicated tooltip (and its `rgb(87 87 87 / 94%)` literal) is
  deduped and tokenized.
- Both drawing UIs render identically and all listed interactions work.
- `make ci` green; changes verified in the browser; branch ready for the
  same review/merge flow as the earlier phases.
- Update `../README.md` status table and fold any decisions back.

## Explicitly NOT in scope

- Don't merge components that the diff shows are parallel-but-different.
- Don't touch the 3D viewer palette (domain-standard Honeybee colors —
  see review item 8).
- Leave the design-pass items (tighter spacing/type scales, remaining
  literal radii) and P3/P4 to their own phases.
