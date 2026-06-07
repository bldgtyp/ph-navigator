// Architectural operation-symbol layer painted on top of the glazing
// rect inside ``ApertureSvgCanvas``. The canvas passes the *rendered*
// (already mirrored for interior view) glazing rect; we run each
// direction through ``flipForView`` so canonical "left" hinges draw on
// the visible right edge in interior view. Multi-direction symbols
// overlap by design (PRD §9.2).

import { slideArrow, swingLines, type RectLike, type ViewDirection } from "../operation-symbols";
import type { ApertureOperation } from "../types";

const SWING_LINE_DASH = "20,10";
const SWING_LINE_STROKE_WIDTH = 8;

export type OperationSymbolsProps = {
  elementId: string;
  glazing: RectLike;
  operation: ApertureOperation | null;
  viewDirection: ViewDirection;
};

export function OperationSymbols({
  elementId,
  glazing,
  operation,
  viewDirection,
}: OperationSymbolsProps) {
  if (operation === null || operation.directions.length === 0) return null;

  return (
    <g
      className="aperture-operation-symbols"
      data-testid={`operation-symbols-${elementId}`}
      stroke="var(--aperture-operation-symbol)"
      fill="none"
      vectorEffect="non-scaling-stroke"
    >
      {operation.type === "swing"
        ? operation.directions.flatMap((direction) =>
            swingLines(glazing, direction, viewDirection).map((seg, i) => (
              <line
                key={`${direction}-${i}`}
                x1={seg.x1}
                y1={seg.y1}
                x2={seg.x2}
                y2={seg.y2}
                strokeDasharray={SWING_LINE_DASH}
                strokeWidth={SWING_LINE_STROKE_WIDTH}
                data-direction={direction}
              />
            )),
          )
        : operation.directions.map((direction) => {
            const arrow = slideArrow(glazing, direction, viewDirection);
            return (
              <g key={direction} data-direction={direction}>
                <line
                  x1={arrow.shaft.x1}
                  y1={arrow.shaft.y1}
                  x2={arrow.shaft.x2}
                  y2={arrow.shaft.y2}
                  strokeWidth={4}
                />
                <polygon
                  points={arrow.head.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="var(--aperture-operation-symbol)"
                  strokeWidth={1}
                />
              </g>
            );
          })}
    </g>
  );
}
