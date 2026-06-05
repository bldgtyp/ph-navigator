import { materialColor } from "../lib";
import { ASSEMBLY_CANVAS_ORIGIN_X_PX } from "../canvas-constants";
import { segmentCanvasKey, type AssemblyCanvasPaintMode } from "../canvas-paint";
import type { AssemblyCanvasGeometry, AssemblyCanvasSegmentGeometry } from "../canvas-geometry";
import type { Assembly, ProjectMaterial } from "../types";

const SVG_STROKE_PADDING_MM = 1;

export function AssemblySvgCanvas({
  assembly,
  materialsById,
  geometry,
  widthPx,
  heightPx,
  paintMode,
  pickedSourceKey,
}: {
  assembly: Assembly;
  materialsById: ReadonlyMap<string, ProjectMaterial>;
  geometry: AssemblyCanvasGeometry;
  widthPx: number;
  heightPx: number;
  paintMode: AssemblyCanvasPaintMode;
  pickedSourceKey: string | null;
}) {
  const pxPerMm = widthPx / geometry.widthMm;
  const strokePaddingPx = SVG_STROKE_PADDING_MM * pxPerMm;
  const paddedWidthPx = widthPx + strokePaddingPx * 2;
  const paddedHeightPx = heightPx + strokePaddingPx * 2;
  const paddedViewBox = [
    -SVG_STROKE_PADDING_MM,
    -SVG_STROKE_PADDING_MM,
    geometry.widthMm + SVG_STROKE_PADDING_MM * 2,
    geometry.heightMm + SVG_STROKE_PADDING_MM * 2,
  ]
    .map(formatSvgNumber)
    .join(" ");

  return (
    <svg
      className="assembly-svg-canvas"
      data-mode={paintMode}
      data-testid="assembly-svg-canvas"
      role="img"
      aria-label={`${assembly.name} assembly section`}
      viewBox={paddedViewBox}
      width={paddedWidthPx}
      height={paddedHeightPx}
      preserveAspectRatio="xMinYMin meet"
      shapeRendering="crispEdges"
      style={{
        left: `${ASSEMBLY_CANVAS_ORIGIN_X_PX - strokePaddingPx}px`,
        top: `${-strokePaddingPx}px`,
      }}
    >
      <defs>
        <pattern
          id={`null-material-pattern-${assembly.id}`}
          width="10"
          height="10"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="10" className="assembly-null-material-hatch" />
        </pattern>
      </defs>
      {geometry.segments.map((segmentGeometry) => {
        const materialId = segmentGeometry.segment.project_material_id;
        const material = materialId ? (materialsById.get(materialId) ?? null) : null;
        const isNullMaterial = material === null;
        return (
          <SvgSegmentRect
            key={`${segmentGeometry.layer.id}-${segmentGeometry.segment.id}`}
            segmentGeometry={segmentGeometry}
            fill={
              isNullMaterial
                ? `url(#null-material-pattern-${assembly.id})`
                : materialColor(material)
            }
            isNullMaterial={isNullMaterial}
            pickedSourceKey={pickedSourceKey}
          />
        );
      })}
    </svg>
  );
}

function SvgSegmentRect({
  segmentGeometry,
  fill,
  isNullMaterial,
  pickedSourceKey,
}: {
  segmentGeometry: AssemblyCanvasSegmentGeometry;
  fill: string;
  isNullMaterial: boolean;
  pickedSourceKey: string | null;
}) {
  const key = segmentCanvasKey(segmentGeometry.layer.id, segmentGeometry.segment.id);
  const classNames = ["assembly-svg-segment"];
  if (isNullMaterial) classNames.push("is-null-material");
  if (pickedSourceKey === key) classNames.push("is-picked-source");

  return (
    <rect
      className={classNames.join(" ")}
      data-testid="assembly-svg-segment"
      data-layer-id={segmentGeometry.layer.id}
      data-segment-id={segmentGeometry.segment.id}
      x={segmentGeometry.xMm}
      y={segmentGeometry.yMm}
      width={segmentGeometry.widthMm}
      height={segmentGeometry.heightMm}
      fill={fill}
    />
  );
}

function formatSvgNumber(value: number): string {
  return Number.parseFloat(value.toFixed(4)).toString();
}
