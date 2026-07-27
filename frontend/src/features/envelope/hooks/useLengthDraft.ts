import { useCallback, useEffect, useRef, useState } from "react";
import { formatLengthFromMm, parseLengthToMm, useUnitPreference } from "../../../lib/units";
import type { UnitSystem } from "../../../lib/units";

// `formatLengthFromMm` spreads its options *over* its own default, so passing
// an explicit `undefined` would clobber that default rather than fall back to
// it. Only ever hand it the key when there is a value.
function formatDraft(valueMm: number, unitSystem: UnitSystem, fractionDigits?: number): string {
  return formatLengthFromMm(valueMm, {
    unitSystem,
    showUnit: false,
    useGrouping: false,
    ...(fractionDigits === undefined ? {} : { fractionDigits }),
  });
}

type LengthDraftOptions = {
  followUnitPreference?: boolean;
  unitLabelStyle?: "short" | "long";
  // Display precision, overriding the length default (SI 1dp / IP 2dp).
  // Sub-millimetre values need it: a 0.15 mm membrane renders as "0.1" at one
  // decimal, and committing the field would write that rounded number straight
  // back over the real one. Two primitives rather than an object so the values
  // stay referentially stable across renders and can be effect dependencies.
  fractionDigitsSI?: number;
  fractionDigitsIP?: number;
};

// Length dialogs capture the unit system when opened; mid-edit global IP/SI
// toggles do not rewrite the user's draft string.
export function useLengthDraft(initialValueMm: number | null, options: LengthDraftOptions = {}) {
  const { unitSystem } = useUnitPreference();
  const [editorUnitSystem] = useState(unitSystem);
  const activeUnitSystem = options.followUnitPreference ? unitSystem : editorUnitSystem;
  const previousUnitSystem = useRef<UnitSystem>(activeUnitSystem);
  const { fractionDigitsSI, fractionDigitsIP } = options;
  const format = useCallback(
    (valueMm: number, unitSystem: UnitSystem) =>
      formatDraft(valueMm, unitSystem, unitSystem === "IP" ? fractionDigitsIP : fractionDigitsSI),
    [fractionDigitsSI, fractionDigitsIP],
  );

  const [draft, setDraft] = useState(() =>
    initialValueMm === null ? "" : format(initialValueMm, activeUnitSystem),
  );
  const [error, setError] = useState<string | null>(null);
  // Whether the user has typed in this field, tracked explicitly rather than
  // inferred by comparing the draft to the current value. The value can change
  // underneath an open dialog — assigning a membrane snaps its layer thickness
  // server-side — and a comparison would then read as "edited" and write the
  // stale draft back, silently undoing the change that just happened.
  const [isTouched, setIsTouched] = useState(false);

  // Follow the value while it is still the app's to control. Without this the
  // field would keep displaying the pre-snap number after the same edit.
  //
  // Guarded on the value actually changing, not just on a re-render: a unit
  // toggle re-runs this too, and reformatting from `initialValueMm` here would
  // race the conversion effect below — that one reads the draft and converts it
  // from the previous system, so it would re-convert this effect's already-
  // converted output and land two conversions deep.
  const lastSyncedValue = useRef(initialValueMm);
  useEffect(() => {
    if (isTouched || lastSyncedValue.current === initialValueMm) return;
    lastSyncedValue.current = initialValueMm;
    setDraft(initialValueMm === null ? "" : format(initialValueMm, activeUnitSystem));
  }, [initialValueMm, isTouched, format, activeUnitSystem]);

  useEffect(() => {
    if (!options.followUnitPreference) return;
    const previous = previousUnitSystem.current;
    if (previous === activeUnitSystem) return;

    setDraft((currentDraft) => {
      if (currentDraft.trim() === "") return currentDraft;
      const parsed = parseLengthToMm(currentDraft, { unitSystem: previous });
      if (!parsed.ok) return currentDraft;
      return format(parsed.valueSi, activeUnitSystem);
    });
    previousUnitSystem.current = activeUnitSystem;
  }, [activeUnitSystem, options.followUnitPreference, format]);

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
    // Has the user actually typed here? Display precision is lossy by design,
    // so committing an untouched field can round a stored value down onto
    // itself. Callers that write on submit should check this first.
    isDirty: isTouched,
    parseOptional,
    parsePositive,
    setDraft: (value: string) => {
      setIsTouched(true);
      setDraft(value);
    },
    unitLabel:
      activeUnitSystem === "IP" && options.unitLabelStyle === "long"
        ? "inch"
        : activeUnitSystem === "IP"
          ? "in"
          : "mm",
  };
}
