export type PointerPoint = {
  clientX: number;
  clientY: number;
};

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
