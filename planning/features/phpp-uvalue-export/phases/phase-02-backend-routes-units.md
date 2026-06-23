---
DATE: 2026-06-23
TIME: 17:19 EDT
STATUS: Planned
AUTHOR: Ed (via Claude)
SCOPE: Backend HTTP — preflight + zip routes, zip response helper, IP unit
  annotation.
RELATED: ../PRD.md (§5 units, §9 modal), ../research.md (§1, §2, §5)
---

# Phase 2 — Backend routes + units

Goal: expose Phase-1 logic over HTTP, mirroring the HBJSON route, and apply the
IP `[ <in> in ]` annotation.

## Response helper — `backend/features/shared/responses.py`

Add `zip_download_response(data: bytes, filename: str) -> Response`:
`Response(content=data, media_type="application/zip",
headers={"Content-Disposition": f'attachment; filename="{filename}"'})`.
(Same shape as `json_download_response`.)

## Units — IP annotation

- `render_assembly_csv(plan, *, units)` (Phase 1) now honors `units`:
  in IP, material name → `f"{name} [ {round(thickness_mm/25.4, 1):.1f} in ]"`
  (decisions Q-B default = every row). `MM_PER_IN = 25.4` as a local constant.
- λ stays W/(mK), thickness stays mm, in both unit systems.
- Add IP golden-CSV test variant in `test_phpp_export.py`.

## Routes — `backend/features/envelope/routes.py`

Append two routes (both `ProjectViewAccess`, like HBJSON):

1. `GET /envelope/export/phpp/preflight`
   - `body = get_saved_document(version_id, access)`
   - `plans = phpp_preflight(body)`
   - return JSON: `{ "assemblies": [ {id, name, exportable, reason} … ] }`
   - response model in `backend/features/envelope/models.py`
     (`PhppPreflightItem`, `PhppPreflightResponse`).

2. `GET /envelope/export/phpp?units=IP|SI`
   - `units: Literal["IP","SI"] = "SI"` query param (validate; default SI).
   - `body = get_saved_document(version_id, access)`
   - `data = build_phpp_zip(body, units=units)`
   - `zip_download_response(data, f"phpp-u-values-{units}-{version_id}.zip")`

## Tests — `backend/features/envelope/tests/` (route-level)

- 200 + `application/zip` + `Content-Disposition` filename includes units.
- `?units=IP` zip contains the inch annotation; `SI` does not.
- Preflight returns correct `exportable`/`reason` per assembly (good + each
  error kind).
- Over-limit / incomplete assemblies still yield a zip (with error CSVs), not a
  422 — the deliberate divergence from HBJSON (decisions Q-E).
- Invalid `units` value → 422 from FastAPI validation.

## Done when

`uv run pytest` green; manual `curl` of both endpoints against a seeded version
returns sane JSON and a valid zip.
