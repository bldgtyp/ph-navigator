# STATUS — aperture-psi-install

**State:** 🟢 PHN side complete — phases 01–06 implemented and Ed's phase-05
UI review closed 2026-08-15 (five rounds of polish on
`feature/aperture-psi-install`). One gate remains, Ed's:

1. **Phase 07** (GH client, `honeybee_grasshopper_ph_plus` repo) is gated on
   deploying phase 02's route-3 changes to production — deploys are Ed's
   call, never an agent's.

The packet stays in the active planning area until phase 07 closes.

**Accepted design:** `decisions.md` (D-1…D-10) is the authority; PRD.md holds
the rationale + wireframe; research.md holds all code citations.

## Phase ledger

| Phase | Repo | State | Evidence |
| --- | --- | --- | --- |
| 01 Schema v10: table, slots, classification | PHN backend | ✅ Done 2026-08-03 | `feature/aperture-psi-install`; v9→v10 migration + corpus fixtures (phius 0.052 / phi 0.04); 1850 backend tests green incl. new edge-classification + install-types suites; as-built notes in phase doc |
| 02 Resolution, commands, route 3 | PHN backend | ✅ Done 2026-08-04 | `feature/aperture-psi-install`; resolver (mull→assigned→default) + 3 commands + hygiene + route-3 `installs` block + uniform frame default + U-value edge wiring + slice summaries; REST spot-check on AGENT-BROWSER fixture (draft discarded); backend suite + frontend dev-check green |
| 03 Installs sub-tab | PHN frontend | ✅ Done 2026-08-04 | `feature/aperture-psi-install`; fifth sub-tab + DataTable page (TB recipe, shared helpers extracted); 15th table-regression case (smoke + cell-behavior green); route-union 500 fixed + locked by test; screenshot `working/agent-browser/installs-subtab-phase03.png` |
| 04 Effective-value display | PHN frontend | ✅ Done 2026-08-04 | `feature/aperture-psi-install`; TS mirrors (paired suites + reciprocal backend pointers); element card gained a dedicated 6th `Ψ-inst` column (assigned/default/mull states, muted inheritance); U-Values Ψ-INSTALL column verified live; screenshots `frame-row-psi-phase04.png` + `u-values-psi-phase04.png` |
| 05 Installs modal (+ Ed's UI review) | PHN frontend | ✅ Done 2026-08-04; review closed 2026-08-15 | `feature/aperture-psi-install`; `InstallsModal` (key-view overlay on the phase-04 resolver, paint/clear, apply-all, copy-to popover, inline unit-aware create via shared payload builders); vitest overlay suite + e2e paint/persist spec green; screenshots `working/agent-browser/installs-modal-phase05.png` + `installs-modal-phase05-painted.png`; as-built notes in phase doc. **Ed's review (2026-08-15)** added: staged edits with a real Cancel (`installs-draft.ts`, written on Save), edit-in-place, frame-tracing tint bands, tool placement + Default vocabulary, project-wide usage in the row editor, app-standard tooltips, and a scrolling type list with a pinned footer |
| 06 Documentation integration + docs sync | PHN both | ✅ Done 2026-08-04 | `feature/aperture-psi-install`; Installs group in the documentation summary (via `_aperture_table` `status_source` param) + `ROWS_KEY_BY_TABLE` write entry + contractor-directions copy; context docs synced (apertures-tab §2.6.4, GLOSSARY, data-model v10); backend summary test + e2e deep-link test green; screenshot `working/agent-browser/documentation-installs-phase06.png`; as-built notes in phase doc |
| 07 GH client per-edge fidelity | honeybee_grasshopper_ph_plus | Not started — gated on 02 deployed | — |

## Coordination

- **Upstream refactor SHIPPED 2026-08-12** — honeybee-ph v1.33.33 + PHX v1.56.73 released;
  GH components merged (canvas step pending, Ed). Landing zone for phase 07: `PhApertureInstallType` + per-edge aperture slots + resolver (primary:
  `honeybee_ph/planning/refactor/aperture-psi-install.md`), PHPP per-row Ψ-install, WUFI/METr
  export-time window-type variant synthesis. Mapping for the GH client:
  [`upstream-alignment.md`](upstream-alignment.md). Phase 07 is now additionally sequenced
  behind the honeybee_ph → PHX → honeybee_grasshopper_ph releases.
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
