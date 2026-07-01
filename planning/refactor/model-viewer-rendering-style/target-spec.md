---
DATE: 2026-06-30
TIME: 18:30 EDT
STATUS: Implemented — the knobs shipped as the default look (see STATUS.md)
AUTHOR: Ed May / Claude
SCOPE: Concrete R3F knobs to move the viewer toward the Spacio "solid" look
RELATED: ./research.md, ./README.md
---

# Target Spec — "solid model" rendering

Translate the research (§4–§6 of `research.md`) into concrete, independently-
toggleable R3F knobs. Target look: **Spacio white-model softness** (matte +
AO + soft sky light + tone mapping) with PH **outlines kept** (lightened), and
**Arcol color discipline** for themes. Each knob ships behind the dev render-
settings hook first, measured against the 2026-06-30 baseline, and is promoted
to a default only if it holds budget (**steady ≥ 55 FPS on Hillandale**).

## Toggle architecture (so we can A/B + measure)

- **`lib/renderSettings.ts`** — a small zustand store (`useViewerRenderSettings`)
  of render knobs, default to today's look (every effect OFF), so production is
  unchanged until we promote a knob. Dev-only `window.__phnViewerRender`
  mirror exposes `get()` / `set(partial)` so the Playwright perf harness can flip
  a knob, orbit, and record FPS on/off in one run.
- **`components/ViewerRenderControls.tsx`** — a dev-only panel (gated on
  `isModelViewerDebugHookEnabled()`, mounted beside `PerfOverlay`) with a
  checkbox/slider per knob, so Ed can eyeball each effect live on a real model.
- **`scene/ViewerCanvas.tsx`** reads the store and assembles the lighting +
  post-processing pipeline from it.

## Knobs (priority order)

### 1. Ambient occlusion — **N8AO** (the #1 "solid" lever) — PROTOTYPING NOW
- `@react-three/postprocessing` v3 already exports `N8AO` (no new dep).
- Rendered inside `<EffectComposer>`; **on heavy models this re-introduces the
  composer we dropped for MSAA** (research §7) → the make-or-break perf test.
- Start params (world units = metres, Z-up): `aoRadius ≈ 1.0`, `intensity ≈ 2.0`,
  `halfRes: true` (big perf win), `quality: 'medium'`, `screenSpaceRadius:
  false`, `denoiseSamples` default. All tunable from the panel.
- Transparent batches (`depthWrite:false`: apertures, space volumes) won't
  write depth → no AO on glass, which is what we want.
- Pair with SMAA in the same composer (AO replaces the MSAA-only heavy path).
- **Measure:** AO off vs on, per lens, on Hillandale; steady FPS + cold-start ms.

### 2. Soft sky lighting (IBL / hemisphere) — NEXT
- Replace today's hard single key (dir 1.55 + flat ambient 0.62) with a soft,
  fill-heavy dome. Options: `<Environment preset="city"|"apartment" />` (drei,
  image-based, gives gentle specular + ambient gradient) and/or a
  `<hemisphereLight>` (sky/ground colors). Drop the directional to ~0.4–0.7 as a
  soft accent, raise ambient/hemisphere fill.
- Knob: `lighting: 'flat' (today) | 'soft'`. Params: hemisphere sky/ground
  colors, directional intensity.

### 3. Tone mapping + color space — NEXT
- `gl.toneMapping = ACESFilmicToneMapping` (or `AgXToneMapping`),
  `toneMappingExposure ≈ 1.0`; ensure `outputColorSpace = SRGBColorSpace`
  (R3F default — confirm). Photographic rolloff vs today's linear/no-tonemap.
- Knob: `toneMapping: 'none' (today) | 'aces' | 'agx'`.

### 4. Lightened outlines — NEXT (keep, don't remove)
- Per-face boundary edges stay (PH requirement). Lighten `VIEWER_FACE_EDGE_COLOR`
  (`#8b8177` → a soft low-contrast grey, e.g. `#b8b2a8`), maybe a touch of
  opacity, so AO carries depth contrast and edges read as gentle creases.
- Knob: `edgeStyle: 'ink' (today) | 'soft'`.

### Out (for now)
- Matcap (breaks true lighting + themes), real-time sun shadows (defer to the
  solar-scrub feature), fat outlines (`Line2`).

## Promotion criteria (per knob)
1. Holds steady ≥ 55 FPS on Hillandale at the baseline viewport (harness A/B).
2. Cold-start first frame not materially worse (or mitigated by a shader
   pre-warm).
3. Reads better with Ed on real models (white-model + a color-by theme).
4. Works with the BatchedMesh substrate + `frameloop="demand"` (no per-frame
   churn beyond the pass itself).

## Promotion path
Once a knob earns its place, fold it into the default look (replace the dev
toggle's default), update `research.md`, and remove the experimental gate.
