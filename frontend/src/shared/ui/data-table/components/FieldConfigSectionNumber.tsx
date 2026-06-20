import { useId } from "react";
import {
  MAX_NUMBER_PRECISION,
  MIN_NUMBER_PRECISION,
  clampNumberPrecision,
} from "../lib/numberPrecision";

export type FieldConfigSectionNumberProps = {
  precision: number;
  onPrecisionChange: (precision: number) => void;
  disabled?: boolean;
  className?: string;
};

export function FieldConfigSectionNumber({
  precision,
  onPrecisionChange,
  disabled = false,
  className = "data-table-field-config-modal-section",
}: FieldConfigSectionNumberProps) {
  const precisionId = useId();
  return (
    <div className={className}>
      <label className="data-table-field-config-label" htmlFor={precisionId}>
        Decimal precision
      </label>
      <input
        id={precisionId}
        type="number"
        className="data-table-add-field-input"
        min={MIN_NUMBER_PRECISION}
        max={MAX_NUMBER_PRECISION}
        step={1}
        value={precision}
        disabled={disabled}
        onChange={(event) => onPrecisionChange(clampNumberPrecision(event.currentTarget.value))}
      />
    </div>
  );
}
