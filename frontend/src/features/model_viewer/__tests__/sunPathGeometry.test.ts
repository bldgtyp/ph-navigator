import { Box3, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  arc2dToPoints,
  arc3dToPoints,
  lineSegment2dToPoints,
  type Point3,
  SUN_PATH_FRAMING_FACTOR,
  sunPathFitTransform,
} from "../scene/sunPathGeometry";
import type { Arc2DModelData, Arc3DModelData, LineSegment2DModelData } from "../types";

function expectPointClose(point: Point3 | undefined, expected: Point3): void {
  expect(point).toBeDefined();
  if (!point) return;
  expect(point[0]).toBeCloseTo(expected[0], 6);
  expect(point[1]).toBeCloseTo(expected[1], 6);
  expect(point[2]).toBeCloseTo(expected[2], 6);
}

describe("arc3dToPoints", () => {
  // A quarter circle in the world XY plane: x-axis +X, normal +Z ⇒ y-axis +Y.
  const quarter: Arc3DModelData = {
    plane: { n: [0, 0, 1], o: [0, 0, 0], x: [1, 0, 0] },
    radius: 1,
    a1: 0,
    a2: Math.PI / 2,
  };

  it("samples segments + 1 points spanning a1..a2", () => {
    const points = arc3dToPoints(quarter, 4);
    expect(points).toHaveLength(5);
    expectPointClose(points[0], [1, 0, 0]);
    expectPointClose(points[points.length - 1], [0, 1, 0]);
  });

  it("honors the plane's radius and origin offset", () => {
    const offset: Arc3DModelData = {
      plane: { n: [0, 0, 1], o: [10, 0, 5], x: [1, 0, 0] },
      radius: 2,
      a1: 0,
      a2: Math.PI,
    };
    const points = arc3dToPoints(offset, 2);
    // midpoint at angle π/2 ⇒ origin + 2·yAxis = (10, 2, 5).
    expectPointClose(points[1], [10, 2, 5]);
  });
});

describe("arc2dToPoints", () => {
  const circle: Arc2DModelData = { c: [0, 0], r: 2, a1: 0, a2: 2 * Math.PI };

  it("places points on the circle at the requested height", () => {
    const points = arc2dToPoints(circle, 5, 4);
    expect(points).toHaveLength(5);
    expectPointClose(points[0], [2, 0, 5]);
    expectPointClose(points[1], [0, 2, 5]);
    expect(points.every((point) => point[2] === 5)).toBe(true);
  });
});

describe("lineSegment2dToPoints", () => {
  it("maps point + vector to a 3D segment at height z", () => {
    const tick: LineSegment2DModelData = { p: [1, 2], v: [3, 4] };
    expect(lineSegment2dToPoints(tick, 0)).toEqual([
      [1, 2, 0],
      [4, 6, 0],
    ]);
  });
});

describe("sunPathFitTransform", () => {
  it("centers horizontally, sits on the model base, scales by bounding sphere", () => {
    const bounds = new Box3(new Vector3(-3, -4, 0), new Vector3(3, 4, 10));
    const fit = sunPathFitTransform(bounds);
    // center (0,0,5); base z = 0.
    expect(fit.position).toEqual([0, 0, 0]);
    // diagonal = sqrt(6²+8²+10²) = sqrt(200); radius = half of that.
    const sphereRadius = Math.sqrt(200) / 2;
    expect(fit.scale).toBeCloseTo(sphereRadius * SUN_PATH_FRAMING_FACTOR, 6);
  });
});
