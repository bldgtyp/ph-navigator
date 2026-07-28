---
DATE: 2026-07-28
TIME: 09:17 EDT
STATUS: Active — planning drafted, awaiting Ed's sign-off on open decisions
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Router for void ("Filler") panels in the Aperture Builder.
RELATED: ./PRD.md, ./STATUS.md, ./decisions.md, ./phases/,
  context/ui/pages/apertures-tab.md, context/GLOSSARY.md
---

# Aperture void ("Filler") panels

Support aperture-element layouts where part of the grid is **not part of the
window unit** — e.g. a storefront whose doors extend below the sidelite sill
line (project trigger: unit S15). A void element occupies grid cells to keep
the layout valid but carries no frames, glazing, or operation, and is excluded
from U-value math and every export.

## Read order

1. **`PRD.md`** — verified current model, the `kind` design, consumer behavior
   matrix, GH/Rhino contract, the deferred solid-panel extension, open
   decisions.
2. **`STATUS.md`** — current state and next step.
3. Active phase file under `phases/` (phase map below).

## The four things to know

1. **The coverage invariant is why this works.** Every grid cell must be
   covered by exactly one element (`check_aperture_coverage`, enforced in
   `ApertureTypeEntry`). A void element preserves that invariant while marking
   cells as "not window" — all dimension/merge/split machinery is untouched.

2. **The GH/Rhino side needs zero code changes.** The route-3 export simply
   omits void elements; `create_hbph_window_unit_types` iterates elements by
   absolute grid indices, so missing cells just build no sash. Verified in
   `honeybee_ph_plus_rhino/.../v0/window_types_get.py:157-177`.

3. **`kind` is an enum, not a bool** (`"glazed" | "void"`), specifically so a
   future `"solid"` spandrel-panel kind is an additive change. The solid
   feature itself is **deferred** (PRD §7, decisions.md D-2) — it has real
   cross-repo cost and certifier-dependent modeling semantics.

4. **The U-value cache key must learn about `kind`.**
   `content_hash_for_aperture` (`aperture_u_value/cache.py:77`) deliberately
   excludes name/operation; `kind` affects the result and must be hashed
   (Phase 3).

## Phase map

| Phase | File | Scope | Status |
| --- | --- | --- | --- |
| 1 | `phases/phase-01-schema.md` | `kind` field, validators, wire/TS types | Not started |
| 2 | `phases/phase-02-command.md` | `setElementKind` command + guards on existing commands | Not started |
| 3 | `phases/phase-03-consumers.md` | U-value, route-3 GH export, route-4 HBJSON export, cache key | Not started |
| 4 | `phases/phase-04-frontend.md` | Canvas rendering, element card, pick/paste/merge guards | Not started |
| 5 | `phases/phase-05-verification-docs.md` | End-to-end + GH smoke, glossary, docs pass | Not started |
| — | (deferred) | Solid spandrel panels | Deferred — see PRD §7 |
