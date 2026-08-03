# STATUS — aperture-psi-install

**State:** 🟢 Active — design accepted by Ed 2026-08-03; phased implementation
plans written for coding-agent handoff. **No implementation started.**

**Next step:** Pick up `phases/phase-01-schema-v10-install-types.md` on a
feature branch. Status UX unification is complete; skip the retired
`status_summary.py` and frontend destination work described by D-9.

**Accepted design:** `decisions.md` (D-1…D-10) is the authority; PRD.md holds
the rationale + wireframe; research.md holds all code citations.

## Phase ledger

| Phase | Repo | State | Evidence |
| --- | --- | --- | --- |
| 01 Schema v10: table, slots, classification | PHN backend | Not started | — |
| 02 Resolution, commands, route 3 | PHN backend | Not started | — |
| 03 Installs sub-tab | PHN frontend | Not started | — |
| 04 Effective-value display | PHN frontend | Not started | — |
| 05 Installs modal (⏸ Ed UI review after exit gate) | PHN frontend | Not started | — |
| 06 Documentation integration + docs sync | PHN both | Not started | — |
| 07 GH client per-edge fidelity | honeybee_grasshopper_ph_plus | Not started — gated on 02 deployed | — |

## Coordination

- **status-ux-unification** (completed and archived 2026-08-03):
  `status_summary.py` and its frontend destination are retired; do not
  recreate them in phases 01/03. No new evidence axes (D-7 here defers the
  pdf_report axis).
- **phx-bug-handoff.md**: 8 upstream PHX/honeybee_ph bugs found during
  research — Ed hands to the PHX-agent; not tracked in this packet's phases.
- Route 3 is never broken mid-rollout (D-5): old GH clients get uniform
  program-aware defaults; per-edge fidelity arrives with phase 07.

## Resolved history (2026-08-03 research)

- Granularity per-edge; library-table source; PHN resolves + emits effective
  values (GH 0.04 fallback becomes dead code).
- Program defaults verified: Phius 0.030 IP ≈ 0.052 W/m·K (mid-wall tiers
  0.020/0.015 IP; 0 at mulled sides, §1.4.4.6); 0.04 W/m·K is the PHI-side
  convention. Seed rule: D-4.
- Origin regression case: project 2524, 196 null `psi_install_w_mk` frames
  via route 3 (`HBPH+ - PH-Nav Get Apertures`) — phase-07 verification
  target.
