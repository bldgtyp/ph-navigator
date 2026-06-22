---
DATE: 2026-06-12
TIME: 17:05 EDT
STATUS: Deferred
AUTHOR: Codex
SCOPE: Router for v1.1 candidate features that are intentionally outside the current v1 scope.
RELATED:
  - planning/.instructions.md
  - planning/features/attachments/STATUS.md
---

# v1.1 Candidate Features

This folder holds deferred feature candidates for PH-Navigator V2 v1.1.
These are intentionally not part of the current v1 closeout scope.

Use the normal feature-folder shape for each candidate:

```text
planning/features_v1.1/<feature-slug>/
  README.md
  PRD.md
  STATUS.md
```

## Candidate Index

| Feature | Status | Current next step |
|---|---|---|
| [Model Viewer post-MVP](model-viewer-post-mvp/README.md) | Active (router) | Umbrella router classifying the deferred Model Viewer candidates into the feature folders below. |
| ⮑ [Model Viewer — Sun Path (3D render)](model-viewer-sun-path/README.md) | Active (planned) | **Frontend-only; depends on Climate Phase 1** (which owns the sun-path endpoint). Render the diagram over geometry once Climate ships it. Scrubber is a gated Phase 2. |
| ⮑ [Model Viewer — Legend as Filter](model-viewer-legend-filter/README.md) | Active (planned) | Ready to build — Ed-flagged near-priority; frontend-only, no open decisions, no Climate dependency. |
| ⮑ [Model Viewer — Clipping Planes](model-viewer-clipping-planes/README.md) | Deferred (gated) | Build when a named sectioned-inspection workflow exists; plan is ready. |
| [User-defined attachment fields](user-defined-attachment-fields/README.md) | Deferred | Revisit after v1 ships and at least two real project workflows need ad hoc attachment columns. |
| _(shipped in v1.0)_ Climate — reference-data ingest + seed | Complete | Shipped v1.0 (2026-06-15) and archived to `planning/archive/climate-reference-data-seeding/`. The former **PHI/PHPP importer** candidate was folded in as `phases/phase-02-phi-importer.md`. |
| [Climate — Design conditions + metrics](climate-design-conditions/README.md) | Deferred (narrowed) | **Narrowed 2026-06-21 (D-CL-25):** production + display now built under [climate-auto-populate](../archive/climate-auto-populate/README.md) P3/P4; only the consumer **contract endpoint** remains, gated on fRSI/comfort + D-CL-5. |
| [Climate — tab follow-ups](climate-tab-followups/README.md) | Superseded | **Folded into [climate-auto-populate](../archive/climate-auto-populate/README.md) (D-CL-25):** custom-record form + sun-path cardinal labels + attached-source charts → P4/P2; `ClimateRecord`→`context/` is a P4 docs task. Folder kept for history. |
| [Climate — Rain exposure class](climate-rain-exposure/README.md) | Deferred | Auto-derive a rain-exposure tier from annual rainfall + mean wind → cladding hint. **Stays deferred (D-CL-25); its EPW-metrics substrate is now built under [climate-auto-populate](../archive/climate-auto-populate/README.md) P3**, so it's a small follow-on; still gated on RX-1 (rainfall source). |
| [Table CSV Download — follow-ups](table-csv-download-followups/README.md) | Deferred | Optional tweaks left from the shipped v1 CSV export: formula-error cell text (F1), `linked_record` id→label resolution (F2), catalog JSON/CSV label reconciliation (F3), plus deferred non-goals (timestamps, CSV-injection). Promote per-item when real usage hits the trigger. |

The **Climate** feature (a top-level tab that owns location/EPW + the
sun-path service + climate design conditions) shipped its data store —
**Phases 1–3 are complete (2026-06-14)** and the feature is archived at
[`planning/archive/climate/`](../archive/climate/README.md). Its remaining
deferred work was split into the three `climate-*` candidates above. As of
**2026-06-21**, the address-first Climate-tab redesign is planned under
[`planning/archive/climate-auto-populate/`](../archive/climate-auto-populate/README.md),
which **absorbs** the tab follow-ups and the design-conditions production/
display (D-CL-25); only the design-conditions **consumer contract** and
**rain-exposure** remain deferred here.

Model Viewer Tier 3 candidates (HBJSON↔document cross-check, comments/
annotations, John test) stay scoped inside
[model-viewer-post-mvp](model-viewer-post-mvp/PRD.md) until their gates
open — they are not yet broken into feature folders.
