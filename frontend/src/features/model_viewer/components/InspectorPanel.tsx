import { Check, Copy, Layers, Maximize2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUnitPreference } from "../../../lib/units";
import { configForMeta, construction, fieldValue, type InspectorConfig } from "../lib/fieldConfigs";
import { useModelViewerStore } from "../store";
import { ConstructionDetailModal } from "./ConstructionDetailModal";
import type { DetailedOpaqueConstruction, ModelObjectMeta } from "../types";

type InspectorPanelProps = {
  meta: ModelObjectMeta | null;
  /** The model's dedup construction-detail map (D-2); null before load. */
  constructions: Record<string, DetailedOpaqueConstruction> | null;
};

export function InspectorPanel({ meta, constructions }: InspectorPanelProps) {
  const clearSelection = useModelViewerStore((state) => state.clearSelection);
  const requestCamera = useModelViewerStore((state) => state.requestCamera);
  const [copied, setCopied] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const resetTimer = useRef<number | null>(null);
  const detailButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setCopied(false);
    setDetailOpen(false);
    return () => {
      if (resetTimer.current !== null) {
        window.clearTimeout(resetTimer.current);
        resetTimer.current = null;
      }
    };
  }, [meta?.id]);

  if (!meta) return null;

  const config = configForMeta(meta);
  const detailedConstruction = detailedConstructionForMeta(meta, constructions);
  const closeDetail = () => {
    setDetailOpen(false);
    detailButtonRef.current?.focus();
  };
  const copyId = async () => {
    await navigator.clipboard.writeText(meta.identifier);
    setCopied(true);
    if (resetTimer.current !== null) {
      window.clearTimeout(resetTimer.current);
    }
    resetTimer.current = window.setTimeout(() => {
      setCopied(false);
      resetTimer.current = null;
    }, 1200);
  };

  return (
    <aside className="model-inspector" aria-label="Selected model element">
      <header className="model-inspector-header">
        <div>
          <p>{config.title}</p>
          <h3>{meta.display_name}</h3>
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
        <button type="button" onClick={() => requestCamera("zoomTo", meta.id)}>
          <Maximize2 size={14} aria-hidden />
          Zoom to
        </button>
      </div>
      <FieldRows config={config} meta={meta} />
      {detailedConstruction ? (
        <div className="model-inspector-construction-action">
          <button ref={detailButtonRef} type="button" onClick={() => setDetailOpen(true)}>
            <Layers size={14} aria-hidden />
            View Construction
          </button>
        </div>
      ) : null}
      {detailOpen && detailedConstruction ? (
        <ConstructionDetailModal construction={detailedConstruction} onClose={closeDetail} />
      ) : null}
    </aside>
  );
}

/** The selected face's full construction detail, or null when the button
 *  must not show: window selections (D-1), non-face metas, artifacts
 *  predating the `constructions` map, or a construction with no layers
 *  (§4.5 — degrade to no-button, never a broken modal). */
function detailedConstructionForMeta(
  meta: ModelObjectMeta,
  constructions: Record<string, DetailedOpaqueConstruction> | null,
): DetailedOpaqueConstruction | null {
  if (meta.type !== "faceMesh" || !constructions) return null;
  const identifier = construction(meta)?.identifier;
  const detailed = identifier ? constructions[identifier] : undefined;
  return detailed && detailed.materials.length > 0 ? detailed : null;
}

export function FieldRows({ config, meta }: { config: InspectorConfig; meta: ModelObjectMeta }) {
  const { unitSystem } = useUnitPreference();

  return (
    <div className="model-inspector-sections">
      {config.sections.map((section, sectionIndex) => (
        <section key={section.title ?? sectionIndex} className="model-inspector-section">
          {section.title ? <h4>{section.title}</h4> : null}
          {section.fields.map((field) => (
            <div key={field.id} className="model-inspector-row">
              <dt title={field.tooltip}>{field.label}</dt>
              <dd>{fieldValue(meta, field, unitSystem)}</dd>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
