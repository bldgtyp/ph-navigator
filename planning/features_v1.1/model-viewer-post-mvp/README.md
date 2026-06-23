---
DATE: 2026-06-13
TIME: -
STATUS: Active — router/classifier for Model Viewer post-MVP work.
AUTHOR: Claude (for Ed); detailed feature plans added 2026-06-13.
SCOPE: Umbrella router for Model Viewer work left outside the
  completed MVP. Classifies the deferred candidates by readiness and
  points to per-feature folders for the ones planned in detail.
RELATED:
  - STATUS.md
  - PRD.md
  - planning/archive/model-viewer-sun-path/
  - planning/archive/model-viewer-legend-filter/
  - planning/features_v1.1/model-viewer-clipping-planes/
  - planning/archive/model-viewer/ (completed MVP — source of truth)
  - context/user-stories/40-model-viewer.md
---

# Model Viewer Post-MVP

Umbrella for Model Viewer work intentionally left outside the completed
MVP feature (`planning/archive/model-viewer/`). The MVP Model tab
(Phases 1–6) is complete and archived; everything here is v1.1+
candidate or product-validation work.

As of 2026-06-13 the deferred candidates have been triaged into three
tiers and the buildable ones broken out into their own feature folders
with detailed phased plans.

## Candidate roster (classified)

### Tier 1 — Ready to build (own feature folder, detailed plan)

| Candidate | Feature folder | Notes |
|---|---|---|
| Sun-path **3D render** (D-07) **+** scrubber (Q-VIEW-6) | [`model-viewer-sun-path/`](../../archive/model-viewer-sun-path/) | **Phases 0 + 1 implemented 2026-06-23** (merged + archived 2026-06-23). The backend was briefly in Climate framing but actually lives in **`project_location`** (the coordinate owner); it was built, deleted 2026-06-22, and rebuilt here as Phase 0, with the Site & Sun render as Phase 1. D-SP-1 settled (decoupled, location-reactive endpoint). Scrubber (Q-VIEW-6) is the deferred Phase 2. |
| Legend-as-filter (NEW-VIEW-2 / Q-VIEW-7) | [`model-viewer-legend-filter/`](../../archive/model-viewer-legend-filter/) | **Implemented 2026-06-23** (merged + archived 2026-06-23). Both phases — single-select isolate + shift-click multi-select; isolate-with-wireframe-context (PRD §5). Reused the D-11 legend rows + bucket-key function as planned. |

### Tier 2 — Plannable but gated (own folder, plan ready, idle)

| Candidate | Feature folder | Gate |
|---|---|---|
| Section / clipping planes (Q-VIEW-8) | [`model-viewer-clipping-planes/`](../model-viewer-clipping-planes/) | A named sectioned-inspection workflow. Approach is low-ambiguity; plan is ready. |

### Tier 3 — Not ready for detailed phasing (scoped here, with gates)

| Candidate | Why not phased yet | Reopen gate |
|---|---|---|
| HBJSON ↔ project-document cross-check (NEW-VIEW-1 / Q-VIEW-9) | Divergence rules can't be defined until the Rooms/equipment builder tables exist. See `PRD.md`. | Plan jointly with the Rooms/equipment QA/QC family (NEW-ROOMS-1). |
| Comments / annotations (D-I7) | Must not be a viewer-only island; needs an app-wide comment/presence model first. | Reopen when the app has a shared comment/presence model. |
| John test / non-technical product validation (PRD §8.4) | Not an implementation task — needs a non-technical viewer + Ed/John coordination. | Coordinate outside a coding-agent session; record the outcome here. |

## Read order

1. This `README.md` — the classification above.
2. `STATUS.md` — the deferred roster with reopen gates + current
   recommendation.
3. `PRD.md` — candidate contracts (now thin for Tier 1/2, which have
   full PRDs in their folders; full for the Tier 3 stubs).
4. The Tier 1/2 feature folders for detailed plans.

## Recommended order if Ed promotes work

1. ~~**Climate Phase 1** — the sun-path *service*.~~ **Done differently:**
   the sun-path service lives in `project_location` (not Climate); it was
   removed 2026-06-22 and rebuilt 2026-06-23 as
   `model-viewer-sun-path` Phase 0.
2. **Sun-path 3D render** — **implemented 2026-06-23** (Phase 1), pending
   merge. Renders the diagram in Site & Sun over geometry.
3. **Legend-as-filter** — **implemented 2026-06-23** (merged + archived);
   both phases, isolate-with-wireframe-context.
4. **Clipping planes** — when a section workflow names itself.
5. **Doc cross-check** — with the Rooms/equipment family, not before.

## Current decision

Do not reopen these for v1 closeout unless Ed promotes one. The MVP
Model tab is complete after Phases 1–6 and archive closeout.
