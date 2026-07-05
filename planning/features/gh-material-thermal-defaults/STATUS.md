# STATUS — gh-material-thermal-defaults

**State:** 🟡 Proposed — awaiting backend implementation. No backend code changed yet.

**Origin:** Incoming feature request from the `honeybee_grasshopper_ph_plus` GH
plugin. Triggered by a real 422 downloading constructions for project 2524.

## Summary

Add an opt-in `user_defaults` mode to `GET /constructions/hbjson` so a material
missing only `density_kg_m3` / `specific_heat_j_kgk` is exported with defaults
(600 / 1000) + `warnings`, instead of a whole-export 422. `conductivity` stays
strict. Default mode is `strict` (unchanged). Full spec in `README.md`.

## Checklist

- [ ] Decide param name (`on_missing_thermal` vs `materials`) + `warnings` placement.
- [ ] Add the mode param to `routes.py` `get_constructions_hbjson`.
- [ ] Thread mode into `export_rich_constructions` → `_require_material`; fill
      defaults for density/specific-heat, keep conductivity strict.
- [ ] Collect defaulted-segment warnings; add `warnings` to the envelope/response.
- [ ] Tests: strict still 422s; `user_defaults` succeeds + populates `warnings`;
      missing conductivity still 422s under `user_defaults`.
- [ ] Ping GH side to wire `PHNavV1Client` (send mode + surface `warnings`).

## Cross-repo follow-up (GH side, blocked on this)

`honeybee_grasshopper_ph_plus` → `planning/ph-navigator-v1/02-get-constructions.md`
open questions: send `user_defaults` from `PHNavV1Client.get_constructions_hbjson()`
and surface envelope `warnings` via `IGH.warning`.
