import { useCallback, useEffect, useState } from "react";
import type { EnvelopeEditorDialogState } from "../components/EnvelopeEditorDialogs";

/**
 * Bundles the four pieces of dialog/picker/error state on EnvelopePage so
 * close handlers (`closeDialog`, `closeRefresh`) can reset them as a unit.
 */
export function useEnvelopeDialogs() {
  const [dialog, setDialog] = useState<EnvelopeEditorDialogState | null>(null);
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false);
  const [refreshMaterialId, setRefreshMaterialId] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);

  useEffect(() => {
    if (dialog?.kind !== "segment") setCatalogPickerOpen(false);
  }, [dialog]);

  const closeDialog = useCallback(() => {
    setDialog(null);
    setCatalogPickerOpen(false);
    setCommandError(null);
  }, []);

  const closeRefresh = useCallback(() => {
    setRefreshMaterialId(null);
    setCommandError(null);
  }, []);

  return {
    dialog,
    setDialog,
    catalogPickerOpen,
    setCatalogPickerOpen,
    refreshMaterialId,
    setRefreshMaterialId,
    commandError,
    setCommandError,
    closeDialog,
    closeRefresh,
  };
}
