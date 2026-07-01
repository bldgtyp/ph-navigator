import { ContactShadows, Grid } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import { EffectComposer, N8AO, SMAA } from "@react-three/postprocessing";
import { useEffect, useMemo } from "react";
import { Object3D, Vector3 } from "three";
import { createGhostMaterials, resolveViewerTokens } from "../lib/colors";
import {
  VIEWER_SOFT_BG_COLOR,
  VIEWER_SOFT_GROUND_COLOR,
  VIEWER_SOFT_SKY_COLOR,
} from "../lib/colorTokens";
import { isModelViewerDebugHookEnabled } from "../lib/debugHook";
import { labelForLens } from "../lib/lenses";
import { useViewerRenderSettings } from "../lib/renderSettings";
import { clampSectionToBounds, clippingPlaneForSection } from "../lib/section";
import { altitudeDeg, interpolateSunVector, sunIntensityFactor } from "../lib/sunStudy";
import type { BuildingModel } from "../loaders/building";
import { useModelViewerStore } from "../store";
import type { SunPathAndCompassModelData } from "../types";
import { BuildingLens } from "./BuildingLens";
import { CameraRig } from "./CameraRig";
import { ModelViewerPerfProbe } from "./PerfProbe";

type ViewerCanvasProps = {
  model: BuildingModel;
  activeFileName: string;
  sunPath: SunPathAndCompassModelData | null;
};

/**
 * Above this object count a model is "heavy": the SMAA post pass is dropped in
 * favor of cheaper hardware MSAA (D-4 / F7). Hillandale (~7,200 objects) is
 * heavy; the small fixture (~110) keeps SMAA's crisper edges.
 */
const LARGE_MODEL_OBJECT_THRESHOLD = 1500;

export function ViewerCanvas({ model, activeFileName, sunPath }: ViewerCanvasProps) {
  const lens = useModelViewerStore((state) => state.lens);
  const clearSelection = useModelViewerStore((state) => state.clearSelection);
  const measureActive = useModelViewerStore((state) => state.measureActive);
  const sunStudy = useModelViewerStore((state) => state.sunStudy);
  const section = useModelViewerStore((state) => state.section);
  const tokens = useMemo(() => resolveViewerTokens(), []);
  // Render knobs — the defaults ARE the shipped study-model look; the dev-only
  // panel + perf harness retune them live.
  const ao = useViewerRenderSettings((state) => state.ao);
  const aoIntensity = useViewerRenderSettings((state) => state.aoIntensity);
  const aoRadius = useViewerRenderSettings((state) => state.aoRadius);
  const aoHalfRes = useViewerRenderSettings((state) => state.aoHalfRes);
  const aoQuality = useViewerRenderSettings((state) => state.aoQuality);
  const softLighting = useViewerRenderSettings((state) => state.softLighting);
  const keyIntensity = useViewerRenderSettings((state) => state.keyIntensity);
  const fillIntensity = useViewerRenderSettings((state) => state.fillIntensity);
  const keyElevation = useViewerRenderSettings((state) => state.keyElevation);
  const keyAzimuth = useViewerRenderSettings((state) => state.keyAzimuth);
  const shadowMapSize = useViewerRenderSettings((state) => state.shadowMapSize);
  // The ghost materials live for the Canvas's lifetime (one Canvas per file);
  // free them when it unmounts so a file swap doesn't leak GPU programs (CR3).
  const ghostMaterials = useMemo(() => createGhostMaterials(), []);
  useEffect(() => {
    return () => {
      ghostMaterials.fill.dispose();
      ghostMaterials.edge.dispose();
    };
  }, [ghostMaterials]);
  // The Canvas is keyed by file (ModelViewerStage), so the model is fixed for
  // this Canvas's lifetime — picking the AA strategy once at mount is safe.
  const isHeavy = model.objects.length > LARGE_MODEL_OBJECT_THRESHOLD;
  // Key-light position from elevation/azimuth (Z-up): elevation 90 = overhead,
  // ~45 = a raking sun that lights some walls directly. Radius is arbitrary
  // (directional light only uses the direction).
  const keyPos = useMemo<[number, number, number]>(() => {
    const el = (keyElevation * Math.PI) / 180;
    const az = (keyAzimuth * Math.PI) / 180;
    const r = 30;
    return [r * Math.cos(el) * Math.cos(az), r * Math.cos(el) * Math.sin(az), r * Math.sin(el)];
  }, [keyElevation, keyAzimuth]);
  const handlePointerMissed = () => {
    if (!measureActive) clearSelection();
  };

  // --- Sun study (PRD §5.2, D-3): while engaged in the site-sun lens, the
  // one key directional becomes the sun — re-aimed to the interpolated grid
  // direction, casting real-time shadows. The hemisphere fill is untouched.
  const sunGrid = sunPath?.sun_positions ?? null;
  const sunEngaged = lens === "site-sun" && sunStudy?.engaged === true && sunGrid !== null;
  const sunVector = useMemo(
    () =>
      sunEngaged && sunGrid && sunStudy
        ? interpolateSunVector(sunGrid, sunStudy.day, sunStudy.minutes)
        : null,
    [sunEngaged, sunGrid, sunStudy],
  );
  // Below the horizon the sun light ramps smoothly to zero (D-3); the model
  // rests on the hemisphere fill alone — the honest rendering of "no sun".
  const sunFactor = sunVector ? sunIntensityFactor(altitudeDeg(sunVector)) : 0;
  // The shadow camera is fitted once per model (bounds are fixed per file,
  // D-5); the light orbits the model center at a fixed distance so the ortho
  // frustum always covers the whole building.
  const sunFrame = useMemo(() => {
    const center = model.bounds.getCenter(new Vector3());
    const radius = Math.max(model.bounds.getSize(new Vector3()).length() / 2, 1);
    return { center, radius, distance: radius * 2.2 };
  }, [model.bounds]);
  const sunLightPos = useMemo<[number, number, number] | null>(() => {
    if (!sunVector) return null;
    const { center, distance } = sunFrame;
    return [
      center.x + sunVector[0] * distance,
      center.y + sunVector[1] * distance,
      center.z + sunVector[2] * distance,
    ];
  }, [sunVector, sunFrame]);
  // The directional light's target must live in the scene graph for its
  // matrix to update; disengaged it sits at the origin (three's default), so
  // the baseline key direction is untouched.
  const sunTarget = useMemo(() => new Object3D(), []);
  // Three never clips the shadow depth pass against the renderer-global
  // clipping planes the section tool uses (verified in the phase-02 spike),
  // so a sectioned wall would keep casting a phantom shadow — while a
  // section is active the sun shadow pass is disabled instead (amended D-11).
  const sunShadowsOn = sunEngaged && sunFactor > 0 && section === null;

  return (
    <Canvas
      frameloop="demand"
      /* PCF shadow maps ("percentage" — R3F's bare `shadows` means PCFSoft,
         which three r0.18x deprecated to a console warning). Enabled at Canvas
         creation so engaging sun study never rebuilds the GL context — the
         flag alone is free when no shadow-casting light exists (phase-02
         spike, PRD §7). */
      shadows="percentage"
      dpr={[1, 1.5]}
      camera={{ fov: 45, near: 0.1, far: 1000, position: [-25, 40, 30], up: [0, 0, 1] }}
      onPointerMissed={handlePointerMissed}
      className="model-viewer-canvas"
      aria-label={`3D model viewer for ${activeFileName}. Active lens: ${labelForLens(lens)}.`}
      gl={{ antialias: isHeavy }}
    >
      <color attach="background" args={[softLighting ? VIEWER_SOFT_BG_COLOR : "snow"]} />
      {/*
        Lighting. The shipped look is a soft key+fill dome: a sky/ground
        hemisphere fill + a directional key raked from elevation/azimuth (bright
        lit faces, grey shadowed faces, so AO reads as gentle contact shadow).
        The `else` branch (hard key + flat ambient) is the legacy flat look, kept
        as a dev toggle only.
      */}
      {softLighting ? (
        <>
          <hemisphereLight
            args={[VIEWER_SOFT_SKY_COLOR, VIEWER_SOFT_GROUND_COLOR, fillIntensity]}
          />
          {/*
            The one key directional (there is only ever one, D-3). Engaged sun
            study re-aims it to the interpolated solar direction around the
            model center and turns on its shadow pass; disengaged it is the
            knob-driven study-model key aimed at the origin, exactly the
            shipped look.
          */}
          <directionalLight
            position={sunLightPos ?? keyPos}
            intensity={sunEngaged ? keyIntensity * sunFactor : keyIntensity}
            target={sunTarget}
            castShadow={sunShadowsOn}
            shadow-mapSize={[shadowMapSize, shadowMapSize]}
            shadow-camera-left={-sunFrame.radius * 1.05}
            shadow-camera-right={sunFrame.radius * 1.05}
            shadow-camera-top={sunFrame.radius * 1.05}
            shadow-camera-bottom={-sunFrame.radius * 1.05}
            shadow-camera-near={0.1}
            shadow-camera-far={sunFrame.distance + sunFrame.radius * 2}
            shadow-normalBias={0.08}
          />
          <primitive object={sunTarget} position={sunEngaged ? sunFrame.center : [0, 0, 0]} />
        </>
      ) : (
        <>
          <ambientLight intensity={0.62} />
          <directionalLight position={[-10, -10, 25]} intensity={1.55} />
        </>
      )}
      <Grid
        args={[80, 80]}
        rotation={[Math.PI / 2, 0, 0]}
        cellSize={1}
        sectionSize={5}
        sectionThickness={0.5}
        cellThickness={0.35}
        fadeDistance={80}
        fadeStrength={1.4}
        infiniteGrid
      />
      {/*
        One shadow strategy (D-2 / F4): a baked contact-shadow ground blob, no
        real-time directional map. `frames={1}` bakes the shadow once per Canvas
        (the Canvas is keyed by file, so it re-bakes on model change). It is
        deliberately NOT keyed by lens: remounting `ContactShadows` every lens
        switch leaked a geometry per switch (CR3). The single bake is the
        building footprint, which every mesh lens shares — revisit if a future
        lens hides the building shell entirely.

        drei's ContactShadows is built for Y-up scenes (receiver plane on XZ,
        bake camera looking +Y). The wrapper group rigidly rotates the whole
        stock assembly into this Z-up scene — plane onto XY, bake camera looking
        +Z — instead of passing a `rotation` prop, which would replace drei's
        internal default and desync plane from camera (the old vertical-sheet
        artifact, ground-shadows fix packet D-12).
      */}
      {/* While sun study is engaged the baked blob is hidden (visible, never
          unmounted — CR3) so the static cue and the live moving shadow don't
          double up; it reappears on disengage (D-4). */}
      <group rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.02]} visible={!sunEngaged}>
        <ContactShadows frames={1} opacity={0.24} scale={80} blur={2.8} far={30} />
      </group>
      <BuildingLens
        model={model}
        ghostMaterials={ghostMaterials}
        tokens={tokens}
        sunPath={sunPath}
        sunStudyVector={sunEngaged ? sunVector : null}
      />
      <SectionClippingPlane model={model} />
      <CameraRig model={model} />
      {isModelViewerDebugHookEnabled() ? <ModelViewerPerfProbe /> : null}
      {/*
        Post-FX. AO (N8AO) is a composer pass and ships on by default, so the
        composer runs on EVERY model (verified ~free on Hillandale, research §7).
        The AO-off branch — SMAA on light models, hardware MSAA on heavy (F7) —
        is the legacy path, kept as a dev toggle.
      */}
      {ao || !isHeavy ? (
        <EffectComposer multisampling={0}>
          {ao ? (
            <>
              <N8AO
                aoRadius={aoRadius}
                intensity={aoIntensity}
                halfRes={aoHalfRes}
                quality={aoQuality}
              />
              <SMAA />
            </>
          ) : (
            <SMAA />
          )}
        </EffectComposer>
      ) : null}
    </Canvas>
  );
}

function SectionClippingPlane({ model }: { model: BuildingModel }) {
  const section = useModelViewerStore((state) => state.section);
  const { gl, invalidate } = useThree();

  useEffect(() => {
    if (!section) {
      gl.clippingPlanes = [];
      invalidate();
      return;
    }
    const clipped = clampSectionToBounds(model.bounds, section);
    gl.clippingPlanes = [clippingPlaneForSection(clipped)];
    invalidate();
  }, [gl, invalidate, model.bounds, section]);

  useEffect(() => {
    return () => {
      gl.clippingPlanes = [];
      invalidate();
    };
  }, [gl, invalidate]);

  return null;
}
