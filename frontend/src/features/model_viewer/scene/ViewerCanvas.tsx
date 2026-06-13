import { ContactShadows, Grid } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, SMAA } from "@react-three/postprocessing";
import { useMemo } from "react";
import { createBuildingMaterials, createGhostMaterial, resolveViewerTokens } from "../lib/colors";
import { labelForLens } from "../lib/lenses";
import type { BuildingModel } from "../loaders/building";
import { useModelViewerStore } from "../store";
import { BuildingLens } from "./BuildingLens";
import { CameraRig } from "./CameraRig";

type ViewerCanvasProps = {
  model: BuildingModel;
  activeFileName: string;
};

export function ViewerCanvas({ model, activeFileName }: ViewerCanvasProps) {
  const lens = useModelViewerStore((state) => state.lens);
  const clearSelection = useModelViewerStore((state) => state.clearSelection);
  const measureActive = useModelViewerStore((state) => state.measureActive);
  const materials = useMemo(() => createBuildingMaterials(resolveViewerTokens()), []);
  const ghostMaterial = useMemo(() => createGhostMaterial(), []);
  const handlePointerMissed = () => {
    if (!measureActive) clearSelection();
  };

  return (
    <Canvas
      frameloop="demand"
      shadows
      camera={{ fov: 45, near: 0.1, far: 1000, position: [-25, 40, 30], up: [0, 0, 1] }}
      onPointerMissed={handlePointerMissed}
      className="model-viewer-canvas"
      aria-label={`3D model viewer for ${activeFileName}. Active lens: ${labelForLens(lens)}.`}
      gl={{ antialias: false }}
    >
      <color attach="background" args={["snow"]} />
      <ambientLight intensity={0.62} />
      <directionalLight position={[-10, -10, 25]} intensity={1.55} castShadow />
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
      <ContactShadows
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, -0.02]}
        opacity={0.24}
        scale={80}
        blur={2.8}
        far={30}
      />
      <BuildingLens model={model} materials={materials} ghostMaterial={ghostMaterial} />
      <CameraRig model={model} />
      <EffectComposer multisampling={0}>
        <SMAA />
      </EffectComposer>
    </Canvas>
  );
}
