# Feature request (from Honeybee-PH+ / Grasshopper): opt-in default-fill for materials missing thermal-mass props

```
STATUS:  Backend implemented (2026-07-05, on branch) — GH-side wiring pending
ORIGIN:  honeybee_grasshopper_ph_plus (GH plugin, PH-Nav V1 client)
DATE:    2026-07-05
AUTHOR:  Ed + Claude (GH side)
SCOPE:   backend/features/gh_api — route 2 (`GET /constructions/hbjson`)
RELATED: CLIENT_HANDOFF.md (the reciprocal GH-data-API contract)
```

> **As-built note (2026-07-05):** shipped as spec'd, with two resolved open
> questions — param name is `on_missing_thermal`, and `warnings` sits on the
> shared `GhEnvelope`. The `GhWarning` wire shape is route-agnostic
> (`{code, message, details}`, mirroring the error envelope) rather than the
> flat illustrative JSON in §3 — the material fields (`assembly`, `segment_id`,
> `project_material_id`, `defaulted_fields`) live inside `details`. See §3 and
> `STATUS.md` for the exact contract.

## One-liner

Add an **opt-in route mode** to `GET /constructions/hbjson` so that a material
missing **only its thermal-mass fields** (`density_kg_m3`, `specific_heat_j_kgk`)
can be exported with **reasonable default values + a warning**, instead of hard
-failing the whole export with 422. Missing `conductivity_w_mk` still 422s. The
mode is **off by default** (strict stays the default); the Grasshopper client
will opt in.

## Why (real case that triggered this)

Downloading constructions for project **2524** from Grasshopper returned:

```
HTTP 422: An assembly references a material that is missing thermal properties.
          missing: density_kg_m3, specific_heat_j_kgk
```

raised by `_require_material` in `backend/features/gh_api/constructions_export.py:162`.
One incomplete material **blocks the entire constructions export** — the GH user
gets zero assemblies until every material is complete in the web app.

For **Passive House / steady-state** work (PHPP, WUFI, EnerPHit), `density` and
`specific_heat` **do not affect the U-value** — that is fully determined by
`thickness` + `conductivity`. Density/specific-heat only matter for **dynamic
EnergyPlus thermal-mass** simulations. So for the GH → Honeybee → PH path, a
material missing those two fields is harmless if we substitute placeholder values
and warn the user. `conductivity` is different — it drives the U-value, so a
missing conductivity must still fail loudly (a wrong default would silently
corrupt the PH result).

## Current behavior (anchors)

- Route: `backend/features/gh_api/routes.py:57` `get_constructions_hbjson(access, version)`
  → `export_rich_constructions(body)`.
- Export: `constructions_export.py` `export_rich_constructions` → `_construction`
  → `_layer_material` / hybrid path → **`_require_material` (line 162)**, which
  raises 422 `construction_export_incomplete` if any of `conductivity_w_mk`,
  `density_kg_m3`, `specific_heat_j_kgk` is `None`. The material is then built at
  `constructions_export.py:77-82` (`EnergyMaterial(conductivity=, density=, specific_heat=)`).
- Response model: `models.py:69` `GhConstructionsResponse(GhEnvelope)` — envelope
  base `GhEnvelope` at `models.py:43`.

## Proposed change

### 1. New route mode (query parameter)

Add a query param to route 2 (name TBD — suggest `on_missing_thermal` or
`materials`), mirroring the existing `VersionQuery` pattern (`routes.py:49`):

| Value | Behavior |
|-------|----------|
| `strict` (**default**) | Current behavior — 422 on any missing `conductivity` / `density` / `specific_heat`. Unchanged for all existing consumers. |
| `user_defaults` | Missing **`density_kg_m3`** → default **600**; missing **`specific_heat_j_kgk`** → default **1000**. Missing **`conductivity_w_mk`** → **still 422** (essential). Export succeeds; each defaulted segment is reported in `warnings` (below). |

Keeping `strict` the default preserves the current contract; only clients that
explicitly want defaults (Grasshopper) pass `user_defaults`.

### 2. Default values (decided by Ed, 2026-07-05)

- `density_kg_m3 = 600` (generic middle-of-road building material)
- `specific_heat_j_kgk = 1000` (canonical generic specific heat)
- Both are EnergyPlus-safe (`density > 0`, `specific_heat >= 100`) and PH-neutral.
- Suggest defining them as named constants near `_require_material` so they are
  discoverable and single-sourced.

### 3. Response signal — `warnings`

So the GH client can tell the user *which* materials were defaulted, `warnings`
is a field on the shared `GhEnvelope` (every GH route carries it; empty `[]` when
nothing was defaulted). **As shipped**, each `GhWarning` is route-agnostic —
`{code, message, details}`, mirroring the error envelope so the GH client's
existing error-`details` renderer handles it unchanged. The material specifics
live inside `details`, one entry per defaulted segment:

```jsonc
"warnings": [
  {
    "code": "material_thermal_defaulted",
    "message": "Used default density (600) and specific heat (1000) — thermal-mass only; no effect on PH U-value.",
    "details": {
      "assembly": "Ext. Wall - Brick",
      "segment_id": "seg-abc",
      "project_material_id": "pmat-42",
      "defaulted_fields": ["density_kg_m3", "specific_heat_j_kgk"]
    }
  }
]
```

The GH client surfaces each as an `IGH.warning` on the canvas.

## GH-side reciprocal changes (this repo will do, once backend ships)

Tracked in `honeybee_grasshopper_ph_plus` (`planning/ph-navigator-v1/02-get-constructions.md`):

1. `PHNavV1Client.get_constructions_hbjson()` sends `on_missing_thermal=user_defaults`.
2. `PHNavV1Client` reads envelope `warnings` and exposes them; the component calls
   `IGH.warning(...)` for each so the user sees which segments got defaults.
   (The client's generic error-`details` renderer already surfaces scalar fields
   like `assembly` / `project_material_id`, so warning rendering can reuse that shape.)

## Decisions already made

- **Density + specific-heat only** get defaults; **conductivity stays strict** (422).
- **Defaults: 600 / 1000.**
- **Opt-in, off by default** — `strict` remains the default mode so other consumers
  are unaffected; Grasshopper opts into `user_defaults`.

## Open questions for the backend

- ~~**Param name / spelling.**~~ **Resolved:** shipped as `on_missing_thermal=strict|user_defaults`.
- ~~**`warnings` placement.**~~ **Resolved:** on the shared `GhEnvelope`, with a
  route-agnostic `{code, message, details}` shape (see §3).
- **Do the aperture routes (3/4) need the same mode?** Still deferred — apertures
  have their own material handling; revisit if the same 422 shows up there.
- **Web-app data hygiene** (flagging incomplete materials before export) is a
  separate, complementary improvement — out of scope here.

## Non-goals

- Fixing the underlying data in project 2524 (that is a web-app data task — enter
  the missing density/specific-heat on the offending material).
- Changing `conductivity` handling (stays a hard 422).
- Any write/push path (GH remains read-only, per D6 of the original handoff).
