export type PointerPoint = {
  clientX: number;
  clientY: number;
};

/**
 * The screen point of a pointer/mouse interaction, read from a Three event's
 * underlying DOM event. Shared by every scene picker (per-mesh and batched
 * lenses) so the drag-vs-click contract has one definition.
 */
export function pointerPoint(event: {
  nativeEvent: { clientX: number; clientY: number };
}): PointerPoint {
  return { clientX: event.nativeEvent.clientX, clientY: event.nativeEvent.clientY };
}

export function isClickWithinDragTolerance(
  start: PointerPoint | null,
  end: PointerPoint,
  tolerancePx = 5,
): boolean {
  if (!start) return true;
  return (
    Math.abs(start.clientX - end.clientX) <= tolerancePx &&
    Math.abs(start.clientY - end.clientY) <= tolerancePx
  );
}
