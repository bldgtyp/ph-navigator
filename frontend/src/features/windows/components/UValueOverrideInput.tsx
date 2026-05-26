import { useEffect, useState } from "react";
import { formatNumber } from "../lib/formatters";

export function UValueOverrideInput({
  value,
  canEdit,
  isOverridden,
  onChange,
  ariaLabel,
}: {
  value: number | null;
  canEdit: boolean;
  isOverridden: boolean;
  onChange: (next: number | null) => void;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState(formatNumber(value));
  useEffect(() => {
    setDraft(formatNumber(value));
  }, [value]);
  return (
    <label className="window-slot-uvalue">
      <span>U-value (W/m²K)</span>
      <input
        type="number"
        step="0.001"
        min="0"
        aria-label={ariaLabel}
        value={draft}
        disabled={!canEdit}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const parsed = draft.trim() === "" ? null : Number.parseFloat(draft);
          const next = parsed !== null && Number.isFinite(parsed) ? parsed : null;
          if (next !== value) onChange(next);
        }}
      />
      {isOverridden ? <span className="override-badge">Override</span> : null}
    </label>
  );
}
