import { useState } from "react";
import { useUnitPreference } from "../../../lib/units/useUnitPreference";
import { errorMessage } from "../../../shared/lib/errors";
import { useEnvelopePhppExportMutation, useEnvelopePhppPreflightMutation } from "../hooks";
import { confirmDraftExport } from "../routes/page-helpers";
import type { EnvelopeReadResponse, PhppPreflightItem } from "../types";

const EXPORT_ERROR = "Could not export PHPP U-Values.";

/**
 * Drives "Download in PHPP format": warn if a draft exists, preflight the saved
 * version, and — when some assemblies can't be represented — hold the blocked
 * list until the user confirms or cancels before streaming the ZIP (PRD §9).
 * Mirrors `useEnvelopeHbjsonImport`: the page consumes it as an opaque
 * controller and renders the dialog from `blocked`.
 */
export function useEnvelopePhppExport(projectId: string, versionId: string | null) {
  const { unitSystem } = useUnitPreference();
  const preflightMutation = useEnvelopePhppPreflightMutation(projectId, versionId);
  const exportMutation = useEnvelopePhppExportMutation(projectId, versionId);
  const [blocked, setBlocked] = useState<PhppPreflightItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(): Promise<void> {
    await exportMutation.mutateAsync(unitSystem);
    setBlocked(null);
  }

  async function start(current: EnvelopeReadResponse | undefined): Promise<void> {
    if (!current) return;
    if (!confirmDraftExport(current, "Download in PHPP format")) return;
    setError(null);
    try {
      const preflight = await preflightMutation.mutateAsync();
      const blockedAssemblies = preflight.assemblies.filter((assembly) => !assembly.exportable);
      if (blockedAssemblies.length > 0) {
        // Confirm before exporting; blocked assemblies become error CSVs in the
        // ZIP rather than silently missing (PRD §9).
        setBlocked(blockedAssemblies);
        return;
      }
      await download();
    } catch (caught) {
      setError(errorMessage(caught, EXPORT_ERROR));
    }
  }

  async function confirm(): Promise<void> {
    setError(null);
    try {
      await download();
    } catch (caught) {
      setError(errorMessage(caught, EXPORT_ERROR));
    }
  }

  function reset(): void {
    setBlocked(null);
    setError(null);
  }

  return {
    start,
    confirm,
    reset,
    blocked,
    error,
    busy: preflightMutation.isPending || exportMutation.isPending,
  };
}
