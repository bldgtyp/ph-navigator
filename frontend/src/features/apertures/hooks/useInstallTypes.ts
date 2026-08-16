// Install-type library summaries for the active project, provided at the
// AperturesTab level (same pattern as ManufacturerFilterProvider /
// DriftProvider) so deep consumers don't thread props through the
// size-capped canvas container. `useInstallPsiResolution` owns the
// per-aperture effective-Ψ derivation so every consumer shares one memo
// shape instead of importing the resolver themselves.
import { createContext, useContext, useMemo } from "react";
import { resolveInstallPsiForAperture, type ResolvedInstallPsi } from "../install-psi";
import type { ApertureInstallTypeSummary, ApertureTypeEntry } from "../types";

const InstallTypesContext = createContext<readonly ApertureInstallTypeSummary[]>([]);

export const InstallTypesProvider = InstallTypesContext.Provider;

export function useInstallTypeSummaries(): readonly ApertureInstallTypeSummary[] {
  return useContext(InstallTypesContext);
}

/** Effective Ψ-install per glazed-element side of one aperture, keyed by
 *  `edgeClassKey(elementId, side)`. */
export function useInstallPsiResolution(
  aperture: ApertureTypeEntry,
): Map<string, ResolvedInstallPsi> {
  const installTypes = useInstallTypeSummaries();
  return useMemo(
    () => resolveInstallPsiForAperture(aperture, installTypes),
    [aperture, installTypes],
  );
}
