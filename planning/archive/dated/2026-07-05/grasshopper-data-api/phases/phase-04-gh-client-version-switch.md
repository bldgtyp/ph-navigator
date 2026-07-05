# Phase 04 — GH Shared Client + Version Switch (honeybee_grasshopper_ph_plus)

```
DATE:    2026-07-05
TIME:    13:30
STATUS:  ⏸ DEFERRED — separate repo (honeybee_grasshopper_ph_plus), NOT
         started. Backend (01–03) is done & deployed; pick up here using
         ../CLIENT_HANDOFF.md.
AUTHOR:  Claude (with Ed)
SCOPE:   PHNavV2Client; V1/V2 version switch on the two existing GH
         components (Get Constructions, Get Window Types). DIFFERENT REPO.
RELATED: ../PRD.md §6; ../research.md §2 (V1 client behavior)
```

## Goal

Rhino users flip a `version` input on the two existing components and pull
the same outputs from PH-Nav-V2. V1 behavior untouched (long transition).

## Repo / environment

- Repo: `~/Dropbox/bldgtyp-00/00_PH_Tools/honeybee_grasshopper_ph_plus`
  (check that repo's own AGENTS/CLAUDE/contributing docs before starting;
  its packaging, test, and component-wrapper conventions govern).
- Target runtime: **IronPython 2.7 inside Rhino/Grasshopper**. Hard
  constraints: no f-strings, `typing` imports wrapped in try/except,
  `System.Net.WebClient` (not requests), TLS 1.2 forced via
  `System.Net.ServicePointManager` (copy the existing pattern incl. the
  Rhino-5 macOS AttributeError fallback), `.ToString()` methods on schema
  classes for GH display.
- Existing code to modify/extend:
  `honeybee_ph_plus_rhino/gh_compo_io/ph_navigator/`
  (`constructions_get.py`, `window_types_get.py`, `window_types_schema.py`).
  Locate the corresponding GH component wrappers/user-objects that
  instantiate these interface classes (follow the repo's gh_compo_io →
  component registration pattern) — the switch needs new inputs surfaced
  there too.

## Requirements

### R1 — `PHNavV2Client` (new module in `gh_compo_io/ph_navigator/`)

- Inputs: base url (default `https://api.ph-nav.com`), bt_number, optional
  version id, optional token.
- Behavior: GET `{base}/api/v1/gh/projects/{bt}/...` with
  `?version=<id>` when provided; `Authorization: Bearer <token>` header
  ONLY when a token is provided (no `Bearer None`); **single**
  `json.loads`; **no offset loop**.
- Envelope validation: check `schema_version == 1`; on mismatch raise a
  friendly `IGH.error` telling the user to update the Honeybee-PH+ plugin.
  Surface HTTP errors with the response `detail` when parseable (404
  unknown project / version, 429 rate-limited: "wait a minute and re-run").
- Expose `project`/`version_id`/`last_modified` from the envelope so
  components can print/output them (users will want to see which version
  they pulled).

### R2 — version switch on the two components

- New inputs on both components: `_version` (V1|V2 selector; **default V1**
  during transition), `_version_id_` (optional, V2 only, blank = latest),
  `_token_` (optional, V2 only, blank = anonymous).
- V1 path: existing classes, byte-for-byte unchanged.
- V2 path:
  - Get Constructions → `GET /constructions/hbjson` → payload
    `hb_constructions` (already a dict — no second parse) →
    `OpaqueConstruction.from_dict` per entry. **Outputs identical to V1.**
  - Get Window Types → `GET /aperture-types` → payload `aperture_types` →
    existing `ApertureTypeData.from_dict` pipeline (schema shape is V1
    parity by Phase-02 contract, incl. top-to-bottom row order — the
    existing reversal logic and mm→m conversions stay). One addition:
    `psi_install_w_mk` now arrives for real (previously silently defaulted
    0.04) — no code change needed, but verify values land.
  - Both: same output params (`constructions_`; `window_types_`,
    `constructions_`, `json_`) so downstream GH graphs are untouched.
- Component metadata: bump per the repo's versioning convention; input
  descriptions must state V2 = ph-nav.com app, V1 = legacy v0 app, and that
  `_project_number` means the bt_number in both.

## Out of scope

New element getter components (Phase 05); removing/deprecating V1 paths;
push components.

## Testing / verification

- Follow the repo's existing test conventions (it has CPython-side tests
  for gh_compo_io logic — check before assuming). Unit-test in CPython:
  URL building (version/token permutations), envelope validation and error
  paths (mock the WebClient seam), V2-payload → `ApertureTypeData` parse
  with a fixture captured from a local Phase-02 backend.
- Cross-repo integration smoke: run the local V2 backend (`make dev` in
  ph-navigator-v2), hit the routes with a CPython script mimicking the
  client, then diff resulting HB objects against the V1 component's output
  for an equivalent fixture project.
- **Manual Rhino gate (Ed)**: both components against a real V2 project —
  (a) constructions arrive with correct layers/values AND colors + refs
  visible downstream (WUFI-Passive/PHPP export path), (b) window-type
  geometry bakes identically to V1 (row order!), (c) version pinning pulls
  an older save, (d) blank token anonymous pull works, (e) V1 switch
  position still works against v0.

## Acceptance gate

CPython tests green in that repo's CI; Ed's manual Rhino checklist above
signed off in this folder's STATUS.md.

## Risks / notes

- IronPython JSON: only `json.loads` — payloads must never require types
  JSON can't carry.
- `System.Net.WebClient.DownloadString` + query strings: reuse the proven
  V1 header/query construction; don't introduce `HttpWebRequest`.
- The two repos version independently: the `schema_version` check is the
  only coupling guard — make its error message excellent.
- If Rhino-side edits require Ed (GH user-object files are binary-ish),
  plan the handoff: agent prepares the `gh_compo_io` code + input specs;
  Ed rebuilds the user objects in GH per that repo's release process.
