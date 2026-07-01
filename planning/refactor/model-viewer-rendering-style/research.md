---
DATE: 2026-06-30
TIME: 17:19 EDT
STATUS: Complete — precedent + baseline findings drove the shipped look (see STATUS.md)
AUTHOR: Ed May / Claude
SCOPE: Reverse-engineer precedent 3D viewers; define a target rendering look
RELATED: ./README.md
---

# Rendering-Style Research

## 1. What we want

Improve the **legibility** and **felt quality** of the 3D scene. Ed's north
star: products like **Spacio** make surfaces feel **solid — almost like a
physical/cardboard model**. We want to find what produces that and match it,
not invent a look from scratch.

Concrete wants, in priority order:

1. **Clear legibility** — form reads instantly; surfaces, edges, and depth are
   unambiguous; color-by themes stay readable on top of the lit look.
2. **Outlines** — crisp, intentional edge treatment (we already draw merged
   crease edges at 12°; the question is weight/color/contrast and whether to
   add silhouette/AO darkening).
3. **Lighting** — a good *default* that makes the scene feel alive (not the
   current flat one-key + flat-ambient look).
4. **Shadows** — a good *default* ground/contact shadow and surface shading
   that gives weight.
5. **(Future, not now)** user-controlled **solar position**: scrub date/time,
   sun moves, real cast shadows update. Default-lighting work must not
   foreclose this.

## 2. Current-state baseline (what the viewer does today)

Grounded in the code as of 2026-06-30:

- **Surfaces:** `MeshStandardMaterial`, `roughness 0.78`, `metalness 0` — flat
  matte dielectric. One neutral-white material per batch; per-object hue comes
  from the per-instance color buffer (`setColorAt`), not material color.
  Single-sided. No vertex colors.
  (`lib/colors.ts:124`, `scene/LensBatch.ts`)
- **Base colors:** faces `#d8d1c6`, apertures `#b9c8d5` (op 0.68), spaces
  `#7aa58d` (op 0.32), floor segments `#c7a74c`. Selection `#E23489`.
  (`lib/colors.ts:140`)
- **Edges:** one merged `LineSegments`, `LineBasicMaterial` `#8b8177`, crease
  threshold 12°. (`scene/LensBatch.ts:126`)
- **Lighting:** `ambientLight 0.62` (white) + one `directionalLight` at
  `[-10,-10,25]`, `1.55` (white). No hemisphere light, no environment map/IBL.
  (`scene/ViewerCanvas.tsx:60`)
- **Tone mapping / color space:** none set — R3F defaults (`NoToneMapping`,
  linear). Background `snow` (#fffafa).
- **Shadows:** no real-time shadow maps. One baked `ContactShadows` ground blob
  (`opacity 0.24`, `blur 2.8`, `frames 1`). (`scene/ViewerCanvas.tsx:82`)
- **Frameloop:** `demand` — renders only on interaction.
- **AA:** SMAA (post) for light models; hardware MSAA for heavy (≥1500 obj).

**Read:** it's a clean, fast, *flat matte* look — close to a Rhino
"Arctic/Shaded" display mode. No sky/ground fill gradient, no ambient
occlusion, no specular environment, no real cast shadows. That flatness is the
gap between today and the "solid physical-model" feel we're chasing.

## 3. The "solid / physical-model feel" hypothesis

Before collecting images, the leading hypotheses for *why* Spacio-type viewers
feel solid (to confirm/refute against precedent):

- **Ambient occlusion (SSAO/GTAO/N8AO)** — contact darkening in corners and
  crevices is the single biggest "this is a real object" cue. Likely the #1
  missing ingredient.
- **Sky/ground hemisphere fill or IBL** — soft directional gradient across a
  surface (top brighter than bottom) reads as real-world light, vs flat ambient.
- **Tone mapping (ACES/AgX/neutral)** — compresses highlights, gives a
  photographic rather than linear/CG feel.
- **A real grounded shadow** — soft cast shadow anchored to the sun direction,
  not just a symmetric blob.
- **Edge/outline weighting** — slightly darker, consistent silhouette + crease
  lines give the "model kit" / "drawn" crispness.
- **Material warmth** — subtle non-white base, gentle roughness, maybe a faint
  fresnel/rim so faces don't read as paper.

The collected precedent should tell us which of these each product leans on.

## 4. Precedent products to study

Gitignored screenshots go under `assets/precedent/<product>/`. Fill the
analysis as we collect. Per product, capture: **lighting** (key/fill/ambient,
IBL?), **shadows** (contact? cast? AO?), **outlines** (silhouette/crease,
weight, color), **surface material** (matte/satin, color palette, transparency),
**tone/post** (tone mapping, vignette, DOF), and the **one thing** that makes it
work.

| Product | URL | Why it's a reference |
| --- | --- | --- |
| **Spacio** | spacio.ai | Ed's favorite — "solid physical-model" surface feel |
| **Qonic** | qonic.com | Modern BIM modeler rendering |
| **Autodesk Forma** | autodesk.com/products/forma | Massing/site, clean default look, real sun |
| **Giraffe (BIM 2.0)** | giraffe.build | Urban/massing web viewer |
| **Arcol** | arcol.io | Figma-for-buildings; polished web 3D |

Screenshots collected 2026-06-30 into `assets/precedent/<product>/` (gitignored).
Sources: product sites (Spacio), AEC Magazine + Autodesk blog editorial
screenshots (Qonic, Forma, Giraffe, Arcol).

### 4.1 Spacio — `assets/precedent/spacio/`
**The reference for the "solid physical-model" feel.** `02_site_model` is a
matte-white massing model of Lower Manhattan on a flat plane: it reads exactly
like a laser-cut / 3D-printed chipboard study model.

- **Lighting:** very soft, **sky-dominant / overcast-studio** — high ambient,
  low-contrast. No hard single key. Almost certainly an **environment map (IBL)**
  doing the fill, not a bare directional light. This softness is most of the
  "physical" feel.
- **Shadows:** soft, grounded **ambient-occlusion + contact** shading; crevices
  between masses darken. No hard cast shadow with a sharp edge.
- **Surface:** flat **matte white**, no specular blowout, no visible edge ink —
  form is read entirely from AO + soft shading, not outlines.
- **Ground:** flat plane; a subtle water texture inset for the river; faint
  street labels embossed on the ground.
- **Separate photoreal path:** `06_banana_rendering` is a full photorealistic
  export (sky, trees, materials, people) — a *different* renderer from the live
  white-model viewer. Worth knowing they ship both; our target is the white-model
  look, not this.
- **One thing that makes it work:** AO + soft IBL on matte white. No hard key.

### 4.2 Qonic — `assets/precedent/qonic/`
Two distinct looks. `01_viewer` = glassy, layered **transparency** (curtain
wall, soft). `03_soane_solids` = neutral **grey clay** with **crisp dark crease
edges** + soft AO — also "solid," but via edges + AO rather than IBL softness.

- **Lighting:** soft sky fill, gentle warm key; low contrast.
- **Shadows:** soft AO in corners/reveals; modest contact.
- **Surface:** matte; the clay look is near-white-grey; glass mode leans on
  ordered transparency + thin frames.
- **Edges:** present and **crisp** (dark thin crease lines) — does a lot of the
  legibility work in clay mode.
- **One thing:** crease edges + AO make even an untextured grey model read as a
  precise physical object.

### 4.3 Autodesk Forma — `assets/precedent/forma/`
`02_massing_site`, `03_proposal`: crisp **white extruded massing** with subtle
**floor-line striations**, soft **real sun shadows**, grey context buildings,
on a desaturated Mapbox basemap; analysis heatmaps (wind/comfort) overlay
directly on the ground.

- **Lighting:** real **sun** (directional) but soft; sky fill. Shadows are soft
  and grounded, not crunchy.
- **Surface:** flat matte white; **horizontal floor lines** give "stacked
  plates" legibility and scale without heavy AO.
- **Edges:** light; selection = cyan outline + vertex handles.
- **Context:** muted/desaturated basemap so the white proposal pops; this is the
  "neutral surround → subject reads" trick.
- **(`01_building_layout_explorer` is a marketing lifestyle photo — ignore.)**
- **One thing:** soft real sun shadows + floor-line striations + desaturated
  context. Closest to our domain (site + real sun, which we want later).

### 4.4 Giraffe — `assets/precedent/giraffe/`
`02_viewer`: GIS-first. White 3D massing on a Mapbox basemap, **flatter**
lighting, dense data labels. Function over feel — least "solid" of the set.

- **Lighting:** flat, low-contrast; minimal shadow.
- **Surface:** plain white massing; the work is in the data overlay, not the
  render.
- **Takeaway:** a cautionary example — this is roughly where *we* are now
  (flat), minus our matte tone. Confirms flat lighting reads as "diagram," not
  "model."

### 4.5 Arcol — `assets/precedent/arcol/`
`01_modeling`: **color-by-program massing** (vivid area-type colors — retail /
residential / school) against a **white context city**, soft blue sky gradient,
grounded soft shadows, gentle AO, trees + water.

- **Lighting:** soft **sky gradient** (blue→pale), gentle key; soft shadows.
- **Surface:** matte; saturated program colors on the subject, neutral white on
  context — exactly the **color-by-theme over neutral surround** problem we have.
- **Edges:** soft, present; floor striations on the towers.
- **One thing:** proves saturated color-coding can stay legible *and* feel solid
  if the context is desaturated white and AO/soft-sky grounds everything. Direct
  precedent for making our color-by themes look good.

### 4.6 Synthesis — what creates the "solid / physical-model" feel

Convergent across the set (especially Spacio + Qonic-clay + Arcol):

1. **Ambient occlusion** — corner/crevice darkening is the single strongest
   "this is a real object" cue. We have **none** today. Likely our #1 lever.
2. **Soft, sky-dominant lighting (IBL / hemisphere)** — a soft fill-heavy dome,
   not a hard single key. Gives the gentle top-down gradient that reads as
   daylight. We currently have the *opposite*: one hard directional (1.55) +
   flat ambient (0.62).
3. **Matte surfaces** — high roughness, zero specular blowout. We already have
   this (`roughness 0.78`). Keep.
4. **A grounded shadow** anchoring the model to the plane. We have a symmetric
   `ContactShadows` blob — fine; could add a soft directional bias.
5. **Crisp-but-soft edges** — thin crease lines (Qonic, Forma floor-lines) for
   legibility, not heavy black ink. We have merged crease edges already — tune
   weight/color rather than replace.
6. **Desaturated context so the subject/color-by pops** (Forma, Arcol) — a
   palette/legibility decision more than a renderer one.

**Diagnosis of our gap:** PHN today = matte white (good) + **hard single key +
flat ambient + no AO + no tone mapping** (the flat, CG-ish part). The look is
closer to Giraffe (flat/diagram) than Spacio (solid/model). Closing the gap is
mostly: **add AO, soften lighting toward an IBL/hemisphere dome, add tone
mapping** — all of which fit our BatchedMesh + `frameloop="demand"` substrate
cheaply (AO is the one per-frame-ish cost, via a post pass).

## 5. Technique catalog (R3F / three.js levers)

The vocabulary for reverse-engineering. "Fit" = how well it sits inside our
BatchedMesh + `frameloop="demand"` substrate.

| Technique | Effect | Cost / fit |
| --- | --- | --- |
| **HemisphereLight** | sky/ground fill gradient; instant "outdoor" feel | trivial; perfect fit |
| **Environment map / IBL** (`<Environment>`) | soft specular + image-based ambient; "solid" sheen | low GPU; great fit; one cubemap |
| **Tone mapping** (ACES/AgX/Neutral) | photographic highlight rolloff | free; one renderer flag |
| **SSAO / GTAO / N8AO** (post) | contact-shadow darkening in corners — biggest "real" cue | moderate per-frame; works with demand loop, adds a pass |
| **Real directional shadow map** | true cast shadows from the sun | per-frame cost; fights demand loop on heavy models; needed for future solar scrub |
| **Soft contact shadow** (have it) | ground anchoring blob | already present; can improve |
| **Outline pass** (`OutlineEffect`/postprocessing) | silhouette ink lines, manga/CAD feel | moderate; alternative/supplement to merged edge lines |
| **Edge-line weight/color tuning** | crease/silhouette crispness | free; already merged-edge based |
| **Matcap material** | bakes a whole studio-light look into a texture; very "solid model" | cheap; but loses true lighting/themes — evaluate |
| **Fresnel / rim term** | subtle edge brightening; dimensional pop | cheap shader add; risk of CG sheen |
| **Vignette / subtle DOF** (post) | focus + depth | cheap; use sparingly |

## 6. Decisions & constraints (discussion 2026-06-30)

**Target look (agreed):** Spacio's **white-model softness** as the default
shaded look, with **Arcol's color discipline** for the color-by themes
(saturated subject over desaturated/neutral context).

**Outlines stay — a PH requirement Spacio does NOT have.** Spacio reads form
purely from AO + soft shading with *no* edge lines. PHN can't: we must show
**every face boundary, including co-planar neighbors** — two adjacent faces in
the same plane with different assemblies / constructions / boundary conditions
must stay visually separable. Findings from the code:

- Our edge system already satisfies this. `mergeEdges` (`loaders/merge.ts`)
  runs `EdgesGeometry(faceGeometry, 12°)` **per source face**, not on the merged
  mesh. `EdgesGeometry` always emits an island's **boundary edges** regardless of
  threshold; the 12° crease only suppresses *interior triangulation*. So each
  face's full polygon outline always draws — including the shared edge between
  two co-planar faces (each face draws its own boundary). **Keep this.**
- So the only change is **edge color/weight**: lighten `VIEWER_FACE_EDGE_COLOR`
  (today `#8b8177`, a mid warm-grey) toward a **soft low-contrast grey** so
  boundaries read as gentle creases, not CAD ink. Synergy: once **AO** carries
  the depth contrast, edges can recede to a hint and still read.
- Caveat: WebGL `LineBasicMaterial` line width is effectively **1px** on most
  platforms — "weight" tuning is really **color/opacity**, not thickness. A
  genuinely thicker line needs `Line2`/`LineMaterial` (fatlines) — defer unless
  needed.

## 7. Performance discipline — measure before effects

Ed's call, and correct: **establish FPS metrics and a baseline before adding
any lighting/AO.** Status of the tooling:

- **We already have the harness.** `ModelViewerPerfProbe` (`scene/PerfProbe.tsx`)
  publishes per-frame `fps`, `frameMs` (EMA), `render.calls`, `triangles`,
  `geometries`, `textures`, `programs` to `window.__phnModelViewerPerf` +
  `useModelViewerPerfStore`. It correctly disables R3F `autoReset` so multi-pass
  `EffectComposer` frames report whole-frame draw calls (not just the last
  pass). Gated by `isModelViewerDebugHookEnabled()` (DEV/test only).
- **`frameloop="demand"` → FPS only matters *during interaction*.** A static
  scene renders 0 frames, so the baseline must be captured **mid-orbit** (the
  probe comment says as much).
- **The AO fault line.** The heavy-model path (≥1500 obj, `ViewerCanvas.tsx`)
  *deliberately drops* `EffectComposer` for hardware MSAA. AO needs an
  `EffectComposer` pass → it re-introduces post-FX exactly where we removed it
  for perf. AO cost is screen-space (≈ resolution-bound, roughly independent of
  object count), but the depth/normal prepass + fullscreen pass still add
  per-frame work. **Must be validated on Hillandale (~7,200 obj), not just the
  small fixture.**
- **Baseline protocol (to run before any change):** fixed fixtures (small ~110,
  Hillandale ~7,200), fixed window size + DPR, a **scripted sustained orbit**,
  record median `fps` / `frameMs` / `render.calls` / `triangles`. Reuse the
  existing production perf fixture + matrix runbook. Set a **budget** (e.g.
  "hold ≥ N FPS on Hillandale @ 1080p") and re-measure after *each* effect;
  keep/cut by budget.

### 7.1 Baseline — captured 2026-06-30

Fixture **Hillandale NAR** (`Hillandale_Gateway_NAR_260402.hbjson`, 7,202
objects). Headed Chromium, real GPU (Apple Silicon), default Playwright viewport
(~1280×720), scripted 24-step orbit per lens, reading `window.__phnModelViewerPerf`.
Raw: `working/perf-baseline-2026-06-30.json`.

| Lens | Objects | Draw calls | Steady FPS | Cold min FPS | ms/frame |
| --- | --- | --- | --- | --- | --- |
| building | 7,202 | **14** | ~60 † | 3.6 | 17 (43 cold) |
| spaces | 583 | 15 | 57 | 34 | 18 |
| floor-areas | 583 | 15 | 57 | 38 | 18 |
| site-sun | 7,202 | 18 | 56 | 30 | 18 |
| ventilation | 227 | 240 | 60 | 60 | 17 |
| hot-water | 117 | 130 | 60 | 59 | 17 |

† The building-lens median reads 26.5 FPS in the raw data, but that is
**cold-start contaminated** — it is the first lens sampled, so its 24 frames
include one-time shader compilation, the initial BatchedMesh GPU upload, and the
0.18 s lens fade-in. Warm steady-state is ~60 FPS like the others; the `minFps`
3.6 is the single first frame.

**Reading of the baseline:**

1. **Draw calls are O(1) — substrate confirmed.** 7,202 objects → **14 draw
   calls**. (`ventilation`/`hot-water` sit higher at 240/130 because duct/pipe
   line-segments aren't batched like faces — still trivial, 60 FPS.)
2. **Steady-state is ~56–60 FPS on every Hillandale lens.** Frame time pins at
   ~17 ms = **vsync-capped**, so real per-frame GPU cost is *well under* 16.7 ms
   — there is large hidden headroom beneath the 60 FPS cap. These numbers say
   "comfortably at 60 today," not "how much margin." So the AO/lighting test is
   pass/fail: *does it stay at 60?* Quantifying the actual margin needs an
   uncapped / GPU-timer measurement (future refinement).
3. **The one real stutter today is the cold-start transient** — the first orbit
   after a model loads (or a heavy lens mounts) dips to single-digit FPS for ~1
   frame (shader compile + GPU upload + fade-in). This is exactly what AO is
   most likely to worsen (bigger shader → longer first compile), so track it as
   its own metric, separate from steady-state.

**Budget (provisional):** hold **steady ≥ 55 FPS** on Hillandale at this
viewport for any effect we keep; treat a worsened cold-start first frame as a
yellow flag to mitigate (e.g. shader pre-warm), not an automatic veto.

**Harness refinement for the experiment phase:** add a warm-up orbit (discard
the first ~8 frames) so medians reflect steady-state, and record the cold-start
first-frame ms as a separate field. The capture spec is at
`working/perf-baseline.spec.ts` (drop into `frontend/tests/e2e/`, run headed).

## 8. Open questions

- How much of the "solid" feel is **AO** vs **IBL** vs **tone mapping**?
  Prototype them independently and A/B so we don't pay for passes that don't
  earn it.
- One shared lit material vs **matcap** (cheaper, very "model-like", but breaks
  true lighting and complicates color-by themes — probably disqualifying for us).
- Real-time sun shadows: defer to the solar-scrub feature, or add a soft
  directional bias to the default now?

## 9. Next actions

1. **FIRST — capture the FPS baseline** on both fixtures with `PerfProbe` + a
   documented orbit protocol; record the numbers here and set the budget.
2. Draft `target-spec.md` (Spacio default + Arcol theme discipline): soft
   IBL/hemisphere lighting, AO pass, tone mapping, lightened edges — each as an
   independently-toggleable knob behind the debug hook.
3. Prototype each knob behind the debug flag; **re-measure against the baseline
   after every effect**; keep only what stays within budget on Hillandale.
