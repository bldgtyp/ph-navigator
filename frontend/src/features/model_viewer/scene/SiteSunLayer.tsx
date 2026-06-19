import { Html, Line } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { Box3, Vector3 } from "three";
import {
  createShadeMaterials,
  VIEWER_SITE_COMPASS_COLOR,
  VIEWER_SUN_PATH_COLOR,
  type ShadeMaterials,
} from "../lib/colors";
import type { BuildingModel, ShadeRenderable } from "../loaders/building";

/**
 * The site-sun overlays: merged shade groups, the north compass, and the sun
 * path. The building context itself renders through `BatchedLens` (the site-sun
 * lens reuses `model.buildingObjects`), so this layer is overlays only.
 */
export function SiteSunLayer({ model }: { model: BuildingModel }) {
  const materials = useMemo(() => createShadeMaterials(), []);
  useEffect(() => {
    return () => {
      materials.fill.dispose();
      materials.edge.dispose();
    };
  }, [materials]);

  return (
    <>
      <ShadeGroups shades={model.shadeObjects} materials={materials} />
      <SiteCompass bounds={model.bounds} />
      {model.sunPath ? <SunPathLines model={model} /> : null}
    </>
  );
}

function ShadeGroups({
  shades,
  materials,
}: {
  shades: ShadeRenderable[];
  materials: ShadeMaterials;
}) {
  return (
    <group name="site-shade-groups">
      {shades.map((shade) => (
        <group key={shade.id} name={shade.displayName}>
          <mesh geometry={shade.geometry} material={materials.fill} raycast={() => null} />
          <lineSegments geometry={shade.edges} material={materials.edge} raycast={() => null} />
        </group>
      ))}
    </group>
  );
}

function SiteCompass({ bounds }: { bounds: Box3 }) {
  const { origin, end, label } = useMemo(() => compassPoints(bounds), [bounds]);
  return (
    <group name="site-compass">
      <Line points={[origin, end]} color={VIEWER_SITE_COMPASS_COLOR} lineWidth={1.2} />
      <Html position={label} center className="model-site-compass-label" pointerEvents="none">
        N
      </Html>
    </group>
  );
}

function SunPathLines({ model }: { model: BuildingModel }) {
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
