// Pure projection of the origin-centered, unit-radius sun-path + compass DTO
// into the 2D SVG primitives the diagram renders. Kept separate from the
// component so the geometry (top-down projection + Arc3D tessellation) is
// unit-testable. SVG y grows downward, so the projection flips y: a point at
// +Y (toward the top of the diagram) maps to a smaller SVG y.

import type { Arc2D, Arc3D, LineSegment2D, Polyline3D, SunPathAndCompass, Vec3 } from "./types";

// A 240×240 viewBox with the diagram centered; RADIUS leaves a margin for the
// compass ticks that extend just past the unit boundary circle.
export const SUN_PATH_VIEWBOX = 240;
const CENTER = SUN_PATH_VIEWBOX / 2;
const RADIUS = 100;
// Arc3D day arcs are smooth curves; sample enough segments to read cleanly.
const ARC_SAMPLES = 48;

export type SunPathGeometry = {
  analemmas: string[];
  dayArcs: string[];
  rings: { cx: number; cy: number; r: number }[];
  ticks: { x1: number; y1: number; x2: number; y2: number }[];
};

// Project a model-space (x, y) pair (z dropped — top-down) to SVG coordinates.
function project(x: number, y: number): [number, number] {
  return [CENTER + x * RADIUS, CENTER - y * RADIUS];
}

function polylineToPath(polyline: Polyline3D): string {
  return polyline.vertices
    .map(([x, y], index) => {
      const [px, py] = project(x, y);
      return `${index === 0 ? "M" : "L"}${px.toFixed(2)} ${py.toFixed(2)}`;
    })
    .join(" ");
}

function normalize([x, y, z]: Vec3): Vec3 {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

// Tessellate an Arc3D (a circular arc lying in `plane`) into an SVG polyline.
// A point at angle θ is o + r·(cosθ·x̂ + sinθ·ŷ), where ŷ = n̂ × x̂ completes
// the plane basis.
function arc3dToPath(arc: Arc3D): string {
  const { plane, radius, a1, a2 } = arc;
  const xAxis = normalize(plane.x);
  const yAxis = normalize(cross(normalize(plane.n), xAxis));
  const [ox, oy] = plane.o;
  const points: string[] = [];
  for (let step = 0; step <= ARC_SAMPLES; step += 1) {
    const angle = a1 + ((a2 - a1) * step) / ARC_SAMPLES;
    const x = ox + radius * (Math.cos(angle) * xAxis[0] + Math.sin(angle) * yAxis[0]);
    const y = oy + radius * (Math.cos(angle) * xAxis[1] + Math.sin(angle) * yAxis[1]);
    const [px, py] = project(x, y);
    points.push(`${step === 0 ? "M" : "L"}${px.toFixed(2)} ${py.toFixed(2)}`);
  }
  return points.join(" ");
}

function ringFromCircle(arc: Arc2D): { cx: number; cy: number; r: number } {
  const [cx, cy] = project(arc.c[0], arc.c[1]);
  return { cx, cy, r: arc.r * RADIUS };
}

function tickFromSegment(segment: LineSegment2D): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
} {
  const [x1, y1] = project(segment.p[0], segment.p[1]);
  const [x2, y2] = project(segment.p[0] + segment.v[0], segment.p[1] + segment.v[1]);
  return { x1, y1, x2, y2 };
}

export function buildSunPathGeometry(data: SunPathAndCompass): SunPathGeometry {
  return {
    analemmas: data.sunpath.hourly_analemma_polyline3d.map(polylineToPath),
    dayArcs: data.sunpath.monthly_day_arc3d.map(arc3dToPath),
    rings: data.compass.all_boundary_circles.map(ringFromCircle),
    ticks: [...data.compass.major_azimuth_ticks, ...data.compass.minor_azimuth_ticks].map(
      tickFromSegment,
    ),
  };
}
