import { Box3, Plane, Vector3 } from "three";

export type SectionAxis = "x" | "y" | "z";

export type ModelViewerSection = {
  axis: SectionAxis;
  offset: number;
};

const AXIS_INDEX: Record<SectionAxis, 0 | 1 | 2> = {
  x: 0,
  y: 1,
  z: 2,
};

const AXIS_NORMALS: Record<SectionAxis, Vector3> = {
  x: new Vector3(-1, 0, 0),
  y: new Vector3(0, -1, 0),
  z: new Vector3(0, 0, -1),
};

export function sectionRangeForBounds(
  bounds: Box3,
  axis: SectionAxis,
): { min: number; max: number; step: number } {
  const index = AXIS_INDEX[axis];
  const min = bounds.min.getComponent(index);
  const max = bounds.max.getComponent(index);
  const span = Math.max(max - min, 0);
  return { min, max, step: span > 0 ? span / 200 : 0.01 };
}

export function defaultSectionForBounds(bounds: Box3, axis: SectionAxis = "z"): ModelViewerSection {
  const { min, max } = sectionRangeForBounds(bounds, axis);
  return { axis, offset: min + (max - min) / 2 };
}

export function sectionForAxis(
  bounds: Box3,
  axis: SectionAxis,
  previous?: ModelViewerSection | null,
): ModelViewerSection {
  if (!previous) return defaultSectionForBounds(bounds, axis);
  const previousRange = sectionRangeForBounds(bounds, previous.axis);
  const nextRange = sectionRangeForBounds(bounds, axis);
  const previousSpan = previousRange.max - previousRange.min;
  const ratio = previousSpan > 0 ? (previous.offset - previousRange.min) / previousSpan : 0.5;
  const clampedRatio = Math.min(1, Math.max(0, ratio));
  return {
    axis,
    offset: nextRange.min + (nextRange.max - nextRange.min) * clampedRatio,
  };
}

export function clampSectionToBounds(
  bounds: Box3,
  section: ModelViewerSection,
): ModelViewerSection {
  const range = sectionRangeForBounds(bounds, section.axis);
  return {
    axis: section.axis,
    offset: Math.min(range.max, Math.max(range.min, section.offset)),
  };
}

export function clippingPlaneForSection(section: ModelViewerSection): Plane {
  return new Plane().setFromNormalAndCoplanarPoint(
    AXIS_NORMALS[section.axis],
    offsetPointForSection(section),
  );
}

export function isPointVisibleForSection(
  point: Vector3,
  section: ModelViewerSection | null,
): boolean {
  if (!section) return true;
  return isCoordinateVisibleForSection(point.getComponent(AXIS_INDEX[section.axis]), section);
}

export function isTupleVisibleForSection(
  point: [number, number, number],
  section: ModelViewerSection | null,
): boolean {
  if (!section) return true;
  return isCoordinateVisibleForSection(point[AXIS_INDEX[section.axis]], section);
}

function isCoordinateVisibleForSection(coordinate: number, section: ModelViewerSection): boolean {
  return coordinate <= section.offset;
}

function offsetPointForSection(section: ModelViewerSection): Vector3 {
  const point = new Vector3();
  point.setComponent(AXIS_INDEX[section.axis], section.offset);
  return point;
}
