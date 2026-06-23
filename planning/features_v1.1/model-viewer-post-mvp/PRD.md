---
DATE: 2026-06-13
TIME: -
STATUS: Active — candidate contracts. Tier 1/2 now have full PRDs in
  their feature folders; this file carries the Tier 3 stubs in detail.
AUTHOR: Codex (original); triaged + expanded by Claude 2026-06-13.
SCOPE: Product contracts for deferred Model Viewer v1.1+ candidates.
RELATED:
  - README.md
  - STATUS.md
  - context/user-stories/40-model-viewer.md
  - planning/archive/model-viewer/PRD.md
  - planning/archive/model-viewer/decisions.md
  - planning/archive/model-viewer-sun-path/PRD.md
  - planning/features_v1.1/model-viewer-legend-filter/PRD.md
  - planning/features_v1.1/model-viewer-clipping-planes/PRD.md
---

# Model Viewer Post-MVP - PRD

## Goal

Preserve the deferred Model Viewer work as explicit future feature
candidates after the MVP archive. As of 2026-06-13 the buildable
candidates have full PRDs + phased plans in their own feature folders;
this file keeps the high-level contract for each and the full text for
the Tier 3 items that are not yet ready for detailed phasing.

## Tier 1 — Ready (full plans in feature folders)

### Sun-Path (Site & Sun completion)
→ **[`model-viewer-sun-path/PRD.md`](../../archive/model-viewer-sun-path/PRD.md)**

Site & Sun already renders building geometry, grey non-selectable
shades, a north marker, and a location hint. The feature populates and
renders `sun_path` from the project's stored location (lat/long/true-
north/time-zone), and folds in the deferred sun-path scrubber as a
gated Phase 2. Key decision: **D-SP-1** — serve the sun path from a
separate location-reactive endpoint rather than baking it into the
immutable `/model_data` artifact (recommended). Non-goals: redesigning
the Model tab, making shades selectable, reworking Measure.

### NEW-VIEW-2 — Legend-As-Filter
→ **[`model-viewer-legend-filter/PRD.md`](../model-viewer-legend-filter/PRD.md)**

Legend rows are already real inert buttons (D-11). The feature lets a
reviewer click a legend swatch/row to isolate matching geometry, with
an obvious clear-filter affordance and shift-click multi-select. Reuses
the existing `colorForThemedObject` bucket-key function. Ed-flagged
near-priority.

## Tier 2 — Gated (plan ready, idle)

### Section / Clipping Planes
→ **[`model-viewer-clipping-planes/PRD.md`](../model-viewer-clipping-planes/PRD.md)**

Add a movable axis-aligned clipping plane for sectioned inspection.
Plan ready (global renderer clipping plane); build only when a concrete
review workflow needs it. Capped (filled) cross-sections are explicitly
out of scope.

## Tier 3 — Not ready for detailed phasing (full stubs below)

These are intentionally NOT broken into feature folders yet — each
depends on something unbuilt, or is not implementation work. Promote to
a feature folder when its gate opens.

### NEW-VIEW-1 — HBJSON / Project Document Cross-Check (Q-VIEW-9)

**What:** after an HBJSON upload, flag divergences between what the
HBJSON describes (window types, room metadata, assembly/construction
names) and what the builder tables say. Surfaces in the Model tab as
inline warnings on suspect objects + a top-bar "N divergences found"
summary.

**Why it is not phased yet:** the divergence *rules* are the whole
feature, and they can only be defined against the builder tables
(assemblies, project materials, rooms, equipment) — which are a
separate, larger workstream (family with NEW-ROOMS-1, "Compare HBJSON
vs Rooms"). PRD §11.4.6 explicitly keeps auto cross-checking out of
v1. Planning it now would be guessing at rules whose data model does
not exist.

**Dependencies to resolve before phasing:**
- The Rooms/equipment builder tables and their canonical fields.
- A divergence taxonomy (what counts as a mismatch; tolerance for
  names vs. values; which direction is authoritative — the viewer is
  read-only and never writes back, PRD §3).
- Where warnings live (per-object inspector badge + a Model-tab
  summary bar) and how they are dismissed/acknowledged.

**Reopen gate:** plan jointly with the Rooms/equipment QA/QC family so
the rules are defined once against real builder tables. Until then this
is a stub, not a roadmap item.

### Comments / Annotations (D-I7)

**What:** 3D-space annotations / comments on model objects.

**Why it is not phased yet:** a Model-Viewer-only comment island is the
wrong shape. Comments need an app-wide comment/presence model (who can
comment, threading, notifications, viewer-vs-editor rights, how
comments relate to project versions and other tabs). Building a
bespoke viewer-only system would create a second comment surface to
later reconcile.

**Reopen gate:** the app grows a shared comment/presence model; then 3D
annotations are one consumer of it, not a standalone feature. Do not
add Model Viewer-only comments before that exists.

### John Test / Product Validation (PRD §8.4)

**What:** the MVP acceptance gate's non-technical user test — John (or
a stand-in) opens a project URL logged-out, orbits, clicks a wall, and
reads its construction with zero instruction.

**Why it is not implementation work:** the MVP shipped against the
per-phase ledgers, the focused Playwright suite, and a browser
walkthrough; the John test could not be performed inside a coding-agent
session. It is product validation, not a missing phase.

**Reopen gate:** Ed/John coordinate a session with a non-technical
viewer. Record the outcome here (or in the archived MVP status). If it
exposes workflow gaps, promote those gaps into specific feature work —
they may feed Tier 1/2 above or surface new candidates.
