---
DATE: 2026-06-24
TIME: 18:25 EDT
STATUS: Blocked (Phase 2 here)
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Phase 3 — rewire the heat-pumps frontend onto the generic table-write client.
RELATED: ../PRD.md, context/technical-requirements/data-table.md,
         frontend/src/features/equipment/ (Ventilators/Pumps = the target pattern)
DEPENDS_ON: Phase 2 (backend heat-pumps on the generic contract, old endpoint still alive).
---

# Phase 3 — Frontend Heat-Pumps Rewire (cross-stack closeout)

## Goal
Heat-pumps editing uses the same generic table-write client and `<DataTable>`
plumbing as every other equipment table. The bespoke
`src/features/equipment/heat-pumps/{api,payload-builders}.ts` is removed or
reduced to declarative column/field-def config — matching how
`VentilatorsTable` / Pumps are wired.

## Background (verified 2026-06-24)
`src/features/equipment/heat-pumps/` has its own `api.ts`, `payload-builders.ts`,
and `types.ts`, distinct from the shared equipment-table write pattern. The
generic table-write client used by the other tables lives alongside
`features/equipment/api.ts` + `features/project_document/` hooks; Ventilators is
the reference (`features/equipment/components/VentilatorsTable.tsx`).

## Changes
- Point the four heat-pump leaf tables at the generic table-write client (the one
  Ventilators/Pumps use), driven by the field-def registry the backend now
  serves uniformly.
- Replace `heat-pumps/payload-builders.ts` (bespoke patch payloads) with the
  generic table-replace payload path; keep only heat-pump-specific column/field
  config (`*-columns.tsx`, `field-defs.ts`, `option-helpers.ts`).
- Reconcile `heat-pumps/types.ts` with the generated API types where the wire
  shape changed; regenerate the OpenAPI client if used.
- Preserve the heat-pumps UX (cascade confirmation on delete, dry-run preview) on
  the generic client — the backend exposes these as generic capabilities (Phase
  2), so the frontend consumes them through the shared affordance, not a bespoke
  one.
- **Remove the old heat-pumps backend endpoint** (kept alive through Phase 2) once
  the frontend no longer calls it.

## Step sequence
1. Rewire reads/writes for one heat-pump leaf table onto the generic client;
   verify in-app (Equipment tab) against a seeded project.
2. Roll the remaining three leaf tables.
3. Wire cascade-confirm + preview through the generic affordance.
4. Delete the bespoke `api.ts`/`payload-builders.ts`; remove the dead backend
   endpoint.

## Acceptance criteria
- No bespoke heat-pumps write client remains (only declarative column/field
  config); heat-pumps matches the Ventilators/Pumps wiring.
- Editing heat-pumps in the Equipment tab works end-to-end: add/edit/delete,
  delete-cascade confirmation, dry-run preview, ETag conflict handling — via the
  shared client.
- Old heat-pumps backend endpoint removed; `grep` clean across BE + FE.
- `make ci` (frontend + backend) green; `pnpm run format` clean; manual
  Equipment-tab smoke as Ed (the seed-project owner) passes.

## Risks
- Behavior parity in the UI (cascade/preview affordances). Mitigation: smoke the
  Equipment tab against the seed project before deleting the bespoke client.
- Generated-client drift if OpenAPI types are regenerated — run the type
  generation and fix call sites in the same PR.
