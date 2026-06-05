---
DATE: 2026-06-05
TIME: 16:50 EDT
STATUS: Active — not yet started
AUTHOR: Codex
SCOPE: Port the V1 Honeybee-Energy WindowConstruction export to
       V2, ship the deterministic identifier escaping rule,
       collision detection, REST endpoint, header overflow-menu
       action, MCP read tool, and V1 shape fixture for Rhino /
       Grasshopper consumers.
RELATED:
  - planning/features/apertures/PRD.md §17, §21 decision 17,
    §22 acceptance summary
  - planning/features/apertures/PLAN.md (Phase 10 row, R5)
  - ../ph-navigator/backend/features/aperture/services/to_hbe_window_construction.py
    (V1 source — port target)
  - phase-09 (per-element U-Value service this export consumes)
---

# Phase 10 — HBJSON window-constructions export

## P0. Why this slice

Phase 10 is the **Rhino / honeybee_ph bridge**. The user picks
`⋯ → Export window constructions (HBJSON)` in the Apertures
header; the backend returns a JSON payload keyed by aperture-
element identifier, each value a `WindowConstruction.to_dict()`
with a single `EnergyWindowMaterialSimpleGlazSys` material whose
`u_factor` is the per-element U-Value from Phase 09 and whose
`shgc` is the element's glazing `g_value`.

V1 ships `vt=0.6` as a hardcoded default. V2 preserves that
until a real VT field exists on the glazing catalog.

The identifier escape rule (PRD §17 / §21 decision 17) is fixed
here forever: `[^A-Za-z0-9_]` → `_`, runs collapsed, collisions
are hard errors. Changing it in a future release breaks Rhino
component scripts in the wild, so the rule lives in `context/`
documentation as a stable contract.

By the end of Phase 10:

- New backend module
  `backend/features/aperture_hbjson_export/` ships a service
  that returns the V1-shaped payload for the requested source
  (draft or version).
- The service consumes the Phase 09 per-element U-Value cache.
- A REST endpoint and an MCP read tool both expose the export.
- The Apertures header overflow menu surfaces
  `Export window constructions (HBJSON)`.
- A V1 shape fixture under
  `backend/features/aperture_hbjson_export/__tests__/fixtures/v1_shape.json`
  is the parity contract; any V2 deviation requires a phase-level
  decision.
- The identifier escape rule is documented in
  `context/technical-requirements/hbjson-export.md` so the
  Rhino / honeybee_ph component side has a citable contract.

Phase 10 does **not** ship: VT field promotion (deferred),
manufacturer filters (Phase 11), refresh-from-catalog (Phase 12),
or MCP write tools (Phase 13).

## P1. Acceptance — Phase 10 done when

1. New module
   `backend/features/aperture_hbjson_export/` ships:
   - `service.py` —
     `export_aperture_window_constructions(body: ProjectDocumentV1,
     source: ProjectDocumentSource) -> dict[str, dict]`.
     Returns a JSON object keyed by escaped identifier with each
     value matching the V1
     `WindowConstruction.to_dict()` shape.
   - `identifiers.py` — `escape_hbjson_identifier(raw: str) -> str`
     plus collision detection helpers.
   - `routes.py` —
     `GET /projects/{id}/versions/{vid}/apertures/hbjson?source=draft|version`.
   - `__tests__/test_service.py`, `test_identifiers.py`,
     `test_routes.py`.
   - `__tests__/fixtures/v1_shape.json` — exact V1 output for a
     reference aperture (built by running V1 on the same fixture
     and capturing the response).
2. **Identifier escaping rule**:
   - `re.sub(r"[^A-Za-z0-9_]", "_", raw)`.
   - Collapse consecutive `_` to single `_`.
   - Strip leading / trailing `_`.
   - Empty result after escaping → raise
     `aperture_hbjson_identifier_empty`.
3. **Identifier format**:
   - `f"{escape(aperture_name)}_C{element.column_span[0]}_R{element.row_span[0]}"`.
   - Examples (PRD §17):
     - `Door A` + col 0 + row 0 → `Door_A_C0_R0`.
     - `CW01` + col 2 + row 1 → `CW01_C2_R1`.
     - `Type B/2` + col 0 + row 0 → `Type_B_2_C0_R0`.
4. **Collision detection**:
   - Iterate every aperture-element identifier; if any two
     post-escape identifiers collide, raise
     `aperture_hbjson_identifier_collision` with structured
     detail naming both source apertures.
   - The error response carries the offending names and
     suggests renaming one aperture; **no silent disambiguation
     with suffixes**.
5. **Construction payload**:
   - One `WindowConstruction` per aperture element.
   - Identifier as in §P1.3.
   - One `EnergyWindowMaterialSimpleGlazSys` material per
     construction. Material identifier:
     `f"{construction.identifier}_GlazSys"`.
   - Material fields:
     - `u_factor` = per-element U-Value from the Phase 09
       cache (W/m²K, SI canonical).
     - `shgc` = element's `glazing.g_value`, fallback `0.5` if
       null (V1 fallback).
     - `vt` = `0.6` hardcoded.
   - `to_dict()` shape mirrors honeybee_energy's expected
     schema (lifted from the V1 source).
6. **REST endpoint**:
   - `GET /projects/{id}/versions/{vid}/apertures/hbjson?source=draft|version`.
   - Returns the constructions JSON object directly (the V1
     contract).
   - On collision or empty-identifier errors, returns 422 with
     the structured error envelope.
   - Honors locked / Viewer read access — viewers can export.
   - Authenticated; project-scoped.
7. **Apertures header overflow menu** action:
   - Label: `Export window constructions (HBJSON)`.
   - Icon: lucide `Download`.
   - Click downloads a JSON file named
     `<project_slug>_<version_label>_apertures.hbjson.json`.
   - Source resolves to the active source (draft if dirty,
     saved version otherwise) — the same resolution the rest
     of the project header uses.
   - Hidden for Viewers in v1 (export is editor-scoped here;
     Phase 13's MCP tool will revisit for viewer scenarios).
   - Disabled if the active aperture set is empty.
   - On 422 collision, surface a Sonner toast naming the
     offending apertures.
8. **MCP read tool** (deferred-tool-style registration):
   - `get_aperture_window_constructions(project_id,
     version_id, source?)` returns the same payload.
   - Same auth + scoping rules as other Apertures-feature MCP
     tools (Phase 13 ships the bulk semantic-write tools; this
     read tool lives in the export module so it can be
     standalone).
9. **Contract documentation**:
   - `context/technical-requirements/hbjson-export.md` records:
     - the identifier escape rule (verbatim);
     - the per-construction payload shape;
     - the VT hardcoded default and the conditions under which
       it would change;
     - the collision-error contract;
     - guidance for the Rhino / honeybee_ph component side
       (linking back to the
       `from_dict` consumer pattern in `honeybee_ph`).
10. `make ci` is green.

## P2. Files

### New (backend)

- `backend/features/aperture_hbjson_export/__init__.py`
- `backend/features/aperture_hbjson_export/service.py`
- `backend/features/aperture_hbjson_export/identifiers.py`
- `backend/features/aperture_hbjson_export/routes.py`
- `backend/features/aperture_hbjson_export/mcp.py`
- `backend/features/aperture_hbjson_export/__tests__/test_service.py`
- `backend/features/aperture_hbjson_export/__tests__/test_identifiers.py`
- `backend/features/aperture_hbjson_export/__tests__/test_routes.py`
- `backend/features/aperture_hbjson_export/__tests__/fixtures/v1_shape.json`

### New (frontend)

- `frontend/src/features/apertures/components/ExportHbjsonAction.tsx`
- `frontend/src/features/apertures/lib/downloadFile.ts`
- `frontend/src/features/apertures/__tests__/ExportHbjsonAction.test.tsx`

### New (docs)

- `context/technical-requirements/hbjson-export.md`

### Modified

- `frontend/src/features/apertures/components/AperturesHeader.tsx`
  - Add `<ExportHbjsonAction />` to the overflow menu.
- `backend/main.py` — mount the new routes.
- Backend MCP registry — register the read tool.

### Deleted

None.

## P3. Component / model shapes

```python
# backend/features/aperture_hbjson_export/identifiers.py — sketch

_ESCAPE_RE = re.compile(r"[^A-Za-z0-9_]")
_COLLAPSE_RE = re.compile(r"_+")


def escape_hbjson_identifier(raw: str) -> str:
    cleaned = _ESCAPE_RE.sub("_", raw)
    cleaned = _COLLAPSE_RE.sub("_", cleaned)
    cleaned = cleaned.strip("_")
    if not cleaned:
        raise api_error(
            422,
            "aperture_hbjson_identifier_empty",
            "Aperture name escapes to an empty Honeybee identifier.",
            {"raw": raw},
        )
    return cleaned


def detect_collisions(identifiers: list[tuple[str, str]]) -> list[Collision]:
    """`identifiers` = [(escaped, source_aperture_name)]."""
    seen: dict[str, str] = {}
    collisions: list[Collision] = []
    for escaped, source in identifiers:
        if escaped in seen and seen[escaped] != source:
            collisions.append(Collision(escaped=escaped, first=seen[escaped], second=source))
        else:
            seen[escaped] = source
    return collisions
```

```python
# backend/features/aperture_hbjson_export/service.py — sketch

def export_aperture_window_constructions(
    body: ProjectDocumentV1,
    source: ProjectDocumentSource,
) -> dict[str, dict]:
    identifiers: list[tuple[str, str]] = []
    payloads: dict[str, dict] = {}

    for entry in body.tables.apertures:
        u_values = calculate_aperture_u_values(entry)
        u_by_element = {e.element_id: e.u_value_w_m2k for e in u_values.elements}
        escaped_name = escape_hbjson_identifier(entry.name)
        for el in entry.elements:
            ident = f"{escaped_name}_C{el.column_span[0]}_R{el.row_span[0]}"
            identifiers.append((ident, entry.name))
            payloads[ident] = build_construction_dict(
                identifier=ident,
                u_factor=u_by_element[el.id],
                shgc=el.glazing.g_value if el.glazing else 0.5,
                vt=0.6,
            )

    collisions = detect_collisions(identifiers)
    if collisions:
        raise api_error(
            422,
            "aperture_hbjson_identifier_collision",
            "Two aperture elements would export with the same Honeybee identifier. Rename one of the apertures.",
            {"collisions": [c.model_dump() for c in collisions]},
        )

    return payloads


def build_construction_dict(
    *, identifier: str, u_factor: float, shgc: float, vt: float,
) -> dict:
    material = {
        "type": "EnergyWindowMaterialSimpleGlazSys",
        "identifier": f"{identifier}_GlazSys",
        "u_factor": round(u_factor, 4),
        "shgc": round(shgc, 4),
        "vt": vt,
    }
    return {
        "type": "WindowConstruction",
        "identifier": identifier,
        "materials": [material],
    }
```

```tsx
// ExportHbjsonAction.tsx — sketch

export function ExportHbjsonAction(props: { projectId: string; versionId: string; }) {
  const onClick = async () => {
    try {
      const blob = await fetchHbjsonExportBlob(props.projectId, props.versionId);
      downloadFile(blob, suggestedFilename(props));
    } catch (err) {
      const e = err as ApiError;
      if (e.code === "aperture_hbjson_identifier_collision") {
        toast.error(
          `Two apertures collide on identifier '${e.detail.collisions[0].escaped}'. Rename one.`,
        );
        return;
      }
      toast.error("Export failed.");
    }
  };
  return (
    <OverflowMenuItem icon={DownloadIcon} onClick={onClick}>
      Export window constructions (HBJSON)
    </OverflowMenuItem>
  );
}
```

## P4. Sequence

1. **Commit 1 — Identifier escaping primitives + tests.**
2. **Commit 2 — Export service + V1 shape fixture.** Capture
   the V1 output for the reference fixture and lock it in.
3. **Commit 3 — REST route + MCP tool.**
4. **Commit 4 — Frontend export action.**
5. **Commit 5 — `context/technical-requirements/hbjson-export.md`
   contract docs.** `make ci` green.

## P5. Tests

### Backend — identifiers

- `escape_hbjson_identifier("Door A") === "Door_A"`.
- `escape_hbjson_identifier("Type B/2") === "Type_B_2"`.
- `escape_hbjson_identifier("---") → 422 empty-identifier`.
- `detect_collisions` returns the matching `Collision` records
  for `[("Door_A_C0_R0", "Door A"), ("Door_A_C0_R0", "Door-A")]`.

### Backend — service

- V1 shape fixture: running the service against the fixture
  aperture set returns a JSON object that matches
  `fixtures/v1_shape.json` exactly.
- Collision case: two apertures named `Door A` and `Door-A`
  with a `C0 R0` element each → 422 with both names in the
  detail.
- Null `glazing.g_value` → `shgc = 0.5` in the material payload.

### Backend — routes

- `GET ?source=draft` returns the draft body's payload.
- Locked version → 200 (export is read-only against the body).
- Unknown source → 422.

### Frontend — action

- Click downloads a JSON blob with the expected filename.
- On 422 collision, the toast names the offending escaped
  identifier.

### Browser

- Open an aperture set; click the overflow menu; verify the
  Export action label.
- Click; verify a JSON file downloads with the expected shape.
- Create two apertures named `Door A` and `Door-A` with a `C0
  R0` element each; click Export; verify the toast names the
  collision and the file does not download.

## P6. Out of scope (lands in later phases)

- Manufacturer filters — Phase 11.
- Refresh-from-catalog dialog — Phase 12.
- MCP semantic-write tools — Phase 13.
- VT field promotion to glazing catalog — deferred indefinitely.

## P7. Risks

- **R-10-1. Honeybee `to_dict()` shape drifts over honeybee_energy
  versions.** Mitigation: V1 shape fixture is the contract; if
  upstream honeybee_energy changes the shape, V2 stays on the V1
  contract until the Rhino component side migrates, then a
  coordinated breaking-change release updates both sides.
- **R-10-2. Identifier escape rule changes break Grasshopper
  scripts.** Mitigation: the rule is documented in
  `context/technical-requirements/hbjson-export.md` and the
  decision is in PRD §21. Any future change is a coordinated
  breaking-change release; the rule does not silently evolve.
- **R-10-3. Cache miss on first export of a fresh aperture
  type.** Mitigation: Phase 09's cache repopulates on demand;
  first call may take longer but subsequent calls are instant.
- **R-10-4. VT hardcoded `0.6` is a guess.** Mitigation: V1
  parity. Promotion to a real catalog field is a future scope
  decision (likely tied to a catalog-schema bump per Phase 01's
  `catalog_schema_version` hook).
