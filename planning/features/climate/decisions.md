---
DATE: 2026-06-13
TIME: -
STATUS: Active — focus is the climate data STORE (Phases 1–3); design
  conditions / fRSI / temp-asymmetry USE-cases deferred to later feature
  work (Ed 2026-06-13). D-CL-1..3, D-CL-6..11 proposed; D-CL-4 resolved
  (incl. ASHRAE-as-pointer); D-CL-5 deferred to the fRSI consumer.
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

## Climate-data model (Ed 2026-06-13 — major expansion)

### D-CL-4 · Store ALL climate sources; don't pick one basis (RESOLVED, Ed 2026-06-13)
We do not know ahead of time which basis a user wants, and a CPHC may
want to evaluate several. So a project can store **all** of these
simultaneously, each independently visualizable (graph + table):
1. **ASHRAE** — a **pointer** to the ASHRAE meteo station
   (`https://ashrae-meteo.info/v3.0/`): store the station id + URL only.
   **Settled (Ed 2026-06-13): keep ASHRAE as a pointer for now** — no
   fetch/store/cache of values yet. (Asymmetry vs. EPW is intentional:
   ASHRAE design data is a stable published reference; the EPW is the
   reproducibility-critical hourly input, so it is stored, D-CL-6.)
2. **EPW** — the stored EPW asset (D-CL-6).
3. **Phius dataset location** — selected from an app-wide Phius
   reference dataset (D-CL-8), by version (2022, 2024, …).
4. **PHI/PHPP dataset location** — selected from an app-wide PHI
   reference dataset (D-CL-8), by version (10.6, 10.7, 11.0, …).
Plus **custom** data (D-CL-9) for locations not in the standard sets.
**Supersedes** the earlier "pick one design-condition basis" framing —
the design conditions are derived *per source*; the consumer (fRSI,
comfort) selects which source to read (D-CL-11).

### D-CL-8 · App-wide, versioned reference climate datasets (NEW, Ed 2026-06-13)
Phius and PHI/PHPP climate data are **app-wide reference data**, shared
across ALL projects and users — not per-project. Store each as a
**versioned, immutable named dataset** (`provider` ∈ {phius, phi} ×
`version` ∈ {2022, 2024, 10.6, 10.7, 11.0, …}) containing N location
records in the standardized format (PRD §4). Seeded into the app from
the source files Ed has (Phius `-mon.txt` set; PHI from PHPP). Small —
~12 monthly points/field/location; Phius (1007) + PHI (~1400) ≈ a few
MB total (research.md).
- Projects **select + pin** a `(provider, version, location)` — the
  pinned dataset version is the immutable, reproducible basis (this is
  the climate analogue of D-CL-7's pinning, and what makes "load an old
  model and see the climate it used" work without document-versioning).
- New provider releases = a new seeded dataset version; **old versions
  retained** (reproducibility). The specific upload/update admin flow
  is **deferred** (Ed: "worry about that later") — but the data model
  must carry `version` from day one.
**Recommendation: accept.**

### D-CL-9 · Custom climate locations (NEW)
A project can supply a **custom** climate record in the standardized
format (same shape as a reference-dataset location) for locations not
in any standard set, or to override one. Stored per-project (not
app-wide). Editable; visualized the same way.
**Recommendation: accept.**

### D-CL-10 · Reuse PH-Tools / PHX climate parsing; align the standardized schema with honeybee-ph (NEW)
The Phius `-mon.txt` shape IS the PHPP climate import format, and PHI
data comes out of PHPP. `PHX` / `honeybee-ph` (Ed's own libraries,
already backend deps) very likely already read/model PHPP monthly
climate. **Investigate reuse before writing parsers from scratch**, and
**align the standardized internal schema (PRD §4) with the honeybee-ph
PH-climate model** so a climate record can round-trip into HBJSON/PHPP
export. Avoids a parallel, drifting representation.
**Recommendation: accept** (research task in Phase 2).

### D-CL-11 · Per-analysis source selection (NEW)
Because a project stores multiple sources (D-CL-4), each downstream
consumer (sun path, fRSI, comfort) **selects which source** it reads —
with a sensible project-level default. The design-conditions contract
(Phase 4) is therefore *source-parameterized*, and the `basis` is named
in the response so a reviewer can audit which dataset/version produced
a value.
**Recommendation: accept.**

## Deferred to later feature work (Ed 2026-06-13)

**Current focus is the climate data *store* (Phases 1–3); the *use* of
that data comes next.** Ed (2026-06-13): "defer the use-case around both
fRSI and temp-asymmetry to later feature dev work. Focus on the climate
data store for now, we'll get to use next."

- **The per-source design-conditions contract (Phase 4) is deferred.**
  It is not part of the current build; reopen with the first consumer.
- **D-CL-5 · Interior boundary assumption for fRSI — deferred to the
  Thermal-Bridges fRSI feature.** fRSI needs an interior condition (temp
  + RH / humidity class): ISO 13788 humidity classes vs. a fixed PH
  assumption (e.g. 20 °C / 50–60% RH) vs. per-project override. This is
  the fRSI consumer's decision, not Climate's — Climate supplies the
  exterior side per source (D-CL-11). Recorded so it is not lost; no
  Climate phase is blocked on it.

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
