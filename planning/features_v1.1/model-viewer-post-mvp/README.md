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
  - planning/features_v1.1/model-viewer-sun-path/
  - planning/features_v1.1/model-viewer-legend-filter/
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
| Sun-path wiring (D-07) **+** sun-path scrubber (Q-VIEW-6) | [`model-viewer-sun-path/`](../model-viewer-sun-path/) | Flagship. Phase 1 = static annual sun path from project-location data; Phase 2 = scrubber (gated). D-SP-1 settled (decouple from the immutable `/model_data` artifact, accepted 2026-06-13). |
| Legend-as-filter (NEW-VIEW-2 / Q-VIEW-7) | [`model-viewer-legend-filter/`](../model-viewer-legend-filter/) | Ed-flagged near-priority. Frontend-only; reuses the D-11 legend rows + existing bucket-key function. No open decisions. |

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

1. **Sun path** — completes declared Site & Sun behavior; prerequisites
   met; D-SP-1 settled — ready to build.
2. **Legend-as-filter** — Ed's stated near-priority; cheapest high-value
   win; no dependencies.
3. **Clipping planes** — when a section workflow names itself.
4. **Doc cross-check** — with the Rooms/equipment family, not before.

## Current decision

Do not reopen these for v1 closeout unless Ed promotes one. The MVP
Model tab is complete after Phases 1–6 and archive closeout.
