import { totalThicknessM, type ConstructionLayer } from "../lib/constructionLayers";

/** Cross-axis extent of the drawing in viewBox units — the layer width is
 *  abstract (fractions), only the stack axis (thickness, mm) is to scale. */
const CROSS_AXIS_UNITS = 140;
/** Stack-axis px per mm of assembly thickness, clamped so thin roofs don't
 *  collapse and thick walls don't overflow the modal. */
const PX_PER_MM = 0.5;
const MIN_HEIGHT_PX = 100;
const MAX_HEIGHT_PX = 220;

/** Read-only, to-scale section through the assembly: exterior at top,
 *  interior at bottom (honeybee materials[] order, Q1). One <rect> per
 *  cell; framed layers show their real segment stripes. Purely
 *  presentational — no paint/pick (this is not the Envelope canvas, D-8).
 */
export function ConstructionStackSvg({
  constructionName,
  layers,
  hoveredIndex,
  onHoverLayer,
}: {
  constructionName: string;
  layers: ConstructionLayer[];
  hoveredIndex: number | null;
  onHoverLayer: (index: number | null) => void;
}) {
  const totalMm = totalThicknessM(layers) * 1000;
  const heightPx = Math.min(MAX_HEIGHT_PX, Math.max(MIN_HEIGHT_PX, totalMm * PX_PER_MM));
  // The section is schematic across its width, but its layer heights remain
  // proportional. Scaling the SVG coordinates to its rendered height lets us
  // preserve the drawing's aspect ratio instead of stretching it vertically.
  const stackScale = totalMm > 0 ? heightPx / totalMm : 1;

  let yMm = 0;
  const layerRects = layers.map((layer) => {
    const layerY = yMm;
    const layerMm = layer.thickness * 1000;
    yMm += layerMm;
    return { layer, layerY, layerMm };
  });

  return (
    <figure className="construction-stack">
      <figcaption className="construction-stack-end-label">Exterior</figcaption>
      <svg
        className="construction-stack-svg"
        role="img"
        aria-label={`${constructionName} — assembly section, exterior at top`}
        viewBox={`0 0 ${CROSS_AXIS_UNITS} ${heightPx}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ height: `${heightPx}px` }}
        onMouseLeave={() => onHoverLayer(null)}
      >
        <defs>
          <pattern
            id="construction-fallback-hatch"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" className="construction-hatch-bg" />
            <line x1="0" y1="0" x2="0" y2="6" className="construction-hatch-line" />
          </pattern>
          <pattern
            id="construction-steel-hatch"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-45)"
          >
            <line x1="0" y1="0" x2="0" y2="8" className="construction-steel-hatch-line" />
          </pattern>
        </defs>
        {layerRects.map(({ layer, layerY, layerMm }) => (
          <g
            key={layer.index}
            data-testid="construction-stack-layer"
            data-layer-index={layer.index}
            className={hoveredIndex === layer.index ? "is-hovered" : undefined}
            onMouseEnter={() => onHoverLayer(layer.index)}
          >
            {layer.cells.map((cell, cellIndex) => (
              <rect
                key={cellIndex}
                data-testid="construction-stack-cell"
                className="construction-stack-cell"
                x={cell.xFraction * CROSS_AXIS_UNITS}
                y={(layerY + cell.yFraction * layerMm) * stackScale}
                width={cell.widthFraction * CROSS_AXIS_UNITS}
                height={cell.heightFraction * layerMm * stackScale}
                fill={cell.color ?? "url(#construction-fallback-hatch)"}
              >
                <title>{cell.label}</title>
              </rect>
            ))}
            {layer.steelStudSpacingMm !== null ? (
              <rect
                data-testid="construction-steel-marker"
                className="construction-steel-marker"
                x={0}
                y={layerY * stackScale}
                width={CROSS_AXIS_UNITS}
                height={layerMm * stackScale}
                fill="url(#construction-steel-hatch)"
              />
            ) : null}
            <rect
              className="construction-stack-layer-outline"
              x={0}
              y={layerY * stackScale}
              width={CROSS_AXIS_UNITS}
              height={layerMm * stackScale}
              fill="transparent"
            />
          </g>
        ))}
      </svg>
      <figcaption className="construction-stack-end-label">Interior</figcaption>
    </figure>
  );
}
