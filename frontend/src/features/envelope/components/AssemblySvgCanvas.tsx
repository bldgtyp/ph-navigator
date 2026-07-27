import { materialColor } from "../lib";
import { ASSEMBLY_CANVAS_ORIGIN_X_PX, SVG_STROKE_PADDING_MM } from "../canvas-constants";
import { segmentCanvasKey, type AssemblyCanvasPaintMode } from "../canvas-paint";
import type { AssemblyCanvasGeometry, AssemblyCanvasSegmentGeometry } from "../canvas-geometry";
import type { Assembly, ProjectMaterial } from "../types";

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
        top: 0,
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
        const key = segmentCanvasKey(segmentGeometry.layer.id, segmentGeometry.segment.id);
        const isPicked = pickedSourceKey === key;
        // A membrane is drawn as a rule centred in its reserved band, not as a
        // block of material — that is how a WRB reads on a wall section, and
        // the daylight either side is what keeps it distinguishable from the
        // layers it sits between. It is never hatched: a layer only counts as
        // a membrane once its material is assigned, so there is no null case.
        //
        // Its colour is optional though — see `membraneStrokeColor`.
        if (segmentGeometry.isMembrane) {
          return (
            <SvgMembraneRule
              key={key}
              segmentGeometry={segmentGeometry}
              stroke={membraneStrokeColor(material)}
              isPicked={isPicked}
            />
          );
        }
        const isNullMaterial = material === null;
        return (
          <SvgSegmentRect
            key={key}
            segmentGeometry={segmentGeometry}
            fill={
              isNullMaterial
                ? `url(#null-material-pattern-${assembly.id})`
                : materialColor(material)
            }
            isNullMaterial={isNullMaterial}
            isPicked={isPicked}
          />
        );
      })}
      {geometry.airBarrier ? (
        <line
          className="assembly-svg-air-barrier"
          data-testid="assembly-svg-air-barrier"
          data-face={geometry.airBarrier.face}
          x1={0}
          x2={geometry.airBarrier.widthMm}
          y1={geometry.airBarrier.yMm}
          y2={geometry.airBarrier.yMm}
        >
          <title>{`Air barrier: ${geometry.airBarrier.face} face`}</title>
        </line>
      ) : null}
    </svg>
  );
}

/**
 * The stroke a membrane rule should paint, or `undefined` to defer to CSS.
 *
 * A material's colour is optional, and `materialColor` answers a missing one
 * with `transparent`. That is harmless for a filled rect but fatal for a rule:
 * the layer would occupy its band and stay selectable while drawing nothing.
 * Returning `undefined` omits the attribute so the stylesheet's default stroke
 * applies, which is what guarantees a membrane is always visible.
 */
export function membraneStrokeColor(material: ProjectMaterial | null): string | undefined {
  return material?.color ? materialColor(material) : undefined;
}

/**
 * How a segment is addressed in the DOM, whatever shape draws it.
 *
 * A membrane renders as a `<line>` and everything else as a `<rect>`, but both
 * must stay findable the same way — tests and the overlay locate segments by
 * these attributes, so the two renderers must not drift apart.
 */
function segmentSvgIdentity(segmentGeometry: AssemblyCanvasSegmentGeometry) {
  return {
    "data-testid": "assembly-svg-segment",
    "data-layer-id": segmentGeometry.layer.id,
    "data-segment-id": segmentGeometry.segment.id,
  };
}

/**
 * A membrane, drawn as a full-width rule at the centre of its reserved band.
 *
 * The band's height comes from the geometry, not from `layer.thickness_mm` —
 * a real membrane is sub-pixel. Centring the rule leaves equal daylight above
 * and below, which is what visually separates it from its neighbours and what
 * signals that the drawing is not to scale here.
 */
function SvgMembraneRule({
  segmentGeometry,
  stroke,
  isPicked,
}: {
  segmentGeometry: AssemblyCanvasSegmentGeometry;
  // Omitted when the material carries no colour, so CSS supplies the default.
  stroke: string | undefined;
  isPicked: boolean;
}) {
  const classNames = ["assembly-svg-membrane"];
  if (isPicked) classNames.push("is-picked-source");
  const centreYMm = segmentGeometry.yMm + segmentGeometry.heightMm / 2;

  return (
    <line
      className={classNames.join(" ")}
      {...segmentSvgIdentity(segmentGeometry)}
      data-membrane="true"
      x1={segmentGeometry.xMm}
      x2={segmentGeometry.xMm + segmentGeometry.widthMm}
      y1={centreYMm}
      y2={centreYMm}
      stroke={stroke}
    />
  );
}

function SvgSegmentRect({
  segmentGeometry,
  fill,
  isNullMaterial,
  isPicked,
}: {
  segmentGeometry: AssemblyCanvasSegmentGeometry;
  fill: string;
  isNullMaterial: boolean;
  isPicked: boolean;
}) {
  const classNames = ["assembly-svg-segment"];
  if (isNullMaterial) classNames.push("is-null-material");
  if (isPicked) classNames.push("is-picked-source");

  return (
    <rect
      className={classNames.join(" ")}
      {...segmentSvgIdentity(segmentGeometry)}
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
