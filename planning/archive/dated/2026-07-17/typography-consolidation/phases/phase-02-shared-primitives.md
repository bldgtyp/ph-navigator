---
DATE: 2026-07-17
TIME: afternoon ET
STATUS: ✅ Done 2026-07-17 (all 65 shared-owner fingerprints retired; baseline 436 → 371 decls; D1/D2 applied; make ci green)
AUTHOR: Codex
SCOPE: Global resets, app shell, shared headings/buttons/forms/tabs/menus, and
  modal typography
DEPENDS_ON: Phase 1
RELATED:
  - `../PRD.md`
  - `../TYPOGRAPHY-CONTRACT.md`
---

# Phase 2 — Shared primitives and app chrome

## Goal

Normalize the highest-reuse global owners once, then make features consume
those roles instead of reopening shared typography later.

## Primary owners

- `frontend/src/styles/reset.css`
- `frontend/src/styles/base.css`
- `frontend/src/styles/base-responsive.css`
- `frontend/src/styles/modals.css`
- shared components whose class contracts must change with those styles

## Build

1. Define the shared button tiers from the PRD: action, compact chrome, text,
   and icon-only. Preserve color/border semantics; this phase changes type and
   class ownership only.
2. Define shared visual heading roles independent of `h1`–`h4` semantics:
   page/section, display/empty-state, and editor-hero.
3. Normalize app topbar, brand, navigation, tabs, menus, save state, form
   labels/controls, chips, and common metadata to approved roles.
4. Apply D1 to modal titles and make modal body, labels, controls, captions,
   and actions reuse the same roles used outside dialogs.
5. Apply D2 to the sign-in display heading through its named token/role.
6. Remove obsolete per-selector typography declarations once a parent/shared
   role owns the value. Do not create generic one-property utility classes.
7. Remove only resolved Phase 2 fingerprints from the debt baseline.

## Verification

- Static guard reports no new debt and no stale Phase 2 baseline entries.
- Focused computed-style audit: sign-in, dashboard, dashboard new-project
  modal, admin invite modal, and recovered-draft modal.
- Screenshots: desktop and responsive dashboard/topbar; sign-in; one ordinary
  modal and one destructive/confirmation modal.
- Check wrapping, button width, input height, modal title/body hierarchy,
  topbar height, and active-tab layout.
- `make frontend-dev-check` during iteration; `make format` and `make ci` at
  phase closeout.

## Done when

Shared controls and modal chrome have one role contract, buttons are reduced
to the approved tiers at their owning layer, and these owners need no further
typography edits in later phases.
