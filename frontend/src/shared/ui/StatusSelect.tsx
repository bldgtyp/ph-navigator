// Shared status pill-select — one control for every "documentation status"
// dropdown (Documentation spec/datasheet/photo, Envelope materials spec, ...).
// Renders a native <select> styled as a colored pill (or a read-only <span>
// pill), with the fill/text colour driven by the option's `tone` via the
// shared --report-status-* tokens. Keep new status dropdowns on this component
// so they stay visually identical across pages.

// The colour families a status can take. Each maps to a --report-status-*
// token (or the neutral --text-muted) in StatusSelect.css.
import type { SpecificationStatus } from "../../features/project_document/specification-status";

/** Status tones are the specification statuses plus an unset "neutral". */
export type StatusTone = SpecificationStatus | "neutral";

export type StatusSelectOption<TValue extends string> = {
  value: TValue;
  label: string;
  tone: StatusTone;
};

export function StatusSelect<TValue extends string>({
  value,
  options,
  ariaLabel,
  disabled = false,
  readOnly = false,
  onChange,
}: {
  value: TValue;
  options: ReadonlyArray<StatusSelectOption<TValue>>;
  ariaLabel: string;
  disabled?: boolean;
  readOnly?: boolean;
  onChange?: (value: TValue) => void;
}) {
  const selected = options.find((option) => option.value === value);
  const tone: StatusTone = selected?.tone ?? "neutral";
  if (readOnly) {
    // Plain display text — the visible label conveys the value, so no
    // aria-label (which would otherwise expose a spurious labelled control).
    return (
      <span className="status-select" data-tone={tone}>
        {selected?.label ?? value}
      </span>
    );
  }
  return (
    <select
      className="status-select"
      data-tone={tone}
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange?.(event.target.value as TValue)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
