import { Box3, Vector3 } from "three";
import type { Arc2DModelData, Arc3DModelData, LineSegment2DModelData } from "../types";

export type Point3 = [number, number, number];

// The backend emits the diagram at unit radius / origin-centered; the values
// below are therefore in that local space. Arc sampling density and dash sizes
// are intentionally small fractions of the unit dome so they read well at any
// model scale once the fit-transform group scales the whole group up.
const ARC3D_SEGMENTS = 48;
const CIRCLE_SEGMENTS = 64;
export const SUN_PATH_DASH_SIZE = 0.05;
export const SUN_PATH_GAP_SIZE = 0.03;
// Uniform scale = bounding-sphere radius × this factor, so the dome clears the
// building with a little margin rather than circumscribing it exactly.
export const SUN_PATH_FRAMING_FACTOR = 1.2;

/**
 * Sample an Arc3D into a polyline. ladybug's Arc3D is an in-plane circle:
 * point(t) = origin + r·cos(t)·xAxis + r·sin(t)·yAxis, with the plane's
 * yAxis = normal × xAxis (right-handed). Used for the monthly day-arcs.
 */
export function arc3dToPoints(arc: Arc3DModelData, segments: number = ARC3D_SEGMENTS): Point3[] {
  const origin = new Vector3(...arc.plane.o);
  const xAxis = new Vector3(...arc.plane.x).normalize();
  const normal = new Vector3(...arc.plane.n).normalize();
  const yAxis = new Vector3().crossVectors(normal, xAxis).normalize();
  const points: Point3[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = arc.a1 + ((arc.a2 - arc.a1) * i) / segments;
    const point = origin
      .clone()
      .addScaledVector(xAxis, Math.cos(angle) * arc.radius)
      .addScaledVector(yAxis, Math.sin(angle) * arc.radius);
    points.push([point.x, point.y, point.z]);
  }
  return points;
}

/** Sample an Arc2D (a compass boundary circle) into a polyline at height `z`. */
export function arc2dToPoints(
  arc: Arc2DModelData,
  z: number = 0,
  segments: number = CIRCLE_SEGMENTS,
): Point3[] {
  const points: Point3[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = arc.a1 + ((arc.a2 - arc.a1) * i) / segments;
    points.push([arc.c[0] + Math.cos(angle) * arc.r, arc.c[1] + Math.sin(angle) * arc.r, z]);
  }
  return points;
}

/** A 2D compass azimuth tick (point + vector) as a 3D segment at height `z`. */
export function lineSegment2dToPoints(
  segment: LineSegment2DModelData,
  z: number = 0,
): [Point3, Point3] {
  const [px, py] = segment.p;
  const [vx, vy] = segment.v;
  return [
    [px, py, z],
    [px + vx, py + vy, z],
  ];
}

export type SunPathFit = { position: Point3; scale: number };

/**
 * Place + uniformly scale the unit-radius, origin-centered diagram so it frames
 * the model. Scale = bounding-sphere radius × `factor`; the diagram is centered
 * horizontally on the model with the observer/compass plane at the model base
 * (`bounds.min.z`). A uniform scale + translate preserves the true-north
 * rotation baked into the geometry by the backend.
 */
export function sunPathFitTransform(
  bounds: Box3,
  factor: number = SUN_PATH_FRAMING_FACTOR,
): SunPathFit {
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const sphereRadius = size.length() / 2;
  return {
    position: [center.x, center.y, bounds.min.z],
    scale: sphereRadius * factor,
  };
}
