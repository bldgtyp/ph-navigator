import { Html, Line } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Box3, Vector3 } from "three";
import {
  createShadeMaterials,
  VIEWER_SITE_COMPASS_COLOR,
  VIEWER_SUN_PATH_COLOR,
  type ShadeMaterials,
} from "../lib/colors";
import type { BuildingModel, ShadeRenderable } from "../loaders/building";
import type { SunVector } from "../lib/sunStudy";
import type { SunPathAndCompassModelData } from "../types";
import { SunStudyLayer } from "./SunStudyLayer";
import {
  arc2dToPoints,
  arc3dToPoints,
  lineSegment2dToPoints,
  type Point3,
  SUN_PATH_DASH_SIZE,
  SUN_PATH_GAP_SIZE,
  sunPathFitTransform,
} from "./sunPathGeometry";
import { SCENE_HTML_Z_INDEX_RANGE } from "./htmlLayering";

/**
 * The site-sun overlays: merged shade groups, the north compass, and — when a
 * project location is set — the annual sun-path diagram. The building context
 * itself renders through `BatchedLens` (the site-sun lens reuses
 * `model.buildingObjects`), so this layer is overlays only.
 */
export function SiteSunLayer({
  model,
  sunPath,
  sunStudyVector,
}: {
  model: BuildingModel;
  sunPath: SunPathAndCompassModelData | null;
  /** The engaged sun-study direction, or null while sun study is off. */
  sunStudyVector: SunVector | null;
}) {
  const materials = useMemo(() => createShadeMaterials(), []);
  useEffect(() => {
    return () => {
      materials.fill.dispose();
      materials.edge.dispose();
    };
  }, [materials]);

  // The canvas runs `frameloop="demand"`, so a repaint only happens on
  // interaction. The sun path arrives from an async query (and refetches when
  // the location is edited), so nudge a frame when it resolves or changes.
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    invalidate();
  }, [sunPath, invalidate]);

  return (
    <>
      <ShadeGroups shades={model.shadeObjects} materials={materials} />
      <SiteCompass bounds={model.bounds} />
      {sunPath ? <SunPathDiagram bounds={model.bounds} sunPath={sunPath} /> : null}
      {sunStudyVector ? <SunStudyLayer bounds={model.bounds} sunVector={sunStudyVector} /> : null}
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
          {/* Shades cast AND receive (PRD §5.2) — free until a shadow-casting
              light exists, i.e. only while sun study is engaged. */}
          <mesh
            geometry={shade.geometry}
            material={materials.fill}
            raycast={() => null}
            castShadow
            receiveShadow
          />
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
      <Html
        position={label}
        center
        className="model-site-compass-label"
        pointerEvents="none"
        zIndexRange={SCENE_HTML_Z_INDEX_RANGE}
      >
        N
      </Html>
    </group>
  );
}

/**
 * The annual sun path + compass, drawn from the backend's unit-radius,
 * origin-centered geometry and framed to the building via a uniform
 * scale + translate (which preserves the baked true-north rotation). Every
 * element is non-selectable (`raycast` disabled) per Q-VIEW-3.
 */
/** One polyline of the diagram. Sun-path curves are dashed; compass elements
 *  are solid. Points are in the backend's unit-radius local space; the parent
 *  group applies the fit transform. */
type SunPathLine = { key: string; points: Point3[]; color: string; dashed: boolean };

function SunPathDiagram({
  bounds,
  sunPath,
}: {
  bounds: Box3;
  sunPath: SunPathAndCompassModelData;
}) {
  const fit = useMemo(() => sunPathFitTransform(bounds), [bounds]);
  const lines = useMemo<SunPathLine[]>(() => {
    const { sunpath, compass } = sunPath;
    return [
      ...sunpath.hourly_analemma_polyline3d.map((polyline, index) => ({
        key: `analemma:${index}`,
        points: polyline.vertices,
        color: VIEWER_SUN_PATH_COLOR,
        dashed: true,
      })),
      ...sunpath.monthly_day_arc3d.map((arc, index) => ({
        key: `arc:${index}`,
        points: arc3dToPoints(arc),
        color: VIEWER_SUN_PATH_COLOR,
        dashed: true,
      })),
      ...compass.all_boundary_circles.map((circle, index) => ({
        key: `circle:${index}`,
        points: arc2dToPoints(circle),
        color: VIEWER_SITE_COMPASS_COLOR,
        dashed: false,
      })),
      ...[...compass.major_azimuth_ticks, ...compass.minor_azimuth_ticks].map((tick, index) => ({
        key: `tick:${index}`,
        points: lineSegment2dToPoints(tick),
        color: VIEWER_SITE_COMPASS_COLOR,
        dashed: false,
      })),
    ];
  }, [sunPath]);

  return (
    <group name="site-sun-path" position={fit.position} scale={fit.scale}>
      {lines.map((line) => (
        <Line
          key={line.key}
          points={line.points}
          color={line.color}
          lineWidth={1}
          dashed={line.dashed}
          dashSize={line.dashed ? SUN_PATH_DASH_SIZE : undefined}
          gapSize={line.dashed ? SUN_PATH_GAP_SIZE : undefined}
          raycast={() => null}
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
