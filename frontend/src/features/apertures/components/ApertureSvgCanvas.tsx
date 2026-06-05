import {
  elementRectMm,
  elementRegionsMm,
  flipColumnForInterior,
  type RectMm,
  viewBoxFor,
} from "../aperture-geometry";
import { MIN_CANVAS_WIDTH_PX, pxFromMm } from "../canvas-constants";
import type { ApertureSide, ApertureTypeEntry, FrameRef, GlazingRef } from "../types";

export type ApertureViewDirection = "exterior" | "interior";

// Match hex colors so we only inline catalog colors that are safe to drop into
// `fill="…"`. Anything else (named, missing, junk) falls back to a CSS token
// so theming stays consistent.
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;

function safeHexFill(color: string | null | undefined, fallbackVar: string): string {
  if (color && HEX_COLOR.test(color)) return color;
  return `var(${fallbackVar})`;
}

export function ApertureSvgCanvas({
  aperture,
  zoom,
  viewDirection,
}: {
  aperture: ApertureTypeEntry;
  zoom: number;
  viewDirection: ApertureViewDirection;
}) {
  const rendered = viewDirection === "interior" ? mirrorApertureForInterior(aperture) : aperture;
  const vb = viewBoxFor(rendered);
  const pxW = Math.max(MIN_CANVAS_WIDTH_PX, pxFromMm(vb.width, zoom));
  const pxH = pxFromMm(vb.height, zoom);

  return (
    <svg
      className="aperture-svg-canvas"
      data-testid="aperture-svg-canvas"
      data-view-direction={viewDirection}
      viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
      width={pxW}
      height={pxH}
      preserveAspectRatio="xMinYMin meet"
      shapeRendering="crispEdges"
      role="img"
      aria-label={`Aperture ${aperture.name}`}
    >
      {rendered.elements.map((el) => {
        const rect = elementRectMm(rendered, el);
        const regions = elementRegionsMm(el, rect);
        return (
          <g key={el.id} data-testid={`element-${el.id}`}>
            <FrameRegion side="top" frame={el.frames.top} rect={regions.top} elementId={el.id} />
            <FrameRegion
              side="right"
              frame={el.frames.right}
              rect={regions.right}
              elementId={el.id}
            />
            <FrameRegion
              side="bottom"
              frame={el.frames.bottom}
              rect={regions.bottom}
              elementId={el.id}
            />
            <FrameRegion side="left" frame={el.frames.left} rect={regions.left} elementId={el.id} />
            <GlazingRegion glazing={el.glazing} rect={regions.glazing} elementId={el.id} />
          </g>
        );
      })}
    </svg>
  );
}

function mirrorApertureForInterior(entry: ApertureTypeEntry): ApertureTypeEntry {
  return {
    ...entry,
    column_widths_mm: [...entry.column_widths_mm].reverse(),
    elements: entry.elements.map((el) => flipColumnForInterior(entry, el)),
  };
}

function FrameRegion({
  side,
  frame,
  rect,
  elementId,
}: {
  side: ApertureSide;
  frame: FrameRef | null;
  rect: RectMm;
  elementId: string;
}) {
  const isNull = frame === null;
  const fill = isNull ? "none" : safeHexFill(frame.color, "--aperture-frame-default-fill");
  return (
    <rect
      data-testid={`region-${elementId}-${side}`}
      data-region-kind="frame"
      data-region-null={isNull ? "true" : undefined}
      x={rect.x}
      y={rect.y}
      width={rect.width}
      height={rect.height}
      fill={fill}
      stroke={isNull ? "var(--aperture-null-stroke)" : "var(--aperture-region-stroke)"}
      strokeDasharray={isNull ? "4,3" : undefined}
      vectorEffect="non-scaling-stroke"
    />
  );
}

function GlazingRegion({
  glazing,
  rect,
  elementId,
}: {
  glazing: GlazingRef | null;
  rect: RectMm;
  elementId: string;
}) {
  const isNull = glazing === null;
  const fill = isNull ? "none" : safeHexFill(glazing.color, "--aperture-glazing-default-fill");
  return (
    <rect
      data-testid={`region-${elementId}-glazing`}
      data-region-kind="glazing"
      data-region-null={isNull ? "true" : undefined}
      x={rect.x}
      y={rect.y}
      width={rect.width}
      height={rect.height}
      fill={fill}
      stroke={isNull ? "var(--aperture-null-stroke)" : "var(--aperture-region-stroke)"}
      strokeDasharray={isNull ? "4,3" : undefined}
      vectorEffect="non-scaling-stroke"
    />
  );
}
