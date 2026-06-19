---
DATE: 2026-06-18
TIME: -
STATUS: Done
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 04c — soften the lens transition with an imperative fade-in on the
       batched substrate (no per-frame React reconcile).
RELATED: ../PRD.md §7, ../decisions.md D-8, review F8
RESOLVES: F8 (lens-fade re-render)
DEPENDS ON: Phase 04b (every mesh lens on the batched substrate)
---

# Phase 04c — Imperative lens fade-in

Phase 01 parked the lens transition as a hard cut (it removed `useLensFade`'s
per-frame `setState`, the dominant F8 cost). This phase adds back a soft
transition imperatively.

**Decision (2026-06-18, Ed): fade-in only, not a true cross-fade.** A faithful
cross-fade would need the outgoing lens's batch kept alive past the React render
that switched the lens, both batches tweened, then the outgoing one disposed
without leaking buffers (CR3 risk) — a sizable imperative dual-batch lifecycle
for pure polish. Instead the incoming lens fades up while the old lens hard-cuts
away as it does today: ~80 % of the visual benefit, none of the dual-batch
lifecycle or dispose/leak risk. Faithful cross-fade stays an option if ever
wanted (recorded so the narrowing is intentional, not forgotten).

## In scope

- When a lens's `BatchedLens` mounts, its batch materials start at opacity 0 and
  tween up to their base opacity over ~0.18 s in `useFrame` — written directly to
  the materials, no React state churn or per-frame allocation (PRD §7 / A6).
  `frameloop="demand"` is preserved by `invalidate()`-ing each fade frame until
  the tween settles, then going idle.
- The opaque batch needs `transparent` + `depthWrite=false` during the fade,
  restored to opaque (early-Z) on completion. No outgoing-batch management — the
  old lens unmounts and disposes exactly as today.

## Out of scope

- True cross-fade (outgoing fade-out) — deferred per the decision above.
- Any substrate/theming/picking changes (done in 03b/04a/04b).

## Verification

- `make format` + `make ci` green.
- Playwright MCP: lens switches fade in smoothly; the perf overlay shows render
  frames only during the ~0.18 s tween, then idle (A6 — no continuous
  re-render). No leaked materials after repeated lens + model swaps.

## Exit criteria

- [x] Incoming lens fades in imperatively; no per-frame React reconcile/alloc (F8).
- [x] Opaque batch restored to opaque (early-Z) after the fade.
- [x] `frameloop="demand"` preserved — idle after the tween (A6).

## Outcome (2026-06-18)

Landed as the fade-in-only variant Ed chose. `LensBatch` gained `setOpacity(k)`
— it owns its materials, so it owns the opacity/transparent/depthWrite policy
(opaque batch blends + skips depth while fading, restores early-Z at `k>=1`).
`BatchedLens.useLensFadeIn` drives it from a self-terminating
`requestAnimationFrame` loop in a `useLayoutEffect` (hides before the first
frame → no flash; cleanup cancels an in-flight fade on lens/model change). No
`useFrame` subscriber and no React state churn (F8); `invalidate()` per fade
frame, then idle (A6). **Verified in-browser**: building settles to solid opaque,
spaces to translucent 0.32, floor-areas→building restores early-Z, picking
intact post-fade, 0 scene errors. simplify pass folded the material-state policy
into `LensBatch.setOpacity` (removed `as Material` casts + the reach through
optional mesh fields) and replaced the `useFrame`/`done`-flag ref with the rAF
loop. Evidence: `working/phase04c-*.png`.
