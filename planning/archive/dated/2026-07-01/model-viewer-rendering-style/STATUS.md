---
DATE: 2026-07-01
TIME: 00:55 EDT
STATUS: Complete — merged to main via PR #26 (2c533d4b); worktree/branch cleaned up
AUTHOR: Ed May / Claude
SCOPE: Live progress + resume recipe for the model-viewer rendering-style refactor
RELATED: ./README.md, ./research.md, ./target-spec.md
---

# STATUS — where we are, what's left

Pick-up doc. If interrupted, read this first, then `research.md` (§7 baseline,
§4–6 findings) and `target-spec.md` (the knob plan).

## TL;DR

Made the 3D viewer feel "solid" like **Spacio** (matte white study-model). The
look now **ships as the default** (`DEFAULT_RENDER_SETTINGS`): soft key+fill
lighting (raked directional key + hemisphere fill) + **N8AO** + a near-white
neutral palette + dark opaque windows + a **flat unlit hover/selection highlight**
+ lightened edges, on a light neutral background. Verified ~free on Hillandale.
Precedent, baseline, and the licensed-fixture leak fix are all done; the simplify
cleanup pass is applied (lint 0 / build ✓ / 65 unit tests green). **Merged to
`main` 2026-07-01 via PR #26 (`2c533d4b`); CI green (backend + frontend); the
`viewer-rendering-style` branch and worktree are removed.**

## Where this work lives (resume recipe)

- **Worktree:** `/Users/em/Dropbox/bldgtyp-00/00_PH_Tools/phn-viewer-rendering`
  on branch **`viewer-rendering-style`** (off `main`). Isolated from `codex/*`.
- **Stack:** Postgres + MinIO in Docker (shared, usually already up). Start
  backend/frontend from the worktree: `make backend`, `make frontend`
  (:8000 / :5173). Sign in as `codex@example.com` / `password`.
- **Heavy fixture:** Hillandale is local-only (gitignored) at
  `backend/tests/fixtures/Hillandale_Gateway_NAR_260402.hbjson`; canonical source
  in Dropbox `…/2534_Hillandale_Gateway_NAR/14_HBJSON/`. (See
  [[project_licensed_hbjson_committed_public_repo]] — do NOT recommit it.)
- **Perf/visual harness (gitignored `working/`):**
  - `working/perf-baseline.spec.ts` — per-lens orbit FPS capture.
  - `working/ao-compare.spec.ts` — AO off/on screenshots + FPS.
  - Run: copy into `frontend/tests/e2e/`, then
    `pnpm exec playwright test <spec> --project=chromium --headed`, then move it
    back out (keep the committed e2e dir clean).
  - Outputs land in `working/*.png` / `working/*.json`.
- **Dev render panel:** mounts on `localhost:5173` when DEV — top-left
  "render (dev)" panel; harness control via `window.__phnViewerRender.set({...})`.

## Done

- **Precedent** collected + reverse-engineered (Spacio/Qonic/Forma/Giraffe/Arcol)
  → `research.md` §4. "Solid" = AO + soft IBL + tone mapping + matte + light
  edges. Screenshots in `assets/precedent/` (gitignored).
- **Baseline** captured (`research.md` §7.1): Hillandale ~60 FPS / 14 draw calls
  steady; vsync-capped (hidden headroom); real stutter is cold-start. Budget:
  hold steady ≥ 55 FPS on Hillandale.
- **Licensed-data leak fixed** — 49 MB Hillandale `.hbjson` purged from public
  history (filter-repo + force-push), gitignored, tests resolve it locally /
  skip when absent.
- **AO knob prototyped** (N8AO): dev panel + `window.__phnViewerRender` +
  `useViewerRenderSettings` store + wired into `ViewerCanvas` composer. AO-off =
  byte-for-byte today's look. **Result:** works + measurable; building lens
  59.9→52.8 FPS (tunable via quality), other lenses ~free. **Visual:** at
  intensity 2/radius 1 it's too strong + grimy → over-darkens because it isn't
  paired with lifted soft lighting.

## Current state (this session)

**Soft-lighting + tone-mapping knobs shipped; combined look validated.** Fixed-
camera capture (`working/look-*.png`) layered today → soft → +AO → +tonemap:
- **Soft + AO (intensity 1.0 / radius 0.6) is the win** — clean warm-white
  massing with gentle contact shadow in the reveals; reads as a "solid study
  model", close to Spacio. Big jump from today's flat grey.
- Tone mapping works *through* the AO composer (renderer-level ACES + exposure)
  but is a subtle polish at exposure 1.0.
- Spaces (color-by) lens: AO defines the volumes but transparent-green + AO gets
  a touch busy — consider less/no AO on transparent lenses.
- **Perf: RESOLVED — the full stack is ~free.** The 32 FPS was pure cold-start
  (shader recompile + GPU upload, counted by a warm-up-less harness). Clean warm
  measurement (`working/perf-knobs.json`; warm-up 16 / measure 30 frames): the
  whole soft + AO + tonemap stack costs **~1 ms/frame** steady (off 119 → full
  116 FPS on this run's ~120 Hz display; AO 'medium' ~+1 ms, soft + tonemap
  free; min never < ~110). No need to drop AO quality for perf; 'high' is fine.
  Only artifact is the one-time cold-start hitch (folds into model-load if
  defaulted; smooth with a shader pre-warm if it ever bugs us). AO `quality` is
  now a knob (`aoQuality`) in the store + panel.
- **Surface "muddy tan" was a MATERIAL issue, not tone mapping.** A/B of tone-map
  curves (`working/tone-*.png`) showed ACES ≈ AgX ≈ Neutral ≈ off — identical.
  Root cause: shaded face albedo was warm beige `#d8d1c6` + a warm soft-dome
  ground bounce. **Fixed:** `faceMesh` base → **`#edecea`** (near-white; ducts/
  pipes keep `#d8d1c6`), `VIEWER_SOFT_GROUND_COLOR` → **`#d8d7d4`** (neutral),
  hemisphere intensity 2 → **2.4**. Result (`working/surface-white.png`): clean
  near-white study-model with AO as gentle contact shadow — the Spacio look.
- **Tone mapping REMOVED** — renderer-level `gl.toneMapping` is bypassed by the
  EffectComposer (always active), so the toggle/curve/exposure did nothing (Ed
  confirmed). Removed the controller + store fields + panel rows to keep the
  panel honest. The look doesn't need it (bright key clipping lit faces to white
  is the desired effect). If we ever want highlight rolloff, add a postprocessing
  `ToneMapping` effect *inside* the composer (needs the `ToneMappingMode` enum —
  not re-exported by `@react-three/postprocessing`, and pnpm-strict blocks
  importing the transitive `postprocessing`; add it as a direct dep then).
- **Palette neutralized (warmth removed).** Surfaces were warm vs Spacio's
  cool-neutral: faceMesh albedo `#edecea` → **`#ececec`** (neutral); hemisphere
  sky `#fdfdfb`→`#fcfcfc`, ground `#d8d7d4`→`#d6d6d6` (neutral); soft-mode
  background `#e9ecf0` (too blue/saturated) → **`#eef0f1`** (lighter, low-sat).
  Result `working/surface-white.png`: clean cool-neutral white.
- **AO quality** select stays (that one works); `aoQuality` knob in store.
- **Windows darker + more opaque** — aperture base `#b9c8d5`→**`#6b7883`**,
  opacity `0.68`→**`0.85`** (read as dark glass, not pale film).
- **Flat unlit hover/selection highlight** (`HighlightOverlay` in `BatchedLens`).
  The old highlight recolored the object's *albedo* in the lit BatchedMesh, so
  the strong key washed it out / it blended through glass. Now the hovered/
  selected object's geometry is drawn on top with an unlit `MeshBasicMaterial`
  (polygon-offset, single-sided, cached + disposed) → a crisp flat colour
  regardless of lighting. Selection = `highlight`, hover = `highlightSoft`;
  overlay never intercepts picking. (Verified: real mouse-hover shows the flat
  pink; single-sided so it correctly doesn't x-ray back-facing objects.) The
  legacy per-instance `setColorAt` swap still runs underneath as a harmless
  fallback — could be removed later.
- **Look LOCKED as the default (2026-06-30).** `DEFAULT_RENDER_SETTINGS` now ships
  the look on: `ao:true` (intensity 3.0, radius 2.5, medium), `softLighting:true`
  (key 3.4, fill 1.4, elev 45°, azim 264°). Production now renders the solid
  study-model look; the dev panel stays dev-only for future tuning.
- **Background lightened to near-white** — `VIEWER_SOFT_BG_COLOR #eef0f1`→
  **`#f5f5f6`** (was reading as a dark blue-grey; now light + neutral, lit faces
  still pop because the strong key clips them brighter).
- **Panel moved** to `top: 120px` + scrollable (`max-height`), clear of the
  file-version chip + theme selector (was overlapping at `top: 14`).
- **Lighting rebalanced to key+fill** (was too flat/fill-dominant → everything
  muddy mid-grey). Soft lighting is now a bright directional **key** (default
  2.6) + hemisphere **fill** (default 1.1) so sunlit faces pop near-white and
  shadowed faces stay grey (Spacio's white-vs-grey range). Background switches to
  a **cool grey** (`VIEWER_SOFT_BG_COLOR #e9ecf0`) under soft lighting so whites
  pop (vs warm `snow`). `keyIntensity`/`fillIntensity` are knobs + sliders.
  Result: `working/surface-white.png` — crisp. Ed to fine-tune the balance live.
- **Key-light direction is now a knob** — `keyElevation` (deg above horizon,
  default 45) + `keyAzimuth` (default 225), computed to a Z-up position vector in
  `ViewerCanvas`, with panel sliders. Lets Ed rake the sun so walls catch direct
  key (lower elevation → sun-facing walls out-bright the roof). Foreshadows the
  future solar-scrub feature (elevation/azimuth is exactly a sun position).

## Done (this session, beyond the bullets above)

- Manual tuning with Ed → locked defaults. Edges lightened
  (`VIEWER_FACE_EDGE_COLOR` → `#a8a6a1`). Color-by themes validated over the new
  lighting (saturated, dimensional, no wash-out). Simplify cleanup pass applied.

## Remaining

Nothing blocking. Merged to `main` 2026-07-01 (PR #26, `2c533d4b`); CI green;
worktree/branch cleaned up.

Deferred (not blocking, no owner yet): future user-scrubbed solar position
(elevation/azimuth is already a sun position); `ao-compare`/`look` capture specs
live in `working/` with a real-mouse-hover pattern (synthetic pointer events
don't drive R3F object hover — use `page.mouse.move`).

## Key files

- `frontend/src/features/model_viewer/lib/renderSettings.ts` — knob store + window mirror.
- `frontend/src/features/model_viewer/components/ViewerRenderControls.tsx` — dev panel.
- `frontend/src/features/model_viewer/scene/ViewerCanvas.tsx` — lights + composer (AO/tonemap).
- `frontend/src/features/model_viewer/lib/colors.ts` — edge color, base colors, materials.
- `frontend/src/features/model_viewer/scene/LensBatch.ts` — BatchedMesh substrate + edges.

## Open decisions

- AO `quality` tier vs the 55 FPS budget on the building lens.
- Tone mapping via renderer (`gl.toneMapping`) vs a postprocessing `ToneMapping`
  effect — renderer-level chosen first (no dep friction); verify it survives the
  AO composer, else add the effect.
- Real-time sun shadows deferred to the future solar-scrub feature.
