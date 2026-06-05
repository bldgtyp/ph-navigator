// Click-to-edit lifecycle for a single dimension label.
//
// Two responsibilities:
//   1) Track the draft string while the user types; commit on Enter/blur,
//      cancel on Escape; surface a parse error for the field's red border.
//   2) **Precision preservation:** when the user types a value that
//      round-trips to the same mm as the stored value (within < 0.5 mm),
//      commit the *original* mm rather than the parsed one. This keeps
//      catalog-derived values like `305.5625` from being silently
//      rewritten to `305.5` after a no-op edit.

import { useCallback, useEffect, useRef, useState } from "react";
import { formatValueForDisplay } from "../../../lib/units/length/displayUnitConverter";
import { parseToMm } from "../../../lib/units/length/parseInput";
import type { DisplayFormat, UnitSystem } from "../../../lib/units/length/types";

export type DimensionDraftCommit =
  | { ok: true; mm: number; preserved: boolean }
  | { ok: false; message: string };

const PARSE_ERROR_TIP = "Couldn't parse this — try 1200, 1' 6\", 1200 / 4, or 1.2 m.";
const PRECISION_TOLERANCE_MM = 0.5;

export type UseDimensionDraftArgs = {
  initialMm: number;
  system: UnitSystem;
  format: DisplayFormat;
};

export type UseDimensionDraftResult = {
  editing: boolean;
  draft: string;
  error: string | null;
  display: string;
  setDraft: (next: string) => void;
  startEditing: () => void;
  commit: () => DimensionDraftCommit;
  cancel: () => void;
};

export function useDimensionDraft({
  initialMm,
  system,
  format,
}: UseDimensionDraftArgs): UseDimensionDraftResult {
  const display = formatValueForDisplay(initialMm, format);
  const initialMmRef = useRef(initialMm);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(display);
  const [error, setError] = useState<string | null>(null);

  // Keep the draft in sync with the canonical mm when the user is not
  // editing — e.g. when a different format selector swaps the display.
  useEffect(() => {
    if (editing) return;
    setDraft(display);
  }, [display, editing]);

  const startEditing = useCallback(() => {
    initialMmRef.current = initialMm;
    setDraft(formatValueForDisplay(initialMm, format));
    setError(null);
    setEditing(true);
  }, [format, initialMm]);

  const commit = useCallback((): DimensionDraftCommit => {
    const parsed = parseToMm(draft, system, format);
    if (parsed === null) {
      setError(PARSE_ERROR_TIP);
      return { ok: false, message: PARSE_ERROR_TIP };
    }
    setEditing(false);
    setError(null);
    if (Math.abs(parsed - initialMmRef.current) < PRECISION_TOLERANCE_MM) {
      return { ok: true, mm: initialMmRef.current, preserved: true };
    }
    return { ok: true, mm: parsed, preserved: false };
  }, [draft, format, system]);

  const cancel = useCallback(() => {
    setDraft(formatValueForDisplay(initialMmRef.current, format));
    setError(null);
    setEditing(false);
  }, [format]);

  return {
    editing,
    draft,
    error,
    display,
    setDraft,
    startEditing,
    commit,
    cancel,
  };
}
