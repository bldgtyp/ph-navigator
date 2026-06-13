---
DATE: 2026-06-13
TIME: -
STATUS: Active — D-CL-1..3, D-CL-6, D-CL-7 proposed (recommendations
  inline); D-CL-4 and D-CL-5 are CPHC-domain decisions for Ed.
AUTHOR: Claude (for Ed)
SCOPE: Decision ledger for the Climate feature.
RELATED:
  - PRD.md
  - planning/archive/project-location/decisions.md (D-PL-1..5)
  - planning/features_v1.1/model-viewer-sun-path/decisions.md (D-SP-1)
---

# Climate — Decisions

## Proposed (recommendations inline; confirm on review)

### D-CL-1 · Climate extends `project_location`, it does not replace it
The implemented `project_location` module (table + service + repo +
MCP + the `ProjectLocationSettingsSection` setter) stays the store for
raw inputs (lat/long/elevation/time-zone/true-north/address + EPW
reference). Climate adds: the sun-path service (Phase 1), the tab UI
(Phase 2), and EPW-derived metrics + design conditions (Phase 3).
**Why:** the data layer is merged and working; rewriting it would be
churn for no gain. Whether Climate later absorbs/renames the module is
a cosmetic call deferred until the tab exists.
**Recommendation: accept.**

### D-CL-2 · The sun-path service lives in the Climate (location)
domain, with one project-scoped endpoint shared by all consumers
`GET /projects/{id}/sun-path` → `SunPathAndCompassDTOSchema | null`.
Built in Phase 1, in the location/climate backend module. The Model
Viewer Site & Sun lens and the Climate tab both consume it; neither
owns it. This is the relocation of the endpoint that
`model-viewer-sun-path` originally sketched (D-SP-1) into its proper
home.
**Why:** the sun path is climate-derived and multi-consumer; one
location-reactive endpoint avoids duplication and a later move.
**Recommendation: accept** (this is what makes "Climate first"
worthwhile — the 3D viz then reduces to frontend rendering).

### D-CL-3 · Climate is a new top-level tab (6th), gated to Phase 2
The MVP roster is Status / Apertures / Envelope / Equipment / Model
(US-3.6). Climate adds a 6th tab in `PROJECT_TABS`, landing in Phase 2.
Phase 1 ships no new tab (the existing settings-modal setter covers
data entry); Phase 1 is backend service only.
**Why:** a tab is justified by the *visualization* + multi-consumer
goal, not by data entry (which already has a home). Deferring the tab
to Phase 2 lets the unblocking service ship first.
**Recommendation: accept.** Open sub-question: does the location setter
*migrate* from the settings modal into the tab, or does the tab embed /
duplicate it? Resolve in Phase 2 (recommendation: migrate the rich
editing into the tab; leave a compact read-only summary in settings, or
remove the settings section once the tab is the home).

### D-CL-6 · Store the EPW ourselves (immutable R2 asset); keep the source URL as provenance
The EPW is stored in R2 as a project asset (as `project_location`
already does via `epw_asset_id`), with `epw_source_url` retained as
provenance. A "fetch from URL" convenience may pull an EPW-Map /
climate.onebuilding.org file *into* our store, but the stored bytes are
the source of truth — we never depend on the provider URL at runtime.
**Why:** reproducibility/auditability beats "less to manage" for a PH
tool. A pointer-only design risks the provider file changing or
disappearing (link rot), and a certification model's climate basis must
be frozen and reproducible across review rounds. EPW files are ~1–2 MB
— storage is trivial. Runtime fetch would also add latency, CORS, and
availability failure modes.
**Recommendation: accept** (this confirms the implemented
`project_location` design; the source URL stays as where-it-came-from).

### D-CL-7 · Location is durable, project-level, and editable — NOT versioned into the project document; reproducibility comes from immutable artifacts + pinning
Location stays in the thin relational layer (per `project_location`
D-PL-1), editable in place. Fixing a typo or correcting coordinates
**propagates everywhere** — that is the correct behavior for fixing a
mistake; you do not want old views frozen-wrong. The sun path is a pure
function of physical facts (lat/long/true-north) that do not
meaningfully "version" — the building does not move between model
rounds.

Where reproducibility genuinely matters, it comes from **immutable
artifacts + optional pinning**, not from versioning the live location:
- HBJSON uploads are already immutable (each upload = a new row, frozen
  bytes); the `/model_data` artifact is immutable (D-15).
- The EPW is an immutable stored asset (D-CL-6).
- A reproducibility-sensitive consumer (fRSI, a certification model)
  **pins the EPW asset id** to capture the exact climate basis it used —
  the established `project_airtightness.hbjson_file_id` precedent — and
  Climate-derived metrics key off the (immutable) EPW asset id, so a
  re-based EPW yields a new asset while the old asset's metrics remain
  reproducible.

**Optional, if Ed wants an audit trail of location edits:** an
append-only location-history (a row per change, or `updated_at` +
history) gives "what did it say on date X" without coupling location to
versioned-by-discipline document saves and its save-friction. Offered,
not required for v1.
**Why not document-versioning:** location/climate is a boundary
condition, not a design discipline you iterate; the PRD deliberately
carved it out of the JSONB document (D-PL-1), and binding it to versions
reintroduces the "save a new version just to set a field" friction that
US-VIEW arch-decision-2 rejected for HBJSON.
**Recommendation: accept** (durable + editable; reproducibility via
immutable EPW asset + pin; audit-history optional).

## CPHC-domain decisions for Ed (Phase 3 — do not guess)

### D-CL-4 · Design-condition basis (OPEN — Ed to decide)
fRSI and window-comfort consumers need a **design exterior temperature**.
The convention matters and is Ed's call as CPHC. Candidates:
- ASHRAE 99.6% / 99% heating design dry-bulb (from the EPW / climate
  data).
- Coldest-month mean dry-bulb (ISO 13788 fRSI monthly method).
- PHPP climate-dataset design values (for PH consistency).
- A national-annex value.
**Impact:** changes the fRSI threshold and the comfort check inputs.
**Status:** OPEN. Phase 3 is blocked on this; Phases 1–2 are not.
Likely answer: support the ISO 13788 monthly method for fRSI AND a
single heating design temp for comfort — but Ed decides.

### D-CL-5 · Interior boundary assumption for fRSI (OPEN — Ed to decide)
fRSI condensation assessment needs an interior condition (temp + RH /
humidity class). Candidates: ISO 13788 humidity classes; a fixed PH
assumption (e.g. 20 °C / 50–60% RH); per-project override.
**Status:** OPEN. Phase 3 / the Thermal-Bridges fRSI consumer needs
this. Not blocking Phases 1–2.

## Inherited (settled elsewhere; restated)

- **D-PL-4** true-north convention (CCW from +Y; 90°=W, 270°=E),
  validated `[0,360)`. The sign passed to ladybug is verified against a
  known-orientation fixture in Phase 1 (a wrong sign silently rotates
  the sun path).
- **D-15 (model-viewer)** `/model_data` is an immutable artifact — the
  reason the sun path is a *separate* live endpoint, not baked in
  (D-SP-1 / D-CL-2).
- **D-PL-3** EPW header parse is dependency-free and owned by the
  location/climate feature; heavier EPW parsing (Phase 3 metrics) uses
  `ladybug-core` (already a backend dep).

## Open questions

- D-CL-4, D-CL-5 (above) — Phase 3 only.
- Phase 2 setter migration sub-question (under D-CL-3).
