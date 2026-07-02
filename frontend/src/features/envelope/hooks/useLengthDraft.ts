import { useEffect, useRef, useState } from "react";
import { formatLengthFromMm, parseLengthToMm, useUnitPreference } from "../../../lib/units";
import type { UnitSystem } from "../../../lib/units";

type LengthDraftOptions = {
  followUnitPreference?: boolean;
  unitLabelStyle?: "short" | "long";
};

// Length dialogs capture the unit system when opened; mid-edit global IP/SI
// toggles do not rewrite the user's draft string.
export function useLengthDraft(initialValueMm: number | null, options: LengthDraftOptions = {}) {
  const { unitSystem } = useUnitPreference();
  const [editorUnitSystem] = useState(unitSystem);
  const activeUnitSystem = options.followUnitPreference ? unitSystem : editorUnitSystem;
  const previousUnitSystem = useRef<UnitSystem>(activeUnitSystem);
  const [draft, setDraft] = useState(() =>
    initialValueMm === null
      ? ""
      : formatLengthFromMm(initialValueMm, {
          unitSystem: activeUnitSystem,
          showUnit: false,
          useGrouping: false,
        }),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!options.followUnitPreference) return;
    const previous = previousUnitSystem.current;
    if (previous === activeUnitSystem) return;

    setDraft((currentDraft) => {
      if (currentDraft.trim() === "") return currentDraft;
      const parsed = parseLengthToMm(currentDraft, { unitSystem: previous });
      if (!parsed.ok) return currentDraft;
      return formatLengthFromMm(parsed.valueSi, {
        unitSystem: activeUnitSystem,
        showUnit: false,
        useGrouping: false,
      });
    });
    previousUnitSystem.current = activeUnitSystem;
  }, [activeUnitSystem, options.followUnitPreference]);

  useEffect(() => setError(null), [draft]);

  function parsePositive(label: string): number | null {
    const parsed = parseLengthToMm(draft, { unitSystem: activeUnitSystem });
    if (!parsed.ok || parsed.valueSi <= 0) {
      setError(parsed.ok ? `${label} must be greater than zero.` : parsed.message);
      return null;
    }
    return parsed.valueSi;
  }

  function parseOptional(): number | null | undefined {
    if (draft.trim() === "") return null;
    const parsed = parseLengthToMm(draft, { unitSystem: activeUnitSystem });
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
    unitLabel:
      activeUnitSystem === "IP" && options.unitLabelStyle === "long"
        ? "inch"
        : activeUnitSystem === "IP"
          ? "in"
          : "mm",
  };
}
