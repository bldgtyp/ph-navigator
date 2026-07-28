---
DATE: 2026-07-28
TIME: 09:17 EDT
STATUS: Implemented on branch — Ed Rhino acceptance, PRs, and merge pending
AUTHOR: Claude (Fable 5) with Ed May
SCOPE: Router for void ("Empty") panels in the Aperture Builder.
RELATED: ./PRD.md, ./STATUS.md, ./decisions.md, ./phases/,
  context/ui/pages/apertures-tab.md, context/GLOSSARY.md
---

# Aperture void ("Empty") panels

Support aperture-element layouts where part of the grid is **not part of the
window unit** — e.g. a storefront whose doors extend below the sidelite sill
line (project trigger: unit S15). A void element occupies grid cells to keep
the layout valid but carries no frames, glazing, or operation, and is excluded
from U-value math and every export.

## Read order

1. **`PRD.md`** — verified current model, the `kind` design, consumer behavior
   matrix, GH/Rhino contract, the deferred solid-panel extension, decisions.
2. **`STATUS.md`** — current state and next step.
3. Active phase file under `phases/` (phase map below).
4. Background only: `reviews/2026-07-28-plan-review.md` — independent Opus
   review, fully folded into the docs above; read for the F-1/F-2 traces.

## The four things to know

1. **The coverage invariant is why this works.** Every grid cell must be
   covered by exactly one element (`check_aperture_coverage`, enforced in
   `ApertureTypeEntry`). A void element preserves that invariant while marking
   cells as "not window" — all dimension/merge/split machinery is untouched.

2. **The GH/Rhino side needs zero code changes for the S15 shape — with one
   exception.** Route 3 omits void elements; the GH builder places elements
   by absolute grid indices, so missing cells just build no sash. But a
   **fully-void grid column** silently shifts later columns left
   (`WindowUnitType.build()` enumerates occupied columns positionally —
   review F-1). Plan: one-line GH-side fix + a permanent PHN route-3 422
   guard. See PRD §6.

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
| 1 | `phases/phase-01-schema.md` | `kind` field, validators, wire/TS types | Complete |
| 2 | `phases/phase-02-command.md` | `setElementKind` command + guards on existing commands | Complete |
| 3 | `phases/phase-03-consumers.md` | U-value, route-3 GH export, route-4 HBJSON export, cache key | Complete |
| 4 | `phases/phase-04-frontend.md` | Canvas rendering, element card, pick/paste/merge guards | Complete |
| 5 | `phases/phase-05-verification-docs.md` | End-to-end + GH smoke, glossary, docs pass | Automated work complete; Ed Rhino check pending |
| — | (deferred) | Solid spandrel panels | Deferred — see PRD §7 |
