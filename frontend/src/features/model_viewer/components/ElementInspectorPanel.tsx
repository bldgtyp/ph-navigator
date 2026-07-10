import { Check, ChevronDown, Copy, Maximize2, X } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { formatLengthFromMm, useUnitPreference } from "../../../lib/units";
import { configForMeta, formatMetersAsLength } from "../lib/fieldConfigs";
import { splitFormattedMeasurement } from "../lib/formattedMeasurement";
import { elementIdForSegmentId } from "../lib/selection";
import type { BuildingModel } from "../loaders/building";
import type { ElementSummary } from "../loaders/lineElements";
import { useModelViewerStore } from "../store";
import type { DuctSegmentLineMeta, ModelObjectMeta, PipeSegmentLineMeta } from "../types";
import { FieldRows } from "./InspectorPanel";

type ElementInspectorPanelProps = {
  element: ElementSummary | null;
  model: BuildingModel | null;
};

export function ElementInspectorPanel({ element, model }: ElementInspectorPanelProps) {
  const { unitSystem } = useUnitPreference();
  const clearSelection = useModelViewerStore((state) => state.clearSelection);
  const requestCamera = useModelViewerStore((state) => state.requestCamera);
  const hoverId = useModelViewerStore((state) => state.hoverId);
  const setHoverId = useModelViewerStore((state) => state.setHoverId);
  const focusedSegmentId = useModelViewerStore((state) => state.focusedSegmentId);
  const toggleFocusedSegment = useModelViewerStore((state) => state.toggleFocusedSegment);
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | null>(null);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());

  useEffect(() => {
    setCopied(false);
    return () => {
      if (resetTimer.current !== null) {
        window.clearTimeout(resetTimer.current);
        resetTimer.current = null;
      }
    };
  }, [element?.id]);

  const hoveredSegmentId =
    hoverId && element && elementIdForSegmentId(hoverId) === element.id ? hoverId : null;

  useEffect(() => {
    if (!hoveredSegmentId) return;
    rowRefs.current.get(hoveredSegmentId)?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [hoveredSegmentId]);

  if (!element || !model) return null;

  const rows = element.segmentIds
    .map((segmentId) => model.metaById.get(segmentId))
    .filter((meta): meta is DuctSegmentLineMeta | PipeSegmentLineMeta => isLineSegmentMeta(meta));
  const firstRow = rows[0] ?? null;
  const lengthUnit = measurementUnit(firstRow ? segmentLength(firstRow, unitSystem) : null);
  const diameterUnit = measurementUnit(firstRow ? segmentDiameter(firstRow, unitSystem) : null);
  const copyId = async () => {
    await navigator.clipboard.writeText(element.identifier);
    setCopied(true);
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => {
      setCopied(false);
      resetTimer.current = null;
    }, 1200);
  };

  return (
    <aside className="model-inspector" aria-label="Selected model element">
      <header className="model-inspector-header">
        <div>
          <p>{element.kind === "ductElement" ? "Duct Element" : "Pipe Element"}</p>
          <h3>{element.display_name}</h3>
        </div>
        <button type="button" aria-label="Close inspector" onClick={clearSelection}>
          <X size={16} aria-hidden />
        </button>
      </header>
      <div className="model-inspector-actions">
        <button type="button" onClick={copyId}>
          {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          {copied ? "Copied" : "Copy ID"}
        </button>
        <button type="button" onClick={() => requestCamera("zoomTo", element.id)}>
          <Maximize2 size={14} aria-hidden />
          Zoom to
        </button>
      </div>
      <div className="model-inspector-sections">
        <section className="model-inspector-section model-inspector-total">
          <h4>Total Length</h4>
          <strong>{formatMetersAsLength(element.length, unitSystem)}</strong>
          <span>{segmentSummary(rows)}</span>
        </section>
        <section className="model-inspector-section">
          <h4>Segments</h4>
          <table
            className={
              element.kind === "pipeElement"
                ? "model-inspector-segment-table has-material"
                : "model-inspector-segment-table"
            }
            aria-label="Element segments"
          >
            <colgroup>
              <col className="model-inspector-segment-col-index" />
              <col className="model-inspector-segment-col-length" />
              <col className="model-inspector-segment-col-diameter" />
              {element.kind === "pipeElement" ? (
                <col className="model-inspector-segment-col-material" />
              ) : null}
              <col className="model-inspector-segment-col-more" />
            </colgroup>
            <thead>
              <tr className="model-inspector-segment-row is-header">
                <th scope="col">#</th>
                <th scope="col">
                  <SegmentColumnHeader label="Length" unit={lengthUnit} />
                </th>
                <th scope="col">
                  <SegmentColumnHeader label="Diam." unit={diameterUnit} />
                </th>
                {element.kind === "pipeElement" ? <th scope="col">Material</th> : null}
                <th scope="col">
                  <span className="sr-only">More</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((meta, index) => {
                const expanded = focusedSegmentId === meta.id;
                const hovered = hoveredSegmentId === meta.id;
                const config = configForMeta(meta);
                const segmentNumber = index + 1;
                const length = splitFormattedMeasurement(segmentLength(meta, unitSystem));
                const diameter = splitFormattedMeasurement(segmentDiameter(meta, unitSystem));
                const material = pipeMaterial(meta);
                return (
                  <Fragment key={meta.id}>
                    <tr
                      ref={(node) => {
                        if (node) rowRefs.current.set(meta.id, node);
                        else rowRefs.current.delete(meta.id);
                      }}
                      className={segmentRowClass(expanded, hovered)}
                      onMouseEnter={() => setHoverId(meta.id)}
                      onMouseLeave={() => setHoverId(null)}
                    >
                      <th className="model-inspector-segment-index" scope="row">
                        {segmentNumber}
                      </th>
                      <td className="model-inspector-segment-length">{length.value}</td>
                      <td className="model-inspector-segment-diameter">{diameter.value}</td>
                      {element.kind === "pipeElement" ? (
                        <td className="model-inspector-segment-material" title={material}>
                          {material}
                        </td>
                      ) : null}
                      <td className="model-inspector-segment-more-cell">
                        <button
                          type="button"
                          className="model-inspector-segment-more"
                          aria-label={segmentButtonLabel({
                            expanded,
                            segmentNumber,
                            length: length.formatted,
                            diameter: diameter.formatted,
                            material: element.kind === "pipeElement" ? material : null,
                          })}
                          aria-expanded={expanded}
                          title={expanded ? "Show less" : "Show more"}
                          onClick={() => toggleFocusedSegment(meta.id)}
                          onFocus={() => setHoverId(meta.id)}
                          onBlur={() => setHoverId(null)}
                        >
                          <ChevronDown
                            className="model-inspector-segment-chevron"
                            size={14}
                            aria-hidden
                          />
                        </button>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="model-inspector-segment-detail-row">
                        <td
                          className="model-inspector-segment-detail"
                          colSpan={element.kind === "pipeElement" ? 5 : 4}
                        >
                          <FieldRows config={config} meta={meta} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </aside>
  );
}

function isLineSegmentMeta(
  meta: ModelObjectMeta | undefined,
): meta is DuctSegmentLineMeta | PipeSegmentLineMeta {
  return meta?.type === "ductSegmentLine" || meta?.type === "pipeSegmentLine";
}

function segmentSummary(rows: Array<DuctSegmentLineMeta | PipeSegmentLineMeta>): string {
  return `${rows.length} ${rows.length === 1 ? "segment" : "segments"}`;
}

function segmentLength(
  meta: DuctSegmentLineMeta | PipeSegmentLineMeta,
  unitSystem: "SI" | "IP",
): string {
  return formatMetersAsLength(meta.length, unitSystem);
}

function segmentDiameter(
  meta: DuctSegmentLineMeta | PipeSegmentLineMeta,
  unitSystem: "SI" | "IP",
): string {
  if (meta.type === "ductSegmentLine") {
    return formatMetersAsLength(meta.diameter_m, unitSystem);
  }
  return formatLengthFromMm(meta.diameter_mm ?? null, { unitSystem, empty: "--" });
}

function pipeMaterial(meta: DuctSegmentLineMeta | PipeSegmentLineMeta): string {
  return meta.type === "pipeSegmentLine" && meta.material_value ? meta.material_value : "--";
}

function measurementUnit(formatted: string | null): string | null {
  return formatted ? splitFormattedMeasurement(formatted).unit : null;
}

function SegmentColumnHeader({ label, unit }: { label: string; unit: string | null }) {
  return (
    <span className="model-inspector-segment-header-stack">
      <span>{label}</span>
      {unit ? <span className="model-inspector-segment-header-unit">{unit}</span> : null}
    </span>
  );
}

function segmentRowClass(expanded: boolean, hovered: boolean): string {
  const classes = ["model-inspector-segment-row"];
  if (expanded) classes.push("is-expanded");
  if (hovered) classes.push("is-hovered");
  return classes.join(" ");
}

function segmentButtonLabel({
  expanded,
  segmentNumber,
  length,
  diameter,
  material,
}: {
  expanded: boolean;
  segmentNumber: number;
  length: string;
  diameter: string;
  material: string | null;
}): string {
  const action = expanded ? "Collapse" : "Expand";
  const materialText = material ? `, material ${material}` : "";
  return `${action} segment ${segmentNumber}: ${length}, diameter ${diameter}${materialText}`;
}
