---
DATE: 2026-06-14
TIME: (local, evening)
STATUS: Complete & archived (2026-06-14). §1, §2, §4, and the §3 .css size cap
  shipped; the §3 color-guard sweep + the design-pass items were carved out.
AUTHOR: Claude Code (Opus 4.8) + Ed May
SCOPE: P3 work items, evidence, and acceptance criteria
RELATED:
  - ./README.md
  - ./STATUS.md
  - ../../features/css-token-guard-sweep/  (carved-out §3 color sweep + design pass)
  - ../../code-reviews/2026-06-14/frontend-css-styling-review.md
---

# P3 — Structure & Discoverability — PRD

> **Outcome (2026-06-14, archived):**
> - **§1 Discoverability — DONE.** `styles/README.md` + `shared/ui/index.ts`.
> - **§2 Structure — DONE.** One import strategy, 6 double-imports removed,
>   leaked CSS promoted, InlineHeaderNameEditor inverted (to a
>   `data-reveal-edit-on-hover` opt-in), first `base.css` split landed +
>   written plan for the rest.
> - **§3 Guards — PARTIAL.** The `.css` size cap shipped. The `check:hex` →
>   `rgb/hsl`/`.ts` extension + color-literal tokenization were **carved out**
>   to [`../../features/css-token-guard-sweep/`](../../features/css-token-guard-sweep/)
>   (not visually neutral; needs per-literal verification + sanctioned-palette
>   decisions the original review under-scoped).
> - **§3 design-pass items / §4 acceptance — split.** §4 doc reconciliation
>   (TECH_STACK + UI_UX cross-link) **DONE**; the spacing/type/radius scale
>   tightening **carved out** to the same follow-up (needs Ed's eye).

Source: 2026-06-14 CSS review, Theme 7 (architecture/structure, MED),
Theme 9 (discoverability, HIGH for owner goal #3), backlog items 9–10.
All line counts/usages below are from that review; **re-grep before
acting** — Phase 7 shifted some line numbers (but did not touch `base.css`
or `DataTable.css`).

## Problem

A new feature author has **no map** to the standard styles, and the CSS
load/ownership story is tangled:

- No `src/styles/README`, no token catalog, no `src/shared/ui/index.ts`
  barrel, no index of which classes live in `base.css`. Components without
  their own CSS (`AppMenu`, `AppSubTabs`, `AutocompleteSelect`,
  `ModalDialog`, `DialogActions`, …) emit class strings that silently
  resolve into `base.css` with no pointer. Finding the right token/class is
  a grep exercise.
- `base.css` is a **~1,967-line god-stylesheet** (resets + the *entire*
  shared component library + page layouts + responsive), uncapped and
  undocumented as the de-facto shared home. `DataTable.css` is **2,830
  lines**.
- **Three import conventions coexist** and **6 sheets are double-imported**
  (both `@import` in `App.css` *and* a component TS `import`):
  `auth-page.css`, `catalogs.css`, `DataTable.css`, `equipment.css`,
  `project_status.css`, `version-controls.css`.
- **Shared utilities leak into feature files** (dependency inversion):
  `.sr-only` is defined in `equipment.css:1` but used by ~7 files; a shared
  ~11-selector panel-border recipe lives in `auth-page.css:11-25`;
  `InlineHeaderNameEditor.css:49-56` hardcodes *feature* ancestor selectors
  (`.assembly-header:hover`, `.apertures-page__header:hover`);
  `TablePrimitiveStub.tsx` couples to `DataTable.css`; `attachments.css` is
  imported from **5 sites across 3 features** via `../../` paths but filed
  under the `assets` feature.

## Goals / Work items

### 1. Discoverability (Theme 9)

- **`frontend/src/styles/README.md`** (or `STYLING.md`):
  - The L1 (vendored brand, `styles/brand/`) / L2 (`styles/tokens.css`) /
    L3 (feature) tier map.
  - The **token catalog** with intent for every scale: `--space-*` (2px-base),
    `--fs-*` (8-step type), radius (`--radius-xs/sm/md/pill`,
    `--phn-control-radius`), shadow (`--shadow-elev-*`, `--shadow-popover`,
    `--shadow-hud-*`), `--z-*`, semantic `--phn-*`, `--chart-*`,
    `--report-status-*`, `--info-tooltip-*`, `--svg-*`, the data-table
    tint cascade, etc.
  - The **shared-class catalog**: what lives in `base.css` (buttons, pills,
    `.chip`, tabs, the three menu systems, forms, tooltip) and in
    `shared/ui/*` (report-table, info-tooltip, canvas, dimensions).
  - A **"how to style a new feature" recipe**.
- **`frontend/src/shared/ui/index.ts` barrel** aggregating the shared UI
  components.
- **Propagate the `report-table/` co-located pattern** (co-located CSS +
  barrel + PRD/doc ref) across `shared/ui`. `info-tooltip/` already follows
  it; bring the rest in line.
- **Cross-link the styles README from `context/UI_UX.md`
  §"BLDGTYP design system"** once it lands. (Carried over from P4 / Theme
  10: that doc-reconciliation pass left a placeholder pointer pending the
  README's existence — see §4.)

### 2. Structure (Theme 7)

- **Pick ONE CSS import strategy** and apply it: recommended — global/shared
  sheets `@import`ed once in `App.css`; feature sheets TS-imported once each.
  **Remove the 6 double-imports.**
- **Promote genuinely-shared CSS out of feature files**: `.sr-only`, the
  `auth-page.css` panel-border recipe, and `attachments.css` (→
  `shared/ui/attachments/`). **Invert** the `InlineHeaderNameEditor.css`
  shared→feature ancestor selectors. Decouple `TablePrimitiveStub.tsx` from
  `DataTable.css`.
- **Begin splitting `base.css` and `DataTable.css`** into sectioned files
  (land at least the first split + a documented plan for the rest).

### 3. Guard / scale follow-ups (deferred from P0.3 — do them here)

These were deferred because they turn *pre-existing* literals red, so they
must land *with* the split/sweep that cleans those up:

- Extend `check:hex` to `rgb()/rgba()/hsl()`/named colors **and** to `.ts`
  files, exempting the sanctioned colour modules
  (`model_viewer/lib/colors.ts`, `model_viewer/lib/themes.ts`,
  `data-table/lib/options/create.ts`).
- Add a **`.css` line-size cap** (`check:file-sizes` currently covers only
  `.ts/.tsx`), with a `@size-exception` escape hatch.

**Adjacent design-pass items (optional, need Ed's eye since they shift
sizes):** tighten the spacing + type scales (drop rarely-used steps); fold
the remaining literal radii (`3/7/9/10/12px`) into tokens.

### 4. Doc-reconciliation tail (carried over from P4 / Theme 10)

P4 (`../../archive/css-brand-dependency-resilience/`, **done & archived**)
reconciled `context/UI_UX.md` §design-system and PRD §12 to the
bespoke-CSS reality and dropped the Tailwind/shadcn prescription. Two
small tails were left for this folder because they depend on P3 work:

- **Reconcile `context/TECH_STACK.md`.** Its "UI kit"
  (`shadcn/ui + Tailwind`), "Design tokens", and "Tables"
  (`shadcn-table primitives`) rows, plus the Table-View section
  (`§ "Prefer shadcn/ui primitives"`, the map-Tailwind-to-tokens steps),
  still prescribe Tailwind/shadcn. P4 flagged these as **superseded** via
  a note in PRD §12 but deferred the rewrite — `TECH_STACK.md` carries
  detailed table-primitive tradeoff text that needs a careful pass.
  Rewrite those rows/section to the plain-CSS + 3-tier-token + Radix
  reality; introduce no shadcn-vocabulary ghost tokens.
- **Add the `context/UI_UX.md` cross-link** to the new
  `styles/README.md` (see §1) — the placeholder pointer P4 left.

Acceptance: no remaining Tailwind/shadcn *prescription* in `TECH_STACK.md`
(historical "why we didn't pick X" discussion may stay if clearly
labeled); `UI_UX.md` §design-system links the styles README.

## Out of scope

- Re-platforming to Tailwind/shadcn (explicitly NOT planned — see the
  archived brand-dependency-resilience feature / Theme 10).
- The brand-token vendoring + the `UI_UX.md`/PRD §12 doc reconciliation —
  **done** in P4 (`../../archive/css-brand-dependency-resilience/`). The
  remaining `TECH_STACK.md` tail is folded in here as §4.

## Acceptance criteria

- A new feature author can find the right token/class **without grep**: the
  styles README exists with token + shared-class catalogs and a "how to
  style a new feature" recipe.
- `shared/ui/index.ts` barrel exists; the co-located pattern is the norm.
- One documented import strategy; **zero double-imported sheets**; the
  leaked shared CSS lives in `shared/`.
- `base.css` + `DataTable.css` split into navigable sections (or first split
  landed + a written plan for the remainder); a `.css` size guard is in CI.
- `check:hex` covers `rgb/rgba/hsl`/named + `.ts` (with the sanctioned
  exemptions).
- **(§4 tail)** `TECH_STACK.md` no longer *prescribes* Tailwind/shadcn;
  `UI_UX.md` §design-system links the styles README.
- `make ci` green; any visually non-neutral change browser-verified.

## Suggested sequencing

Discoverability docs first (pure addition, zero risk) → import-strategy +
shared-CSS promotion → guard extensions landed together with the literal
cleanup → `base.css`/`DataTable.css` splits last (largest, highest churn).
