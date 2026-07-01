import { Vector3 } from "three";

const EPSILON = 1e-6;
const WORLD_UP = new Vector3(0, 0, 1);
const WORLD_RIGHT = new Vector3(1, 0, 0);

export type DimensionLineGeometry = {
  extensionA: [Vector3, Vector3];
  extensionB: [Vector3, Vector3];
  dimensionLine: [Vector3, Vector3];
  tickA: [Vector3, Vector3];
  tickB: [Vector3, Vector3];
  midpoint: Vector3;
  lengthM: number;
};

export type DimensionPrimitiveCounts = {
  lineSegments: number;
  labels: number;
  total: number;
};

export function buildDimensionLineGeometry(
  start: Vector3,
  end: Vector3,
  cameraViewDirection: Vector3,
  offsetDistance: number,
): DimensionLineGeometry {
  const lengthM = start.distanceTo(end);
  const segmentDirection = end.clone().sub(start);
  if (segmentDirection.lengthSq() < EPSILON) {
    segmentDirection.set(1, 0, 0);
  } else {
    segmentDirection.normalize();
  }

  const viewDirection = cameraViewDirection.clone();
  if (viewDirection.lengthSq() < EPSILON) viewDirection.set(0, 1, 0);
  else viewDirection.normalize();

  const offsetDirection = segmentDirection.clone().cross(viewDirection);
  if (offsetDirection.lengthSq() < EPSILON) {
    const fallbackAxis = Math.abs(segmentDirection.dot(WORLD_UP)) > 0.96 ? WORLD_RIGHT : WORLD_UP;
    offsetDirection.copy(fallbackAxis).cross(segmentDirection);
  }
  offsetDirection.normalize();

  const offset = offsetDirection.multiplyScalar(offsetDistance);
  const offsetStart = start.clone().add(offset);
  const offsetEnd = end.clone().add(offset);
  const tickHalf = Math.max(offsetDistance * 0.22, 0.06);
  const tickDirection = segmentDirection.clone().cross(offsetDirection).normalize();
  const tickVector = tickDirection.multiplyScalar(tickHalf);

  return {
    extensionA: [start.clone(), offsetStart.clone()],
    extensionB: [end.clone(), offsetEnd.clone()],
    dimensionLine: [offsetStart.clone(), offsetEnd.clone()],
    tickA: [offsetStart.clone().sub(tickVector), offsetStart.clone().add(tickVector)],
    tickB: [offsetEnd.clone().sub(tickVector), offsetEnd.clone().add(tickVector)],
    midpoint: offsetStart.clone().add(offsetEnd).multiplyScalar(0.5),
    lengthM,
  };
}

export function dimensionOffsetDistance(elementDiagonal: number): number {
  return Math.max(elementDiagonal * 0.045, 0.22);
}

export function dimensionPrimitiveCounts(segmentCount: number): DimensionPrimitiveCounts {
  const lineSegments = segmentCount * 5;
  const labels = segmentCount;
  return { lineSegments, labels, total: lineSegments + labels };
}
