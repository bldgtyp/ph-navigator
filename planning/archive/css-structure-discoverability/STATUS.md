---
DATE: 2026-06-14
TIME: (local, evening)
STATUS: Complete & archived
AUTHOR: Claude Code (Opus 4.8) + Ed May
SCOPE: P3 final state
RELATED:
  - ./README.md
  - ./PRD.md
  - ../../features/css-token-guard-sweep/  (carved-out tail)
---

# STATUS — CSS Structure & Discoverability (P3)

**State:** Complete & archived (2026-06-14). Built, verified (`make ci` green +
sign-in page browser-checked), merged to `main`.

## Shipped

- **Discoverability (§1):** `frontend/src/styles/README.md` — the tier model,
  token catalog, shared-class catalog (which sheet owns which class), import
  strategy, "how to style a new feature" recipe, and the god-stylesheet split
  plan. `frontend/src/shared/ui/index.ts` barrel added (excludes the dead
  `TablePrimitiveStub`).
- **Structure (§2):** one import strategy — global/shared sheets `@import`'d
  once in `App.css`, feature sheets TS-imported once each; **the 6
  double-imports removed** (`DataTable.css` self-import dropped; `envelope.css`
  now TS-imported by `EnvelopePage`). Leaked shared CSS promoted: `.sr-only` →
  `reset.css`; the card-panel recipe + blueprint decoration → `styles/panels.css`
  (at the old `auth-page.css` cascade slot, so precedence is unchanged);
  `attachments.css` → `shared/ui/attachments/` (5 cross-feature TS imports
  dropped). InlineHeaderNameEditor's shared→feature ancestor selectors inverted
  to a `data-reveal-edit-on-hover` opt-in owned by the shared component.
- **First god-stylesheet split (§2):** `base.css` (2025 → 1879 lines) split into
  `reset.css` (resets + utilities) and `base-responsive.css` (`<=760px`),
  cascade-preserving. Remaining split is documented in the styles README.
- **`.css` size cap (§3 partial):** `check:sizes` now covers `.css` with a
  `@size-exception` escape hatch; the 5 oversized sheets carry markers.
- **Doc reconciliation (§4):** `context/TECH_STACK.md` no longer prescribes
  Tailwind/shadcn (UI-kit/Design-tokens/Tables rows + the design-system section
  rewritten to the vendored 3-tier + Radix reality); `context/UI_UX.md`
  §design-system cross-links the styles README, and three stale
  "shadcn Dialog/Sonner" references were corrected to Radix / D-06.

## Carved out → `../../features/css-token-guard-sweep/`

The judgment-heavy, non-visually-neutral tail that needs Ed's eye + per-literal
browser verification: tokenizing the ~24 `rgb/hsl` color literals, extending
`check:hex` to `rgb/hsl`/`.ts` (with sanctioned-palette exemptions the original
review under-scoped), and the spacing/type/radius scale design pass.

## Known follow-up

`TablePrimitiveStub.tsx` has zero importers (dead). Flagged, not deleted, per
the surgical-change rule. Recommend removing it in a future cleanup.
