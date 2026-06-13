import { Box3, Vector3 } from "three";

export type Point3Tuple = [number, number, number];

export function boundsForPoints(points: Point3Tuple[]): Box3 {
  const bounds = new Box3();
  expandBoundsByPoints(bounds, points);
  return bounds;
}

export function expandBoundsByPoints(bounds: Box3, points: Point3Tuple[]): void {
  for (const point of points) {
    bounds.expandByPoint(new Vector3(point[0], point[1], point[2]));
  }
}
