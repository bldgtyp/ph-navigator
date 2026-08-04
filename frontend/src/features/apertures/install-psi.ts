// Effective Ψ-install resolution — the frontend mirror of
// backend/features/project_document/apertures/install_psi.py, fed by the
// apertures slice (`aperture_install_types` summaries + each element's
// `installs` slots). Precedence per glazed-element side:
//
// 1. interior (mulled) side → Ψ = 0, source "mull" (stale slots ignored);
// 2. assigned slot → that library row's psi, source "assigned";
// 3. empty slot → the `apit_default` row, source "default".
//
// Dangling slot refs fall back to the Default; a type without a psi value
// resolves to 0 — both mirror the backend's degradation rungs. Display
// only: the backend resolver remains the authority everywhere it emits.

import { classifyElementEdges, edgeClassKey } from "./edge-classification";
import { APERTURE_SIDES, type ApertureInstallTypeSummary, type ApertureTypeEntry } from "./types";

export const APERTURE_INSTALL_DEFAULT_TYPE_ID = "apit_default";

export type InstallPsiSource = "mull" | "assigned" | "default";

export type ResolvedInstallPsi = {
  psiWmk: number;
  source: InstallPsiSource;
  installTypeId: string | null;
  installTypeName: string | null;
};

const MULL: ResolvedInstallPsi = {
  psiWmk: 0,
  source: "mull",
  installTypeId: null,
  installTypeName: null,
};

/**
 * Resolve every glazed-element side of one aperture, keyed
 * `${elementId}:${side}` (see {@link edgeClassKey}). Void elements carry
 * no install edges and are skipped.
 */
export function resolveInstallPsiForAperture(
  aperture: ApertureTypeEntry,
  installTypes: readonly ApertureInstallTypeSummary[],
): Map<string, ResolvedInstallPsi> {
  const typesById = new Map(installTypes.map((installType) => [installType.id, installType]));
  const defaultType = typesById.get(APERTURE_INSTALL_DEFAULT_TYPE_ID) ?? null;
  const classes = classifyElementEdges(aperture);

  const resolved = new Map<string, ResolvedInstallPsi>();
  for (const element of aperture.elements) {
    if (element.kind !== "glazed") continue;
    for (const side of APERTURE_SIDES) {
      const key = edgeClassKey(element.id, side);
      if (classes.get(key) === "interior") {
        resolved.set(key, MULL);
        continue;
      }
      const slot = element.installs[side];
      const assigned = slot !== null ? (typesById.get(slot) ?? null) : null;
      const source = assigned ?? defaultType;
      resolved.set(key, {
        psiWmk: source?.psi_w_mk ?? 0,
        source: assigned ? "assigned" : "default",
        installTypeId: source?.id ?? null,
        installTypeName: source?.name ?? null,
      });
    }
  }
  return resolved;
}
