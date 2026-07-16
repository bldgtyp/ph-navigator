# STATUS — aperture-psi-install

**State:** 🟡 Requested — need documented, **not scoped**. Blocked on a UI /
data-entry decision (Ed's call). No backend work started.

**Origin:** Surfaced while building the `HBPH+ - PH-Nav Get Apertures` component
(route 3) in `honeybee_grasshopper_ph_plus`. Project 2524 returned
`psi_install_w_mk: null` on ~196 frames; the GH client now falls back to a 0.04 W/mK
placeholder, so the value reaching the PH model is fabricated, not project data.

**Ask:** frames need to *store* a real Psi-Install value and route 3 needs to *emit*
it. See `README.md` for why it matters (PH install thermal bridge) and the open
questions (per-frame vs. per-edge, catalog vs. hand-entry, default policy).

**Deliberately NOT decided here:** the UI. Do not build data-entry off this doc.

## Checklist

- [x] Document the need (this folder).
- [ ] Decide granularity: per-frame vs. per-edge (top/sill/jambs).
- [ ] Decide data source: hand-entered vs. shared install-detail library.
- [ ] Decide default policy: PH-Nav defaults + warns, or emits `null` for the
      consumer to default (GH currently owns the 0.04 fallback).
- [ ] Data-model + route-3 emission change.
- [ ] UI / data-entry (blocked on the decisions above).
