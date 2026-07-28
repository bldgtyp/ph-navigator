---
DATE: 2026-07-28
TIME: 09:17 EDT
STATUS: Active — Phases 1–2 complete; Phase 3 next
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Current state, next step, blockers, verification for aperture void panels.
RELATED: ./README.md, ./PRD.md, ./phases/
---

# STATUS — aperture void panels

## Current state

- 2026-07-28 — Feature packet drafted (PRD, decisions, phases 1–5) from a
  verified review of the aperture schema, command handlers, U-value service,
  both exports, the GH v1 client/schema, and the frontend builder surface.
  Trigger project: storefront unit S15 (doors extend below sidelite sills).
- Solid spandrel panels: deferred (decisions.md D-2, PRD §7); `kind` enum
  reserves the slot.
- 2026-07-28 — Ed resolved all open decisions: D-1 UI label **"Empty"** with
  explanatory tooltips; D-3 confirm-then-clear; D-4 near-fully transparent
  fill + dashed outline. PRD/decisions/phases updated to match.
- 2026-07-28 — Independent Opus review
  (`reviews/2026-07-28-plan-review.md`) verified against code and **folded
  in full** (all seven findings valid). Headlines: F-1 fully-void grid
  columns silently misplace geometry in GH → one-line GH-repo fix + permanent
  PHN route-3 422 guard ("zero GH changes" claim amended, decisions A-3);
  F-2 mullion-vs-jamb frame semantics at void boundaries → PRD §2.1, confirm-
  dialog copy + `mullion_frame_at_void_boundary` warning; F-3 `setElementKind`
  now batch `element_ids` + toolbar affordance (A-5); F-4 "allow holes"
  alternative recorded as rejected (A-4); F-5 all-void apertures get a
  `no_glazed_elements` warning + export 422; F-6 straddle-grows-voids
  documented + tested; F-7 pick/paste guard retargeted to
  `usePickPasteHandlers.ts` + paste-undo integrity fix.
- 2026-07-28 — Phase 1 implemented on
  `feature/aperture-void-panels`: backend schema/default/void invariant,
  `project_document.document` re-export, frontend wire/domain mirror and
  hydration, schema/coverage/legacy-default/MCP `replace_table` regressions.
  Focused backend suite: `79 passed, 1 skipped`; frontend TypeScript build:
  green. Full `make ci`: backend `1595 passed, 7 skipped`; frontend `245`
  files / `2294` tests passed, all structural guards and production build
  green.
- 2026-07-28 — Phase 2 implemented: atomic batch `setElementKind`,
  unconditional assignment clearing for Empty elements, server guards across
  operation/pick/paste, uniform-kind merge enforcement, kind-preserving
  merge/split, documented straddle growth and delete-to-all-void behavior,
  frontend command typing, and MCP dispatch coverage. Focused suite:
  `75 passed, 1 skipped`; simplify reuse/quality/efficiency review complete
  with all findings resolved. Full `make ci`: backend `1609 passed, 7
  skipped`; frontend `245` files / `2294` tests passed.

## Next step

Implement Phase 3 (`phases/phase-03-consumers.md`).

## Blockers

- None.

## Verification ledger

| Phase | Gate | Result |
| --- | --- | --- |
| 1 | focused backend + frontend type checks | `79 passed, 1 skipped`; TypeScript green |
| 1 | `make ci` | Green — backend 1595 passed; frontend 2294 passed |
| 2 | focused backend + frontend type checks | `75 passed, 1 skipped`; TypeScript green |
| 2 | `make ci` | Green — backend 1609 passed; frontend 2294 passed |
| 3–5 | `make ci` per phase | — |
| 4 | agent-browser smoke (S15 layout build) | — |
| 5 | Route-3 → GH schema parse + Rhino visual check (Ed) | — |
