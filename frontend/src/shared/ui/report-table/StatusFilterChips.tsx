import type { ReportStatusKey } from "./StatusPill";
import { StatusDot } from "./StatusPill";

export type StatusFilterValue<K extends string> = K | "all";

export type StatusFilterOption<K extends ReportStatusKey> = {
  value: StatusFilterValue<K>;
  label: string;
  count: number;
  status?: K;
};

export function StatusFilterChips<K extends ReportStatusKey>({
  options,
  value,
  onChange,
  summary,
}: {
  options: StatusFilterOption<K>[];
  value: StatusFilterValue<K>;
  onChange: (next: StatusFilterValue<K>) => void;
  summary?: string;
}) {
  return (
    <div className="report-status-filters">
      <div className="report-status-filters__chips">
        {options.map((option) => {
          const pressed = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              className="report-status-chip"
              aria-pressed={pressed}
              onClick={() => onChange(option.value)}
            >
              {option.status ? <StatusDot status={option.status} /> : null}
              <span>{option.label}</span>
              <span className="report-status-chip__count">{option.count}</span>
            </button>
          );
        })}
      </div>
      {summary ? <span className="report-status-filters__summary">{summary}</span> : null}
    </div>
  );
}
