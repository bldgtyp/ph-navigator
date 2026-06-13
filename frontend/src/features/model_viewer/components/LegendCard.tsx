import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { formatProjectDateTime } from "../../../shared/lib/dates";
import { useModelViewerPopoverEscape } from "../lib/events";
import { legendForModel } from "../lib/themes";
import type { BuildingModel } from "../loaders/building";
import { useModelViewerStore } from "../store";
import type { HbjsonFile, LoadSummary, ModelViewerLegend } from "../types";

const LEGEND_COLLAPSED_KEY = "phn:model-viewer:legend-collapsed";

type LegendCardProps = {
  model: BuildingModel | null;
  activeFile: HbjsonFile;
  loadSummary: LoadSummary | null;
};

export function LegendCard({ model, activeFile, loadSummary }: LegendCardProps) {
  const lens = useModelViewerStore((state) => state.lens);
  const theme = useModelViewerStore((state) => state.themesByLens[state.lens]);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [infoOpen, setInfoOpen] = useState(false);
  const closeInfo = useCallback(() => setInfoOpen(false), []);
  const legend = useMemo(
    () => (model ? legendForModel(model, lens, theme) : null),
    [lens, model, theme],
  );
  useModelViewerPopoverEscape(closeInfo);

  if (!legend) {
    return (
      <div className="model-scene-info-root">
        <InfoButton open={infoOpen} onClick={() => setInfoOpen((current) => !current)} />
        {infoOpen ? <SceneInfoPopover activeFile={activeFile} loadSummary={loadSummary} /> : null}
      </div>
    );
  }

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      sessionStorage.setItem(LEGEND_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  return (
    <div className="model-legend-card" aria-label={`${legend.title} legend`}>
      <div className="model-legend-titlebar">
        <div className="model-legend-title">
          <span>{legend.title}</span>
          {legend.kind === "mini-key" ? <small>Key</small> : null}
        </div>
        <div className="model-legend-title-actions">
          <InfoButton open={infoOpen} onClick={() => setInfoOpen((current) => !current)} />
          <button
            type="button"
            aria-label={collapsed ? "Expand legend" : "Collapse legend"}
            title={collapsed ? "Expand legend" : "Collapse legend"}
            onClick={toggleCollapsed}
          >
            {collapsed ? (
              <ChevronUp size={15} aria-hidden />
            ) : (
              <ChevronDown size={15} aria-hidden />
            )}
          </button>
        </div>
      </div>
      {infoOpen ? <SceneInfoPopover activeFile={activeFile} loadSummary={loadSummary} /> : null}
      {!collapsed ? <LegendRows legend={legend} /> : null}
    </div>
  );
}

function LegendRows({ legend }: { legend: Exclude<ModelViewerLegend, null> }) {
  return (
    <div className="model-legend-rows">
      {legend.rows.map((row) => (
        <button key={row.id} type="button" aria-disabled="true" tabIndex={-1}>
          <span className="model-legend-swatch" style={{ backgroundColor: row.color }} />
          <span className="model-legend-label">{row.label}</span>
          <span className="model-legend-count">{row.count}</span>
        </button>
      ))}
    </div>
  );
}

function InfoButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Model scene information"
      aria-expanded={open}
      title="Model scene information"
      onClick={onClick}
    >
      <Info size={15} aria-hidden />
    </button>
  );
}

function SceneInfoPopover({
  activeFile,
  loadSummary,
}: {
  activeFile: HbjsonFile;
  loadSummary: LoadSummary | null;
}) {
  return (
    <div className="model-scene-info-popover" role="dialog" aria-label="Model scene information">
      <h4>Model Info</h4>
      <dl>
        <div>
          <dt>File</dt>
          <dd>{activeFile.display_name}</dd>
        </div>
        <div>
          <dt>Uploaded</dt>
          <dd>{formatProjectDateTime(activeFile.uploaded_at)}</dd>
        </div>
        {loadSummary ? (
          <>
            <div>
              <dt>Surfaces</dt>
              <dd>{loadSummary.faces_extracted}</dd>
            </div>
            <div>
              <dt>Spaces</dt>
              <dd>{loadSummary.spaces_extracted}</dd>
            </div>
            <div>
              <dt>Shade Groups</dt>
              <dd>{loadSummary.shade_groups_extracted}</dd>
            </div>
            <div>
              <dt>Air Boundaries Skipped</dt>
              <dd>{loadSummary.air_boundaries_skipped}</dd>
            </div>
          </>
        ) : null}
      </dl>
      {loadSummary?.extraction_warnings.length ? (
        <div className="model-scene-info-warnings">
          <h5>Warnings</h5>
          <ul>
            {loadSummary.extraction_warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function readCollapsed(): boolean {
  return sessionStorage.getItem(LEGEND_COLLAPSED_KEY) === "true";
}
