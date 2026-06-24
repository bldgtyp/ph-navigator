---
DATE: 2026-06-24
TIME: 19:03 EDT
STATUS: Active — Phase 2 complete; Phase 3 closeout next
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase sequence for the two aperture spec-report pages.
RELATED: ./README.md, ./PRD.md, ./phases/
---

# PLAN — Apertures → Glazings / Frames report pages

Four phases. Phase 0 backend, Phases 1–2 frontend, Phase 3 closeout.

```
P0  COMPLETE — Backend read API: build_apertures_read_parts + ProjectGlazingRead/ProjectFrameRead
    + use-site DTOs + read endpoint + drift report
P1  COMPLETE — Frontend routing + panels: route-based Apertures sub-tabs; GlazingsPanel/FramesPanel
    shells (MaterialsPanel clones); query hooks + api + types
P2  COMPLETE — Wire the panels: columns, status chips, datasheet zones, use-sites, spec-status,
    drift; retire ProjectRefsView + refsAggregation
P3  NEXT — Closeout: UI_UX page docs, final make ci, archive gate
```

## Dependency order

**Prerequisite resolved in current checkout:** `ProjectGlazing`/`ProjectFrame`
exist, the apertures slice carries the flat tables, and the documentation
commands + datasheet-registry extension are in place.

Within this feature: `P0 → P1 → P2 → P3`. P0–P2 are complete. Phase 2 already
ran an isolated Codex-fixture browser smoke for the two report routes; P3 should
complete final docs/context updates and the full closeout gate.

## Reuse budget (the whole point)

| Need | Reuse (do not rebuild) |
| --- | --- |
| Table | `shared/ui/report-table/ReportTable` |
| Status pill + chips | `StatusDot`, `StatusFilterChips` |
| Datasheet chip / zone | `AttachmentChipCell`, `AttachmentCell`, `DATASHEET_ATTACHMENT_CONFIG`, `useAssetUrls` |
| Status select | `AutocompleteSelect` |
| Sub-tab bar | `AppSubTabs` / `AppSubTabLink` |
| Page composition | clone `MaterialsPanel.tsx` |
| Backend read | clone `build_envelope_read_parts` + the envelope read route |
| Drift | reuse `aperture_drift` |

New code should be: two panels, two query hooks, one selector + DTOs + endpoint,
the route wiring, and the retirement of the old modal. Nothing else.
