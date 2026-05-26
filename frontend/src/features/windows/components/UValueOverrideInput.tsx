import { useEffect, useState } from "react";
import { formatUValueFromWm2K, parseUValueToWm2K, useUnitPreference } from "../../../lib/units";

function uValueLabel(unitSystem: "SI" | "IP"): string {
  return unitSystem === "IP" ? "Btu/(h-ft2-F)" : "W/m2-K";
}

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
  const { unitSystem } = useUnitPreference();
  const [draft, setDraft] = useState(
    formatUValueFromWm2K(value, { unitSystem, showUnit: false, empty: "" }),
  );
  useEffect(() => {
    setDraft(formatUValueFromWm2K(value, { unitSystem, showUnit: false, empty: "" }));
  }, [value, unitSystem]);
  return (
    <label className="window-slot-uvalue">
      <span>U-value ({uValueLabel(unitSystem)})</span>
      <input
        type="text"
        inputMode="decimal"
        step="0.001"
        min="0"
        aria-label={ariaLabel}
        value={draft}
        disabled={!canEdit}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const parsed =
            draft.trim() === "" ? null : parseUValueToWm2K(draft, { unitSystem, showUnit: false });
          const next = parsed === null ? null : parsed.ok ? parsed.valueSi : null;
          if (next !== value) onChange(next);
        }}
      />
      {isOverridden ? <span className="override-badge">Override</span> : null}
    </label>
  );
}
