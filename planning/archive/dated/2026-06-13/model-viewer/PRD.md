---
DATE: 2026-06-12
TIME: -
STATUS: Accepted 2026-06-12 — decisions D-02..D-12 confirmed by Ed;
  implementation handoffs live under phases/.
AUTHOR: Claude (for Ed)
SCOPE: Product / behavior contract for the V2 Model tab (3D HBJSON
  viewer). Composition layer over US-VIEW-1..7; does not duplicate
  their acceptance criteria.
RELATED:
  - context/user-stories/40-model-viewer.md (canonical behavior)
  - research/v1-3d-model-viewer-reference.md (V1 source of truth;
    §16 no-regression checklist is the acceptance gate)
  - context/technical-requirements/frontend-viewer-units.md §11.4/§11.5
  - planning/archive/model-viewer/UI_SPEC.md (UI definition)
  - planning/archive/model-viewer/decisions.md
---

# Model Viewer — PRD

## 1. Goal

A project's Model tab renders uploaded HBJSON files as a polished,
fast, intuitive 3D viewer that serves two audiences at once:

- **Technical reviewers** (Ed, John, certifiers): verify the energy
  model against design intent — constructions, boundary conditions,
  TFA weighting, ventilation airflow, duct/pipe routing — by coloring,
  picking, and measuring.
- **Non-technical viewers** (owners, architects, contractors with the
  project URL): orbit the building, understand what was modeled, click
  things and see readable facts. Zero learning curve; nothing that
  requires knowing what a "viz state" or "tool mode" is.

Design stance: **a modern product viewer, not a CAD application.**
Selection always works (no "Select tool" to arm), controls are labeled
in domain language ("Spaces", "Floor Areas" — not icon-only glyphs),
camera moves are damped and smooth, and the one genuinely modal tool
(Measure) is an explicit, clearly-indicated mode.

## 2. Capability matrix (what ships in MVP)

| Capability | Contract | UI surface (UI_SPEC.md) |
|---|---|---|
| HBJSON upload / list / pick / rename / notes / delete | US-VIEW-1 (schema, dedup, 100 MB cap per D-17, soft delete, permissions) | File chip + popover, §3.2 |
| 3D scene: Z-up, lighting, ground, orbit/pan/zoom | US-VIEW-2 | Canvas, §3.1 |
| 6 viewing **lenses**: Building, Spaces, Floor Areas, Site & Sun, Ventilation, Hot Water | US-VIEW-3 (same visibility + selectability rules, recomposed — see §4.1) | Lens bar, §3.3 |
| 6 **color themes** (face type, boundary, opaque construction, aperture construction, ventilation airflow, floor weighting) + static/dynamic legend | US-VIEW-5 (same color sources, same cyrb53 hash) | Theme menu + legend card, §3.4 |
| Always-on hover + click selection, per-type inspector with IP/SI | US-VIEW-4 (selection semantics) + US-VIEW-6 (field configs) | Inspector panel, §3.5 |
| Measure: vertex snap, two-click dimension lines, unit-aware labels | US-VIEW-4 | Measure mode, §3.6 |
| Bulk `/model_data` backend with SI canonical wire + `load_summary` | US-VIEW-7 | — |
| Supply/exhaust duct color split | Q-VIEW-2 resolved | Ventilation lens |
| AirBoundary skip surfaced as a count | Q-VIEW-1 resolved | Load status, §3.7 |
| Deep links: active file, lens, theme in URL query | US-VIEW-1 crit. 6, extended (D-10) | Router integration |

Everything in V1-reference §16 (no-regression checklist) must pass,
**except** items that described V1's composition rather than its
capability — those are re-mapped in §4 below.

## 3. Data flow (unchanged from the user stories)

```
Rhino + GH + honeybee_ph ──.hbjson──▶ Model tab upload (drag-drop)
        │                                    │
        │                          project_assets (R2, kind='hbjson')
        │                          project_hbjson_files (metadata)
        │                                    │
        ▼                                    ▼
   (by-hand reference            GET /api/v1/projects/{id}/
    from builder tables)           hbjson-files/{file_id}/model_data
                                             │
                                  CombinedModelData (SI canonical,
                                  triangulated meshes, merged shades,
                                  load_summary)
                                             │
                                             ▼
                                  R3F scene: loaders → BufferGeometry
                                  + per-object metadata for inspector
```

- HBJSON files are immutable post-upload. The upload-time job
  precomputes `CombinedModelData` to R2 as a derived artifact;
  `/model_data` streams it with `Cache-Control: immutable` + ETag +
  gzip — no in-process cache, no per-request parse (D-15, amending
  US-VIEW-7 crit. 9).
- The viewer never writes anything back to the project document.
- Wire is SI everywhere (m, m², m³, m³/s, W/m²K); IP conversion is
  frontend display only, via the existing `useUnitPreference` +
  `frontend/src/lib/units/` helpers.

## 4. Deltas vs. the user stories

These are the points where this PRD intentionally departs from
US-VIEW-1..7 composition. All were accepted by Ed 2026-06-12 and
folded back into `context/user-stories/40-model-viewer.md` (V2
amendments block + amended US-VIEW-6 crit. 7) and
`context/UI_UX.md` §2.9 in the same docs pass.

### 4.1 Lens + Theme replaces VizState + ColorBy-state (D-03)

V1 (and US-VIEW-3/5) model "ColorBy" as an 8th mutually-exclusive viz
state whose geometry visibility is derived from the picked attribute.
That is an implementation artifact, not a user concept. V2 separates:

- **Lens** — *what you are looking at.* Exactly one active:
  Building · Spaces · Floor Areas · Site & Sun · Ventilation ·
  Hot Water. Same visibility/selectability table as US-VIEW-3
  criterion 4 (Geometry→Building, SpaceFloors→Floor Areas,
  SunPath→Site & Sun, Ducts→Ventilation, Pipes→Hot Water).
- **Color theme** — *how the current lens is painted.* Offered only
  where applicable:

| Lens | Themes (default first) | Legend |
|---|---|---|
| Building | Shaded · Surface Type · Boundary · Construction · Window Construction | static / static / dynamic / dynamic |
| Spaces | Shaded · Ventilation Airflow | static |
| Floor Areas | **Weighting Factor** (default — it is the point of this lens) · Shaded | static |
| Site & Sun | — (fixed: shaded building + grey shades + dashed sun path) | — |
| Ventilation | — (fixed: supply blue / exhaust red) | mini-key always shown |
| Hot Water | — (fixed: distribution vs. recirc) | mini-key always shown |

All six US-VIEW-5 color modes survive 1:1. Switching lens resets the
theme to that lens's default. The V1 rule "clicking the active mode
button reverts to Geometry" is dropped — a segmented control with one
always-active lens needs no "off" state.

### 4.2 Always-on selection; Measure is the only mode (D-04)

V1 required arming a "Select tool" before clicking did anything.
V2: pointer hover + click selection is **always live** (drag-vs-click
5px tolerance preserved). The ToolState machine collapses to a single
boolean: Measure on/off. While measuring, selection is suspended;
exiting Measure clears dimension lines (US-VIEW-4 lifecycle rules
otherwise unchanged).

### 4.3 Declarative materials replace the `materialStore` contract (D-09)

US-VIEW-4/5 carry forward V1's imperative material-restoration
contract (`userData['materialStore']`, `colorByOriginalMaterial`).
In R3F this disappears: each mesh's material/color is **derived
state** — `f(lensDefault, themeColor, isHovered, isSelected)` —
recomputed on render, nothing stashed or restored. The *observable*
behavior contract stays: deselect during an active theme lands on the
theme color, not the base material; hover highlight never leaks after
pointer-out; theme switches never leave stale colors.

### 4.4 Loading UX: in-canvas progress, not sonner (D-06)

Q-VIEW-5 resolved to "non-blocking Sonner toast" — but sonner is not
in the V2 stack and nothing else needs it. Same intent, different
surface: a non-blocking **progress chip** floating top-center in the
canvas ("Downloading 14 MB…" → "Building scene…"), with the rest of
the app fully interactive. Errors render in-canvas with a Retry
button. The `load_summary` (e.g. "3 air boundaries not rendered")
appears as a transient status line in the same chip, then collapses
into the scene-info popover (§3.7 of UI_SPEC).

### 4.5 Sun path from project location, not EPW (D-07)

V1 derived the sun path from the project's EPW file (stored in
AirTable). V2 has no EPW storage, and a sun path needs only
latitude / longitude / north — not a weather file. Resolved (Ed
2026-06-12): location data will come from a new project-level
**Location** section, developed as its own feature with robust EPW
linkages — requirements handoff at
`planning/archive/project-location/README.md`. Until model-viewer
wires that data into extraction, the Site & Sun lens renders building
+ shades with a quiet "Set project location to see the sun path" hint;
the sun path activates when model-viewer populates `sun_path` (no
Model-tab rework needed —
`Sunpath.from_location` reads whatever that section stores).

### 4.6 Round-3 amendments: artifact serving, broken files, cap (D-15/D-16/D-17)

Accepted by Ed 2026-06-12 (review round 3), synced into
`context/user-stories/40-model-viewer.md` in the same pass:

- **D-15** — `/model_data` is precomputed at upload and served as an
  immutable R2 artifact (amends US-VIEW-7 crit. 9; see decisions.md
  for the self-healing pending/failed contract).
- **D-16** — files that fail honeybee parsing get a "Failed to
  parse" badge in the file popover, and `/model_data` errors are
  typed permanent (no Retry) vs. transient (Retry). Amends the
  UI_SPEC §8 error state.
- **D-17** — upload cap raised to 100 MB (the real multifamily
  fixture is 51.99 MB).

## 5. Backend contract summary

Full detail in US-VIEW-7; the deltas and confirmations:

- **Dependencies (D-02):** add `honeybee-ph` (pulls honeybee-core /
  honeybee-energy / ladybug-geometry) and `ladybug-core` to
  `backend/pyproject.toml` via `uv add`. The V2 backend currently has
  zero honeybee deps (existing HBJSON *export* features hand-build
  dicts), but the *extraction* side — `Model.from_dict()`, punched
  geometry, triangulation, `Point3D.is_equivalent` shade merging,
  `Sunpath` — would be a large rewrite without them. These are
  PH-Tools' own libraries; supply-chain posture is acceptable.
- **Feature module:** `backend/features/model_viewer/` with the
  standard `routes.py` / `models.py` / `service.py` / `repository.py`
  split per `context/CODING_STANDARDS.md`. Schemas port from V1's
  `schemas/{honeybee,honeybee_energy,honeybee_ph,honeybee_phhvac,
  ladybug,ladybug_geometry}/` subtrees, Pydantic v2.
- **Routes** (under `/api/v1/projects/{project_id}/hbjson-files`):
  CRUD per US-VIEW-1 crit. 14 (upload goes through the existing
  generic asset upload-intent flow with `asset_kind='hbjson'` —
  already supported by `backend/features/assets/registry.py`), plus
  `GET .../{file_id}/model_data` (bulk; the viewer's only data call)
  and the per-feature reads kept live for MCP.
- **SI canonical:** V1's pre-Pydantic ×3600 airflow hack is dropped;
  wire is m³/s (US-VIEW-7 crit. 1).
- **`load_summary`:** faces/spaces/shade-group counts +
  `air_boundaries_skipped` + warnings (US-VIEW-7 crit. 3).
- **No process cache; precomputed artifact (D-15):** the upload job
  parses once and persists `CombinedModelData` to R2 (gzip, derived
  key); `/model_data` and the per-feature routes read the artifact —
  no per-request parse, no in-memory cache (US-VIEW-7 crit. 9 as
  amended). Model units are normalized to Meters before extraction
  (HBJSON exports arrive in Inches/Feet/Meters; the wire stays SI).
- **Geometry summary extraction** at upload (volume / envelope area /
  iCFA on `project_hbjson_files`) serves US-ENV-14 Airtightness too —
  one upload, one extraction, used twice (US-VIEW-1 crit. 5).

## 6. Frontend stack additions

- `three`, `@react-three/fiber`, `@react-three/drei`,
  `@react-three/postprocessing` (PRD §12 already pins this direction).
  pnpm supply-chain protections stay on (24 h `minimumReleaseAge`).
- Viewer state: one Zustand store (`modelViewerStore`) — active file
  id, lens, theme, hover id, selection id, measure state, load phase.
  No React contexts for viewer state.
- Feature module: `frontend/src/features/model_viewer/` —
  feature-first per CODING_STANDARDS; loaders as pure functions
  (HBJSON DTO → BufferGeometry + metadata), JSX scene components per
  lens, TanStack Query for `/model_data` + file list.

## 7. Performance posture

- Target: 5–20 MB HBJSON typical, 52 MB worst-case (the Hillandale
  fixture: 583 rooms / 6,178 faces / 1,024 apertures) — fetch +
  JSON.parse on main thread is acceptable for MVP with the progress
  chip visible (PRD open Q15). Defer workers until a real model
  hurts; the Hillandale file is the canary, exercised from Phase 2
  on (not deferred to acceptance).
- One material instance per theme bucket (shared), merged shade
  groups server-side (one draw call per group), `frustumCulled`
  defaults. No per-frame allocation in `useFrame`.
- `<Canvas frameloop="demand">` — the scene is static between
  interactions; render on demand keeps laptops cool. Damped controls
  invalidate while moving.

## 8. Acceptance gate

1. Every US-VIEW-1..7 acceptance criterion, as amended by §4 deltas.
2. V1-reference §16 checklist, capability-mapped (lens/theme table in
   §4.1 is the mapping key).
3. UI_SPEC.md states and interactions verified via Playwright e2e +
   Playwright MCP walkthrough with the canonical fixture
   (`planning/archive/model-viewer/ph_nav_v2_example.hbjson`,
   Ed 2026-06-12 — coverage map in PLAN.md Phase 2) plus the real
   52 MB multifamily fixture
   (`Hillandale_Gateway_NAR_260402.hbjson`, Ed 2026-06-12) for
   scale, named constructions, and Inches→SI conversion. Paths
   neither fixture covers (Adiabatic, AirBoundary, duct/pipe
   geometry at scale) are synthetic-tested per PLAN.md Phase 2.
4. A non-technical user test: John (or a stand-in) can open a project
   URL logged-out, orbit, click a wall, and read its construction —
   with zero instruction.
