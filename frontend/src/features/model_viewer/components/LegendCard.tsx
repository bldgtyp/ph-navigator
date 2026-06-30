import { ChevronDown, ChevronUp, Gauge, Info, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { formatProjectDateTime } from "../../../shared/lib/dates";
import { isModelViewerDebugHookEnabled } from "../lib/debugHook";
import { useModelViewerPopoverEscape } from "../lib/events";
import { useModelViewerPerfStore } from "../lib/perf";
import { legendForModel } from "../lib/themes";
import type { BuildingModel } from "../loaders/building";
import { useModelViewerStore } from "../store";
import type { HbjsonFile, LoadSummary, ModelViewerLegend, ModelViewerTheme } from "../types";

const LEGEND_COLLAPSED_KEY = "phn:model-viewer:legend-collapsed";

type LegendCardProps = {
  model: BuildingModel | null;
  activeFile: HbjsonFile;
  loadSummary: LoadSummary | null;
};

export function LegendCard({ model, activeFile, loadSummary }: LegendCardProps) {
  const lens = useModelViewerStore((state) => state.lens);
  const theme = useModelViewerStore((state) => state.themesByLens[state.lens]);
  const legendFilter = useModelViewerStore((state) => state.legendFilter);
  const clearLegendFilter = useModelViewerStore((state) => state.clearLegendFilter);
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
        <PerfToggleButton />
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
    <>
      <div className="model-legend-card" aria-label={`${legend.title} legend`}>
        <div className="model-legend-titlebar">
          <div className="model-legend-title">
            <span>{legend.title}</span>
            {legend.kind === "mini-key" ? <small>Key</small> : null}
          </div>
          <div className="model-legend-title-actions">
            {legendFilter?.theme === theme ? (
              <button
                type="button"
                className="model-legend-clear-filter"
                aria-label="Clear filter"
                title="Clear filter"
                onClick={clearLegendFilter}
              >
                <X size={15} aria-hidden />
              </button>
            ) : null}
            <button
              type="button"
              className="model-legend-collapse-trigger"
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
        {!collapsed ? <LegendRows legend={legend} theme={theme} /> : null}
      </div>
      <div className="model-scene-info-root">
        <InfoButton open={infoOpen} onClick={() => setInfoOpen((current) => !current)} />
        <PerfToggleButton />
        {infoOpen ? <SceneInfoPopover activeFile={activeFile} loadSummary={loadSummary} /> : null}
      </div>
    </>
  );
}

/**
 * The legend rows, live as a single-select filter group (NEW-VIEW-2). Clicking a
 * row isolates its bucket; clicking the active row again clears it. Rows show
 * model totals (not post-filter counts) — they are a model summary, not a filter
 * readout (PRD §2.5).
 */
function LegendRows({
  legend,
  theme,
}: {
  legend: Exclude<ModelViewerLegend, null>;
  theme: ModelViewerTheme;
}) {
  const legendFilter = useModelViewerStore((state) => state.legendFilter);
  const toggleLegendFilterKey = useModelViewerStore((state) => state.toggleLegendFilterKey);
  const activeKeys = legendFilter?.theme === theme ? legendFilter.keys : null;
  return (
    <div className="model-legend-rows" role="group" aria-label={`Filter by ${legend.title}`}>
      {legend.rows.map((row) => {
        const active = activeKeys?.has(row.id) ?? false;
        return (
          <button
            key={row.id}
            type="button"
            aria-pressed={active}
            className={active ? "model-legend-row is-active" : "model-legend-row"}
            title={`Isolate ${row.label} — Shift-click to add to the filter`}
            onClick={(event) => toggleLegendFilterKey(theme, row.id, event.shiftKey)}
          >
            <span className="model-legend-swatch" style={{ backgroundColor: row.color }} />
            <span className="model-legend-label">{row.label}</span>
            <span className="model-legend-count">{row.count}</span>
          </button>
        );
      })}
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

/**
 * Dev-only toggle for the perf overlay (the calls/tris/fps readout). Renders
 * nothing outside dev/test so it never reaches the production UI; in dev it sits
 * beside the scene-info button and shows/hides the overlay, which stays hidden
 * by default.
 */
function PerfToggleButton() {
  const overlayVisible = useModelViewerPerfStore((state) => state.overlayVisible);
  const toggleOverlay = useModelViewerPerfStore((state) => state.toggleOverlay);
  if (!isModelViewerDebugHookEnabled()) return null;
  const label = overlayVisible ? "Hide perf overlay" : "Show perf overlay";
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={overlayVisible}
      title={label}
      onClick={toggleOverlay}
    >
      <Gauge size={15} aria-hidden />
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
