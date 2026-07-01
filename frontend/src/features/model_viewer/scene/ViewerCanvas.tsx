import { ContactShadows, Grid } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, N8AO, SMAA } from "@react-three/postprocessing";
import { useEffect, useMemo } from "react";
import { createGhostMaterials, resolveViewerTokens } from "../lib/colors";
import {
  VIEWER_SOFT_BG_COLOR,
  VIEWER_SOFT_GROUND_COLOR,
  VIEWER_SOFT_SKY_COLOR,
} from "../lib/colorTokens";
import { isModelViewerDebugHookEnabled } from "../lib/debugHook";
import { labelForLens } from "../lib/lenses";
import { useViewerRenderSettings } from "../lib/renderSettings";
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

  return (
    <Canvas
      frameloop="demand"
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
          <directionalLight position={keyPos} intensity={keyIntensity} />
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
      */}
      <ContactShadows
        frames={1}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, -0.02]}
        opacity={0.24}
        scale={80}
        blur={2.8}
        far={30}
      />
      <BuildingLens
        model={model}
        ghostMaterials={ghostMaterials}
        tokens={tokens}
        sunPath={sunPath}
      />
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
