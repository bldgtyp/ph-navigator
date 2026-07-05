# STATUS — gh-material-thermal-defaults

**State:** 🟢 Backend implemented (2026-07-05, on branch). GH-side wiring still
pending (cross-repo follow-up below). Merge to `main` = Ed's call.

**Origin:** Incoming feature request from the `honeybee_grasshopper_ph_plus` GH
plugin. Triggered by a real 422 downloading constructions for project 2524.

## Summary

Add an opt-in `user_defaults` mode to `GET /constructions/hbjson` so a material
missing only `density_kg_m3` / `specific_heat_j_kgk` is exported with defaults
(600 / 1000) + `warnings`, instead of a whole-export 422. `conductivity` stays
strict. Default mode is `strict` (unchanged). Full spec in `README.md`.

## Decisions taken at implementation

- **Param name:** `on_missing_thermal=strict|user_defaults` (query param on route 2).
- **`warnings` placement:** on the shared `GhEnvelope` (every GH route carries it).
- **`GhWarning` shape:** route-agnostic `{code, message, details}` mirroring the
  error envelope — material specifics (`assembly`, `segment_id`,
  `project_material_id`, `defaulted_fields`) live in the `details` bag, which the
  GH client's existing error-`details` renderer already surfaces. This differs
  from the flat illustrative JSON in `README.md` §3; the shipped shape is the
  contract the GH side codes against.

## Checklist

- [x] Decide param name (`on_missing_thermal`) + `warnings` placement (envelope).
- [x] Add the mode param to `routes.py` `get_constructions_hbjson`.
- [x] Thread mode into `export_rich_constructions` → `_require_material`; fill
      defaults for density/specific-heat, keep conductivity strict.
- [x] Collect defaulted-segment warnings; add `warnings` to the envelope.
- [x] Tests: strict still 422s; `user_defaults` succeeds + populates `warnings`;
      missing conductivity still 422s under `user_defaults`.
- [x] Ping GH side to wire `PHNavV1Client` (send mode + surface `warnings`). Done
      2026-07-05 in `honeybee_grasshopper_ph_plus` — `get_constructions_hbjson`
      sends `on_missing_thermal=user_defaults`; `_surface_warnings` (in the shared
      `_validate_envelope` path) emits envelope `warnings` as `IGH.warning`.

## Cross-repo follow-up (GH side, blocked on this)

`honeybee_grasshopper_ph_plus` → `planning/ph-navigator-v1/02-get-constructions.md`
open questions: send `user_defaults` from `PHNavV1Client.get_constructions_hbjson()`
and surface envelope `warnings` via `IGH.warning`.
