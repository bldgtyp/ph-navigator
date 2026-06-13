import { Check, Copy, Maximize2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUnitPreference } from "../../../lib/units";
import { configForMeta, fieldValue } from "../lib/fieldConfigs";
import { useModelViewerStore } from "../store";
import type { ModelObjectMeta } from "../types";

type InspectorPanelProps = {
  meta: ModelObjectMeta | null;
};

export function InspectorPanel({ meta }: InspectorPanelProps) {
  const { unitSystem } = useUnitPreference();
  const clearSelection = useModelViewerStore((state) => state.clearSelection);
  const requestCamera = useModelViewerStore((state) => state.requestCamera);
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    setCopied(false);
    return () => {
      if (resetTimer.current !== null) {
        window.clearTimeout(resetTimer.current);
        resetTimer.current = null;
      }
    };
  }, [meta?.id]);

  if (!meta) return null;

  const config = configForMeta(meta);
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
    </aside>
  );
}
