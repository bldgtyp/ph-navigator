import { Camera, Vector3 } from "three";
import { stripTrailingZeros } from "../../../lib/units/format";
import { formatFeetInches } from "../../../lib/units/length/formatFeetInches";
import type { UnitSystem } from "../../../lib/units";
import type { ModelViewerMeasurePoint } from "../types";
export { distanceBetweenMeasurePoints } from "./measureDistance";

export type MeasureViewport = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type MeasureSnapCandidate = ModelViewerMeasurePoint;

export type ScreenPoint = {
  clientX: number;
  clientY: number;
};

const MM_PER_M = 1000;

export function nearestMeasureSnap(
  candidates: MeasureSnapCandidate[],
  pointer: ScreenPoint,
  camera: Camera,
  viewport: MeasureViewport,
  thresholdPx = 20,
  scratch = new Vector3(),
): MeasureSnapCandidate | null {
  let best: { candidate: MeasureSnapCandidate; distancePx: number } | null = null;

  for (const candidate of candidates) {
    const projected = projectToScreen(candidate.position, camera, viewport, scratch);
    if (!projected) continue;
    const distancePx = Math.hypot(
      projected.clientX - pointer.clientX,
      projected.clientY - pointer.clientY,
    );
    if (distancePx > thresholdPx) continue;
    if (!best || distancePx < best.distancePx) {
      best = { candidate, distancePx };
    }
  }

  return best?.candidate ?? null;
}

export function formatMeasureDistance(distanceM: number, unitSystem: UnitSystem): string {
  if (unitSystem === "IP") {
    return formatFeetInches(distanceM * MM_PER_M);
  }
  return `${stripTrailingZeros(distanceM.toFixed(2))} m`;
}

function projectToScreen(
  position: [number, number, number],
  camera: Camera,
  viewport: MeasureViewport,
  scratch: Vector3,
): ScreenPoint | null {
  const projected = scratch.set(...position).project(camera);
  if (projected.z < -1 || projected.z > 1) return null;
  return {
    clientX: viewport.left + ((projected.x + 1) / 2) * viewport.width,
    clientY: viewport.top + ((1 - projected.y) / 2) * viewport.height,
  };
}
