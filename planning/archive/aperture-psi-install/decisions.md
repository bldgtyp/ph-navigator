# Decisions — aperture-psi-install

```
DATE:    2026-08-03
TIME:    11:55
STATUS:  Accepted by Ed 2026-08-03 ("confirm lean on all this — let's give it a
         try and see how the UI feels"). D-7/D-9 adjusted same day to fit the
         concurrently-accepted status-ux-unification refactor.
AUTHOR:  Ed + Claude
SCOPE:   Accepted design decisions the phase plans implement. Rationale lives in
         PRD.md / research.md; this file is the short authority.
RELATED: PRD.md, research.md, PLAN.md,
         ../../archive/dated/2026-08-03/status-ux-unification/
```

- **D-1 Granularity: per aperture-element edge.** Assignment slots live on the
  aperture element (`installs.top/right/bottom/left`), nullable. Downstream is
  per-edge end-to-end; `ProjectFrame` dedup rules out frame-row storage.
  (research.md §2–§5)

- **D-2 Library table, not raw numbers.** New project table
  `aperture_install_types`, row id prefix `apit_`, anatomy cloned from
  `thermal_bridges` (typed id/asset/status columns + seeded FieldDefs for
  name, Ψ value, source; custom fields allowed). Users assign types to edges;
  the number + Flixo PDF + status live once on the type row.

- **D-3 Interior (mulled) edges are derived Ψ=0.** Never stored, never
  assignable — computed by a pure edge-classification helper (grid geometry).
  Matches Phius §1.4.4.6 "0 at mulled sides". **Edges abutting `void`
  elements count as perimeter** (a void panel is an opening in the sash
  layout, its boundary is still an install edge) — revisit in phase-01 review
  if a real project contradicts this.

- **D-4 Program-aware Default row, seeded, editable.** Well-known row id
  **`apit_default`**, seeded in `templates.py` (new projects) and the v9→v10
  migration (existing projects) — both have `project.cert_programs` in the
  document body. Value: **0.052 W/m·K if `"phius"` ∈ cert_programs, else
  0.04** (PHI or unset). Editable like any row; delete-blocked. No automatic
  re-seed when cert_programs changes later (follow-up candidate: a mismatch
  hint in the Installs tab).

- **D-5 Route-3 contract: graceful degradation.**
  `frame_type.psi_install_w_mk` is always filled with the **project Default
  value (uniform)** — never per-edge-varying, because the current GH client
  dedupes frame elements by name and would silently misapply varying values.
  A new per-element-side **`installs` block** carries the true effective
  value (`{install_type_id, name, psi_install_w_mk, source}`, incl. 0 on
  interior edges). Old clients read `frame_type` and get real program-aware
  defaults (strictly better than today's fabricated 0.04); the updated client
  (D-10) reads `installs`. PHN phases are therefore **not blocked** on the GH
  client change.

- **D-6 UX shape.** (a) Element-card `FrameRow` third cell displays the
  effective Ψ-install (muted when inherited, `0 (mull)` on interior edges).
  (b) Library managed on a **fifth Apertures sub-tab named "Installs"**
  (standard DataTable page). (c) Assignment happens in a per-aperture
  **Installs modal** with a read-only key-view SVG: pick type → paint
  perimeter edges; bulk apply; copy-to-identical-grid apertures; inline type
  creation. (d) The builder canvas gets **no new events** in v1; the tested
  `onRegionClick` seam stays in reserve for a later lens mode.

- **D-7 Evidence tracking follows the TB precedent** (supersedes the PRD §5.3
  recommendation (a)). The install-type row carries `pdf_report_asset_ids`
  (Flixo, PDF-only) plus the standard datasheet/photo columns; Spec. Status
  is the human judgment "calculated + justified". **No new Documentation
  evidence axis** — the concurrently-accepted status-ux-unification packet
  (PRD §5 non-goals, D-4 there) fixes the three-axis model; a `pdf_report`
  axis would churn it. Follow-up candidate (jointly for thermal_bridges +
  installs) after that packet archives.

- **D-8 Referenced types are delete-blocked** (409 with per-type usage
  counts in the preview), matching required-`DependentLink` behavior. Slots
  are inside aperture elements (not a registry table), so the block is a
  custom check in the install-types replace path, not a `DependentLink`.

- **D-9 Status surfaces: minimal, coordinated.** Status UX unification is
  complete and `status_summary.py` is retired, so do not recreate its table or
  frontend destination. Add `aperture_install_types` to `STATUS_TABLE_NAMES`
  for the shared status FieldDef. The durable surface is a
  `DocumentationTable` entry (section "apertures"), which feeds the Overview
  meters automatically.

- **D-10 Cross-repo sequencing.** honeybee_grasshopper_ph_plus change
  (phase-07: read `installs`, apply psi per-edge after dedup) is required for
  per-edge *fidelity* in Rhino but does not gate any PHN phase (see D-5).
  The upstream PHX/honeybee_ph bugs (research.md §3.6) are handed off
  separately (`phx-bug-handoff.md`) and are not part of this feature.
