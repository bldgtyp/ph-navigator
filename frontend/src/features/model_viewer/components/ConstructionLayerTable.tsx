import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import {
  formatConductivityFromWmK,
  formatLengthFromMm,
  formatRValueFromM2KPerW,
  type UnitSystem,
} from "../../../lib/units";
import {
  isFramedLayer,
  totalThicknessM,
  type ConstructionCell,
  type ConstructionLayer,
} from "../lib/constructionLayers";

function length(mm: number | null, unitSystem: UnitSystem): string {
  return formatLengthFromMm(mm, { unitSystem, empty: "--" });
}

function conductivity(wmk: number, unitSystem: UnitSystem): string {
  return formatConductivityFromWmK(wmk, { unitSystem, empty: "--" });
}

function rValue(r: number, unitSystem: UnitSystem): string {
  return formatRValueFromM2KPerW(r, { unitSystem, empty: "--" });
}

/** Expandable layer schedule: one row per layer exterior→interior, framed
 *  layers reveal their segment sub-rows on request, totals in the footer.
 *  Per-layer and Σ figures are display-only layer math (D-7);
 *  the authoritative U/R stay in the modal header, LBT-verbatim. */
export function ConstructionLayerTable({
  layers,
  unitSystem,
  hoveredIndex,
  onHoverLayer,
}: {
  layers: ConstructionLayer[];
  unitSystem: UnitSystem;
  hoveredIndex: number | null;
  onHoverLayer: (index: number | null) => void;
}) {
  const [expandedIndices, setExpandedIndices] = useState<ReadonlySet<number>>(() => new Set());

  const toggleLayer = (index: number) => {
    setExpandedIndices((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <table className="construction-layer-table" onMouseLeave={() => onHoverLayer(null)}>
      <thead>
        <tr>
          <th scope="col" className="construction-col-index">
            #
          </th>
          <th scope="col">Layer</th>
          <th scope="col" className="construction-col-number">
            Thickness{" "}
            <span className="construction-column-unit">({unitSystem === "IP" ? "in" : "mm"})</span>
          </th>
          <th
            scope="col"
            className="construction-col-number construction-col-lambda"
            title="Conductivity (homogenized)"
          >
            λ{" "}
            <span className="construction-column-unit">
              ({unitSystem === "IP" ? "Btu/(h-ft-F)" : "W/(m-K)"})
            </span>
          </th>
          <th scope="col" className="construction-col-number" title="Layer R = thickness / λ (D-7)">
            R{" "}
            <span className="construction-column-unit">
              ({unitSystem === "IP" ? "h-ft2-F/Btu" : "m2-K/W"})
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        {layers.map((layer) => (
          <LayerRows
            key={layer.index}
            layer={layer}
            unitSystem={unitSystem}
            isExpanded={expandedIndices.has(layer.index)}
            isHovered={hoveredIndex === layer.index}
            onHover={onHoverLayer}
            onToggle={toggleLayer}
          />
        ))}
      </tbody>
      <tfoot>
        <tr className="construction-totals-row">
          <td />
          <th scope="row">Σ layers</th>
          <td className="construction-col-number">
            {length(totalThicknessM(layers) * 1000, unitSystem)}
          </td>
          <td />
          <td
            className="construction-col-number"
            title="Sum of per-layer R — reconciles with the header R-Value within rounding (D-7)"
          >
            {rValue(
              layers.reduce((sum, layer) => sum + layer.rValue, 0),
              unitSystem,
            )}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

function LayerRows({
  layer,
  unitSystem,
  isExpanded,
  isHovered,
  onHover,
  onToggle,
}: {
  layer: ConstructionLayer;
  unitSystem: UnitSystem;
  isExpanded: boolean;
  isHovered: boolean;
  onHover: (index: number | null) => void;
  onToggle: (index: number) => void;
}) {
  const isFramed = isFramedLayer(layer);
  const showCells = isFramed && isExpanded;
  return (
    <>
      <tr
        data-testid="construction-layer-row"
        className={isHovered ? "is-hovered" : undefined}
        onMouseEnter={() => onHover(layer.index)}
      >
        <td className="construction-col-index">{layer.index + 1}</td>
        <td>
          <span className="construction-layer-label">
            <LayerSwatch cells={layer.cells} />
            {isFramed ? (
              <button
                type="button"
                className="construction-expand-button"
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? "Collapse" : "Expand"} segments of ${layer.label}`}
                onClick={() => onToggle(layer.index)}
              >
                {isExpanded ? (
                  <ChevronDown size={13} aria-hidden />
                ) : (
                  <ChevronRight size={13} aria-hidden />
                )}
                {layer.label}
              </button>
            ) : (
              layer.label
            )}
          </span>
        </td>
        <td className="construction-col-number">{length(layer.thickness * 1000, unitSystem)}</td>
        <td className="construction-col-number">{conductivity(layer.conductivity, unitSystem)}</td>
        <td className="construction-col-number">{rValue(layer.rValue, unitSystem)}</td>
      </tr>
      {showCells
        ? layer.cells.map((cell, cellIndex) => (
            <tr
              key={cellIndex}
              data-testid="construction-cell-row"
              className="construction-cell-row"
              onMouseEnter={() => onHover(layer.index)}
            >
              <td />
              <td>
                <span className="construction-layer-label is-cell">
                  <span
                    className={
                      cell.color ? "construction-swatch" : "construction-swatch is-fallback"
                    }
                    style={cell.color ? { background: cell.color } : undefined}
                    aria-hidden
                  />
                  {cell.label}
                </span>
              </td>
              <td className="construction-col-number">
                {cell.widthM !== null ? `↔ ${length(cell.widthM * 1000, unitSystem)}` : "--"}
              </td>
              <td className="construction-col-number">
                {conductivity(cell.conductivity, unitSystem)}
              </td>
              <td />
            </tr>
          ))
        : null}
      {layer.steelStudSpacingMm !== null ? (
        // Not gated on expansion: a steel-stud layer often carries a single
        // homogenized cell (nothing to expand), but the spacing must still
        // be annotated (acceptance crit. 3).
        <tr className="construction-cell-row construction-steel-note" data-testid="steel-stud-note">
          <td />
          <td colSpan={4}>Steel studs @ {length(layer.steelStudSpacingMm, unitSystem)} o.c.</td>
        </tr>
      ) : null}
    </>
  );
}

/** Mini section through the layer: one stripe per cell, proportional to its
 *  width — reads as a legend for the drawing. Null colors show the fallback
 *  hatch (D-6). */
function LayerSwatch({ cells }: { cells: ConstructionCell[] }) {
  return (
    <span className="construction-swatch is-segmented" aria-hidden>
      {cells.map((cell, index) => (
        <span
          key={index}
          className={cell.color ? undefined : "is-fallback"}
          style={{
            flexGrow: cell.widthFraction,
            ...(cell.color ? { background: cell.color } : undefined),
          }}
        />
      ))}
    </span>
  );
}
