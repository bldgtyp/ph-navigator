import type { CSSProperties, MouseEvent } from "react";
import type { RectMm } from "../aperture-geometry";
import { pxFromMm } from "../canvas-constants";
import type { ApertureSide } from "../types";

export type ApertureRegionKind = ApertureSide | "glazing";

export function ApertureHitTarget({
  elementId,
  region,
  rect,
  parentRect,
  zoom,
  isHovered,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  elementId: string;
  region: ApertureRegionKind;
  rect: RectMm;
  parentRect: RectMm;
  zoom: number;
  isHovered: boolean;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const style: CSSProperties = {
    left: `${pxFromMm(rect.x - parentRect.x, zoom)}px`,
    top: `${pxFromMm(rect.y - parentRect.y, zoom)}px`,
    width: `${pxFromMm(rect.width, zoom)}px`,
    height: `${pxFromMm(rect.height, zoom)}px`,
  };
  return (
    <div
      className="aperture-hit aperture-hit--region"
      data-testid={`hit-${elementId}-${region}`}
      data-region={region}
      data-hovered={isHovered ? "true" : undefined}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
      }}
    />
  );
}
