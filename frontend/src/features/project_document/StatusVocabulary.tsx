import { Info } from "lucide-react";
import { InfoTooltip, Tooltip } from "../../shared/ui";
import {
  STATUS_AXIS_LABELS,
  STATUS_AXIS_TOOLTIPS,
  STATUS_LEGEND_ITEMS,
  STATUS_LEGEND_RESOLVED_COPY,
  resolvedLabel,
  type DocumentationStatusAxis,
} from "./specification-status";

export function StatusAxisHeader({
  axis,
  label = STATUS_AXIS_LABELS[axis].column,
}: {
  axis: DocumentationStatusAxis;
  label?: string;
}) {
  return (
    <span className="status-vocabulary-label">
      <span>{label}</span>
      <InfoTooltip label={`${STATUS_AXIS_LABELS[axis].column} definition`}>
        {STATUS_AXIS_TOOLTIPS[axis]}
      </InfoTooltip>
    </span>
  );
}

export function StatusLegend() {
  return (
    <Tooltip
      placement="bottom"
      content={
        <span className="status-legend-tooltip">
          {STATUS_LEGEND_ITEMS.map((item) => (
            <span key={item.label}>
              <strong>{item.label}</strong> — {item.description}
            </span>
          ))}
          <span>{STATUS_LEGEND_RESOLVED_COPY}</span>
        </span>
      }
    >
      <button type="button" className="status-legend-button" aria-label="Status legend">
        <Info aria-hidden="true" size={14} strokeWidth={1.8} />
        <span>Legend</span>
      </button>
    </Tooltip>
  );
}

export function StatusRollupSummary({ resolved, total }: { resolved: number; total: number }) {
  return (
    <>
      <span>{resolvedLabel(resolved, total)}</span>
      <StatusLegend />
    </>
  );
}
