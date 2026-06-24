---
DATE: 2026-06-24
TIME: 17:45 EDT
STATUS: Planning — blocked on prerequisite
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase sequence for the two aperture spec-report pages.
RELATED: ./README.md, ./PRD.md, ./phases/
---

# PLAN — Apertures → Glazings / Frames report pages

Four phases. Phase 0 backend, Phases 1–2 frontend, Phase 3 closeout.

```
P0  Backend read API: build_apertures_read_parts + ProjectGlazingRead/ProjectFrameRead
    + use-site DTOs + read endpoint + drift report
P1  Frontend routing + panels: route-based Apertures sub-tabs; GlazingsPanel/FramesPanel
    shells (MaterialsPanel clones); query hooks + api + types
P2  Wire the panels: columns, status chips, datasheet zones, use-sites, spec-status,
    drift; retire ProjectRefsView + refsAggregation
P3  Closeout: browser smoke (sign in as Ed), UI_UX page docs, make ci
```

## Dependency order

**Hard prerequisite:** `glazing-frame-documentation` merged (or its Phases 0–2
on the working branch), so `ProjectGlazing`/`ProjectFrame` exist, the apertures
slice carries the flat tables, and the documentation commands +
datasheet-registry extension are in place.

Within this feature: `P0 → P1 → P2 → P3`. P1 can scaffold against the P0 read
shape; P2 needs P0 live to render real rows. P3 is the first phase to require a
dev-server **browser smoke** — and per the dev-seed rule, that smoke signs in as
**Ed** (the seeded project is `ed@example.com`'s; single active session — don't
clobber Ed's session; use the isolated-worktree smoke recipe from
`planning/features/.instructions.md` if his stack is up).

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
