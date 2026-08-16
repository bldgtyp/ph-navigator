import { Info } from "lucide-react";
import { Link } from "react-router-dom";
import { InfoTooltip, ProgressBar, Tooltip } from "../../shared/ui";
import {
  STATUS_AXIS_LABELS,
  STATUS_AXIS_TOOLTIPS,
  STATUS_LEGEND_ITEMS,
  STATUS_LEGEND_RESOLVED_COPY,
  completeCountLabel,
  resolvedLabel,
  type DocumentationStatusAxis,
  type StatusAxisCounts,
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

const ROLLUP_AXES = [
  { axis: "spec", done: "spec_done", total: "spec_total" },
  { axis: "datasheet", done: "ds_done", total: "ds_total" },
  { axis: "photo", done: "photo_done", total: "photo_total" },
] as const satisfies ReadonlyArray<{
  axis: DocumentationStatusAxis;
  done: keyof StatusAxisCounts;
  total: keyof StatusAxisCounts;
}>;

/**
 * The three evidence meters, in canonical axis order.
 *
 * One component serves both surfaces: Documentation renders it in place, and
 * Overview passes `linkFor` to turn each meter into a drill-in deep link. That
 * is the only difference between the two — a meter must not look or count
 * differently depending on which page you are reading it from.
 */
export function StatusAxisRollup({
  counts,
  linkFor,
}: {
  counts: StatusAxisCounts;
  linkFor?: (axis: DocumentationStatusAxis) => string;
}) {
  return (
    <div className="status-axis-rollup">
      {ROLLUP_AXES.map(({ axis, done, total }) => (
        <StatusAxisMeter
          key={axis}
          label={STATUS_AXIS_LABELS[axis].meter}
          done={counts[done]}
          total={counts[total]}
          to={linkFor?.(axis)}
        />
      ))}
    </div>
  );
}

function StatusAxisMeter({
  label,
  done,
  total,
  to,
}: {
  label: string;
  done: number;
  total: number;
  to?: string;
}) {
  // `total === 0` means nothing is tracked on this axis — not that the work is
  // done. Painting it as complete showed a full bar for a section with no
  // records at all, which reads as "finished" when it means "nothing here".
  const untracked = total === 0;
  const count = completeCountLabel(done, total);
  const body = (
    <>
      <span className="status-axis-meter-copy">
        <span className="status-axis-meter-label">{label}</span>{" "}
        <span className="status-axis-meter-count">{count}</span>
      </span>
      <ProgressBar
        className="status-axis-meter-track"
        value={untracked ? 0 : (done / total) * 100}
        label={untracked ? `${label} none tracked` : `${label} ${count}`}
      />
    </>
  );
  const state = {
    "data-untracked": untracked,
    "data-complete": !untracked && done >= total,
    "data-zero": !untracked && done === 0,
  };
  if (!to) {
    return (
      <span className="status-axis-meter" {...state}>
        {body}
      </span>
    );
  }
  return (
    <Link className="status-axis-meter status-axis-meter--link" to={to} {...state}>
      {body}
    </Link>
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
