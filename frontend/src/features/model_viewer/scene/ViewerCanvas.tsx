import { ContactShadows, Grid } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, SMAA } from "@react-three/postprocessing";
import { useEffect, useMemo } from "react";
import { createGhostMaterials, resolveViewerTokens } from "../lib/colors";
import { isModelViewerDebugHookEnabled } from "../lib/debugHook";
import { labelForLens } from "../lib/lenses";
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
      <color attach="background" args={["snow"]} />
      <ambientLight intensity={0.62} />
      <directionalLight position={[-10, -10, 25]} intensity={1.55} />
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
      {/* Post-FX only on light models; heavy models rely on MSAA above (F7). */}
      {isHeavy ? null : (
        <EffectComposer multisampling={0}>
          <SMAA />
        </EffectComposer>
      )}
    </Canvas>
  );
}
