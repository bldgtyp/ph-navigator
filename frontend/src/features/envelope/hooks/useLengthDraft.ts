import { useEffect, useState } from "react";
import { formatLengthFromMm, parseLengthToMm, useUnitPreference } from "../../../lib/units";

// Length dialogs capture the unit system when opened; mid-edit global IP/SI
// toggles do not rewrite the user's draft string.
export function useLengthDraft(initialValueMm: number | null) {
  const { unitSystem } = useUnitPreference();
  const [editorUnitSystem] = useState(unitSystem);
  const [draft, setDraft] = useState(() =>
    initialValueMm === null
      ? ""
      : formatLengthFromMm(initialValueMm, { unitSystem: editorUnitSystem, showUnit: false }),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setError(null), [draft]);

  function parsePositive(label: string): number | null {
    const parsed = parseLengthToMm(draft, { unitSystem: editorUnitSystem });
    if (!parsed.ok || parsed.valueSi <= 0) {
      setError(parsed.ok ? `${label} must be greater than zero.` : parsed.message);
      return null;
    }
    return parsed.valueSi;
  }

  function parseOptional(): number | null | undefined {
    if (draft.trim() === "") return null;
    const parsed = parseLengthToMm(draft, { unitSystem: editorUnitSystem });
    if (!parsed.ok) {
      setError(parsed.message);
      return undefined;
    }
    return parsed.valueSi;
  }

  return {
    draft,
    error,
    parseOptional,
    parsePositive,
    setDraft,
    unitLabel: editorUnitSystem === "IP" ? "in" : "mm",
  };
}
