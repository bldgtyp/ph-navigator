# Feature request (from Honeybee-PH+ / Grasshopper): capture per-frame Psi-Install (`psi_install_w_mk`)

```
STATUS:  Requested — need documented, NOT scoped. UI / data-entry approach TBD (Ed).
ORIGIN:  honeybee_grasshopper_ph_plus (GH plugin, PH-Nav V1 client — Get Apertures)
DATE:    2026-07-05
AUTHOR:  Ed + Claude (GH side)
SCOPE:   window/frame data model + route 3 (`GET /aperture-types`). NOT UI (deferred).
RELATED: CLIENT_HANDOFF.md; aperture route 3 payload; gh-material-thermal-defaults (sibling
         "missing PH value" case, already shipped)
```

> **Purpose of this doc:** record the *need* so it is not forgotten. It deliberately
> does **not** propose a UI or an implementation — Ed has not decided how frames should
> capture this value. When that is settled, add the scope/phases then.

## One-liner

Frames need a place to store a **Psi-Install (`psi_install_w_mk`)** thermal-bridge value,
and route 3 (`GET /aperture-types`) needs to emit the real number. Today it is essentially
never set: the value comes back as `null` and the downstream tools fall back to a placeholder.

## Why (real case that surfaced it)

Building **Get Apertures** in Grasshopper against project **2524**, route 3 returned
`psi_install_w_mk: null` on essentially every frame — **196 null occurrences** across the
27 aperture types. The GH plugin currently defaults `null → 0.04 W/mK` (a generic PH
install-psi placeholder) just to keep the parse alive. That means the number flowing into
the Passive-House model is a **fabricated constant, not project data**.

## What Psi-Install is / why it matters (PH context)

`psi_install` (Ψ-install, W/(m·K)) is the **linear thermal bridge at the window-to-wall
installation joint** — the extra heat loss around the perimeter of an installed window,
beyond the frame and glass U-values themselves. In PH accounting it is applied per meter of
window install-perimeter and can be a **material contributor to the envelope heat-loss
balance** (PHPP has a dedicated install-psi input per window edge; it is not negligible,
especially on projects with lots of small windows or deep/over-insulated walls).

Because it is a real, per-installation quantity (it depends on how the window sits in the
wall — over-insulated reveal, flush, etc.), a single hard-coded default is a poor stand-in.
For accurate PH work we need the **actual per-frame (or per-edge) value** to originate in
PH-Navigator and travel through route 3 into Honeybee/PHPP.

## The need (what must become true — not how)

1. **Storage.** A frame (and ideally each frame *edge* — install psi can differ top vs. sill
   vs. jambs) can carry a `psi_install_w_mk` value in the PH-Nav data model.
2. **Emission.** Route 3 (`GET /aperture-types`) emits that stored value on each frame's
   `frame_type` instead of `null`. When genuinely unset, `null` is acceptable (the client
   defaults it) — but a set value must round-trip.
3. **Fidelity.** The value is a float in W/(m·K); no unit surprises across the wire.

## Current interim behavior (GH side — no action needed here)

- `honeybee_grasshopper_ph_plus` V1 aperture schema (`v1/window_types_schema.py`) is
  **null-safe**: a null/missing `psi_install_w_mk` falls back to **0.04 W/mK** (matching the
  legacy V0 default) so the download does not fail. This unblocks the plugin today but is a
  placeholder, not real data — it is exactly the gap this request exists to close.

## Explicitly out of scope (for now)

- **UI / data-entry design** — where and how a user types install-psi (per frame? per edge?
  a library of install-detail types? inherited from an assembly?) is **undecided** and
  intentionally left open. Do not build UI off this doc.
- Per-edge vs. per-frame granularity is flagged as a question, not a decision.
- Any change to the GH client beyond what already ships (it already reads the value straight
  when present).

## Open questions (for whenever this is picked up)

- **Granularity:** one `psi_install` per frame, or one per edge (top / bottom / left / right)?
  PHPP supports per-edge; the frame data model already splits `left/right/top/bottom`.
- **Source of the number:** hand-entered per project, or drawn from a shared install-detail
  library / catalog (analogous to how frame/glazing types are shared)?
- **Default policy:** should PH-Nav itself apply a default when unset (and warn, like
  `gh-material-thermal-defaults`), or keep emitting `null` and let each consumer decide? The
  GH client currently owns the 0.04 fallback.
