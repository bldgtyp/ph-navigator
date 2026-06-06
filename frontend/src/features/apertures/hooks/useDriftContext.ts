// Phase 12 — share the drift report + the open-dialog callback with
// the cards / rows / badges without prop-drilling. The provider lives
// in ``AperturesTab`` (it owns the drift query + the dialog state).

import { createContext, useContext, useMemo } from "react";
import type { ApertureDriftEntry, DriftTarget } from "../drift-types";

export type DriftContextValue = {
  entries: ApertureDriftEntry[];
  onOpenRefresh: (entry: ApertureDriftEntry) => void;
};

const DriftContext = createContext<DriftContextValue | undefined>(undefined);

export const DriftProvider = DriftContext.Provider;

// Look up the drift entry, if any, for one (element_id, target) pair.
// Returns ``null`` when the slot is current — the badge stays hidden.
export function useDriftEntry(elementId: string, target: DriftTarget): ApertureDriftEntry | null {
  const ctx = useContext(DriftContext);
  if (!ctx) return null;
  return ctx.entries.find((e) => e.element_id === elementId && e.target === target) ?? null;
}

export function useOpenRefreshDialog(): ((entry: ApertureDriftEntry) => void) | undefined {
  return useContext(DriftContext)?.onOpenRefresh;
}

// Convenience: how many entries are drifted on the active aperture
// (used by the BuilderDriftBanner).
export function useApertureDriftEntries(apertureTypeId: string | null): ApertureDriftEntry[] {
  const ctx = useContext(DriftContext);
  return useMemo(
    () =>
      ctx && apertureTypeId ? ctx.entries.filter((e) => e.aperture_type_id === apertureTypeId) : [],
    [ctx, apertureTypeId],
  );
}
