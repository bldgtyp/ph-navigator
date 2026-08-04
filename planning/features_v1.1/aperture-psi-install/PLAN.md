# PLAN — aperture-psi-install implementation sequence

```
DATE:    2026-08-03
TIME:    11:55
STATUS:  Accepted — phases 01–02 complete 2026-08-03/04
         (feature/aperture-psi-install); 03–07 not started
AUTHOR:  Ed + Claude
SCOPE:   Phase map, ordering constraints, and cross-packet coordination.
RELATED: decisions.md, phases/,
         ../../archive/dated/2026-08-03/status-ux-unification/PLAN.md
```

## Phase map

| Phase | Repo | Scope | Depends on |
| --- | --- | --- | --- |
| 01 Schema v10 — table, slots, classification | PHN backend | `aperture_install_types` table + seeds, `ApertureElementInstalls`, edge-classification helper, migration, attachment registry, drift-guard entries | — |
| 02 Resolution, commands, route 3 | PHN backend | effective-Ψ resolver, `setElementInstall` + bulk commands, grid-mutation slot hygiene, route-3 `installs` block, U-value report wiring, slice payload | 01 |
| 03 Installs sub-tab | PHN frontend | fifth Apertures sub-tab, DataTable page (TB clone), PDF attachment column, `?focus=` | 01–02 |
| 04 Effective-value display | PHN frontend | frontend mirror of classification/resolution, `FrameRow` third cell, U-Values panel verification | 02, 03 |
| 05 Installs modal | PHN frontend | key-view modal: tint, paint, bulk apply, copy-to, inline create | 02–04 |
| 06 Documentation integration + docs sync | PHN both | `DocumentationTable` entry, directions copy, context docs, e2e | 03 (05 for screenshots) |
| 07 GH client per-edge fidelity | honeybee_grasshopper_ph_plus | parse `installs`, apply psi per-edge after dedup, fallback hygiene | 02 deployed |

Each phase is a separate feature-branch unit with its own closeout gate
(`simplify` skill → `docs-pass` skill → `make format` → `make ci`). Phases
01–02 can share a branch if convenient; 03–05 are separate UI branches.
Phase 07 lives in the other repo and follows its conventions.

## Ordering constraints & coordination

- **status-ux-unification** completed and archived 2026-08-03. Do not recreate
  retired `status_summary.py` or its frontend destination (D-9). Do not add
  any new axis vocabulary; all status UI must use the current shared status
  field and controls.
- **Route 3 is never broken** (D-5): `frame_type.psi_install_w_mk` carries
  the uniform Default from phase 02 onward; the `installs` block is additive.
  Phase 07 can land any time after phase 02 reaches the dev/prod server the
  GH user points at.
- **Schema bump** is v9→v10 exactly once (phase 01). Phases 02+ must not
  bump again — everything they store fits the phase-01 shapes.
- The PHX/honeybee_ph upstream bugs are **not in any phase** — see
  `phx-bug-handoff.md` (Ed hands to the PHX agent).

## Verification spine (all phases)

- Backend: pytest per feature dir; migration round-trip test on a seeded
  v9 fixture; `make ci` green.
- Frontend: vitest component tests; e2e where the phase doc says so;
  `make frontend-dev-check` for UI-only phases, `make ci` before merge.
- UI phases: agent-browser screenshots (`make agent-browser-ready`, then
  `node scripts/agent-browser.mjs /projects/<id>/apertures/... --out ...`)
  attached to the phase ledger in STATUS.md.
