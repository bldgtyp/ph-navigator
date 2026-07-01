import { describe, expect, test } from "vitest";
import { Vector3 } from "three";
import {
  buildDimensionLineGeometry,
  dimensionOffsetDistance,
  dimensionPrimitiveCounts,
} from "../lib/dimensionLines";

describe("model viewer dimension lines", () => {
  test("builds offset extension, dimension, tick, and label geometry", () => {
    const start = new Vector3(0, 0, 0);
    const end = new Vector3(3, 4, 0);
    const geometry = buildDimensionLineGeometry(start, end, new Vector3(0, 0, -1), 0.5);

    expect(geometry.lengthM).toBeCloseTo(5);
    expect(geometry.dimensionLine[0].distanceTo(geometry.dimensionLine[1])).toBeCloseTo(5);
    expect(geometry.extensionA[0].distanceTo(start)).toBeCloseTo(0);
    expect(geometry.extensionA[1].distanceTo(start)).toBeCloseTo(0.5);
    expect(Number.isFinite(geometry.midpoint.x)).toBe(true);
    expect(Number.isFinite(geometry.midpoint.y)).toBe(true);
    expect(Number.isFinite(geometry.midpoint.z)).toBe(true);
  });

  test("falls back to a stable offset when viewed head-on", () => {
    const geometry = buildDimensionLineGeometry(
      new Vector3(0, 0, 0),
      new Vector3(0, 0, 3),
      new Vector3(0, 0, 1),
      0.5,
    );

    expect(geometry.lengthM).toBeCloseTo(3);
    for (const point of [
      ...geometry.extensionA,
      ...geometry.extensionB,
      ...geometry.dimensionLine,
      ...geometry.tickA,
      ...geometry.tickB,
      geometry.midpoint,
    ]) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
      expect(Number.isFinite(point.z)).toBe(true);
    }
    expect(geometry.extensionA[1].distanceTo(geometry.extensionA[0])).toBeCloseTo(0.5);
  });

  test("keeps offset distance readable for short and large elements", () => {
    expect(dimensionOffsetDistance(1)).toBe(0.22);
    expect(dimensionOffsetDistance(20)).toBeCloseTo(0.9);
  });

  test("dimension primitive count scales only with selected segment count", () => {
    expect(dimensionPrimitiveCounts(3)).toEqual({ lineSegments: 15, labels: 3, total: 18 });
    expect(dimensionPrimitiveCounts(30)).toEqual({ lineSegments: 150, labels: 30, total: 180 });

    const unrelatedModelSegmentCount = 500;
    expect(dimensionPrimitiveCounts(3).total).toBe(18);
    expect(unrelatedModelSegmentCount).toBeGreaterThan(dimensionPrimitiveCounts(3).total);
  });
});
