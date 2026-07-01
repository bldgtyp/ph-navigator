import { Check, Copy, Maximize2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatLengthFromMm, useUnitPreference } from "../../../lib/units";
import { configForMeta, formatMetersAsLength } from "../lib/fieldConfigs";
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
  const [copied, setCopied] = useState(false);
  const [expandedSegmentId, setExpandedSegmentId] = useState<string | null>(null);
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    setCopied(false);
    setExpandedSegmentId(null);
    return () => {
      if (resetTimer.current !== null) {
        window.clearTimeout(resetTimer.current);
        resetTimer.current = null;
      }
    };
  }, [element?.id]);

  if (!element || !model) return null;

  const rows = element.segmentIds
    .map((segmentId) => model.metaById.get(segmentId))
    .filter((meta): meta is DuctSegmentLineMeta | PipeSegmentLineMeta => isLineSegmentMeta(meta));
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
          <span>{segmentSummary(rows, element)}</span>
        </section>
        <section className="model-inspector-section">
          <h4>Segments</h4>
          <div className="model-inspector-segment-table" role="table" aria-label="Element segments">
            <div className="model-inspector-segment-row is-header" role="row">
              <span role="columnheader">#</span>
              <span role="columnheader">Length</span>
              <span role="columnheader">Diameter</span>
              {element.kind === "pipeElement" ? <span role="columnheader">Material</span> : null}
            </div>
            {rows.map((meta, index) => {
              const expanded = expandedSegmentId === meta.id;
              const config = configForMeta(meta);
              return (
                <div className="model-inspector-segment-group" key={meta.id}>
                  <button
                    type="button"
                    className={
                      expanded
                        ? "model-inspector-segment-row is-expanded"
                        : "model-inspector-segment-row"
                    }
                    aria-expanded={expanded}
                    onClick={() => setExpandedSegmentId(expanded ? null : meta.id)}
                  >
                    <span>{index + 1}</span>
                    <span>{segmentLength(meta, unitSystem)}</span>
                    <span>{segmentDiameter(meta, unitSystem)}</span>
                    {element.kind === "pipeElement" ? <span>{pipeMaterial(meta)}</span> : null}
                  </button>
                  {expanded ? (
                    <div className="model-inspector-segment-detail">
                      <FieldRows config={config} meta={meta} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
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

function segmentSummary(
  rows: Array<DuctSegmentLineMeta | PipeSegmentLineMeta>,
  element: ElementSummary,
): string {
  const segmentText = `${rows.length} ${rows.length === 1 ? "segment" : "segments"}`;
  const firstRow = rows[0] ?? null;
  const diameter = firstRow ? segmentDiameter(firstRow, "SI") : "--";
  if (diameter === "--") return segmentText;
  const prefix = element.kind === "pipeElement" ? "diam." : "dia.";
  return `${segmentText} · ${prefix} ${diameter}`;
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
