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
  // Whether the user has typed here, tracked explicitly rather than inferred by
  // comparing the draft to the value. Display precision is lossy by design, so
  // a comparison would read an untouched rounded field as edited.
  //
  // This hook does not follow `initialValueMm` when it changes. That is
  // deliberate: a draft is a snapshot the user is working on, and chasing the
  // value from in here would race the unit-conversion effect below, which reads
  // the draft and converts it from the previous system — the follower's own
  // output would be converted a second time. A caller whose value really can
  // move underneath it should remount the field with a React `key`, which
  // re-runs the initialiser above and needs no effect at all.
  const [isTouched, setIsTouched] = useState(false);

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
