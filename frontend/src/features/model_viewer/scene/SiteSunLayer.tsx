import { Edges, Html, Line } from "@react-three/drei";
import { useMemo } from "react";
import { Box3, MeshBasicMaterial, Vector3 } from "three";
import type { MeshStandardMaterial } from "three";
import {
  VIEWER_SHADE_EDGE_COLOR,
  VIEWER_SITE_COMPASS_COLOR,
  VIEWER_SUN_PATH_COLOR,
} from "../lib/colors";
import type { BuildingModel, ShadeRenderable } from "../loaders/building";
import type { ModelViewerTheme } from "../types";
import { MeshObject } from "./BuildingLens";
import { useOpacityMaterial } from "./useOpacityMaterial";

type SiteSunLayerProps = {
  model: BuildingModel;
  materials: Map<string, MeshStandardMaterial>;
  themeMaterials: Map<string, MeshBasicMaterial>;
  theme: ModelViewerTheme;
  opacity: number;
  interactive: boolean;
  shadeMaterial: MeshBasicMaterial;
};

export function SiteSunLayer({
  model,
  materials,
  themeMaterials,
  theme,
  opacity,
  interactive,
  shadeMaterial,
}: SiteSunLayerProps) {
  return (
    <>
      {model.buildingObjects.map((object) => (
        <MeshObject
          key={`site:${object.id}`}
          object={object}
          materials={materials}
          themeMaterials={themeMaterials}
          lens="site-sun"
          theme={theme}
          opacity={opacity}
          interactive={interactive}
        />
      ))}
      <ShadeGroups shades={model.shadeObjects} material={shadeMaterial} opacity={opacity} />
      <SiteCompass bounds={model.bounds} opacity={opacity} />
      {model.sunPath ? <SunPathLines model={model} opacity={opacity} /> : null}
    </>
  );
}

function ShadeGroups({
  shades,
  material,
  opacity,
}: {
  shades: ShadeRenderable[];
  material: MeshBasicMaterial;
  opacity: number;
}) {
  const visibleMaterial = useOpacityMaterial(material, opacity);
  return (
    <group name="site-shade-groups">
      {shades.map((shade) =>
        shade.geometries.map((geometry) => (
          <mesh
            key={`${shade.id}:${geometry.uuid}`}
            name={shade.displayName}
            geometry={geometry}
            material={visibleMaterial}
            raycast={() => null}
          >
            <Edges threshold={12} color={VIEWER_SHADE_EDGE_COLOR} />
          </mesh>
        )),
      )}
    </group>
  );
}

function SiteCompass({ bounds, opacity }: { bounds: Box3; opacity: number }) {
  const { origin, end, label } = useMemo(() => compassPoints(bounds), [bounds]);
  return (
    <group name="site-compass">
      <Line
        points={[origin, end]}
        color={VIEWER_SITE_COMPASS_COLOR}
        lineWidth={1.2}
        transparent
        opacity={opacity}
      />
      <Html position={label} center className="model-site-compass-label" pointerEvents="none">
        N
      </Html>
    </group>
  );
}

function SunPathLines({ model, opacity }: { model: BuildingModel; opacity: number }) {
  return (
    <group name="site-sun-path">
      {model.sunPath?.sunpath.hourly_analemma_polyline3d.map((polyline, index) => (
        <Line
          key={`analemma:${index}`}
          points={polyline.vertices}
          color={VIEWER_SUN_PATH_COLOR}
          lineWidth={1}
          dashed
          dashSize={1}
          gapSize={0.5}
          transparent
          opacity={opacity}
        />
      ))}
    </group>
  );
}

function compassPoints(bounds: Box3): {
  origin: [number, number, number];
  end: [number, number, number];
  label: [number, number, number];
} {
  const size = bounds.getSize(new Vector3());
  const radius = Math.min(Math.max(Math.max(size.x, size.y) * 0.12, 2), 7);
  const z = bounds.min.z;
  const origin: [number, number, number] = [bounds.min.x - radius * 0.5, bounds.min.y - radius, z];
  const end: [number, number, number] = [origin[0], origin[1] + radius, z];
  const label: [number, number, number] = [origin[0], end[1] + radius * 0.18, z];
  return { origin, end, label };
}
