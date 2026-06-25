import type { ModelViewerMeasurePoint } from "../types";

export function distanceBetweenMeasurePoints(
  start: ModelViewerMeasurePoint,
  end: ModelViewerMeasurePoint,
): number {
  return Math.hypot(
    end.position[0] - start.position[0],
    end.position[1] - start.position[1],
    end.position[2] - start.position[2],
  );
}
