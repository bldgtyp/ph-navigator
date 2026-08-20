import type { ModelViewerLegend } from "../types";

type ContinuousLegendDefinition = Extract<Exclude<ModelViewerLegend, null>, { kind: "continuous" }>;

export function ContinuousLegend({ legend }: { legend: ContinuousLegendDefinition }) {
  const gradient = `linear-gradient(to right, ${legend.stops
    .map((stop) => `${stop.color} ${stop.value * 100}%`)
    .join(", ")})`;
  return (
    <div className="model-continuous-legend">
      <p className="model-continuous-legend-title">{legend.title}</p>
      <div
        className="model-continuous-legend-gradient"
        style={{ backgroundImage: gradient }}
        aria-hidden
      />
      <div className="model-continuous-legend-ticks" aria-label="Shading factor scale">
        {legend.stops.map((stop) => (
          <span key={stop.value}>{formatTick(stop.value)}</span>
        ))}
      </div>
      <div className="model-continuous-legend-endpoints">
        <span>{legend.endpointLabels.minimum}</span>
        <span>{legend.endpointLabels.maximum}</span>
      </div>
      {legend.missingCount > 0 ? (
        <div className="model-continuous-legend-missing">
          <span className="model-legend-swatch" style={{ backgroundColor: legend.missingColor }} />
          <span>Missing</span>
          <span className="model-legend-count">{legend.missingCount}</span>
        </div>
      ) : null}
    </div>
  );
}

function formatTick(value: number): string {
  if (value === 0) return "0";
  if (value === 1) return "1.00";
  return value.toFixed(2);
}
