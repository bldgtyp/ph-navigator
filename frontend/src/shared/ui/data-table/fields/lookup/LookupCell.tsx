import { formatClipboardValue } from "../../lib/paste/tsv";

export type LookupCellProps = {
  value: unknown;
  emptyLabel?: string;
};

export function LookupCell({ value, emptyLabel = "Empty" }: LookupCellProps) {
  const values = lookupDisplayValues(value);
  if (values.length === 0) return <span className="muted-cell">{emptyLabel}</span>;
  return (
    <span className="data-table-lookup-cell">
      {values.map((label) => (
        <span key={label} className="data-table-lookup-pill" title={label}>
          <span className="data-table-lookup-pill-label">{label}</span>
        </span>
      ))}
    </span>
  );
}

function lookupDisplayValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map(formatLookupValue).filter((entry) => entry.length > 0))];
  }
  const formatted = formatLookupValue(value);
  return formatted ? [formatted] : [];
}

function formatLookupValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  return formatClipboardValue(value).trim();
}
